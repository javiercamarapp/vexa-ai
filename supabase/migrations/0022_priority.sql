BEGIN;
-- Explicit versioned policy, human operational assessment, and immutable ranking.
CREATE TABLE public.priority_policy_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES public.organizations(id),version integer NOT NULL CHECK(version>0),actor_id uuid NOT NULL,name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 200),
 weights jsonb NOT NULL,frequency_baseline integer NOT NULL CHECK(frequency_baseline BETWEEN 1 AND 1000000),impact_baseline_minor numeric NOT NULL CHECK(impact_baseline_minor>0 AND impact_baseline_minor=trunc(impact_baseline_minor) AND impact_baseline_minor::text ~ '^[0-9]+$' AND length(impact_baseline_minor::text)<=4096),currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),exponent integer NOT NULL CHECK(exponent BETWEEN 0 AND 4),formula_version text NOT NULL CHECK(formula_version='weighted-priority-v1'),report text NOT NULL CHECK(length(btrim(report)) BETWEEN 20 AND 4000),attested boolean NOT NULL CHECK(attested),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,version),FOREIGN KEY(tenant_id,actor_id) REFERENCES public.memberships(tenant_id,user_id),
 CHECK(jsonb_typeof(weights)='object' AND weights ?& ARRAY['impact','frequency','severity','actionability'] AND (weights-'impact'-'frequency'-'severity'-'actionability')='{}'::jsonb)
);
CREATE TABLE public.priority_actionability_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES public.organizations(id),problem_id uuid NOT NULL,problem_version integer NOT NULL,version integer NOT NULL CHECK(version>0),actor_id uuid NOT NULL,level text NOT NULL CHECK(level IN('unknown','low','medium','high')),report text NOT NULL CHECK(length(btrim(report)) BETWEEN 20 AND 4000),attested boolean NOT NULL CHECK(attested),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(tenant_id,id),UNIQUE(tenant_id,problem_id,version),FOREIGN KEY(tenant_id,problem_id,problem_version) REFERENCES public.problem_versions(tenant_id,problem_id,version),FOREIGN KEY(tenant_id,actor_id) REFERENCES public.memberships(tenant_id,user_id));
CREATE TABLE public.priority_runs(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES public.organizations(id),snapshot_id uuid NOT NULL,scope_hash text NOT NULL CHECK(scope_hash ~ '^[a-f0-9]{64}$'),policy_id uuid NOT NULL,previous_run_id uuid,version integer NOT NULL CHECK(version>0),actor_id uuid NOT NULL,input_hash text NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'),content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'),status text NOT NULL CHECK(status IN('draft','published')),entry_count integer NOT NULL CHECK(entry_count>=0),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(tenant_id,id),UNIQUE(tenant_id,snapshot_id,version),FOREIGN KEY(tenant_id,snapshot_id) REFERENCES public.metric_snapshots(tenant_id,id),FOREIGN KEY(tenant_id,policy_id) REFERENCES public.priority_policy_versions(tenant_id,id),FOREIGN KEY(tenant_id,previous_run_id) REFERENCES public.priority_runs(tenant_id,id),FOREIGN KEY(tenant_id,actor_id) REFERENCES public.memberships(tenant_id,user_id));
CREATE TABLE public.priority_entries(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES public.organizations(id),run_id uuid NOT NULL,problem_id uuid NOT NULL,problem_version integer NOT NULL,rank integer NOT NULL CHECK(rank>0),critical_lane boolean NOT NULL,score_known_bps integer NOT NULL CHECK(score_known_bps BETWEEN 0 AND 10000),score_upper_bps integer NOT NULL CHECK(score_upper_bps BETWEEN score_known_bps AND 10000),status text NOT NULL CHECK(status IN('complete','partial')),contributions jsonb NOT NULL CHECK(jsonb_typeof(contributions)='object'),inputs jsonb NOT NULL CHECK(jsonb_typeof(inputs)='object'),reasons jsonb NOT NULL CHECK(jsonb_typeof(reasons)='array'),delta jsonb NOT NULL CHECK(jsonb_typeof(delta)='object'),label text NOT NULL,evidence_run_ids uuid[] NOT NULL,actionability_id uuid,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(tenant_id,id),UNIQUE(tenant_id,run_id,problem_id),UNIQUE(tenant_id,run_id,rank),FOREIGN KEY(tenant_id,run_id) REFERENCES public.priority_runs(tenant_id,id),FOREIGN KEY(tenant_id,problem_id,problem_version) REFERENCES public.problem_versions(tenant_id,problem_id,version),FOREIGN KEY(tenant_id,actionability_id) REFERENCES public.priority_actionability_versions(tenant_id,id));
ALTER TABLE public.priority_policy_versions ENABLE ROW LEVEL SECURITY;ALTER TABLE public.priority_policy_versions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.priority_policy_versions FROM public,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.priority_policy_versions TO vexa_backend;
CREATE POLICY backend_read ON public.priority_policy_versions FOR SELECT TO vexa_backend USING(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid AND public.vexa_member(tenant_id) AND current_setting('vexa.action',true) IN('read','configure','import') AND public.economic_contributor_active(tenant_id,actor_id));
CREATE POLICY backend_insert ON public.priority_policy_versions FOR INSERT TO vexa_backend WITH CHECK(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid AND current_setting('vexa.action',true)='configure' AND public.economic_contributor_active(tenant_id,auth.uid()));
ALTER TABLE public.priority_actionability_versions ENABLE ROW LEVEL SECURITY;ALTER TABLE public.priority_actionability_versions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.priority_actionability_versions FROM public,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.priority_actionability_versions TO vexa_backend;
CREATE POLICY backend_read ON public.priority_actionability_versions FOR SELECT TO vexa_backend USING(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid AND public.vexa_member(tenant_id) AND current_setting('vexa.action',true) IN('read','configure','import') AND public.economic_contributor_active(tenant_id,actor_id));
CREATE POLICY backend_insert ON public.priority_actionability_versions FOR INSERT TO vexa_backend WITH CHECK(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid AND current_setting('vexa.action',true)='configure' AND public.economic_contributor_active(tenant_id,auth.uid()));
ALTER TABLE public.priority_runs ENABLE ROW LEVEL SECURITY;ALTER TABLE public.priority_runs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.priority_runs FROM public,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.priority_runs TO vexa_backend;
CREATE POLICY backend_read ON public.priority_runs FOR SELECT TO vexa_backend USING(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid AND public.vexa_member(tenant_id) AND current_setting('vexa.action',true) IN('read','configure','import') AND public.economic_contributor_active(tenant_id,actor_id) AND (status='published' OR public.economic_contributor_active(tenant_id,auth.uid())));
CREATE POLICY backend_insert ON public.priority_runs FOR INSERT TO vexa_backend WITH CHECK(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid AND current_setting('vexa.action',true)='import' AND public.economic_contributor_active(tenant_id,auth.uid()));
ALTER TABLE public.priority_entries ENABLE ROW LEVEL SECURITY;ALTER TABLE public.priority_entries FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.priority_entries FROM public,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.priority_entries TO vexa_backend;
CREATE POLICY backend_read ON public.priority_entries FOR SELECT TO vexa_backend USING(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid AND public.vexa_member(tenant_id) AND current_setting('vexa.action',true) IN('read','configure','import') AND EXISTS(SELECT 1 FROM public.priority_runs r WHERE r.tenant_id=priority_entries.tenant_id AND r.id=priority_entries.run_id));
CREATE POLICY backend_insert ON public.priority_entries FOR INSERT TO vexa_backend WITH CHECK(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid AND current_setting('vexa.action',true)='import' AND public.economic_contributor_active(tenant_id,auth.uid()));
GRANT UPDATE ON public.priority_runs TO vexa_backend;
CREATE POLICY backend_update ON public.priority_runs FOR UPDATE TO vexa_backend USING(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid AND current_setting('vexa.action',true)='import' AND public.economic_contributor_active(tenant_id,auth.uid())) WITH CHECK(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid AND current_setting('vexa.action',true)='import' AND public.economic_contributor_active(tenant_id,auth.uid()));
CREATE FUNCTION public.priority_digest(p_tenant uuid,p_run uuid) RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT encode(sha256(convert_to(jsonb_build_object('snapshotId',r.snapshot_id,'scopeHash',r.scope_hash,'policyId',r.policy_id,'inputHash',r.input_hash,'entries',coalesce((SELECT jsonb_agg(to_jsonb(e)-'created_at'-'tenant_id' ORDER BY e.rank) FROM public.priority_entries e WHERE e.tenant_id=r.tenant_id AND e.run_id=r.id),'[]'::jsonb))::text,'UTF8')),'hex') FROM public.priority_runs r WHERE r.tenant_id=p_tenant AND r.id=p_run
$$;
REVOKE ALL ON FUNCTION public.priority_digest(uuid,uuid) FROM public,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.priority_digest(uuid,uuid) TO vexa_backend;
CREATE FUNCTION public.priority_version_head(p_tenant uuid,p_kind text,p_resource uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF p_tenant IS DISTINCT FROM nullif(current_setting('vexa.tenant_id',true),'')::uuid OR coalesce(current_setting('vexa.action',true),'') NOT IN('read','configure','import') OR NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.tenant_id=p_tenant AND m.user_id=auth.uid() AND m.status='active') THEN RETURN NULL;END IF;
 IF p_kind='policy' THEN SELECT jsonb_build_object('id',id,'version',version) INTO result FROM public.priority_policy_versions WHERE tenant_id=p_tenant ORDER BY version DESC LIMIT 1;
 ELSIF p_kind='actionability' THEN SELECT jsonb_build_object('id',id,'version',version) INTO result FROM public.priority_actionability_versions WHERE tenant_id=p_tenant AND problem_id=p_resource ORDER BY version DESC LIMIT 1;
 ELSIF p_kind='run' THEN SELECT jsonb_build_object('id',id,'version',version) INTO result FROM public.priority_runs WHERE tenant_id=p_tenant AND snapshot_id=p_resource AND status='published' ORDER BY version DESC LIMIT 1;
 ELSE RAISE check_violation USING MESSAGE='priority_head_kind_invalid';END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.priority_version_head(uuid,text,uuid) FROM public,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.priority_version_head(uuid,text,uuid) TO vexa_backend;
