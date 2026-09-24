begin;
-- Additive retention. Canonical identifiers/financial history survive; source content does not.
create table public.retention_policies(
 tenant_id uuid primary key references public.organizations(id),version integer not null check(version>0),
 backup_ttl_seconds integer not null check(backup_ttl_seconds between 1 and 31536000),
 active_erasure text not null check(active_erasure='immediate'),business_history text not null check(business_history='retain-authorized-audit'),
 actor_id uuid not null,updated_at timestamptz not null default clock_timestamp(),
 foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id)
);
create table public.retention_ledger(
 tenant_id uuid not null,id uuid not null,connection_id uuid not null,entity_type text not null check(entity_type in('message','conversation','customer')),
 external_id text not null check(length(external_id) between 1 and 512),actor_id uuid not null,policy_version integer not null,
 created_at timestamptz not null default clock_timestamp(),primary key(tenant_id,id),unique(tenant_id,connection_id,entity_type,external_id),
 foreign key(tenant_id,connection_id) references public.connections(tenant_id,id),foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id)
);
create table public.retention_artifacts(
 tenant_id uuid not null,id uuid not null default gen_random_uuid(),connection_id uuid not null,entity_type text not null check(entity_type in('message','conversation','customer')),source_key text not null,
 class text not null check(class in('raw','cache','export','backup')),object_path text not null,
 expires_at timestamptz not null,status text not null default 'active' check(status in('active','pending','deleted')),deleted_at timestamptz,
 primary key(tenant_id,id),unique(tenant_id,object_path),foreign key(tenant_id,connection_id) references public.connections(tenant_id,id),
 check(object_path like tenant_id::text||'/%' and object_path!~'(^|/)\.\.(/|$)' and object_path!~'[\\[:cntrl:]]')
);
-- New erasures exist only in the typed ledger. Ambiguous historical tombstones
-- remain conservative legacy blocks; never write a new untyped alias here.
create function public.retention_source_deleted_internal(t uuid,c uuid,k text,e text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.retention_ledger where tenant_id=t and connection_id=c and entity_type=k and external_id=e)
 or exists(select 1 from public.tombstones where tenant_id=t and (connection_id is null or connection_id=c) and deleted_source_key=e)
$$;
revoke all on function public.retention_source_deleted_internal(uuid,uuid,text,text) from public,anon,authenticated,service_role;revoke all on function public.retention_source_deleted_internal(uuid,uuid,text,text) from vexa_backend;
create function public.retention_source_deleted(t uuid,c uuid,k text,e text) returns boolean language sql stable security definer set search_path='' as $$
 select case when t=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(t) then public.retention_source_deleted_internal(t,c,k,e) else false end
$$;
revoke all on function public.retention_source_deleted(uuid,uuid,text,text) from public,anon,authenticated,service_role;grant execute on function public.retention_source_deleted(uuid,uuid,text,text) to vexa_backend;
-- Existing canonical pipelines hold this same tenant:connection lock. SQL protects direct inserts too.
create function public.retention_source_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare t uuid:=new.tenant_id;c uuid;k text;e text;m public.messages;begin
 if tg_table_name='sync_raw_objects' then
  c=new.connection_id;k=coalesce(new.original->'envelope'->>'entity_type',new.normalized->'envelope'->>'entity_type');e=coalesce(new.original->'envelope'->>'external_id',new.normalized->'envelope'->>'external_id');
  perform pg_advisory_xact_lock(hashtextextended(t::text||':'||c::text,0));
  if public.retention_source_deleted_internal(t,c,k,e) then new.original='{}';new.normalized='{}';new.result=jsonb_build_object('status','rejected','code','SOURCE_TOMBSTONED');end if;return new;
 elsif tg_table_name='source_revisions' or tg_table_name='source_heads' then c=new.connection_id;k=new.entity_type;e=new.external_id;
 elsif tg_table_name='messages' then c=new.connection_id;k='message';e=new.external_id;
 elsif tg_table_name='conversations' then c=new.connection_id;k='conversation';e=new.external_id;
 elsif tg_table_name='customers' then c=new.connection_id;k='customer';e=new.external_id;
 elsif tg_table_name in('message_revisions','embeddings') then
  if tg_table_name='message_revisions' then select * into m from public.messages where tenant_id=t and id=new.message_id;
  else select v.* into m from public.messages v join public.message_revisions r on r.tenant_id=v.tenant_id and r.message_id=v.id where r.tenant_id=t and r.id=new.message_revision_id;end if;
  c=m.connection_id;k='message';e=m.external_id;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text||':'||c::text,0));
 if public.retention_source_deleted_internal(t,c,k,e) then raise check_violation using message='SOURCE_TOMBSTONED';end if;return new;
