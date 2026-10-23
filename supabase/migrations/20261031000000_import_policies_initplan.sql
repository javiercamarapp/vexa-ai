-- 20261031000000 (APLICADA 23-oct vía apply_migration): el desglose de rechazadas de HubSpot (agregado por error_code sobre import_rows) no cabía en el tope porque las políticas
-- backend_scope de import_rows e imports evalúan vexa_member(tenant_id) POR FILA (~30 µs/fila; ~16.4 mil filas de la importación). Mismo patrón que 20261024/25/26: membresía una vez por sentencia.
-- Mismo significado de acceso. ALTER POLICY es atómico. Reversa: packages/workspace-service/tests/20261031000000_import_policies_initplan.down.sql
begin;
set local lock_timeout='3s';
alter policy backend_scope on public.import_rows using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (select public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid))) with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (select public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid)));
alter policy backend_scope on public.imports using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (select public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid))) with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (select public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid)));
commit;
