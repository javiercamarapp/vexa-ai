-- 20261029000000 (PROPUESTA, NO APLICADA): recommendation_managed_guard acepta una recomendación sobre un corte SIN vínculos problema–pedido.
-- Diagnóstico (22-oct, flujo real en Postgres local): en un corte con problem_versions vacío (sin SKU/fuente) «Proponer una recomendación» fallaba (404 problem_not_found en el repositorio; y aun corregido eso,
-- el guard exigía que la versión del problema estuviera fijada en workspace_scope_bindings.problem_versions). El detalle y el Explorador ya usan en ese corte la versión VIGENTE del problema.
-- Cambio mínimo: sin vínculos y sin filtros de SKU/fuente, no se exige la fijación del problema ni que la corrida de cada cita esté en models del snapshot (el corte sin vínculos no captura corridas: models vacío); se mantienen TODAS las demás guardas: la versión debe ser la más reciente y activa, el recibo de detalle (detail_hash) debe existir
-- para ese binding, cada cita debe existir en evidence_spans/issues/manifiesto/membresía del problema y en las corridas del snapshot, y recommendation_inputs_current. Con vínculos o filtros: idéntico a 0025.
-- Reversa: tests/20261029000000_recommendation_catalog_cut.down.sql (definición de 0025).
begin;
set local lock_timeout='3s';
create or replace function public.recommendation_managed_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.problem_versions;b public.workspace_scope_bindings;s public.metric_snapshots;ref jsonb;span public.evidence_spans;
begin
 if tg_op='DELETE' then if old.recommendation_schema is not null then raise insufficient_privilege;end if;return old;end if;
 if tg_op='UPDATE' and old.recommendation_schema is not null and new.recommendation_schema is distinct from old.recommendation_schema then raise check_violation;end if;
 if new.recommendation_schema is null then return new;end if;
 if new.recommendation_schema is distinct from 'recommendation-v1' or new.tenant_id is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or current_setting('vexa.action',true) is distinct from 'propose' or new.actor_id is distinct from auth.uid() or not public.vexa_member(new.tenant_id,array['owner','analyst','operator']) then raise insufficient_privilege;end if;
 if new.status not in ('proposed','dismissed') or new.approval_bound or new.snapshot_id is null or new.problem_version_id is null or new.workspace_binding_id is null or new.scope_hash is null or new.scope_hash!~'^[a-f0-9]{64}$' or new.detail_hash is null or new.detail_hash!~'^[a-f0-9]{64}$' or new.generator_version is distinct from 'conditioned-rules-v1' then raise check_violation;end if;
 if new.action is null or length(btrim(new.action)) not between 20 and 2000 or new.rationale is null or length(btrim(new.rationale)) not between 20 and 4000 or new.change_reason is null or length(btrim(new.change_reason)) not between 20 and 2000 or jsonb_typeof(new.preconditions) is distinct from 'array' or jsonb_array_length(new.preconditions) not between 1 and 10 or exists(select 1 from jsonb_array_elements(new.preconditions) x where jsonb_typeof(x)<>'string' or length(btrim(x#>>'{}')) not between 10 and 500) or jsonb_typeof(new.evidence_refs) is distinct from 'array' or jsonb_array_length(new.evidence_refs) not between 1 and 500 then raise check_violation;end if;
 if new.owner_id is not null and not public.recommendation_member_active(new.tenant_id,new.owner_id) then raise check_violation;end if;
 select * into p from public.problem_versions where tenant_id=new.tenant_id and id=new.problem_version_id;
 select * into b from public.workspace_scope_bindings where tenant_id=new.tenant_id and id=new.workspace_binding_id;
 select * into s from public.metric_snapshots where tenant_id=new.tenant_id and id=new.snapshot_id;
 if p.id is null or p.problem_id<>new.problem_id or b.id is null or b.base_snapshot_id<>new.snapshot_id or b.scope_hash<>new.scope_hash or s.id is null or s.status<>'published' or not (exists(select 1 from jsonb_array_elements(b.problem_versions) x where x->>'problemId'=new.problem_id::text and x->>'versionId'=p.id::text) or jsonb_array_length(b.problem_versions)=0 and jsonb_array_length(b.filters->'sku')=0 and jsonb_array_length(b.filters->'source')=0) or not exists(select 1 from public.workspace_detail_bindings d where d.tenant_id=new.tenant_id and d.workspace_binding_id=b.id and d.detail_hash=new.detail_hash) then raise check_violation;end if;
 if p.version<>(select max(version) from public.problem_versions where tenant_id=new.tenant_id and problem_id=new.problem_id) or p.provenance->'snapshot'->>'state' is distinct from 'active' then raise check_violation;end if;
 for ref in select value from jsonb_array_elements(new.evidence_refs) loop
  if jsonb_typeof(ref) is distinct from 'object' or not(ref ?& array['runId','messageRevisionId','quote','quoteHash','role','category','severity']) or (select count(*) from jsonb_object_keys(ref))<>7 then raise check_violation;end if;
  select e.* into span from public.evidence_spans e join public.issues i on i.tenant_id=e.tenant_id and i.id=e.issue_id join public.extraction_runs r on r.tenant_id=i.tenant_id and r.id=i.extraction_run_id where e.tenant_id=new.tenant_id and i.extraction_run_id=(ref->>'runId')::uuid and e.message_revision_id=(ref->>'messageRevisionId')::uuid and e.quote_hash=ref->>'quoteHash' and i.category=ref->>'category' and coalesce(i.severity,'unknown')=ref->>'severity' and r.status='succeeded' and exists(select 1 from jsonb_array_elements(r.provenance->'input_manifest') v where v->>'message_revision_id'=ref->>'messageRevisionId' and v->>'role'=ref->>'role') limit 1;
  if span.id is null or ref->>'quoteHash' is distinct from encode(sha256(convert_to(ref->>'quote','UTF8')),'hex') or not (exists(select 1 from jsonb_array_elements(s.input_manifest->'models') m where m->>'id'=ref->>'runId') or (jsonb_array_length(b.problem_versions)=0 and jsonb_array_length(b.filters->'sku')=0 and jsonb_array_length(b.filters->'source')=0)) or not exists(select 1 from public.problem_embedding_members m where m.tenant_id=new.tenant_id and m.extraction_run_id=(ref->>'runId')::uuid and m.embedding_id in (select value::uuid from jsonb_array_elements_text(p.provenance->'snapshot'->'embeddingIds'))) then raise check_violation;end if;
 end loop;
 if tg_op='UPDATE' and exists(select 1 from public.recommendation_versions h where h.tenant_id=new.tenant_id and h.recommendation_id=new.id and public.recommendation_member_active(h.tenant_id,h.actor_id) is not true) then raise insufficient_privilege;end if;
 if public.recommendation_inputs_current(new.tenant_id,new.snapshot_id,new.evidence_refs) is not true then raise check_violation;end if;
 if tg_op='INSERT' then if new.version<>1 or new.status<>'proposed' then raise check_violation;end if;new.created_at=clock_timestamp();
 else
  if new.version<>old.version+1 or (to_jsonb(new)-array['version','action','preconditions','rationale','owner_id','status','actor_id','change_reason','updated_at']) is distinct from (to_jsonb(old)-array['version','action','preconditions','rationale','owner_id','status','actor_id','change_reason','updated_at']) then raise check_violation;end if;
 end if;
 new.updated_at=clock_timestamp();return new;
end $$;
commit;
