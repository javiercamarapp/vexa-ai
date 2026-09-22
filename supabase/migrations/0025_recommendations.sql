begin;
alter table public.recommendations add column recommendation_schema text,add column problem_version_id uuid,add column workspace_binding_id uuid,add column scope_hash text,add column detail_hash text,add column action text,add column preconditions jsonb,add column evidence_refs jsonb,add column generator_version text,add column actor_id uuid,add column change_reason text;
alter table public.recommendations add foreign key(tenant_id,problem_version_id) references public.problem_versions(tenant_id,id) on delete restrict,add foreign key(tenant_id,workspace_binding_id) references public.workspace_scope_bindings(tenant_id,id) on delete restrict,add foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id) on delete restrict;
create table public.recommendation_versions(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null, recommendation_id uuid not null,version integer not null check(version>0),actor_id uuid not null,definition jsonb not null check(jsonb_typeof(definition)='object'),created_at timestamptz not null default clock_timestamp(),unique(tenant_id,id),unique(tenant_id,recommendation_id,version),foreign key(tenant_id) references public.organizations(id) on delete restrict,foreign key(tenant_id,recommendation_id) references public.recommendations(tenant_id,id) on delete restrict,foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id) on delete restrict
);
alter table public.interventions add column recommendation_version integer;
alter table public.interventions add foreign key(tenant_id,recommendation_id,recommendation_version) references public.recommendation_versions(tenant_id,recommendation_id,version) on delete restrict;
create function public.recommendation_member_active(t uuid,u uuid) returns boolean language sql stable security definer set search_path='' as $$
 select t=nullif(current_setting('vexa.tenant_id',true),'')::uuid and current_setting('vexa.action',true) in ('read','propose') and public.vexa_member(t) and exists(select 1 from public.memberships m where m.tenant_id=t and m.user_id=u and m.status='active' and m.role in ('owner','analyst','operator'))
$$;
revoke all on function public.recommendation_member_active(uuid,uuid) from public,anon,authenticated,service_role;grant execute on function public.recommendation_member_active(uuid,uuid) to vexa_backend;
create function public.recommendation_members(t uuid) returns table(id uuid,role text) language sql stable security definer set search_path='' as $$
 select m.user_id,m.role from public.memberships m where t=nullif(current_setting('vexa.tenant_id',true),'')::uuid and current_setting('vexa.action',true)='read' and public.vexa_member(t) and m.tenant_id=t and m.status='active' and m.role in ('owner','analyst','operator') order by m.user_id
