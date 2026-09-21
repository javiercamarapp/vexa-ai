-- F05-05: canonical immutable snapshots; existing policies and guards remain.
ALTER TABLE public.components ALTER COLUMN amount_minor TYPE numeric,
 ALTER COLUMN known_subtotal_minor TYPE numeric;
ALTER TABLE public.components ADD CONSTRAINT snapshot_money_exact CHECK (
 (amount_minor IS NULL OR (amount_minor=trunc(amount_minor) AND amount_minor::text ~ '^[0-9]+(\.0+)?$' AND length(split_part(amount_minor::text,'.',1))<=4096)) AND
 (known_subtotal_minor IS NULL OR (known_subtotal_minor=trunc(known_subtotal_minor) AND known_subtotal_minor::text ~ '^[0-9]+(\.0+)?$' AND length(split_part(known_subtotal_minor::text,'.',1))<=4096)));
ALTER TABLE public.metric_snapshots ADD COLUMN economic_schema_version text,
 ADD COLUMN as_of timestamptz, ADD COLUMN content_hash text,
 ADD COLUMN input_manifest jsonb, ADD COLUMN component_count integer,
 ADD COLUMN created_by uuid, ADD COLUMN published_by uuid,
 ADD FOREIGN KEY(tenant_id,created_by) REFERENCES public.memberships(tenant_id,user_id),
 ADD FOREIGN KEY(tenant_id,published_by) REFERENCES public.memberships(tenant_id,user_id),
 ADD CONSTRAINT economic_snapshot_metadata CHECK(economic_schema_version IS NULL OR (
 economic_schema_version='economic-snapshot-v1' AND as_of IS NOT NULL AND isfinite(as_of)
 AND content_hash IS NOT NULL AND input_manifest IS NOT NULL AND component_count IS NOT NULL AND content_hash ~ '^[a-f0-9]{64}$' AND scope_hash ~ '^[a-f0-9]{64}$' AND input_hash ~ '^[a-f0-9]{64}$'
 AND jsonb_typeof(input_manifest)='object' AND component_count>=0 AND created_by IS NOT NULL
 AND (status<>'published' OR published_by IS NOT NULL)));
create or replace function public.economic_contributor_active(p_tenant uuid,p_actor uuid) returns boolean language sql stable security definer set search_path='' as $$
 select p_tenant=nullif(current_setting('vexa.tenant_id',true),'')::uuid and current_setting('vexa.action',true) in ('read','configure','import')
 and exists(select 1 from public.memberships caller where caller.tenant_id=p_tenant and caller.user_id=auth.uid() and caller.status='active' and caller.role in ('owner','analyst','operator','viewer'))
 and exists(select 1 from public.memberships contributor where contributor.tenant_id=p_tenant and contributor.user_id=p_actor and contributor.status='active' and contributor.role='owner')
$$;
revoke all on function public.economic_contributor_active(uuid,uuid) from public,anon,authenticated,service_role;grant execute on function public.economic_contributor_active(uuid,uuid) to vexa_backend;

CREATE TABLE public.economic_snapshot_heads (
 tenant_id uuid NOT NULL REFERENCES public.organizations(id), scope_hash text NOT NULL CHECK(scope_hash ~ '^[a-f0-9]{64}$'),
 snapshot_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 PRIMARY KEY(tenant_id,scope_hash), FOREIGN KEY(tenant_id,snapshot_id) REFERENCES public.metric_snapshots(tenant_id,id));
