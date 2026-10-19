-- 0055: escala de las vistas económicas (libro real de ~85 mil asientos). NO cambia el significado de ninguna cifra, política ni guarda:
-- solo evita trabajo repetido por fila dentro de las MISMAS decisiones. Orden de aplicación: ANTES de desplegar el código de la aplicación que la usa
-- (el código también funciona sin ella, por el camino lento, pero entonces las lecturas con el libro completo exceden statement_timeout).
--
-- 1) Lectura del libro y de las relaciones: la comprobación de membresía depende solo de la sesión (GUC de tenant + auth.uid()), no de la fila.
--    La política original la llamaba una vez POR FILA (88 mil llamadas = ~1.8 s por lectura del libro). Aquí se evalúa UNA vez por sentencia
--    (sub-select no correlacionado). La condición sigue siendo exactamente: tenant de la fila = tenant de la sesión Y la sesión es miembro activa.
-- 2) Resumen INMUTABLE del manifiesto de cada snapshot económico, calculado en la base al insertar (un trigger lo recalcula y lo congela; la aplicación no puede
--    fijarlo): contribuyentes, fuentes y referencias de configuración distintos; ids de los asientos del libro; y las pocas referencias que no son del libro.
--    El manifiesto completo (con una referencia por asiento) sigue siendo la fuente de verdad y lo cubre el digest; el resumen solo evita recorrerlo.
-- 3) economic_snapshot_visible: las MISMAS condiciones de 0021, evaluadas sobre ese resumen. Antes recorría ~85 mil referencias con una subconsulta por
--    referencia en CADA lectura de metric_snapshots/components, en cada INSERT de componente (trigger) y en el digest. Los snapshots económicos creados
--    antes de esta migración no tienen resumen: la función cae a calcularlo del manifiesto (misma decisión).
begin;
-- Si otra transacción sostiene un candado sobre estas tablas, falla pronto (el script de aplicación reintenta) en vez de bloquear lecturas del libro en cola detrás del DROP POLICY / ALTER TABLE.
set local lock_timeout='3s';

drop policy economic_ledger_read on public.economic_ledger_entries;
create policy economic_ledger_read on public.economic_ledger_entries for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (select public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid)));
drop policy economic_problem_links_read on public.economic_problem_links;
create policy economic_problem_links_read on public.economic_problem_links for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (select public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid)));
drop policy economic_order_aliases_read on public.economic_order_aliases;
create policy economic_order_aliases_read on public.economic_order_aliases for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (select public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid)));
drop policy economic_order_customers_read on public.economic_order_customers;
create policy economic_order_customers_read on public.economic_order_customers for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (select public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid)));
drop policy workspace_dimensions_read on public.workspace_order_dimension_versions;
create policy workspace_dimensions_read on public.workspace_order_dimension_versions for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (select public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid)));

alter table public.metric_snapshots
 add column refs_actor_ids uuid[], add column refs_source_ids uuid[], add column refs_currency_ids uuid[], add column refs_fx_ids uuid[],
 add column refs_ledger_ids uuid[], add column refs_ledger_live_ids uuid[], add column refs_small jsonb;

-- Comprobación única (una pasada) de que el resumen guardado == el que sale del manifiesto. Sobrevive a DISABLE TRIGGER: un resumen alterado por un superusuario con los disparadores
-- deshabilitados es rechazado por el CHECK. Sin resumen (snapshots anteriores a 0055) TODAS las columnas derivadas deben ser nulas (si no, se podría fijar un resumen parcial); usan el camino lento.
create function public.economic_manifest_summary_ok(p_manifest jsonb,p_actors uuid[],p_sources uuid[],p_currency uuid[],p_fx uuid[],p_ledger uuid[],p_live uuid[],p_small jsonb) returns boolean language sql immutable set search_path='' as $$
 select p_actors is not distinct from coalesce(array_agg(distinct (r->>'actorId')::uuid) filter(where r->>'authorized'='true'),'{}')
  and p_sources is not distinct from coalesce(array_agg(distinct (r->>'sourceId')::uuid) filter(where r->>'authorized'='true' and r->>'active'='true' and r->>'sourceId' is not null),'{}')
  and p_currency is not distinct from coalesce(array_agg(distinct (r->>'id')::uuid) filter(where r->>'authorized'='true' and r->>'active'='true' and r->>'table'='economic_currency_versions'),'{}')
  and p_fx is not distinct from coalesce(array_agg(distinct (r->>'id')::uuid) filter(where r->>'authorized'='true' and r->>'active'='true' and r->>'table'='economic_fx_versions'),'{}')
  and p_ledger is not distinct from coalesce(array_agg((r->>'id')::uuid) filter(where r->>'table'='economic_ledger_entries'),'{}')
  and p_live is not distinct from coalesce(array_agg((r->>'id')::uuid) filter(where r->>'table'='economic_ledger_entries' and r->>'authorized'='true' and r->>'active'='true'),'{}')
  and p_small is not distinct from coalesce(jsonb_agg(r) filter(where r->>'table' is distinct from 'economic_ledger_entries'),'[]'::jsonb)
 from jsonb_array_elements(p_manifest->'refs') r