$$;
revoke all on function public.recommendation_members(uuid) from public,anon,authenticated,service_role;grant execute on function public.recommendation_members(uuid) to vexa_backend;
alter policy backend_recommendation_state on public.recommendations using (current_setting('vexa.action',true)<>'propose' or status in ('draft','proposed') or (recommendation_schema='recommendation-v1' and status='dismissed')) with check (current_setting('vexa.action',true)<>'propose' or status in ('draft','proposed') or (recommendation_schema='recommendation-v1' and status='dismissed'));
create policy recommendation_managed_browser on public.recommendations as restrictive for select to authenticated using (recommendation_schema is null);
create policy recommendation_managed_backend on public.recommendations as restrictive for select to vexa_backend using (recommendation_schema is null or (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id)));
create policy recommendation_managed_intervention_browser on public.interventions as restrictive for select to authenticated using (provenance->>'kind' is distinct from 'recommendation-draft-v1');
alter table public.recommendation_versions enable row level security;alter table public.recommendation_versions force row level security;revoke all on public.recommendation_versions from public,anon,authenticated,service_role,vexa_backend;grant select on public.recommendation_versions to vexa_backend;
create policy recommendation_versions_read on public.recommendation_versions for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create function public.recommendation_inputs_current(t uuid,sid uuid,refs jsonb) returns boolean language plpgsql stable security definer set search_path='' as $$
declare snap public.metric_snapshots; ref jsonb; input jsonb; run public.extraction_runs; c record; m record; source_row record; current_actor uuid; current_active boolean; keys text[]; identity_text text; entity text; external_key text;
begin
 if t is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or current_setting('vexa.action',true) is distinct from 'propose' or not public.vexa_member(t,array['owner','analyst','operator']) then return false;end if;
 select * into snap from public.metric_snapshots where tenant_id=t and id=sid;
 if snap.id is null or snap.status<>'published' or jsonb_typeof(refs) is distinct from 'array' or jsonb_array_length(refs)=0 then return false;end if;
 if not exists(select 1 from public.memberships where tenant_id=t and user_id=snap.created_by and status='active' and role='owner') or not exists(select 1 from public.memberships where tenant_id=t and user_id=snap.published_by and status='active' and role='owner') then return false;end if;
 for ref in select value from jsonb_array_elements(snap.input_manifest->'refs') loop
  if ref->'authorized'='true'::jsonb and not exists(select 1 from public.memberships where tenant_id=t and user_id=(ref->>'actorId')::uuid and status='active' and role='owner') then return false;end if;
  if ref->'authorized'='true'::jsonb and ref->'active'='true'::jsonb then
   current_actor=null;current_active=null;
   if ref->>'table'='economic_source_versions' then
    select latest.actor_id,latest.active into current_actor,current_active from public.economic_source_versions original join lateral(select actor_id,active from public.economic_source_versions v where v.tenant_id=t and v.source_id=original.source_id order by version desc limit 1) latest on true where original.tenant_id=t and original.id=(ref->>'id')::uuid;
   elsif ref->>'table'='economic_currency_versions' then
    select latest.actor_id,latest.active into current_actor,current_active from public.economic_currency_versions original join lateral(select actor_id,active from public.economic_currency_versions v where v.tenant_id=t and v.currency=original.currency order by version desc limit 1) latest on true where original.tenant_id=t and original.id=(ref->>'id')::uuid;
   elsif ref->>'table'='economic_fx_versions' then
    select latest.actor_id,latest.active into current_actor,current_active from public.economic_fx_versions original join lateral(select actor_id,active from public.economic_fx_versions v where v.tenant_id=t and v.rate_id=original.rate_id order by version desc limit 1) latest on true where original.tenant_id=t and original.id=(ref->>'id')::uuid;
   else continue;end if;
   if current_active is distinct from true or not exists(select 1 from public.memberships where tenant_id=t and user_id=current_actor and status='active' and role='owner') then return false;end if;
  end if;
 end loop;
 for ref in select value from jsonb_array_elements(snap.input_manifest->'models') loop
  select * into run from public.extraction_runs where tenant_id=t and id=(ref->>'id')::uuid;
  if run.id is null or run.status<>'succeeded' or jsonb_typeof(run.provenance->'input_manifest') is distinct from 'array' or jsonb_array_length(run.provenance->'input_manifest')=0 then return false;end if;
  select v.*,n.account_id,n.status as connection_status,h.state as head_state into c from public.conversations v join public.connections n on n.tenant_id=v.tenant_id and n.id=v.connection_id left join public.source_heads h on h.tenant_id=v.tenant_id and h.id=v.id where v.tenant_id=t and v.id=run.conversation_id;
  if c.id is null or c.deleted_at is not null or c.connection_status<>'active' or c.head_state is null or c.head_state not in ('unique','selected','ambiguous') then return false;end if;
  keys=array[c.id::text,c.external_id];
  select '['||string_agg(to_json(v)::text,',' order by ord)||']' into identity_text from unnest(array['v1',t::text,c.connection_id::text,c.source,c.account_id,'conversation',c.external_id]) with ordinality a(v,ord);
  keys=keys||array[identity_text,encode(sha256(convert_to(identity_text,'UTF8')),'hex')];
  for input in select value from jsonb_array_elements(run.provenance->'input_manifest') loop
   select r.id,r.message_id,r.hash,r.redacted_text,r.redaction_version,r.deleted_at,o.id as original_id,o.message_id as original_message_id,o.deleted_at as original_deleted,v.deleted_at as message_deleted,v.connection_id,v.external_id,sr.canonical_id,sr.connection_id as source_connection,sr.snapshot,h.state as head_state into m from public.message_revisions r join public.message_revisions o on o.tenant_id=r.tenant_id and o.id::text=r.provenance->>'original_revision_id' join public.messages v on v.tenant_id=r.tenant_id and v.id=r.message_id join public.source_revisions sr on sr.tenant_id=o.tenant_id and sr.message_revision_id=o.id and sr.entity_type='message' left join public.source_heads h on h.tenant_id=v.tenant_id and h.id=v.id where r.tenant_id=t and r.id=(input->>'message_revision_id')::uuid;
   if m.id is null or m.deleted_at is not null or m.original_deleted is not null or m.message_deleted is not null or m.redaction_version is null or m.original_id::text is distinct from input->>'original_revision_id' or m.message_id<>m.original_message_id or m.canonical_id<>m.message_id or m.connection_id<>c.connection_id or m.source_connection<>c.connection_id or m.head_state is null or m.head_state not in ('unique','selected','ambiguous') or m.hash is distinct from input->>'hash' or encode(sha256(convert_to(m.redacted_text,'UTF8')),'hex') is distinct from input->>'hash' or (select count(*) from jsonb_array_elements(m.snapshot) x where x->>'table'='messages' and x->'row'->>'id'=m.message_id::text and x->'row'->>'role'=input->>'role' and x->'row'->>'conversation_id'=run.conversation_id::text)<>1 then return false;end if;
   keys=keys||array[m.id::text,m.original_id::text,m.message_id::text,m.external_id];
   select '['||string_agg(to_json(v)::text,',' order by ord)||']' into identity_text from unnest(array['v1',t::text,c.connection_id::text,c.source,c.account_id,'message',m.external_id]) with ordinality a(v,ord);
   keys=keys||array[identity_text,encode(sha256(convert_to(identity_text,'UTF8')),'hex')];
  end loop;
  if exists(select 1 from public.tombstones where tenant_id=t and (connection_id is null or connection_id=c.connection_id) and deleted_source_key=any(keys)) then return false;end if;
 end loop;
 return true;
