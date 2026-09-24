begin;
-- Serialize artifact admission with the source scope used by preview/erase.
-- Scope identity cannot be rewritten after consent; status/expiry updates remain compatible.
create function public.retention_artifact_scope_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if row(NEW.id,NEW.tenant_id,NEW.connection_id,NEW.entity_type,NEW.source_key,NEW.class,NEW.object_path)
   is distinct from row(OLD.id,OLD.tenant_id,OLD.connection_id,OLD.entity_type,OLD.source_key,OLD.class,OLD.object_path)
  then raise insufficient_privilege using message='retention artifact identity immutable';end if;
  return NEW;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||':'||NEW.connection_id::text,0));
 if NEW.class<>'backup' and NEW.status<>'deleted' and public.retention_source_deleted_internal(NEW.tenant_id,NEW.connection_id,NEW.entity_type,NEW.source_key)
 then NEW.status:='pending';end if;
 return NEW;
end $$;
revoke all on function public.retention_artifact_scope_guard() from public,anon,authenticated,service_role,vexa_backend;
create trigger retention_artifact_scope_guard before insert or update on public.retention_artifacts
 for each row execute function public.retention_artifact_scope_guard();
create table public.retention_web_requests (
 tenant_id uuid not null,request_id uuid not null,actor_id uuid not null,token_hash text not null check(token_hash~'^[a-f0-9]{64}$'),result jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(tenant_id,request_id),foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id)
);
alter table public.retention_web_requests enable row level security;alter table public.retention_web_requests force row level security;
revoke all on public.retention_web_requests from public,anon,authenticated,service_role,vexa_backend;grant select,insert on public.retention_web_requests to vexa_backend;
create policy retention_web_read on public.retention_web_requests for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id,array['owner']));
create policy retention_web_insert on public.retention_web_requests for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and actor_id=auth.uid() and public.vexa_backend_action(tenant_id,array['retain']));
create function public.retention_storage_authorized(p_path text) returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from public.retention_artifacts a join public.memberships m on m.tenant_id=a.tenant_id where a.object_path=p_path and split_part(p_path,'/',1)=a.tenant_id::text and a.status='pending' and (a.expires_at<=clock_timestamp() or (a.class<>'backup' and public.retention_source_deleted_internal(a.tenant_id,a.connection_id,a.entity_type,a.source_key))) and m.user_id=auth.uid() and m.status='active' and m.role='owner')
$$;
revoke all on function public.retention_storage_authorized(text) from public,anon,authenticated,service_role;grant execute on function public.retention_storage_authorized(text) to authenticated,vexa_backend;
-- Restrict the old general owner DELETE policy to authorized pending artifacts.
create policy retention_only_delete on storage.objects as restrictive for delete to authenticated using(bucket_id<>'vexa-private' or public.retention_storage_authorized(name));
drop policy immutable_import_delete on storage.objects;
create policy immutable_import_delete on storage.objects as restrictive for delete to authenticated using(bucket_id<>'vexa-private' or split_part(name,'/',2)<>'imports' or public.retention_storage_authorized(name));
create or replace function public.guard_reserved_import_object() returns trigger
language plpgsql security definer set search_path='' as $$
declare u public.import_uploads; i public.imports;
begin
 if TG_OP='DELETE' and OLD.bucket_id='vexa-private' and public.retention_storage_authorized(OLD.name) then return OLD;end if;
 if TG_OP <> 'INSERT' and OLD.bucket_id='vexa-private' and split_part(OLD.name,'/',2)='imports' then
  raise exception 'reserved import object immutable' using errcode='42501';
 end if;
 if TG_OP='DELETE' then return OLD; end if;
 if NEW.bucket_id<>'vexa-private' or split_part(NEW.name,'/',2)<>'imports' then return NEW; end if;
 select * into i from public.imports where object_path=NEW.name;
 select * into u from public.import_uploads where import_id=i.id and tenant_id=i.tenant_id;
 if i.id is null or u.import_id is null or i.state<>'reserved' or u.expires_at<=clock_timestamp()
 or NEW.owner_id is distinct from u.user_id::text
 or not exists(select 1 from public.memberships where tenant_id=u.tenant_id and user_id=u.user_id and status='active' and role in ('owner','analyst'))
 then raise exception 'invalid upload reservation' using errcode='42501'; end if;
 -- Storage signing may perform a rollback-only permission probe without metadata.
 if NEW.metadata ? 'size' and (NEW.metadata->>'size')::bigint is distinct from u.size then
  raise exception 'upload size mismatch' using errcode='23514';
 end if;
 return NEW;