$$;
revoke all on function public.economic_manifest_summary_ok(jsonb,uuid[],uuid[],uuid[],uuid[],uuid[],uuid[],jsonb) from public,anon,authenticated,service_role;
grant execute on function public.economic_manifest_summary_ok(jsonb,uuid[],uuid[],uuid[],uuid[],uuid[],uuid[],jsonb) to vexa_backend;
alter table public.metric_snapshots add constraint economic_snapshot_summary_matches check(case when refs_small is null then refs_actor_ids is null and refs_source_ids is null and refs_currency_ids is null and refs_fx_ids is null and refs_ledger_ids is null and refs_ledger_live_ids is null else public.economic_manifest_summary_ok(input_manifest,refs_actor_ids,refs_source_ids,refs_currency_ids,refs_fx_ids,refs_ledger_ids,refs_ledger_live_ids,refs_small) end);

-- Resumen del manifiesto (nunca se acepta del cliente: el trigger lo recalcula en INSERT y lo congela en UPDATE).
create function public.economic_manifest_actors(p_manifest jsonb) returns uuid[] language sql immutable set search_path='' as $$
 select coalesce(array_agg(distinct (r->>'actorId')::uuid),'{}') from jsonb_array_elements(p_manifest->'refs') r where r->>'authorized'='true'
$$;
create function public.economic_manifest_sources(p_manifest jsonb) returns uuid[] language sql immutable set search_path='' as $$
 select coalesce(array_agg(distinct (r->>'sourceId')::uuid),'{}') from jsonb_array_elements(p_manifest->'refs') r where r->>'authorized'='true' and r->>'active'='true' and r->>'sourceId' is not null
$$;
create function public.economic_manifest_config(p_manifest jsonb,p_table text) returns uuid[] language sql immutable set search_path='' as $$
 select coalesce(array_agg(distinct (r->>'id')::uuid),'{}') from jsonb_array_elements(p_manifest->'refs') r where r->>'authorized'='true' and r->>'active'='true' and r->>'table'=p_table
