-- PROPUESTA (NO aplicada, NO está en supabase/migrations): misma semántica que economic_snapshot_visible de 0021, sin el costo O(refs) de consultas correlacionadas.
-- Motivo (medido en local con 88,666 filas de libro): la función evalúa, POR CADA referencia del manifiesto (una por asiento del libro, ~85 mil), una subconsulta a
-- memberships y otra a economic_source_versions, y se invoca POR FILA desde las políticas RESTRICTIVAS de components/metric_snapshots y desde el trigger
-- vexa_snapshot_guard (SELECT ... FOR UPDATE sobre metric_snapshots) => cada lectura de Resumen/Explorador/Detalle y cada INSERT de componente cuesta segundos.
-- Cambio: deduplicar primero los actores y las fuentes del manifiesto (unos pocos valores distintos) y comprobar solo esos. El resultado booleano es idéntico.
-- Las comprobaciones de moneda y tipo de cambio se dejan tal cual (pocas referencias).
-- Revisión requerida antes de aplicar: la prueba economia-problemas.test.mjs («propuesta 0055») compara ambas funciones en escenarios de revocación.
begin;
create or replace function public.economic_snapshot_visible(p_tenant uuid,p_snapshot uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.metric_snapshots s join public.memberships reader on reader.tenant_id=s.tenant_id and reader.user_id=auth.uid() and reader.status='active'
 where s.tenant_id=p_tenant and s.id=p_snapshot and (s.economic_schema_version is null or (
 (s.status='published' or reader.role='owner')
 and exists(select 1 from public.memberships m where m.tenant_id=s.tenant_id and m.user_id=s.created_by and m.status='active' and m.role='owner')
 and (s.published_by is null or exists(select 1 from public.memberships m where m.tenant_id=s.tenant_id and m.user_id=s.published_by and m.status='active' and m.role='owner'))
 and not exists(select 1 from (select distinct (r->>'actorId')::uuid as actor_id from jsonb_array_elements(s.input_manifest->'refs') r where r->>'authorized'='true') a
   where not exists(select 1 from public.memberships m where m.tenant_id=s.tenant_id and m.user_id=a.actor_id and m.status='active' and m.role='owner'))
 and not exists(select 1 from (select distinct (r->>'sourceId')::uuid as source_id from jsonb_array_elements(s.input_manifest->'refs') r where r->>'authorized'='true' and r->>'active'='true' and r->>'sourceId' is not null) x
   where not exists(select 1 from public.economic_source_versions src where src.tenant_id=s.tenant_id and src.source_id=x.source_id and src.active and src.version=(select max(v.version) from public.economic_source_versions v where v.tenant_id=src.tenant_id and v.source_id=src.source_id)))
 and not exists(select 1 from jsonb_array_elements(s.input_manifest->'refs') r where r->>'authorized'='true' and r->>'active'='true' and r->>'table'='economic_currency_versions' and not exists(select 1 from public.economic_currency_versions captured join public.economic_currency_versions current on current.tenant_id=captured.tenant_id and current.currency=captured.currency where captured.tenant_id=s.tenant_id and captured.id=(r->>'id')::uuid and current.active and current.version=(select max(v.version) from public.economic_currency_versions v where v.tenant_id=current.tenant_id and v.currency=current.currency)))
 and not exists(select 1 from jsonb_array_elements(s.input_manifest->'refs') r where r->>'authorized'='true' and r->>'active'='true' and r->>'table'='economic_fx_versions' and not exists(select 1 from public.economic_fx_versions captured join public.economic_fx_versions current on current.tenant_id=captured.tenant_id and current.rate_id=captured.rate_id where captured.tenant_id=s.tenant_id and captured.id=(r->>'id')::uuid and current.active and current.version=(select max(v.version) from public.economic_fx_versions v where v.tenant_id=current.tenant_id and v.rate_id=current.rate_id)))
)))
$$;
commit;
