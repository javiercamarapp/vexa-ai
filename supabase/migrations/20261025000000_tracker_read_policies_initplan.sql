-- 20261025000000 (PROPUESTA, NO APLICADA): la tarjeta «Excel (Tracker)» de la banda de cobertura deja de salir «No disponible ahora» de forma intermitente.
-- Diagnóstico (22-oct, producción, solo lectura): coverage() cuenta tracker_row_observations (52,893 filas del tenant CLIENTEX) con LIMIT 100001 bajo un statement_timeout de 2.5-3.5 s
-- y un presupuesto total de 9 s para toda la banda. La política backend_read evalúa `vexa_member(tenant_id)` por FILA (~30 µs/fila ≈ 1.6 s solo en esa cuenta); según la carga en frío de
-- las demás tarjetas, el paso excede su tiempo y la tarjeta sale «timeout». Con el sub-select no correlacionado (mismo patrón que 0055, 20261021 y 20261024) la membresía se evalúa una vez por sentencia.
-- NO cambia el significado de ninguna política (tenant de la fila = tenant de la sesión Y membresía activa). ALTER POLICY es atómico. Solo estas 5 tablas; las demás con el mismo patrón quedan igual.
-- Reversa: packages/workspace-service/tests/20261025000000_tracker_read_policies_initplan.down.sql
begin;
set local lock_timeout='3s';
alter policy backend_read on public.tracker_versions using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (select public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid)));
alter policy backend_read on public.tracker_row_observations using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (select public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid)));
alter policy backend_read on public.tracker_row_rejections using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (select public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid)));
alter policy backend_read on public.tracker_row_revisions using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (select public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid)));
alter policy backend_read on public.tracker_sheet_jobs using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (select public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid)));
commit;