$$;
revoke all on function public.economic_manifest_actors(jsonb),public.economic_manifest_sources(jsonb),public.economic_manifest_config(jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.economic_manifest_actors(jsonb),public.economic_manifest_sources(jsonb),public.economic_manifest_config(jsonb,text) to vexa_backend;

create function public.economic_snapshot_summary_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.economic_schema_version is null then
  new.refs_actor_ids:=null;new.refs_source_ids:=null;new.refs_currency_ids:=null;new.refs_fx_ids:=null;new.refs_ledger_ids:=null;new.refs_ledger_live_ids:=null;new.refs_small:=null;
  return new;
 end if;
 if tg_op='UPDATE' and old.refs_actor_ids is not null and new.input_manifest is not distinct from old.input_manifest then
  new.refs_actor_ids:=old.refs_actor_ids;new.refs_source_ids:=old.refs_source_ids;new.refs_currency_ids:=old.refs_currency_ids;new.refs_fx_ids:=old.refs_fx_ids;
  new.refs_ledger_ids:=old.refs_ledger_ids;new.refs_ledger_live_ids:=old.refs_ledger_live_ids;new.refs_small:=old.refs_small;
  return new;
 end if;
 -- Una sola pasada sobre el manifiesto. refs_small = todas las referencias que NO son del libro (pocas); el libro (decenas de miles) queda como listas de ids.
 select coalesce(array_agg(distinct (r->>'actorId')::uuid) filter(where r->>'authorized'='true'),'{}'),
  coalesce(array_agg(distinct (r->>'sourceId')::uuid) filter(where r->>'authorized'='true' and r->>'active'='true' and r->>'sourceId' is not null),'{}'),
  coalesce(array_agg(distinct (r->>'id')::uuid) filter(where r->>'authorized'='true' and r->>'active'='true' and r->>'table'='economic_currency_versions'),'{}'),
  coalesce(array_agg(distinct (r->>'id')::uuid) filter(where r->>'authorized'='true' and r->>'active'='true' and r->>'table'='economic_fx_versions'),'{}'),
  coalesce(array_agg((r->>'id')::uuid) filter(where r->>'table'='economic_ledger_entries'),'{}'),
  coalesce(array_agg((r->>'id')::uuid) filter(where r->>'table'='economic_ledger_entries' and r->>'authorized'='true' and r->>'active'='true'),'{}'),
  coalesce(jsonb_agg(r) filter(where r->>'table' is distinct from 'economic_ledger_entries'),'[]'::jsonb)
 into new.refs_actor_ids,new.refs_source_ids,new.refs_currency_ids,new.refs_fx_ids,new.refs_ledger_ids,new.refs_ledger_live_ids,new.refs_small
 from jsonb_array_elements(new.input_manifest->'refs') r;
 return new;
end $$;
revoke all on function public.economic_snapshot_summary_guard() from public,anon,authenticated,service_role;
grant execute on function public.economic_snapshot_summary_guard() to vexa_backend;
-- Alfabéticamente DESPUÉS de economic_snapshot_guard (que valida el manifiesto y la inmutabilidad) y antes de nada que lea el resumen.
create trigger economic_snapshot_summary before insert or update on public.metric_snapshots for each row execute function public.economic_snapshot_summary_guard();

create or replace function public.economic_snapshot_visible(p_tenant uuid,p_snapshot uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.metric_snapshots s join public.memberships reader on reader.tenant_id=s.tenant_id and reader.user_id=auth.uid() and reader.status='active'
 where s.tenant_id=p_tenant and s.id=p_snapshot and (s.economic_schema_version is null or (
 (s.status='published' or reader.role='owner')
 and exists(select 1 from public.memberships m where m.tenant_id=s.tenant_id and m.user_id=s.created_by and m.status='active' and m.role='owner')
 and (s.published_by is null or exists(select 1 from public.memberships m where m.tenant_id=s.tenant_id and m.user_id=s.published_by and m.status='active' and m.role='owner'))
 and not exists(select 1 from unnest(coalesce(s.refs_actor_ids,public.economic_manifest_actors(s.input_manifest))) a(actor_id) where a.actor_id is null or not exists(select 1 from public.memberships m where m.tenant_id=s.tenant_id and m.user_id=a.actor_id and m.status='active' and m.role='owner'))
 and not exists(select 1 from unnest(coalesce(s.refs_source_ids,public.economic_manifest_sources(s.input_manifest))) x(source_id) where not exists(select 1 from public.economic_source_versions src where src.tenant_id=s.tenant_id and src.source_id=x.source_id and src.active and src.version=(select max(v.version) from public.economic_source_versions v where v.tenant_id=src.tenant_id and v.source_id=src.source_id)))
 and not exists(select 1 from unnest(coalesce(s.refs_currency_ids,public.economic_manifest_config(s.input_manifest,'economic_currency_versions'))) c(ref_id) where not exists(select 1 from public.economic_currency_versions captured join public.economic_currency_versions current on current.tenant_id=captured.tenant_id and current.currency=captured.currency where captured.tenant_id=s.tenant_id and captured.id=c.ref_id and current.active and current.version=(select max(v.version) from public.economic_currency_versions v where v.tenant_id=current.tenant_id and v.currency=current.currency)))
 and not exists(select 1 from unnest(coalesce(s.refs_fx_ids,public.economic_manifest_config(s.input_manifest,'economic_fx_versions'))) f(ref_id) where not exists(select 1 from public.economic_fx_versions captured join public.economic_fx_versions current on current.tenant_id=captured.tenant_id and current.rate_id=captured.rate_id where captured.tenant_id=s.tenant_id and captured.id=f.ref_id and current.active and current.version=(select max(v.version) from public.economic_fx_versions v where v.tenant_id=current.tenant_id and v.rate_id=current.rate_id)))
)))
$$;
commit;