end $$;
-- Read-only footprint under the same connection lock used by ingestion and erasure.
create function public.retention_web_scope(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=nullif(current_setting('vexa.tenant_id',true),'')::uuid;c uuid:=(p->>'connectionId')::uuid;k text:=p->>'entityType';e text:=p->>'externalId';cid uuid[];mid uuid[];revs uuid[];imps uuid[];result jsonb;begin
 if current_setting('vexa.action',true) is distinct from 'retain' or public.vexa_member(t,array['owner']) is not true then raise insufficient_privilege;end if;
 if k not in('message','conversation','customer') or e is null or length(e) not between 1 and 512 then raise check_violation;end if;
 if not exists(select 1 from public.connections where tenant_id=t and id=c) then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text||':'||c::text,0));
 perform 1 from public.retention_policies where tenant_id=t for update;
 if not exists(select 1 from public.source_heads where tenant_id=t and connection_id=c and entity_type=k and external_id=e) and not exists(select 1 from public.retention_ledger where tenant_id=t and connection_id=c and entity_type=k and external_id=e) then raise no_data_found;end if;
 select coalesce(array_agg(id order by id),'{}') into cid from public.conversations where tenant_id=t and connection_id=c and ((k='conversation' and external_id=e) or (k='customer' and customer_id in(select id from public.customers where tenant_id=t and connection_id=c and external_id=e)));
 select coalesce(array_agg(id order by id),'{}') into mid from public.messages where tenant_id=t and connection_id=c and ((k='message' and external_id=e) or conversation_id=any(cid));
 select coalesce(array_agg(id order by id),'{}') into revs from public.message_revisions where tenant_id=t and message_id=any(mid);
 if cardinality(mid)>500 or cardinality(revs)>1000 then raise program_limit_exceeded using message='RETENTION_SCOPE_LIMIT';end if;
 select coalesce(array_agg(distinct i.import_id order by i.import_id),'{}') into imps from public.import_rows i join public.message_revisions r on r.tenant_id=i.tenant_id and r.text_ref=i.payload_ref where i.tenant_id=t and r.id=any(revs);
 -- Include content hashes and exact whole-file collateral, never source text.
 result=jsonb_build_object('conversations',to_jsonb(cid),'messages',to_jsonb(mid),'revisions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'hash',hash) order by id) from public.message_revisions where tenant_id=t and id=any(revs)),'[]'),
 'vectors',coalesce((select jsonb_agg(id order by id) from public.embeddings where tenant_id=t and message_revision_id=any(revs)),'[]'),
 'jobs',coalesce((select jsonb_agg(j.id order by j.id) from public.jobs j where j.tenant_id=t and j.state in('queued','running','partial') and (j.import_id=any(imps) or j.id in(select job_id from public.extraction_runs where tenant_id=t and conversation_id in(select conversation_id from public.messages where tenant_id=t and id=any(mid))) or j.id in(select job_id from public.problem_embedding_requests where tenant_id=t and extraction_run_id in(select id from public.extraction_runs where tenant_id=t and conversation_id in(select conversation_id from public.messages where tenant_id=t and id=any(mid)))))),'[]'),
 'problems',coalesce((select jsonb_agg(distinct problem_id order by problem_id) from public.problem_embedding_members where tenant_id=t and embedding_id in(select id from public.embeddings where tenant_id=t and message_revision_id=any(revs))),'[]'),
 'rawObjects',coalesce((select jsonb_agg(o.id order by o.id) from public.sync_raw_objects o where o.tenant_id=t and o.connection_id=c and ((o.original->'envelope'->>'entity_type'=k and o.original->'envelope'->>'external_id'=e) or (o.normalized->'envelope'->>'entity_type'=k and o.normalized->'envelope'->>'external_id'=e) or (o.original->'envelope'->>'entity_type'='message' and o.original->'envelope'->>'external_id' in(select external_id from public.messages where tenant_id=t and id=any(mid))) or (o.normalized->'envelope'->>'entity_type'='message' and o.normalized->'envelope'->>'external_id' in(select external_id from public.messages where tenant_id=t and id=any(mid))) or (o.original->'envelope'->>'entity_type'='conversation' and o.original->'envelope'->>'external_id' in(select external_id from public.conversations where tenant_id=t and id=any(cid))) or (o.normalized->'envelope'->>'entity_type'='conversation' and o.normalized->'envelope'->>'external_id' in(select external_id from public.conversations where tenant_id=t and id=any(cid))))),'[]'),
 'rawFiles',coalesce((select jsonb_agg(jsonb_build_object('importId',i.id,'path',i.object_path,'hash',i.file_hash,'rows',(select count(*) from public.import_rows r where r.tenant_id=t and r.import_id=i.id)) order by i.id) from public.imports i where i.tenant_id=t and i.id=any(imps) and i.object_path is not null),'[]'),
 'artifacts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'path',a.object_path,'class',a.class) order by a.id) from public.retention_artifacts a where a.tenant_id=t and a.connection_id=c and a.class<>'backup' and ((a.entity_type=k and a.source_key=e) or a.entity_type='message' and a.source_key in(select external_id from public.messages where tenant_id=t and id=any(mid)) or a.entity_type='conversation' and a.source_key in(select external_id from public.conversations where tenant_id=t and id=any(cid)))),'[]'),
 'derived',coalesce((select jsonb_agg(x order by x->>'table',x->>'id') from(select jsonb_build_object('table','extraction_runs','id',r.id,'hash',encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex')) x from public.extraction_runs r where r.tenant_id=t and public.retention_redact_json(r.provenance,revs) is distinct from r.provenance union all select jsonb_build_object('table','weekly_briefs','id',b.id,'hash',encode(sha256(convert_to(to_jsonb(b)::text,'UTF8')),'hex')) from public.weekly_briefs b where b.tenant_id=t and public.retention_redact_json(b.document,revs) is distinct from b.document)y),'[]'),
 'policy',(select jsonb_build_object('version',version,'backupTtlSeconds',backup_ttl_seconds) from public.retention_policies where tenant_id=t));
 if octet_length(result::text)>131072 then raise program_limit_exceeded using message='RETENTION_SCOPE_LIMIT';end if;
 return result;
end $$;
revoke all on function public.retention_web_scope(jsonb) from public,anon,authenticated,service_role;grant execute on function public.retention_web_scope(jsonb) to vexa_backend;
create function public.retention_web_redactions(p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=nullif(current_setting('vexa.tenant_id',true),'')::uuid;result jsonb;begin
 if current_setting('vexa.action',true) is distinct from 'retain' or public.vexa_member(t,array['owner']) is not true or not exists(select 1 from public.retention_ledger where tenant_id=t and id=p_request and actor_id=auth.uid()) then raise insufficient_privilege;end if;
 select coalesce(jsonb_agg(jsonb_build_object('table',table_name,'id',row_id,'hash',before_hash) order by table_name,row_id),'[]') into result from public.retention_redactions where tenant_id=t and request_id=p_request;return result;
end $$;
revoke all on function public.retention_web_redactions(uuid) from public,anon,authenticated,service_role;grant execute on function public.retention_web_redactions(uuid) to vexa_backend;
commit;
