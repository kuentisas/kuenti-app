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
- No hay suite de tests automatizada en el repo (sin Jest/Vitest/Playwright configurado de forma permanente). La verificación se hace corriendo scripts Node ad-hoc contra la base de Supabase real (`@supabase/supabase-js`, con usuarios y datos 100% temporales creados y destruidos en la misma corrida, nunca contra datos reales), ejercitando RLS/RPCs igual que la app en producción. Para verificación visual/responsive, Playwright se instala temporalmente (`npm install -D playwright`, `npx playwright install chromium`) y se desinstala al terminar — no asumir que existe `npm test` ni que Playwright queda instalado entre sesiones.
- Migraciones: `supabase/migrations/*.sql`, numeradas secuencialmente (van por `0026` al momento de escribir esto). No hay Supabase CLI linkeado en este entorno (sin `supabase/config.toml`) — se aplican con un script Node temporal que usa `pg` contra `SUPABASE_DB_URL` (ver `.env.local`), o pegándolas en el SQL Editor del dashboard. Nunca editar una migración ya aplicada; siempre agregar una nueva con el siguiente número.
- Deploy: Vercel conectado a GitHub (`kuentisas/kuenti-app`, rama `main`) — push a `main` dispara deploy automático a producción. **No hay entorno de staging**: cualquier push a `main` es directo a producción real. `vercel --prod` manual sigue disponible como respaldo si el Git Integration fallara.

## Decisiones de diseño importantes

### Roles y autorización — tres capas independientes

Tres roles en `users.role`: `admin`, `supervisor`, `colaboradora`.
- **admin**: todo, incluido lo financiero (`client_rate_history`, `user_salary_history`, `app_settings`) y eliminar usuarios/cambiar roles.
- **supervisor**: "admin operativo sin visibilidad financiera" — gestiona clientes, actividades, aprobaciones y equipo, pero **nunca** se agrega a las policies financieras (siguen exclusivas de `is_admin()`), y no puede eliminar usuarios ni cambiar el rol de nadie (ni el propio).
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
- Se hizo una auditoría exhaustiva de esto (2026-07-17) cubriendo todo el código SQL y TypeScript; los hallazgos ya quedaron corregidos.

### Timers (`time_entries`) — invariantes garantizados por la base, no por la app

Un solo timer activo por usuario, y un solo timer activo por actividad (cualquier usuario) — ambos garantizados por **índices únicos parciales** (`... where end_time is null`), no solo por chequeos en las funciones. Esto cierra condiciones de carrera reales, verificado con llamadas concurrentes de verdad contra la base.

`start_activity()`, `stop_activity()`, `resolve_stale_timer()` (RPCs `security definer`) son el único camino soportado para tocar timers — evitar INSERT/UPDATE directo a `time_entries` en código nuevo. Auto-cierre de seguridad vía `pg_cron` (cada 15 min) cierra timers activos hace más de 12h.

### Actividades: recurrentes vs. eventuales

`tipo = 'recurrente'` está siempre disponible si `activo` y aprobada. `tipo = 'eventual'` solo es utilizable en su `mes_aplicable` (mes calendario en Bogotá) — verificado en los 3 bordes (mes anterior/actual/siguiente) tanto vía RPC como vía INSERT directo a `time_entries`.

Las eventuales sugeridas por colaboradoras quedan **aprobadas automáticamente** (ya no pasan por revisión de admin, a diferencia de una fase anterior del proyecto). El trigger `set_activity_approval_defaults` fuerza server-side `estado_aprobacion`, `sugerida_por` y, desde la corrección de auditoría, también `mes_aplicable` (siempre el mes actual en Bogotá) para actores no-admin — nunca confía en lo que mande el cliente.

### Correcciones de tiempo (`activity_corrections`) — estas sí requieren aprobación

A diferencia de las actividades eventuales, una corrección solicitada por una colaboradora sí necesita aprobación explícita de admin/supervisor vía `approve_correction()`/`reject_correction()` (RPCs `security definer`). No hay policy de UPDATE en la tabla — esas dos funciones son el único camino para cambiar su estado. `hora_fin_original` se captura por trigger al crear la solicitud (antes de que `approve_correction` sobreescriba `time_entries.end_time`), para poder auditar qué cambió realmente. `visto_por_solicitante` + `mark_corrections_seen()` le muestran a la colaboradora un badge cuando su corrección se resuelve.

