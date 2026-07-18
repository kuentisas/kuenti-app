# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este proyecto

Kuenti: control de horas para una firma de servicios contables/administrativos en Colombia. Las colaboradoras registran tiempo por cliente/actividad con un timer; admins y supervisores gestionan clientes, equipo, aprobaciones y (solo admin) rentabilidad y salarios.

## Stack

- Next.js 14 (App Router) + React 18 + TypeScript, desplegado en Vercel.
- Supabase: Postgres + Auth + Realtime. `@supabase/ssr` en Server Components/Server Actions (`src/lib/supabase/server.ts`), `@supabase/supabase-js` cliente puro donde aplica (`src/lib/supabase/client.ts`, `src/lib/supabase/admin.ts` para el cliente `service_role`).
- Tailwind CSS + shadcn/ui (primitivas Radix) en `src/components/ui`.
- Toda la lógica de negocio sensible vive en Postgres (RLS, triggers, funciones `security definer`), no en el backend de Next — Next es mayormente una capa fina sobre Supabase.

## Comandos

- `npm run dev` / `npm run build` / `npm run lint`
- `npx tsc --noEmit` — typecheck (usarlo antes de dar por buena cualquier edición)
- No hay suite de tests automatizada en el repo (sin Jest/Vitest/Playwright configurado). La verificación se hace corriendo scripts Node ad-hoc contra la base de Supabase real (`@supabase/supabase-js`, con usuarios y datos 100% temporales creados y destruidos en la misma corrida, nunca contra datos reales), ejercitando RLS/RPCs igual que la app en producción. No asumir que existe `npm test`.
- Migraciones: `supabase/migrations/*.sql`, numeradas secuencialmente (van por `0025` al momento de escribir esto). No hay Supabase CLI linkeado en este entorno (sin `supabase/config.toml`) — se aplican con un script Node temporal que usa `pg` contra `SUPABASE_DB_URL` (ver `.env.local`), o pegándolas en el SQL Editor del dashboard. Nunca editar una migración ya aplicada; siempre agregar una nueva con el siguiente número.
- Deploy: Vercel conectado a GitHub (`kuentisas/kuenti-app`, rama `main`) — push a `main` dispara deploy automático a producción. **No hay entorno de staging**: cualquier push a `main` es directo a producción real. `vercel --prod` manual sigue disponible como respaldo si el Git Integration fallara.

## Decisiones de diseño importantes

### Roles y autorización — tres capas independientes

Tres roles en `users.role`: `admin`, `supervisor`, `colaboradora`.
- **admin**: todo, incluido lo financiero (`client_rates`, `user_salaries`, `app_settings`) y eliminar usuarios/cambiar roles.
- **supervisor**: "admin operativo sin visibilidad financiera" — gestiona clientes, actividades, aprobaciones y equipo, pero **nunca** se agrega a las policies de `client_rates`/`user_salaries`/`app_settings` (siguen exclusivas de `is_admin()`), y no puede eliminar usuarios ni cambiar el rol de nadie (ni el propio).
- **colaboradora**: solo lo suyo — sus clientes asignados, sus `time_entries`.

Autorización en 3 capas, cada una independiente de las otras (verificado explícitamente con pruebas de escalamiento de privilegios):
1. **RLS en Postgres** — la capa real. `is_admin()` vs `is_admin_or_supervisor()` son funciones SQL separadas a propósito; nunca mezclar.
2. **`requireRole()`** (`src/lib/require-role.ts`) — obligatorio en cualquier server action que use el cliente `service_role` (bypasea RLS por completo), porque ahí la única defensa vive en el código de la action.
3. **Middleware** (`src/middleware.ts`) — redirige por rol a `/admin` o `/panel`. Es UX, no seguridad; no confiar en él para proteger datos.

Defensa en profundidad explícita: el trigger `prevent_role_change_by_non_admin` en `users` bloquea cualquier cambio de rol que no venga de un admin, **incluso si la policy RLS de UPDATE ya lo permitiría** (un supervisor pasa esa policy pero el trigger lo frena igual).

### Zona horaria — Bogotá fija (UTC-5, sin DST)

El servidor (Vercel) y Postgres corren en UTC; la app entera opera en hora de Bogotá. Ya hubo bugs reales por esta discrepancia (actividades eventuales desapareciendo horas antes de medianoche real de Bogotá).

