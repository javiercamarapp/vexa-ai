-- Reversa de 20261026000000: vuelve a la política original (membresía por fila).
begin;
set local lock_timeout='3s';
alter policy backend_scope on public.issues using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
alter policy backend_scope on public.evidence_spans using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
commit;
