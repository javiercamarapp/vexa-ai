-- DOWN de 0055_economic_scale.sql. Restaura EXACTAMENTE las definiciones de 0019/0023/0018 (políticas) y 0021 (economic_snapshot_visible).
-- Ubicación sugerida en el repositorio: supabase/operations/0055_economic_scale.down.sql (NO en supabase/migrations: la CLI de Supabase aplicaría un .down.sql como migración).
-- Los snapshots ya creados siguen intactos: solo se descartan las columnas de resumen (derivadas del manifiesto, que no cambia).
begin;
set local lock_timeout='3s';

alter table public.metric_snapshots drop constraint economic_snapshot_summary_matches;
drop function public.economic_manifest_summary_ok(jsonb,uuid[],uuid[],uuid[],uuid[],uuid[],uuid[],jsonb);
drop trigger economic_snapshot_summary on public.metric_snapshots;
drop function public.economic_snapshot_summary_guard();

-- 0021, textualmente (CREATE FUNCTION de supabase/migrations/0021_economic_snapshots.sql, como CREATE OR REPLACE).
CREATE OR REPLACE FUNCTION public.economic_snapshot_visible(p_tenant uuid,p_snapshot uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.metric_snapshots s JOIN public.memberships reader ON reader.tenant_id=s.tenant_id AND reader.user_id=auth.uid() AND reader.status='active'
 WHERE s.tenant_id=p_tenant AND s.id=p_snapshot AND (s.economic_schema_version IS NULL OR (
 (s.status='published' OR reader.role='owner')
 AND EXISTS(SELECT 1 FROM public.memberships m WHERE m.tenant_id=s.tenant_id AND m.user_id=s.created_by AND m.status='active' AND m.role='owner')
 AND (s.published_by IS NULL OR EXISTS(SELECT 1 FROM public.memberships m WHERE m.tenant_id=s.tenant_id AND m.user_id=s.published_by AND m.status='active' AND m.role='owner'))
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.input_manifest->'refs') r WHERE r->>'authorized'='true' AND NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.tenant_id=s.tenant_id AND m.user_id=(r->>'actorId')::uuid AND m.status='active' AND m.role='owner'))
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.input_manifest->'refs') r WHERE r->>'authorized'='true' AND r->>'active'='true' AND r->>'sourceId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.economic_source_versions src WHERE src.tenant_id=s.tenant_id AND src.source_id=(r->>'sourceId')::uuid AND src.active AND src.version=(SELECT max(v.version) FROM public.economic_source_versions v WHERE v.tenant_id=src.tenant_id AND v.source_id=src.source_id)))
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.input_manifest->'refs') r WHERE r->>'authorized'='true' AND r->>'active'='true' AND r->>'table'='economic_currency_versions' AND NOT EXISTS(SELECT 1 FROM public.economic_currency_versions captured JOIN public.economic_currency_versions current ON current.tenant_id=captured.tenant_id AND current.currency=captured.currency WHERE captured.tenant_id=s.tenant_id AND captured.id=(r->>'id')::uuid AND current.active AND current.version=(SELECT max(v.version) FROM public.economic_currency_versions v WHERE v.tenant_id=current.tenant_id AND v.currency=current.currency)))
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.input_manifest->'refs') r WHERE r->>'authorized'='true' AND r->>'active'='true' AND r->>'table'='economic_fx_versions' AND NOT EXISTS(SELECT 1 FROM public.economic_fx_versions captured JOIN public.economic_fx_versions current ON current.tenant_id=captured.tenant_id AND current.rate_id=captured.rate_id WHERE captured.tenant_id=s.tenant_id AND captured.id=(r->>'id')::uuid AND current.active AND current.version=(SELECT max(v.version) FROM public.economic_fx_versions v WHERE v.tenant_id=current.tenant_id AND v.rate_id=current.rate_id)))
)))
$$;

drop function public.economic_manifest_actors(jsonb);
drop function public.economic_manifest_sources(jsonb);
drop function public.economic_manifest_config(jsonb,text);
alter table public.metric_snapshots drop column refs_actor_ids, drop column refs_source_ids, drop column refs_currency_ids, drop column refs_fx_ids, drop column refs_ledger_ids, drop column refs_ledger_live_ids, drop column refs_small;

drop policy economic_ledger_read on public.economic_ledger_entries;
create policy economic_ledger_read on public.economic_ledger_entries for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
drop policy economic_problem_links_read on public.economic_problem_links;
create policy economic_problem_links_read on public.economic_problem_links for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
drop policy economic_order_aliases_read on public.economic_order_aliases;
create policy economic_order_aliases_read on public.economic_order_aliases for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
drop policy economic_order_customers_read on public.economic_order_customers;
create policy economic_order_customers_read on public.economic_order_customers for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
drop policy workspace_dimensions_read on public.workspace_order_dimension_versions;
create policy workspace_dimensions_read on public.workspace_order_dimension_versions for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));

commit;
