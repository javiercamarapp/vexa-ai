-- Reversa de 20261021000000: vuelve a la política original de 0045 (membresía por fila).
begin;
set local lock_timeout='3s';
drop policy association_fact_read on public.native_customer_associations;
create policy association_fact_read on public.native_customer_associations for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
drop policy association_binding_read on public.conversation_customer_association_bindings;
create policy association_binding_read on public.conversation_customer_association_bindings for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
commit;