end $$;
revoke all on function public.retention_source_guard() from public,anon,authenticated,service_role,vexa_backend;
do $$declare tab text;begin foreach tab in array array['source_revisions','source_heads','messages','conversations','customers','message_revisions','embeddings','sync_raw_objects'] loop execute format('create trigger retention_source_guard before insert on public.%I for each row execute function public.retention_source_guard()',tab);end loop;end $$;
-- Tombstone deletion or editing would reopen access and must never be a normal retain capability.
create function public.retention_immutable() returns trigger language plpgsql set search_path='' as $$begin raise insufficient_privilege;end $$;
create trigger retention_ledger_immutable before update or delete on public.retention_ledger for each row execute function public.retention_immutable();
create trigger retention_tombstone_immutable before update or delete on public.tombstones for each row execute function public.retention_immutable();
revoke all on function public.retention_immutable() from public,anon,authenticated,service_role,vexa_backend;
-- Derived payloads keep their identifiers, hashes and financial/audit columns.
-- The append-only receipt authorizes exactly one old-row -> redacted-row transition.
create table public.retention_redactions(
 tenant_id uuid not null,request_id uuid not null,table_name text not null check(table_name in('extraction_runs','weekly_briefs')),
 row_id uuid not null,before_hash text not null,after_hash text not null,created_at timestamptz not null default clock_timestamp(),
 primary key(tenant_id,request_id,table_name,row_id,before_hash),
 foreign key(tenant_id,request_id) references public.retention_ledger(tenant_id,id)
);
alter table public.retention_redactions enable row level security;
alter table public.retention_redactions force row level security;
revoke all on public.retention_redactions from public,anon,authenticated,service_role,vexa_backend;
create trigger retention_redactions_immutable before update or delete on public.retention_redactions for each row execute function public.retention_immutable();
-- Match canonical revision relationships, never a substring of user text.
create function public.retention_redact_json(value jsonb,revisions uuid[]) returns jsonb language plpgsql immutable set search_path='' as $$
declare output jsonb;item record;matched boolean;begin
 if jsonb_typeof(value)='array' then select coalesce(jsonb_agg(public.retention_redact_json(x,revisions) order by ord),'[]') into output from jsonb_array_elements(value) with ordinality as a(x,ord);return output;
 elsif jsonb_typeof(value)='object' then
  output='{}';for item in select * from jsonb_each(value) loop output=output||jsonb_build_object(item.key,public.retention_redact_json(item.value,revisions));end loop;
  matched=coalesce(value->>'message_revision_id',value->>'messageRevisionId')=any(revisions::text[]);
  if matched and value ? 'quote' then output=jsonb_set(output,'{quote}','null');end if;
  if value ? 'value' and jsonb_typeof(value->'evidence')='array' and exists(select 1 from jsonb_array_elements(value->'evidence') e where coalesce(e->>'message_revision_id',e->>'messageRevisionId')=any(revisions::text[])) then output=jsonb_set(output,'{value}','null');end if;
  return output;
 end if;return value;