### Financiero — historial de vigencia (`client_rate_history`, `user_salary_history`, `app_settings`)

Aisladas de `clients`/`users` a propósito, con RLS `SELECT`-only para `is_admin()` (sin excepción para supervisor): admin y colaboradora comparten el mismo rol de Postgres (`authenticated`), así que RLS no puede ocultar columnas dentro de una fila que su propio dueño puede leer — de ahí la separación de tablas.

**No son tablas de "valor actual"** — son historiales append-only. `client_rates`/`user_salaries` (una sola fila por entidad, sin fecha de vigencia) existieron en una fase anterior y se **reemplazaron** (migración `0026`) porque subir una tarifa o un salario HOY distorsionaba retroactivamente la rentabilidad de meses ya cerrados. Cada fila de `client_rate_history`/`user_salary_history` tiene un `vigente_desde` (primer día de mes); el valor vigente en un mes es siempre la fila con `vigente_desde` más reciente que no sea posterior a ese mes — no hay `vigente_hasta`, así que corregir un mes corrige también los meses posteriores que no tuvieran su propio cambio explícito, hasta el próximo cambio real (intencional, no un bug).

Reglas de negocio:
- **Cambio normal** (`set_client_tarifa`/`set_user_salario`): el primer valor de una entidad aplica desde el mes actual; cualquier cambio posterior aplica desde el mes **siguiente**, nunca a mitad del mes en curso.
- **Corrección retroactiva** (`correct_client_tarifa_historico`/`correct_user_salario_historico`): acción separada y explícita en la UI (nunca el comportamiento por defecto), exclusiva de `admin` (nunca supervisor), y nunca aplicable a un mes futuro.
- Ambos caminos son RPCs `security definer` — las tablas no tienen policy de insert/update, mismo criterio que `activity_corrections`.

Rentabilidad (`/admin/rentabilidad`) usa `costo_hora_promedio` (`app_settings`) como fallback cuando una colaboradora no tiene salario vigente ese mes (badge "estimado"/"parcial" indica cuándo se usó). Sin caché de totales en ningún lado: todo se recalcula desde `time_entries.duration_seconds` (columna generada) + el historial vigente en cada carga, así que correcciones/ajustes aprobados se reflejan de inmediato. Helper compartido: `src/lib/vigencia.ts` (`vigenteEnMes`, `masReciente`, `estaVigente`, `formatMesVigencia`).

### Modo offline — versión simple implementada; versión "completa" NO existe todavía

Lo que hay hoy: `navigator.onLine` controla un banner + deshabilita los botones de Iniciar/Detener mientras está en `false`. El contador visual de un timer ya activo sigue corriendo (matemática local `Date.now() - startTime`, no depende de red). **No hay ninguna cola de acciones ni sincronización** — como los botones quedan deshabilitados, no hay nada que encolar; al reconectar, los botones simplemente se vuelven a habilitar.

Lo que **no** existe (y no se debe asumir que existe): un modo offline "completo" permitiría iniciar/detener timers sin conexión, guardando esas acciones en algo persistente en el dispositivo (ej. IndexedDB) y sincronizándolas con Supabase al reconectar, con detección de conflictos si el mismo timer se tocó desde dos dispositivos. Esto requeriría una cola de sincronización real en el cliente (Service Worker o similar) — no es un cambio menor.

El esquema ya tiene infraestructura pensada para ese escenario más ambicioso, pero sin usar: `time_entries.sincronizado_offline` (default `true`, ninguna fila real tiene `false` porque `start_activity()` siempre inserta con `true`) y `time_entries.tiene_conflicto` (para marcar solapamientos entre timers creados offline por distintos dispositivos). Las policies de RLS incluso tienen una rama para `sincronizado_offline = false`, pero ningún código de la UI la alcanza hoy.

**Esto queda como fase futura posible, no comprometida** — solo vale la pena construirla si el equipo reporta en la práctica que la falta de conexión es un problema recurrente (zonas con mala señal, etc.). Mientras tanto, no remover estas columnas ni asumir que ya hay sync real.

### Responsive / móvil