CREATE FUNCTION public.priority_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE prev public.priority_runs;parent public.priority_runs;seen integer;head jsonb;n integer;part text;total integer:=0;value numeric;sid text;
BEGIN
 IF TG_OP IN('UPDATE','DELETE') AND TG_TABLE_NAME<>'priority_runs' THEN RAISE check_violation USING MESSAGE='priority_append_only';END IF;
 IF TG_OP='DELETE' THEN RAISE check_violation USING MESSAGE='priority_immutable';END IF;
 IF NOT public.economic_contributor_active(new.tenant_id,auth.uid()) THEN RAISE insufficient_privilege USING MESSAGE='priority_owner_required';END IF;
 IF TG_TABLE_NAME='priority_policy_versions' THEN
  IF new.actor_id<>auth.uid() THEN RAISE insufficient_privilege USING MESSAGE='priority_actor_required';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':priority-policy',0));seen:=coalesce((public.priority_version_head(new.tenant_id,'policy')->>'version')::integer,0);
  IF new.version<>seen+1 THEN RAISE check_violation USING MESSAGE='priority_policy_cas';END IF;
  FOREACH part IN ARRAY ARRAY['impact','frequency','severity','actionability'] LOOP
   IF jsonb_typeof(new.weights->part) IS DISTINCT FROM 'number' OR coalesce(new.weights->>part,'') !~ '^[0-9]+$' THEN RAISE check_violation USING MESSAGE='priority_weights_invalid';END IF;
   value:=(new.weights->>part)::numeric;IF value>10000 THEN RAISE check_violation USING MESSAGE='priority_weights_invalid';END IF;total:=total+value::integer;
  END LOOP;
  IF total<>10000 THEN RAISE check_violation USING MESSAGE='priority_weights_sum';END IF;
 ELSIF TG_TABLE_NAME='priority_actionability_versions' THEN
  IF new.actor_id<>auth.uid() THEN RAISE insufficient_privilege USING MESSAGE='priority_actor_required';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':priority-action:'||new.problem_id::text,0));seen:=coalesce((public.priority_version_head(new.tenant_id,'actionability',new.problem_id)->>'version')::integer,0);
  IF new.version<>seen+1 OR new.problem_version IS DISTINCT FROM (SELECT max(version) FROM public.problem_versions WHERE tenant_id=new.tenant_id AND problem_id=new.problem_id) THEN RAISE check_violation USING MESSAGE='priority_actionability_cas';END IF;
 ELSIF TG_TABLE_NAME='priority_runs' THEN
  IF TG_OP='INSERT' THEN
   IF new.actor_id<>auth.uid() OR new.status<>'draft' THEN RAISE check_violation USING MESSAGE='priority_draft_required';END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':priority-rank:'||new.snapshot_id::text,0));head:=public.priority_version_head(new.tenant_id,'run',new.snapshot_id);
   IF new.version<>coalesce((head->>'version')::integer,0)+1 OR new.previous_run_id IS DISTINCT FROM (head->>'id')::uuid THEN RAISE check_violation USING MESSAGE='priority_run_cas';END IF;
   SELECT scope_hash INTO sid FROM public.metric_snapshots WHERE tenant_id=new.tenant_id AND id=new.snapshot_id AND status='published' AND economic_schema_version='economic-snapshot-v1';
   IF sid IS DISTINCT FROM new.scope_hash THEN RAISE check_violation USING MESSAGE='priority_snapshot_required';END IF;
  ELSE
   IF old.status<>'draft' OR new.status<>'published' OR (to_jsonb(new)-'status'-'content_hash') IS DISTINCT FROM (to_jsonb(old)-'status'-'content_hash') THEN RAISE check_violation USING MESSAGE='priority_run_immutable';END IF;
   SELECT count(*) INTO n FROM public.priority_entries WHERE tenant_id=new.tenant_id AND run_id=new.id;
   IF n<>new.entry_count OR new.content_hash IS DISTINCT FROM public.priority_digest(new.tenant_id,new.id) THEN RAISE check_violation USING MESSAGE='priority_run_incomplete';END IF;
  END IF;
 ELSE
  SELECT * INTO parent FROM public.priority_runs WHERE tenant_id=new.tenant_id AND id=new.run_id FOR UPDATE;
  IF NOT FOUND OR parent.status<>'draft' THEN RAISE check_violation USING MESSAGE='priority_entry_immutable';END IF;
  IF EXISTS(SELECT 1 FROM unnest(new.evidence_run_ids) AS refs(run_id) WHERE NOT EXISTS(SELECT 1 FROM public.extraction_runs e WHERE e.tenant_id=new.tenant_id AND e.id=refs.run_id)) THEN RAISE check_violation USING MESSAGE='priority_evidence_tenant';END IF;
 END IF;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.priority_guard() FROM public,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION public.priority_guard() TO vexa_backend;
CREATE TRIGGER priority_guard BEFORE INSERT OR UPDATE OR DELETE ON public.priority_policy_versions FOR EACH ROW EXECUTE FUNCTION public.priority_guard();
CREATE TRIGGER priority_guard BEFORE INSERT OR UPDATE OR DELETE ON public.priority_actionability_versions FOR EACH ROW EXECUTE FUNCTION public.priority_guard();
CREATE TRIGGER priority_guard BEFORE INSERT OR UPDATE OR DELETE ON public.priority_runs FOR EACH ROW EXECUTE FUNCTION public.priority_guard();
CREATE TRIGGER priority_guard BEFORE INSERT OR UPDATE OR DELETE ON public.priority_entries FOR EACH ROW EXECUTE FUNCTION public.priority_guard();
COMMIT;