end $$;
revoke all on function public.retention_redact_json(jsonb,uuid[]) from public,anon,authenticated,service_role,vexa_backend;
create function public.retention_redaction_permitted(tab text,oldrow jsonb,newrow jsonb) returns boolean language sql stable security definer set search_path='' as $$
 select current_setting('vexa.action',true)='retain' and oldrow->>'tenant_id'=current_setting('vexa.tenant_id',true)
 and public.vexa_member((oldrow->>'tenant_id')::uuid,array['owner']) and exists(select 1 from public.retention_redactions r
 where r.tenant_id=(oldrow->>'tenant_id')::uuid and r.table_name=tab and r.row_id=(oldrow->>'id')::uuid
 and r.before_hash=encode(sha256(convert_to(oldrow::text,'UTF8')),'hex') and r.after_hash=encode(sha256(convert_to(newrow::text,'UTF8')),'hex'))
$$;
revoke all on function public.retention_redaction_permitted(text,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.retention_redaction_permitted(text,jsonb,jsonb) to vexa_backend;
create or replace function public.vexa_extraction_terminal_guard() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare claim public.extraction_claims; begin
 if tg_op='UPDATE' and public.retention_redaction_permitted(tg_table_name,to_jsonb(old),to_jsonb(new)) then return new;end if;
 select * into claim from public.extraction_claims where tenant_id=OLD.tenant_id and run_id=OLD.id;
 if found then
  if OLD.status<>'running' or NEW.id<>OLD.id or NEW.tenant_id<>OLD.tenant_id or NEW.job_id is distinct from OLD.job_id
   or NEW.conversation_id<>OLD.conversation_id or NEW.input_hash is distinct from OLD.input_hash
   or NEW.prompt_hash<>OLD.prompt_hash or NEW.schema_hash<>OLD.schema_hash
   or NEW.status not in ('succeeded','failed','abstained','policy_blocked')
   or claim.actor_id<>auth.uid() or claim.owner_token is distinct from nullif(current_setting('vexa.extraction_owner_token',true),'')::uuid
  then raise exception 'extraction immutable or stale owner' using errcode='23514';end if;
 end if;
 return NEW;
end $$;
create or replace function public.brief_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare b public.workspace_scope_bindings;prior public.workspace_scope_bindings;s public.metric_snapshots;ps public.metric_snapshots;x jsonb;m jsonb;v jsonb;ev jsonb;pv public.problem_versions;def jsonb;expected jsonb;amount text;delta text;comparable boolean;head uuid;begin
 if tg_op='UPDATE' and public.retention_redaction_permitted(tg_table_name,to_jsonb(old),to_jsonb(new)) then return new;end if;
 if tg_op<>'INSERT' then if old.brief_schema is not null or new.brief_schema is not null then raise check_violation;end if;return case when tg_op='DELETE' then old else new end;end if;
 if new.brief_schema is null then return new;end if;
 if new.brief_schema is distinct from 'brief-v1' or new.status is distinct from 'published' or new.actor_id is distinct from auth.uid() or current_setting('vexa.action',true) is distinct from 'import' or public.brief_member(new.tenant_id,new.actor_id,array['owner','analyst']) is not true then raise insufficient_privilege;end if;
 if new.binding_id is null or new.input_hash is null or new.content_hash is null or new.canonical_input is null or new.canonical_document is null or new.document is null or new.input_manifest is null or new.input_hash!~'^[a-f0-9]{64}$' or new.content_hash!~'^[a-f0-9]{64}$' or new.canonical_input::jsonb is distinct from new.input_manifest or new.canonical_document::jsonb is distinct from new.document or encode(sha256(convert_to(new.canonical_input,'UTF8')),'hex') is distinct from new.input_hash or encode(sha256(convert_to(new.canonical_document,'UTF8')),'hex') is distinct from new.content_hash then raise check_violation;end if;
 if public.brief_manifest_current(new.tenant_id,new.input_manifest) is not true then raise insufficient_privilege;end if;
 select * into b from public.workspace_scope_bindings where tenant_id=new.tenant_id and id=new.binding_id;select * into s from public.metric_snapshots where tenant_id=new.tenant_id and id=new.snapshot_id;
 if b.base_snapshot_id is distinct from new.snapshot_id or b.scope_hash is distinct from new.scope_hash or new.input_manifest->>'bindingId' is distinct from b.id::text or new.input_manifest->>'comparisonBindingId' is distinct from new.comparison_binding_id::text or new.input_manifest->>'snapshotId' is distinct from new.snapshot_id::text or new.input_manifest->>'snapshotContentHash' is distinct from s.content_hash or new.input_manifest->>'documentHash' is distinct from new.content_hash or new.input_manifest->>'template' is distinct from 'brief-observed-v1' then raise check_violation;end if;
 expected=b.filters||jsonb_build_object('date_start',b.filters->>'date_start'||'T00:00:00.000Z','date_end',b.filters->>'date_end'||'T00:00:00.000Z','scope_hash',b.scope_hash);
 if new.document->'scope' is distinct from expected or new.document->>'snapshotId' is distinct from s.id::text or new.document->>'scopeHash' is distinct from b.scope_hash or new.document->>'baseScopeHash' is distinct from b.base_scope_hash or new.document->>'templateVersion' is distinct from 'brief-observed-v1' or new.document->'sent' is distinct from 'false'::jsonb or new.document->'causalClaim' is distinct from 'false'::jsonb or new.document->'comparison'->'causalClaim' is distinct from 'false'::jsonb or new.document->'problemRowsAreAdditive' is distinct from 'false'::jsonb or (new.document->>'asOf')::timestamptz is distinct from s.as_of then raise check_violation;end if;
 if jsonb_typeof(new.document->'forecast') is distinct from 'object' or new.document->'forecast'->>'status' is distinct from 'not_estimable' or (new.document->'forecast')-array['status','reason'] is distinct from '{}'::jsonb or jsonb_typeof(new.document->'forecast'->'reason') is distinct from 'string' then raise check_violation;end if;
 if jsonb_typeof(new.document->'metrics') is distinct from 'array' or jsonb_array_length(new.document->'metrics')<>3 or (select count(distinct value->>'kind') from jsonb_array_elements(new.document->'metrics'))<>3 then raise check_violation;end if;
 for m in select value from jsonb_array_elements(new.document->'metrics') loop
 v=public.brief_metric(new.tenant_id,b.id,m->>'kind');if m->>'currency' is distinct from b.filters->>'currency' or m->'exponent' is distinct from b.filters->'exponent' or m->'amount_minor' is distinct from v->'amountMinor' or m->'known_subtotal' is distinct from v->'knownSubtotalMinor' or m->'coverage' is distinct from jsonb_build_object('known_n',v->'knownCount','eligible_n',v->'totalCount') or m->>'status' is distinct from v->>'status' or (select coalesce(jsonb_agg(z order by z),'[]') from jsonb_array_elements(m->'missing_reasons') z) is distinct from (select coalesce(jsonb_agg(z order by z),'[]') from jsonb_array_elements(v->'missingReasons') z) or m->>'source_ref' is distinct from 'workspace:'||b.scope_hash then raise check_violation;end if;
 end loop;
 if jsonb_typeof(new.document->'top3') is distinct from 'array' or jsonb_array_length(new.document->'top3')>3 or jsonb_typeof(new.document->'critical') is distinct from 'array' then raise check_violation;end if;
 for x in select value from jsonb_array_elements((new.document->'top3')||(new.document->'critical')) loop
 select p.* into pv from public.problem_versions p where p.tenant_id=new.tenant_id and p.problem_id=(x->>'id')::uuid and p.version=(x->>'version')::integer and exists(select 1 from jsonb_array_elements(b.problem_versions) bp where bp->>'problemId'=p.problem_id::text and bp->>'versionId'=p.id::text);
 if pv.id is null or x->>'title' is distinct from pv.provenance->'snapshot'->>'label' or jsonb_typeof(x->'evidence') is distinct from 'array' or jsonb_array_length(x->'evidence')=0 or (x->>'evidenceCount')::integer is distinct from jsonb_array_length(x->'evidence') then raise check_violation;end if;
 for ev in select value from jsonb_array_elements(x->'evidence') loop
 if not exists(select 1 from public.evidence_spans es join public.issues i on i.tenant_id=es.tenant_id and i.id=es.issue_id join public.extraction_runs r on r.tenant_id=i.tenant_id and r.id=i.extraction_run_id where es.tenant_id=new.tenant_id and r.id::text=ev->>'runId' and es.message_revision_id::text=ev->>'messageRevisionId' and es.quote_hash=ev->>'quoteHash' and es.quote_hash=encode(sha256(convert_to(ev->>'quote','UTF8')),'hex') and i.category=ev->>'category' and coalesce(i.severity,'unknown')=ev->>'severity' and exists(select 1 from jsonb_array_elements(r.provenance->'input_manifest') z where z->>'message_revision_id'=es.message_revision_id::text and z->>'role'=ev->>'role') and exists(select 1 from public.problem_embedding_members em where em.tenant_id=r.tenant_id and em.extraction_run_id=r.id and em.embedding_id in(select value::uuid from jsonb_array_elements_text(pv.provenance->'snapshot'->'embeddingIds')))) then raise check_violation;end if;end loop;
 for m in select value from jsonb_array_elements(x->'metrics') loop v=public.brief_metric(new.tenant_id,b.id,m->>'kind',(x->>'id')::uuid);if m->>'currency' is distinct from b.filters->>'currency' or m->'exponent' is distinct from b.filters->'exponent' or m->'amount_minor' is distinct from v->'amountMinor' or m->'known_subtotal' is distinct from v->'knownSubtotalMinor' or m->'coverage' is distinct from jsonb_build_object('known_n',v->'knownCount','eligible_n',v->'totalCount') or m->>'status' is distinct from v->>'status' or (select coalesce(jsonb_agg(z order by z),'[]') from jsonb_array_elements(m->'missing_reasons') z) is distinct from (select coalesce(jsonb_agg(z order by z),'[]') from jsonb_array_elements(v->'missingReasons') z) then raise check_violation;end if;end loop;
 end loop;
 if jsonb_typeof(new.document->'actions') is distinct from 'array' or jsonb_array_length(new.document->'actions') is distinct from jsonb_array_length(new.input_manifest->'actions') then raise check_violation;end if;
 for x in select value from jsonb_array_elements(new.document->'actions') loop
 if not exists(select 1 from jsonb_array_elements(new.input_manifest->'actions') a where a->>'kind'=x->>'kind' and a->>'id'=x->>'id' and a->'version'=x->'version') then raise check_violation;end if;
 if x->>'kind'='recommendation' then select definition into def from public.recommendation_versions where tenant_id=new.tenant_id and recommendation_id=(x->>'id')::uuid and version=(x->>'version')::integer;expected=jsonb_build_object('title',def->'title','status',def->'status','ownerId',def->'owner_id','summary',(def->>'action')||' '||(def->>'rationale'));else select definition into def from public.intervention_events where tenant_id=new.tenant_id and intervention_id=(x->>'id')::uuid and version=(x->>'version')::integer;expected=jsonb_build_object('title',def->'provenance'->'definition'->'title','status',def->'status','ownerId',def->'owner_id','summary',def->'hypothesis');end if;
 if (x-array['id','version','kind','href']) is distinct from expected then raise check_violation;end if;end loop;
 if new.comparison_binding_id is null then if new.document->'comparison'->>'status' is distinct from 'not_requested' or new.document->'comparison'->'metrics' is distinct from '[]'::jsonb then raise check_violation;end if;
 else
 select * into prior from public.workspace_scope_bindings where tenant_id=new.tenant_id and id=new.comparison_binding_id;select * into ps from public.metric_snapshots where tenant_id=new.tenant_id and id=prior.base_snapshot_id;
 if (b.filters-array['date_start','date_end','snapshot_id']) is distinct from (prior.filters-array['date_start','date_end','snapshot_id']) or new.document->'comparison'->>'snapshotId' is distinct from ps.id::text or new.document->'comparison'->>'scopeHash' is distinct from prior.scope_hash or jsonb_array_length(new.document->'comparison'->'metrics') is distinct from 3 then raise check_violation;end if;
 comparable=ps.date_end<=s.date_start and ps.date_end-ps.date_start=s.date_end-s.date_start and ps.policy_version=s.policy_version and ps.economic_schema_version=s.economic_schema_version and (select coalesce(jsonb_agg(distinct (z-'id') order by (z-'id')),'[]') from jsonb_array_elements(ps.input_manifest->'models') z)=(select coalesce(jsonb_agg(distinct (z-'id') order by (z-'id')),'[]') from jsonb_array_elements(s.input_manifest->'models') z);
 if new.document->'comparison'->>'status' is distinct from (case when comparable then 'available' else 'not_comparable' end) then raise check_violation;end if;
 for m in select value from jsonb_array_elements(new.document->'comparison'->'metrics') loop v=public.brief_metric(new.tenant_id,prior.id,m->>'kind');x=public.brief_metric(new.tenant_id,b.id,m->>'kind');delta=null;if comparable and v->>'amountMinor' is not null and x->>'amountMinor' is not null then delta=((x->>'amountMinor')::numeric-(v->>'amountMinor')::numeric)::text;end if;if m->>'previousAmountMinor' is distinct from v->>'amountMinor' or m->>'currentAmountMinor' is distinct from x->>'amountMinor' or m->>'deltaMinor' is distinct from delta or m->>'currency' is distinct from b.filters->>'currency' or m->'exponent' is distinct from b.filters->'exponent' then raise check_violation;end if;end loop;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':briefs:'||new.snapshot_id::text,0));select brief_id into head from public.brief_heads where tenant_id=new.tenant_id and binding_id=new.binding_id;if new.previous_id is distinct from head or new.version<>(select coalesce(max(version),0)+1 from public.weekly_briefs where tenant_id=new.tenant_id and snapshot_id=new.snapshot_id) then raise check_violation;end if;
 new.created_at=clock_timestamp();new.updated_at=new.created_at;return new;