ALTER TABLE public.economic_snapshot_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economic_snapshot_heads FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.economic_snapshot_heads FROM public,anon,authenticated,service_role;
GRANT SELECT ON public.economic_snapshot_heads TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.economic_snapshot_heads TO vexa_backend;
CREATE POLICY member_read ON public.economic_snapshot_heads FOR SELECT TO authenticated USING(public.vexa_member(tenant_id));
CREATE POLICY backend_read ON public.economic_snapshot_heads FOR SELECT TO vexa_backend USING(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid AND ((current_setting('vexa.action',true)='read' AND public.vexa_member(tenant_id)) OR public.vexa_backend_action(tenant_id,ARRAY['import'])));
CREATE POLICY backend_insert ON public.economic_snapshot_heads FOR INSERT TO vexa_backend WITH CHECK(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid AND public.vexa_backend_action(tenant_id,ARRAY['import']) AND public.economic_contributor_active(tenant_id,auth.uid()));
CREATE POLICY backend_update ON public.economic_snapshot_heads FOR UPDATE TO vexa_backend USING(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid AND public.vexa_backend_action(tenant_id,ARRAY['import'])) WITH CHECK(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid AND public.vexa_backend_action(tenant_id,ARRAY['import']) AND public.economic_contributor_active(tenant_id,auth.uid()));
-- The composite-key head uses its own identity guard below; it has no id column.
CREATE FUNCTION public.economic_snapshot_digest(p_tenant uuid,p_snapshot uuid) RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT encode(sha256(convert_to(jsonb_build_object('scope',s.provenance->'scope','exposure',s.provenance->'exposure','asOf',to_char(s.as_of AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'inputHash',s.input_hash,'manifest',s.input_manifest,'policy',s.policy_version,'schema',s.economic_schema_version,
 'components',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'metric',c.metric,'amount',c.amount_minor,'subtotal',c.known_subtotal_minor,'currency',c.currency,'exponent',c.exponent,'known',c.known_count,'total',c.total_count,'kind',c.kind,'provenance',c.provenance) ORDER BY c.metric,c.currency,c.id) FROM public.components c WHERE c.tenant_id=s.tenant_id AND c.snapshot_id=s.id),'[]'::jsonb))::text,'UTF8')),'hex')
 FROM public.metric_snapshots s WHERE s.tenant_id=p_tenant AND s.id=p_snapshot AND p_tenant=nullif(current_setting('vexa.tenant_id',true),'')::uuid AND ((current_setting('vexa.action',true)='read' AND public.vexa_member(p_tenant)) OR public.vexa_backend_action(p_tenant,ARRAY['import']))
$$;
REVOKE ALL ON FUNCTION public.economic_snapshot_digest(uuid,uuid) FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.economic_snapshot_digest(uuid,uuid) TO vexa_backend;
CREATE FUNCTION public.economic_snapshot_write_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE snap public.metric_snapshots; n bigint;
BEGIN
 IF TG_TABLE_NAME='economic_snapshot_heads' THEN
  IF TG_OP='UPDATE' AND new.tenant_id IS DISTINCT FROM old.tenant_id THEN RAISE check_violation USING MESSAGE='snapshot_head_tenant_immutable'; END IF;
  SELECT * INTO snap FROM public.metric_snapshots WHERE tenant_id=new.tenant_id AND id=new.snapshot_id FOR UPDATE;
  IF NOT FOUND OR snap.status<>'published' OR snap.economic_schema_version IS NULL OR snap.scope_hash<>new.scope_hash THEN RAISE check_violation USING MESSAGE='snapshot_head_requires_published'; END IF;
  IF TG_OP='UPDATE' AND (new.version<>old.version+1 OR new.scope_hash<>old.scope_hash) THEN RAISE check_violation USING MESSAGE='snapshot_head_version'; END IF;
  RETURN new;
 END IF;
 IF TG_OP='UPDATE' AND old.economic_schema_version IS NOT NULL AND new.economic_schema_version IS DISTINCT FROM old.economic_schema_version THEN RAISE check_violation USING MESSAGE='snapshot_schema_immutable'; END IF;
 IF new.economic_schema_version IS NULL THEN RETURN new; END IF;
 IF jsonb_typeof(new.input_manifest->'refs') IS DISTINCT FROM 'array' OR jsonb_typeof(new.input_manifest->'models') IS DISTINCT FROM 'array' OR jsonb_typeof(new.input_manifest->'watermarks') IS DISTINCT FROM 'array'
 OR jsonb_typeof(new.input_manifest->'selection') IS DISTINCT FROM 'object' OR jsonb_typeof(new.provenance->'scope') IS DISTINCT FROM 'object'
 OR new.input_manifest->>'schema' IS DISTINCT FROM new.economic_schema_version OR new.input_manifest->>'policy' IS DISTINCT FROM new.policy_version
 OR new.input_manifest->'selection'->'scope' IS DISTINCT FROM new.provenance->'scope'
 OR new.input_manifest->'selection'->'fxRateId' IS DISTINCT FROM new.provenance->'fxRateId'
 OR coalesce(new.input_manifest->>'exposureInputHash','') !~ '^[a-f0-9]{64}$'
 THEN RAISE check_violation USING MESSAGE='snapshot_manifest_incomplete'; END IF;
 IF NOT public.economic_contributor_active(new.tenant_id,auth.uid()) OR current_setting('vexa.action',true)<>'import' THEN RAISE insufficient_privilege USING MESSAGE='snapshot_owner_required'; END IF;
 IF TG_OP='INSERT' AND (new.created_by<>auth.uid() OR new.status<>'draft') THEN RAISE check_violation USING MESSAGE='snapshot_staging_required'; END IF;
 IF TG_OP='UPDATE' AND (new.created_by IS DISTINCT FROM old.created_by OR new.input_hash<>old.input_hash OR new.scope_hash<>old.scope_hash OR new.input_manifest IS DISTINCT FROM old.input_manifest OR new.as_of<>old.as_of OR new.provenance IS DISTINCT FROM old.provenance OR new.policy_version<>old.policy_version) THEN RAISE check_violation USING MESSAGE='snapshot_identity_immutable'; END IF;
 IF new.status='published' THEN
  SELECT count(*) INTO n FROM public.components WHERE tenant_id=new.tenant_id AND snapshot_id=new.id;
  IF new.published_by<>auth.uid() OR new.component_count<>n OR new.content_hash IS DISTINCT FROM public.economic_snapshot_digest(new.tenant_id,new.id) THEN RAISE check_violation USING MESSAGE='snapshot_components_incomplete'; END IF;
 END IF;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.economic_snapshot_write_guard() FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.economic_snapshot_write_guard() TO vexa_backend;
