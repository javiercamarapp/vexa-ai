-- Reversa de 20261025000000: vuelve a la política original (membresía por fila).
begin;
set local lock_timeout='3s';
alter policy backend_read on public.tracker_versions using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
alter policy backend_read on public.tracker_row_observations using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
alter policy backend_read on public.tracker_row_rejections using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
alter policy backend_read on public.tracker_row_revisions using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
alter policy backend_read on public.tracker_sheet_jobs using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
commit;