La navegación no usa menú hamburguesa: el sidebar de escritorio (`<aside>`) se oculta en móvil (`hidden md:flex`, breakpoint `md` = 768px) y se reemplaza por una barra de tabs inferior fija (`app-shell.tsx`). El botón de cerrar sesión vive en ambos: en el sidebar como botón normal, y en la barra inferior como último ítem (`mobileLabel`/`LogOut`) — antes de una auditoría responsive, solo existía en el sidebar y no había forma de cerrar sesión desde el celular.

Gotcha de CSS a tener en cuenta: por default, un ítem flex/grid no se encoge por debajo del ancho intrínseco de su contenido (`min-width: auto`). Sin `min-width: 0`, un hijo ancho (una tabla, una grilla de tarjetas) estira toda la cadena de contenedores en vez de activar su propio scroll interno — bug real que causaba desborde horizontal en casi toda la app en móvil. Mitigado con `min-w-0` explícito en la cadena de `app-shell.tsx` **y** una regla global de seguridad en `globals.css` (`.flex, .grid { min-width: 0 }`). Si se agrega un nuevo layout con contenido ancho (tablas, grillas) dentro de una cadena flex/grid, verificar que esto siga aplicando.

Los ítems de la barra inferior usan `mobileLabel` (opcional, en `NavItem`) cuando la etiqueta completa no entra en 375px sin superponerse a la del vecino (son palabras sueltas, no hacen wrap) — el sidebar de escritorio siempre usa `label` completo.

## Estado general del proyecto Kuenti (más allá de esta app)

**Este repositorio (`kuenti-app`) es solo la pieza de control de horas dentro de un proyecto más grande — no asumir que es todo lo que existe.** Contexto de infraestructura reportado por el usuario (no verificado desde este repo, salvo donde se indica):

- **Meta Business Manager**: creado, en proceso de verificación de empresa (pendiente de que Meta la apruebe).
- **WhatsApp Business**: número ya registrado, pendiente de conectarlo vía Embedded Signup con Coexistence (permite seguir usando la app normal de WhatsApp Business junto con la API, en vez de migrar por completo).
- **Atención al cliente / chat**: decisión tomada de usar **Chatwoot self-hosted** (no la versión cloud de Chatwoot), corriendo en un VPS de Hetzner — el VPS todavía **no está aprovisionado**.
- **kuenti.co**: dominio ya en producción, sirviendo por ahora una página "coming soon" en Vercel — probablemente un proyecto de Vercel separado de `kuenti-app`, no confirmado desde este repo.
- **GitHub**: el proyecto vive bajo la cuenta/organización `kuentisas`, separada de la cuenta personal `armogas` del usuario. Ambas cuentas tienen su propia llave SSH configuradas en esta máquina — confirmado en `~/.ssh/config`, hosts `github-kuenti` (usa `~/.ssh/id_kuenti`) y `github-armogas` (usa `~/.ssh/id_armogas`). El remote de este repo usa el alias `github-kuenti`.
- **DNS**: Cloudflare gestiona el DNS de `kuenti.co`. Correo corporativo vía Zoho Mail, con SPF/DKIM/DMARC ya configurados.

Si una tarea futura toca WhatsApp, Chatwoot, el dominio kuenti.co, o el correo corporativo, es probable que involucre otro repositorio/servicio, no este.

## Estado del proyecto (2026-07-23)

**Completo y en producción:** timer con bloqueo cruzado y recuperación de timers huérfanos, corrección de horas con aprobación y auditoría de detalle, actividades recurrentes/eventuales sin aprobación, rol supervisor, ajustes manuales con distinción visual de origen (autoajuste vs. aprobado por admin), badge de correcciones resueltas para la colaboradora, rentabilidad con manejo de casos límite (sin tarifa, sin salario, sin actividad este mes) e historial de vigencia real para tarifas/salarios, carga masiva de actividades por línea (soporta pegar una columna de Excel), fixes de responsive móvil (375px–768px verificado). Se completó una auditoría exhaustiva pre-producción (zona horaria, timers, permisos, integridad financiera) con pruebas reales contra Supabase; los hallazgos técnicos quedaron corregidos.

**En curso:** carga de clientes y actividades reales a producción (la base de prueba ya se limpió por completo — solo queda el admin real).

**Pendiente / decisiones de producto sin resolver todavía:**
- Modo offline completo (cola de sincronización real) — ver sección de arriba. No construir sin que el equipo confirme que es un problema recurrente en la práctica.