end $$;
create function public.retention_erase(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=nullif(current_setting('vexa.tenant_id',true),'')::uuid;c uuid:=(p->>'connectionId')::uuid;k text:=p->>'entityType';e text:=p->>'externalId';rid uuid:=(p->>'requestId')::uuid;
 pol public.retention_policies;prior public.retention_ledger;mid uuid[];cid uuid[];revs uuid[];import_ids uuid[];probs uuid[];m record;oldrow jsonb;newrow jsonb;redacted jsonb;count_raw integer;count_vectors integer;begin
 if current_setting('vexa.action',true) is distinct from 'retain' or public.vexa_member(t,array['owner']) is not true then raise insufficient_privilege;end if;
 if p->>'confirmed' is distinct from 'true' or k not in('message','conversation','customer') or e is null or length(e) not between 1 and 512 or rid is null then raise check_violation;end if;
 select * into pol from public.retention_policies where tenant_id=t;if pol.tenant_id is null then raise check_violation using message='RETENTION_POLICY_REQUIRED';end if;
 if not exists(select 1 from public.connections where tenant_id=t and id=c) then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text||':'||c::text,0));
 select * into prior from public.retention_ledger where tenant_id=t and id=rid;
 if prior.id is not null and (prior.connection_id,prior.entity_type,prior.external_id) is distinct from(c,k,e) then raise unique_violation;end if;
 insert into public.retention_ledger(tenant_id,id,connection_id,entity_type,external_id,actor_id,policy_version) values(t,rid,c,k,e,auth.uid(),pol.version) on conflict do nothing;
 -- Broader source erasure includes descendants; aliases are resolved by canonical foreign keys, not display names.
 select coalesce(array_agg(id),'{}') into cid from public.conversations where tenant_id=t and connection_id=c and ((k='conversation' and external_id=e) or (k='customer' and customer_id in(select id from public.customers where tenant_id=t and connection_id=c and external_id=e)));
 select coalesce(array_agg(id),'{}') into mid from public.messages where tenant_id=t and connection_id=c and ((k='message' and external_id=e) or conversation_id=any(cid));
 select coalesce(array_agg(id),'{}') into revs from public.message_revisions where tenant_id=t and message_id=any(mid);
 select coalesce(array_agg(distinct i.import_id),'{}') into import_ids from public.import_rows i join public.message_revisions r on r.tenant_id=i.tenant_id and r.text_ref=i.payload_ref where i.tenant_id=t and r.id=any(revs);
 select coalesce(array_agg(distinct problem_id),'{}') into probs from public.problem_embedding_members where tenant_id=t and embedding_id in(select id from public.embeddings where tenant_id=t and message_revision_id=any(revs));
 for m in select 'message'::text as kind,id,external_id from public.messages where tenant_id=t and id=any(mid) union all select 'conversation',id,external_id from public.conversations where tenant_id=t and id=any(cid) loop
  insert into public.retention_ledger(tenant_id,id,connection_id,entity_type,external_id,actor_id,policy_version) values(t,gen_random_uuid(),c,m.kind,m.external_id,auth.uid(),pol.version) on conflict do nothing;
 end loop;
 delete from public.problem_embedding_members where tenant_id=t and embedding_id in(select id from public.embeddings where tenant_id=t and message_revision_id=any(revs));
 delete from public.embeddings where tenant_id=t and message_revision_id=any(revs);get diagnostics count_vectors=row_count;
 -- Authorize exact derived redactions with immutable full-row digests before updating.
 for m in select r.* from public.extraction_runs r where r.tenant_id=t and public.retention_redact_json(r.provenance,revs) is distinct from r.provenance for update loop
  oldrow=to_jsonb(m);redacted=public.retention_redact_json(m.provenance,revs);newrow=jsonb_set(oldrow,'{provenance}',redacted);
  insert into public.retention_redactions(tenant_id,request_id,table_name,row_id,before_hash,after_hash) values(t,rid,'extraction_runs',m.id,encode(sha256(convert_to(oldrow::text,'UTF8')),'hex'),encode(sha256(convert_to(newrow::text,'UTF8')),'hex')) on conflict do nothing;
  update public.extraction_runs set provenance=redacted where tenant_id=t and id=m.id;
 end loop;
 for m in select b.* from public.weekly_briefs b where b.tenant_id=t and public.retention_redact_json(b.document,revs) is distinct from b.document for update loop
  oldrow=to_jsonb(m);redacted=public.retention_redact_json(m.document,revs);newrow=jsonb_set(jsonb_set(oldrow,'{document}',redacted),'{canonical_document}',to_jsonb(redacted::text));
  insert into public.retention_redactions(tenant_id,request_id,table_name,row_id,before_hash,after_hash) values(t,rid,'weekly_briefs',m.id,encode(sha256(convert_to(oldrow::text,'UTF8')),'hex'),encode(sha256(convert_to(newrow::text,'UTF8')),'hex')) on conflict do nothing;
  update public.weekly_briefs set document=redacted,canonical_document=redacted::text where tenant_id=t and id=m.id;
 end loop;
 update public.redaction_maps set private_map='[]' where tenant_id=t and (original_revision_id=any(revs) or redacted_revision_id=any(revs));
 update public.message_revisions set redacted_text=null,text_ref='deleted:'||id::text,deleted_at=coalesce(deleted_at,clock_timestamp()),provenance=jsonb_build_object('retention',rid) where tenant_id=t and id=any(revs);
 update public.messages set deleted_at=coalesce(deleted_at,clock_timestamp()),provenance=jsonb_build_object('retention',rid) where tenant_id=t and id=any(mid);
 update public.conversations set deleted_at=coalesce(deleted_at,clock_timestamp()),provenance=jsonb_build_object('retention',rid) where tenant_id=t and id=any(cid);
 update public.customers set display_name=null,provenance=jsonb_build_object('retention',rid) where tenant_id=t and connection_id=c and k='customer' and external_id=e;
 update public.source_revisions set snapshot='[]',provenance=jsonb_build_object('retention',rid) where tenant_id=t and connection_id=c and (canonical_id=any(mid) or canonical_id=any(cid) or (k='customer' and entity_type=k and external_id=e));
 update public.sync_raw_objects set original='{}',normalized='{}',result=jsonb_build_object('status','erased') where tenant_id=t and connection_id=c and (public.retention_source_deleted_internal(t,c,original->'envelope'->>'entity_type',original->'envelope'->>'external_id') or public.retention_source_deleted_internal(t,c,normalized->'envelope'->>'entity_type',normalized->'envelope'->>'external_id'));get diagnostics count_raw=row_count;
 -- Entire containing upload must be deleted; it cannot be safely edited in place.
 insert into public.retention_artifacts(tenant_id,connection_id,entity_type,source_key,class,object_path,expires_at,status) select t,c,k,e,'raw',object_path,clock_timestamp(),'pending' from public.imports where tenant_id=t and id=any(import_ids) and object_path is not null on conflict(tenant_id,object_path) do update set status='pending';
 update public.retention_artifacts a set status='pending' where a.tenant_id=t and a.connection_id=c and a.class<>'backup' and exists(select 1 from public.retention_ledger l where l.tenant_id=a.tenant_id and l.connection_id=a.connection_id and l.entity_type=a.entity_type and l.external_id=a.source_key);
 update public.problems set archived_at=coalesce(archived_at,clock_timestamp()) where tenant_id=t and id=any(probs);
 -- Fence related jobs before storage IO. This closes workers and prevents late commits.
 update public.jobs set state='cancelled',cancel_requested_at=clock_timestamp(),fencing_token=fencing_token+1,lease_until=null where tenant_id=t and state in('queued','running','partial') and (import_id=any(import_ids) or id in(select job_id from public.extraction_runs where tenant_id=t and conversation_id in(select conversation_id from public.messages where tenant_id=t and id=any(mid))) or id in(select job_id from public.problem_embedding_requests where tenant_id=t and extraction_run_id in(select id from public.extraction_runs where tenant_id=t and conversation_id in(select conversation_id from public.messages where tenant_id=t and id=any(mid)))));
 update public.attempts set state='cancelled',finished_at=clock_timestamp() where tenant_id=t and state='running' and job_id in(select id from public.jobs where tenant_id=t and state='cancelled');
 update public.outbox set state='cancelled',lease_until=null where tenant_id=t and job_id in(select id from public.jobs where tenant_id=t and state='cancelled');
 return jsonb_build_object('requestId',rid,'state','active_content_erased','messages',cardinality(mid),'vectors',count_vectors,'rawRows',count_raw,'storagePending',(select count(*) from public.retention_artifacts where tenant_id=t and status='pending'),'businessHistory','retained_authorized_audit','externalCopies','not_verified');
end $$;
revoke all on function public.retention_erase(jsonb) from public,anon,authenticated,service_role;grant execute on function public.retention_erase(jsonb) to vexa_backend;
do $$declare tab text;begin foreach tab in array array['retention_policies','retention_ledger','retention_artifacts'] loop
 execute format('alter table public.%I enable row level security',tab);execute format('alter table public.%I force row level security',tab);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role,vexa_backend',tab);
 execute format('grant select on public.%I to vexa_backend',tab);
 execute format('create policy retention_read on public.%I for select to vexa_backend using(tenant_id=nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid and public.vexa_member(tenant_id,array[''owner'']))',tab);
end loop;end $$;
grant insert,update on public.retention_policies,public.retention_artifacts to vexa_backend;
create policy retention_write_policy on public.retention_policies to vexa_backend using(public.vexa_backend_action(tenant_id,array['retain'])) with check(public.vexa_backend_action(tenant_id,array['retain']));
create policy retention_write_artifact on public.retention_artifacts to vexa_backend using(public.vexa_backend_action(tenant_id,array['retain'])) with check(public.vexa_backend_action(tenant_id,array['retain']));
commit;