end $$;
revoke all on function public.recommendation_inputs_current(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.recommendation_inputs_current(uuid,uuid,jsonb) to vexa_backend;

create function public.recommendation_managed_guard() returns trigger language plpgsql security definer set search_path='' as $$
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
 if p.id is null or p.problem_id<>new.problem_id or b.id is null or b.base_snapshot_id<>new.snapshot_id or b.scope_hash<>new.scope_hash or s.id is null or s.status<>'published' or not exists(select 1 from jsonb_array_elements(b.problem_versions) x where x->>'problemId'=new.problem_id::text and x->>'versionId'=p.id::text) or not exists(select 1 from public.workspace_detail_bindings d where d.tenant_id=new.tenant_id and d.workspace_binding_id=b.id and d.detail_hash=new.detail_hash) then raise check_violation;end if;
 if p.version<>(select max(version) from public.problem_versions where tenant_id=new.tenant_id and problem_id=new.problem_id) or p.provenance->'snapshot'->>'state' is distinct from 'active' then raise check_violation;end if;
 for ref in select value from jsonb_array_elements(new.evidence_refs) loop
  if jsonb_typeof(ref) is distinct from 'object' or not(ref ?& array['runId','messageRevisionId','quote','quoteHash','role','category','severity']) or (select count(*) from jsonb_object_keys(ref))<>7 then raise check_violation;end if;
  select e.* into span from public.evidence_spans e join public.issues i on i.tenant_id=e.tenant_id and i.id=e.issue_id join public.extraction_runs r on r.tenant_id=i.tenant_id and r.id=i.extraction_run_id where e.tenant_id=new.tenant_id and i.extraction_run_id=(ref->>'runId')::uuid and e.message_revision_id=(ref->>'messageRevisionId')::uuid and e.quote_hash=ref->>'quoteHash' and i.category=ref->>'category' and coalesce(i.severity,'unknown')=ref->>'severity' and r.status='succeeded' and exists(select 1 from jsonb_array_elements(r.provenance->'input_manifest') v where v->>'message_revision_id'=ref->>'messageRevisionId' and v->>'role'=ref->>'role') limit 1;
  if span.id is null or ref->>'quoteHash' is distinct from encode(sha256(convert_to(ref->>'quote','UTF8')),'hex') or not exists(select 1 from jsonb_array_elements(s.input_manifest->'models') m where m->>'id'=ref->>'runId') or not exists(select 1 from public.problem_embedding_members m where m.tenant_id=new.tenant_id and m.extraction_run_id=(ref->>'runId')::uuid and m.embedding_id in (select value::uuid from jsonb_array_elements_text(p.provenance->'snapshot'->'embeddingIds'))) then raise check_violation;end if;
 end loop;
 if tg_op='UPDATE' and exists(select 1 from public.recommendation_versions h where h.tenant_id=new.tenant_id and h.recommendation_id=new.id and public.recommendation_member_active(h.tenant_id,h.actor_id) is not true) then raise insufficient_privilege;end if;
 if public.recommendation_inputs_current(new.tenant_id,new.snapshot_id,new.evidence_refs) is not true then raise check_violation;end if;
 if tg_op='INSERT' then if new.version<>1 or new.status<>'proposed' then raise check_violation;end if;new.created_at=clock_timestamp();
 else
  if new.version<>old.version+1 or (to_jsonb(new)-array['version','action','preconditions','rationale','owner_id','status','actor_id','change_reason','updated_at']) is distinct from (to_jsonb(old)-array['version','action','preconditions','rationale','owner_id','status','actor_id','change_reason','updated_at']) then raise check_violation;end if;
 end if;
 new.updated_at=clock_timestamp();return new;
end $$;
revoke all on function public.recommendation_managed_guard() from public,anon,authenticated,service_role;create trigger recommendation_managed_guard before insert or update or delete on public.recommendations for each row execute function public.recommendation_managed_guard();
create function public.recommendation_history_capture() returns trigger language plpgsql security definer set search_path='' as $$
begin if new.recommendation_schema='recommendation-v1' then insert into public.recommendation_versions(tenant_id,recommendation_id,version,actor_id,definition) values(new.tenant_id,new.id,new.version,new.actor_id,to_jsonb(new));end if;return new;end $$;
revoke all on function public.recommendation_history_capture() from public,anon,authenticated,service_role;create trigger recommendation_history_capture after insert or update on public.recommendations for each row execute function public.recommendation_history_capture();
create function public.recommendation_history_immutable() returns trigger language plpgsql set search_path='' as $$begin raise insufficient_privilege;end $$;
revoke all on function public.recommendation_history_immutable() from public,anon,authenticated,service_role;create trigger recommendation_history_immutable before update or delete on public.recommendation_versions for each row execute function public.recommendation_history_immutable();
create function public.recommendation_draft_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.recommendations;v integer;
begin
 if tg_op='DELETE' then if old.provenance->>'kind'='recommendation-draft-v1' then raise insufficient_privilege;end if;return old;end if;
 if tg_op='UPDATE' and old.provenance->>'kind'='recommendation-draft-v1' then raise insufficient_privilege;end if;
 if new.provenance->>'kind' is distinct from 'recommendation-draft-v1' then return new;end if;
 if tg_op<>'INSERT' or new.tenant_id is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or current_setting('vexa.action',true) is distinct from 'propose' or not public.vexa_member(new.tenant_id,array['owner','analyst','operator']) or new.provenance->>'actorId' is distinct from auth.uid()::text then raise insufficient_privilege;end if;
 select * into r from public.recommendations where tenant_id=new.tenant_id and id=new.recommendation_id for share;
 if r.id is null or r.recommendation_schema is distinct from 'recommendation-v1' or r.status<>'proposed' or r.version is distinct from (new.provenance->>'recommendationVersion')::integer or new.baseline_ref is distinct from r.snapshot_id or new.owner_id is distinct from r.owner_id or new.status<>'draft' or new.version<>1 or new.provenance->>'scopeHash' is distinct from r.scope_hash or new.recommendation_version is distinct from r.version or (r.owner_id is not null and not public.recommendation_member_active(new.tenant_id,r.owner_id)) or r.problem_version_id is distinct from (select id from public.problem_versions where tenant_id=new.tenant_id and problem_id=r.problem_id order by version desc limit 1) or not public.recommendation_member_active(new.tenant_id,r.actor_id) then raise check_violation;end if;
 if exists(select 1 from public.recommendation_versions h where h.tenant_id=new.tenant_id and h.recommendation_id=r.id and public.recommendation_member_active(h.tenant_id,h.actor_id) is not true) then raise insufficient_privilege;end if;
 if public.recommendation_inputs_current(new.tenant_id,r.snapshot_id,r.evidence_refs) is not true then raise check_violation;end if;
 new.provenance=jsonb_set(new.provenance,'{definition}',to_jsonb(r));new.created_at=clock_timestamp();new.updated_at=new.created_at;return new;
end $$;
revoke all on function public.recommendation_draft_guard() from public,anon,authenticated,service_role;create trigger recommendation_draft_guard before insert or update or delete on public.interventions for each row execute function public.recommendation_draft_guard();
commit;
