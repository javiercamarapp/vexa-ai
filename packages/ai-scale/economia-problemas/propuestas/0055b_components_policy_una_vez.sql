-- PROPUESTA (NO aplicada): la política RESTRICTIVA de lectura de public.components llama a economic_snapshot_visible(tenant_id,snapshot_id) POR CADA FILA de componentes
-- (cada llamada vuelve a desanidar el manifiesto de ~88 mil referencias). Se reescribe como subconsulta NO correlacionada sobre metric_snapshots: Postgres la evalúa UNA vez por
-- sentencia (hashed SubPlan) y la política RESTRICTIVA de metric_snapshots (la misma función) se aplica una sola vez por snapshot del tenant.
-- Equivale a: «un componente es visible si y solo si su snapshot es visible para ese rol», que es exactamente lo que dice economic_snapshot_visible para (tenant, snapshot).
begin;
drop policy economic_component_read on public.components;
create policy economic_component_read on public.components as restrictive for select to vexa_backend
 using ((tenant_id,snapshot_id) in (select s.tenant_id,s.id from public.metric_snapshots s));
commit;