- TypeScript: usar siempre los helpers de `src/lib/dates.ts` (`BOGOTA_TZ`, `bogotaDateKey`, `bogotaMonthKey`, `startOfBogotaMonth`/`endOfBogotaMonth`, `bogotaDatetimeLocalToISOString`, `bogotaDatetimeLocal`). Nunca `new Date()` crudo ni getters locales (`getHours()`, `getMonth()`, etc.) para decidir "hoy"/"este mes"/cortes de mes. En componentes `"use client"` que formatean fechas para mostrar, pasar siempre `timeZone: BOGOTA_TZ` explícito a `toLocaleString`/`toLocaleDateString`/`toLocaleTimeString` — no asumir que el reloj del dispositivo está en hora Bogotá.
- SQL: nunca `date_trunc('month', now())` a secas para "mes actual" — siempre `date_trunc('month', now() AT TIME ZONE 'America/Bogota')`.
- Se hizo una auditoría exhaustiva de esto (2026-07-17, ver historial de commits) cubriendo todo el código SQL y TypeScript; los hallazgos ya quedaron corregidos.

### Timers (`time_entries`) — invariantes garantizados por la base, no por la app

Un solo timer activo por usuario, y un solo timer activo por actividad (cualquier usuario) — ambos garantizados por **índices únicos parciales** (`... where end_time is null`), no solo por chequeos en las funciones. Esto cierra condiciones de carrera reales, verificado con llamadas concurrentes de verdad contra la base.

`start_activity()`, `stop_activity()`, `resolve_stale_timer()` (RPCs `security definer`) son el único camino soportado para tocar timers — evitar INSERT/UPDATE directo a `time_entries` en código nuevo. Auto-cierre de seguridad vía `pg_cron` (cada 15 min) cierra timers activos hace más de 12h.

`sincronizado_offline` y `tiene_conflicto` son infraestructura para un modo offline "real" (cola/sync entre dispositivos) que **hoy no se usa** — la UI actual solo deshabilita los botones de Iniciar/Detener cuando `navigator.onLine` es `false`; no hay cola que reproducir al reconectar. No asumir que existe sync offline real sin verificarlo.

### Actividades: recurrentes vs. eventuales

`tipo = 'recurrente'` está siempre disponible si `activo` y aprobada. `tipo = 'eventual'` solo es utilizable en su `mes_aplicable` (mes calendario en Bogotá) — verificado en los 3 bordes (mes anterior/actual/siguiente) tanto vía RPC como vía INSERT directo a `time_entries`.

Las eventuales sugeridas por colaboradoras quedan **aprobadas automáticamente** (ya no pasan por revisión de admin, a diferencia de una fase anterior del proyecto). El trigger `set_activity_approval_defaults` fuerza server-side `estado_aprobacion`, `sugerida_por` y `mes_aplicable` para actores no-admin — nunca confía en lo que mande el cliente.

### Correcciones de tiempo (`activity_corrections`) — estas sí requieren aprobación

A diferencia de las actividades eventuales, una corrección solicitada por una colaboradora sí necesita aprobación explícita de admin/supervisor vía `approve_correction()`/`reject_correction()` (RPCs `security definer`). No hay policy de UPDATE en la tabla — esas dos funciones son el único camino para cambiar su estado. `hora_fin_original` se captura por trigger al crear la solicitud (antes de que `approve_correction` sobreescriba `time_entries.end_time`), para poder auditar qué cambió realmente. `visto_por_solicitante` + `mark_corrections_seen()` le muestran a la colaboradora un badge cuando su corrección se resuelve.

### Financiero (`client_rates`, `user_salaries`, `app_settings`)

Aisladas en tablas separadas de `clients`/`users` a propósito, con RLS admin-only sin excepción: admin y colaboradora comparten el mismo rol de Postgres (`authenticated`), así que RLS no puede ocultar columnas dentro de una fila que su propio dueño puede leer — de ahí la separación de tablas.

Rentabilidad (`/admin/rentabilidad`) usa `costo_hora_promedio` (`app_settings`) como fallback cuando una colaboradora no tiene salario cargado (badge "estimado"/"parcial" indica cuándo se usó). Sin caché de totales en ningún lado: todo se recalcula desde `time_entries.duration_seconds` (columna generada) en cada carga, así que correcciones/ajustes aprobados se reflejan de inmediato.

## Estado del proyecto (2026-07-17)

**Completo y en producción:** timer con bloqueo cruzado y recuperación de timers huérfanos, corrección de horas con aprobación y auditoría de detalle, actividades recurrentes/eventuales sin aprobación, rol supervisor, ajustes manuales con distinción visual de origen (autoajuste vs. aprobado por admin), badge de correcciones resueltas para la colaboradora, rentabilidad con manejo de casos límite (sin tarifa, sin salario, sin actividad este mes). Se completó una auditoría exhaustiva pre-producción (zona horaria, timers, permisos, integridad financiera) con pruebas reales contra Supabase; los hallazgos técnicos quedaron corregidos.

**Pendiente / decisiones de producto sin resolver todavía:**
- Modo offline real (cola/sync entre dispositivos) — la infraestructura de base de datos existe (`sincronizado_offline`, `tiene_conflicto`) pero no se usa; hoy solo se deshabilitan botones mientras `navigator.onLine` es falso.
