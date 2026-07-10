-- RLS nuevas/actualizadas para activities, time_entries (insert extendido),
-- activity_corrections, user_salaries y client_rates.

-- ---------------------------------------------------------------------------
-- activities (las policies de "processes" siguen adjuntas al OID de la
-- tabla tras el rename, pero su lógica debe actualizarse)
-- ---------------------------------------------------------------------------
drop policy "processes_select_admin_or_assigned" on public.activities;
create policy "activities_select_admin_or_scoped"
  on public.activities for select
  using (
    public.is_admin()
    or (
      public.is_assigned_to_client(client_id)
      and estado_aprobacion = 'aprobada'
      and activo
      and (tipo = 'recurrente' or mes_aplicable = date_trunc('month', now())::date)
    )
    or sugerida_por = auth.uid()
  );

drop policy "processes_insert_admin" on public.activities;
create policy "activities_insert_admin_or_suggestion"
  on public.activities for insert
  with check (
    public.is_admin()
    or (
      tipo = 'eventual'
      and public.is_assigned_to_client(client_id)
      and sugerida_por = auth.uid()
      and estado_aprobacion = 'pendiente'
      and mes_aplicable is not null
    )
  );

drop policy "processes_update_admin" on public.activities;
create policy "activities_update_admin"
  on public.activities for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy "processes_delete_admin" on public.activities;
create policy "activities_delete_admin"
  on public.activities for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- time_entries: extiende el insert para permitir sync offline. Un registro
-- offline ya terminó (end_time presente) y no revalida que la actividad
-- siga vigente hoy — el trabajo ya se hizo, nunca se pierden horas
-- trabajadas; detect_offline_conflict (0009) marca tiene_conflicto si hay
-- solapamiento real para que el admin lo revise.
-- ---------------------------------------------------------------------------
drop policy "time_entries_insert_admin_or_own_assigned" on public.time_entries;
create policy "time_entries_insert_admin_or_own_assigned"
  on public.time_entries for insert
  with check (
    public.is_admin()
    or (
      user_id = auth.uid()
      and public.is_assigned_to_client(client_id)
      and exists (
        select 1 from public.activities a
        where a.id = activity_id and a.client_id = client_id
      )
      and (
        (
          sincronizado_offline = true
          and exists (
            select 1 from public.activities a2
            where a2.id = activity_id
              and a2.activo
              and a2.estado_aprobacion = 'aprobada'
              and (a2.tipo = 'recurrente' or a2.mes_aplicable = date_trunc('month', now())::date)
          )
        )
        or (
          sincronizado_offline = false
          and end_time is not null
          and estado in ('finalizado', 'ajustado_manualmente')
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- activity_corrections
-- ---------------------------------------------------------------------------
alter table public.activity_corrections enable row level security;

create policy "activity_corrections_select_admin_or_own"
  on public.activity_corrections for select
  using (public.is_admin() or user_id = auth.uid());

create policy "activity_corrections_insert_own"
  on public.activity_corrections for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.time_entries te
      where te.id = time_entry_id
        and te.user_id = auth.uid()
        and te.end_time is not null
        and nueva_hora_fin_sugerida >= te.start_time
        and nueva_hora_fin_sugerida <= now()
    )
  );
-- Sin policy de UPDATE/DELETE: ver comentario en 0010_activity_corrections.sql.

-- ---------------------------------------------------------------------------
-- user_salaries / client_rates: admin-only sin excepciones, ni siquiera
-- auto-lectura. Una sola policy "for all" porque la lógica es idéntica para
-- cualquier comando, sin ninguna excepción — ese es todo el punto.
-- ---------------------------------------------------------------------------
alter table public.user_salaries enable row level security;
create policy "user_salaries_all_admin"
  on public.user_salaries for all
  using (public.is_admin())
  with check (public.is_admin());

alter table public.client_rates enable row level security;
create policy "client_rates_all_admin"
  on public.client_rates for all
  using (public.is_admin())
  with check (public.is_admin());
