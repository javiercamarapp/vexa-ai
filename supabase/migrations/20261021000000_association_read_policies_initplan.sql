-- 20261021000000: conteos exactos de la cobertura de asociaciones HubSpot (hechos y vínculos) dentro del límite de 10 s.
-- NO cambia el significado de ninguna política: la condición sigue siendo «tenant de la fila = tenant de la sesión Y la sesión es miembro activa».
-- Solo evalúa la membresía UNA vez por sentencia (sub-select no correlacionado, mismo patrón que 0055 aplicó al libro económico) en vez de una vez POR FILA
-- (~30 µs por fila: 117,719 hechos + 72,720 vínculos = ~5.7 s solo en políticas, por eso la cobertura tenía que estimar con una muestra del 10 %).
-- Orden de aplicación: puede aplicarse antes o después del código. Sin ella, `provenance.coverage()` intenta el conteo exacto con un tope de tiempo y,
-- si no alcanza, cae a la muestra rotulada «Estimado» (nunca muestra una cifra incompleta como exacta).
-- Bloqueo: DROP/CREATE POLICY toman un candado breve sobre cada tabla; lock_timeout hace que falle pronto si otra transacción la sostiene.
begin;
set local lock_timeout='3s';
do $$
begin
 if to_regclass('public.native_customer_associations') is null or to_regclass('public.conversation_customer_association_bindings') is null then
  raise exception 'faltan tablas de asociaciones: aplique antes 0045_native_customer_associations';
 end if;
end $$;
drop policy association_fact_read on public.native_customer_associations;
create policy association_fact_read on public.native_customer_associations for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (select public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid)));
drop policy association_binding_read on public.conversation_customer_association_bindings;
create policy association_binding_read on public.conversation_customer_association_bindings for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (select public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid)));
commit;