CREATE TRIGGER economic_snapshot_guard BEFORE INSERT OR UPDATE ON public.metric_snapshots FOR EACH ROW EXECUTE FUNCTION public.economic_snapshot_write_guard();
CREATE TRIGGER economic_head_guard BEFORE INSERT OR UPDATE ON public.economic_snapshot_heads FOR EACH ROW EXECUTE FUNCTION public.economic_snapshot_write_guard();

-- Authenticated reads cannot bypass the server's unpublished-snapshot boundary.
CREATE FUNCTION public.economic_snapshot_visible(p_tenant uuid,p_snapshot uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
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
REVOKE ALL ON FUNCTION public.economic_snapshot_visible(uuid,uuid) FROM public,anon,service_role;
GRANT EXECUTE ON FUNCTION public.economic_snapshot_visible(uuid,uuid) TO authenticated,vexa_backend;
CREATE POLICY economic_snapshot_read ON public.metric_snapshots AS RESTRICTIVE FOR SELECT TO authenticated,vexa_backend USING(public.economic_snapshot_visible(tenant_id,id));
CREATE POLICY economic_component_read ON public.components AS RESTRICTIVE FOR SELECT TO authenticated,vexa_backend USING(public.economic_snapshot_visible(tenant_id,snapshot_id));
-- Economic snapshots are served through the authenticated server repository,
-- which verifies retained redacted extraction evidence before returning payloads.
-- Legacy snapshot visibility is unchanged.
DROP POLICY economic_snapshot_read ON public.metric_snapshots;
DROP POLICY economic_component_read ON public.components;
CREATE POLICY economic_snapshot_read ON public.metric_snapshots AS RESTRICTIVE FOR SELECT TO vexa_backend USING(public.economic_snapshot_visible(tenant_id,id));
CREATE POLICY economic_component_read ON public.components AS RESTRICTIVE FOR SELECT TO vexa_backend USING(public.economic_snapshot_visible(tenant_id,snapshot_id));
CREATE POLICY economic_snapshot_server_read ON public.metric_snapshots AS RESTRICTIVE FOR SELECT TO authenticated USING(economic_schema_version IS NULL);
CREATE POLICY economic_component_server_read ON public.components AS RESTRICTIVE FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.metric_snapshots s WHERE s.tenant_id=components.tenant_id AND s.id=components.snapshot_id AND s.economic_schema_version IS NULL));
