begin;
-- Native occurrences remain import rows; facts and their current M:N projections
-- are separate. No mutation of conversations.customer_id.
create table public.native_customer_associations(
 id uuid primary key,tenant_id uuid not null references public.organizations(id),source_connection_id uuid not null,
 provider text not null check(provider='hubspot'),portal_id text not null,ticket_id text not null,contact_id text not null,
 first_evidence_hash text not null check(first_evidence_hash~'^[a-f0-9]{64}$'),immutable_evidence jsonb not null,
 first_import_row_id uuid not null,source_version_hash text not null,resolution_state text not null check(resolution_state in('pending','resolved','blocked','retained')),
 reason text not null,version bigint not null default 1 check(version>0),selected_evidence_hash text,
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),retained_at timestamptz,
 unique(tenant_id,id),unique(tenant_id,source_connection_id,provider,portal_id,ticket_id,contact_id),
 foreign key(tenant_id,source_connection_id) references public.connections(tenant_id,id),
 foreign key(tenant_id,first_import_row_id) references public.import_rows(tenant_id,id) deferrable initially deferred
);
create table public.conversation_customer_association_bindings(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,fact_id uuid not null,conversation_id uuid not null,customer_id uuid not null,
 conversation_connection_id uuid not null,customer_connection_id uuid not null,conversation_revision_id uuid not null,customer_revision_id uuid not null,
 conversation_head_version bigint not null,customer_head_version bigint not null,fact_version bigint not null,evidence_hash text not null,
 method text not null check(method in('unique_explicit_bridge','owner_decision')),decision_id uuid not null,actor_id uuid not null,active boolean not null default true,
 created_at timestamptz not null default clock_timestamp(),deactivated_at timestamptz,provenance jsonb not null,
 unique(tenant_id,id),foreign key(tenant_id,fact_id) references public.native_customer_associations(tenant_id,id),
 foreign key(tenant_id,conversation_id) references public.conversations(tenant_id,id),foreign key(tenant_id,customer_id) references public.customers(tenant_id,id),
 foreign key(tenant_id,conversation_connection_id) references public.connections(tenant_id,id),foreign key(tenant_id,customer_connection_id) references public.connections(tenant_id,id),
 foreign key(tenant_id,conversation_revision_id) references public.source_revisions(tenant_id,id),foreign key(tenant_id,customer_revision_id) references public.source_revisions(tenant_id,id),
 foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id)
);
create unique index association_active_pair on public.conversation_customer_association_bindings(tenant_id,fact_id,conversation_id,customer_id) where active;
create index association_fact_state on public.native_customer_associations(tenant_id,resolution_state,id);
create index association_fact_native_contact on public.native_customer_associations(tenant_id,source_connection_id,contact_id);
create index association_binding_conversation on public.conversation_customer_association_bindings(tenant_id,conversation_id,id);
create index association_binding_customer on public.conversation_customer_association_bindings(tenant_id,customer_id,id);
create index association_evidence_rows on public.import_rows(tenant_id,((provenance->'result'->>'fact_id')),((provenance->'result'->>'evidence_hash')),id) where provenance->'result' ? 'fact_id';
create unique index association_origin_version on public.audit_events(tenant_id,resource,((provenance->>'version')::bigint)) where action in('association_origin_approved','association_origin_revoked');
create unique index association_request_replay on public.audit_events(tenant_id,((provenance->>'requestId'))) where action in('association_origin_approved','association_origin_revoked','association_resolve');
alter table public.native_customer_associations enable row level security;alter table public.native_customer_associations force row level security;
alter table public.conversation_customer_association_bindings enable row level security;alter table public.conversation_customer_association_bindings force row level security;
revoke all on public.native_customer_associations,public.conversation_customer_association_bindings from public,anon,authenticated,service_role,vexa_backend;
grant select on public.native_customer_associations,public.conversation_customer_association_bindings to vexa_backend;
create policy association_fact_read on public.native_customer_associations for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create policy association_binding_read on public.conversation_customer_association_bindings for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
-- Canonical JSON follows the existing contentHash (sorted object keys, compact arrays).
create function public.association_canonical(v jsonb) returns text language sql immutable set search_path='' as $$
 select case jsonb_typeof(v) when 'object' then '{'||coalesce((select string_agg(to_jsonb(key)::text||':'||public.association_canonical(value),',' order by key collate "C") from jsonb_each(v)),'')||'}' when 'array' then '['||coalesce((select string_agg(public.association_canonical(value),',' order by ord) from jsonb_array_elements(v) with ordinality a(value,ord)),'')||']' else v::text end
$$;
create function public.association_hash(v jsonb) returns text language sql immutable set search_path='' as $$select encode(sha256(convert_to(public.association_canonical(v),'UTF8')),'hex')$$;
create function public.association_fact_id(t uuid,c uuid,a jsonb) returns uuid language sql immutable set search_path='' as $$
 with x as(select public.association_hash(jsonb_build_array('native-customer-association-v1',t,c,a->>'provider',a->>'portalId',a->>'ticketId',a->>'contactId')) h)
 select (substr(h,1,8)||'-'||substr(h,9,4)||'-5'||substr(h,14,3)||'-a'||substr(h,18,3)||'-'||substr(h,21,12))::uuid from x
$$;
-- Only current, immutable approval events establish the owner-attested origin.
create function public.association_origins(t uuid) returns table(approval_id uuid,version bigint,entry_hash text,entry jsonb) language sql stable security definer set search_path='' as $$
 with latest as(select distinct on(resource) resource,provenance from public.audit_events where tenant_id=t and action in('association_origin_approved','association_origin_revoked') order by resource,(provenance->>'version')::bigint desc)
 select resource::uuid,(provenance->>'version')::bigint,public.association_hash(e),e from latest cross join lateral jsonb_array_elements(provenance->'entries') e where provenance->>'state'='approved'
$$;
-- Bounded by requested facts. Endpoints are joined by exact typed identities and
-- import lineage; the inventory or a namespace prefix alone never grants authority.
create function public.association_candidates(t uuid,ids uuid[],owner_choice boolean) returns table(fact_id uuid,kind text,id uuid,connection_id uuid,external_id text,revision_id uuid,head_version bigint,proof jsonb) language sql stable security definer set search_path='' as $$
 with facts as materialized(select f.*,coalesce((select ir.provenance->'result'->'evidence' from public.import_rows ir where ir.tenant_id=t and ir.provenance->'result'->>'fact_id'=f.id::text and ir.provenance->'result'->>'evidence_hash'=f.selected_evidence_hash order by ir.id limit 1),f.immutable_evidence) ev from public.native_customer_associations f where f.tenant_id=t and f.id=any(ids) and f.resolution_state<>'retained'),
 origins as materialized(select * from public.association_origins(t)),
 endpoint_rows as(
 select f.id fact_id,'customer'::text kind,c.id,c.connection_id,c.external_id,r.id revision_id,h.version::bigint head_version,o.approval_id,o.version,o.entry_hash,i.id import_id,ir.id row_id
 from facts f join public.customers c on c.tenant_id=t and c.external_id=f.contact_id and (owner_choice or c.connection_id=f.source_connection_id)
 join public.connections cn on cn.tenant_id=t and cn.id=c.connection_id and cn.status='active' and cn.source='csv'
 join public.source_heads h on h.tenant_id=t and h.id=c.id and h.connection_id=c.connection_id and h.entity_type='customer' and h.external_id=c.external_id and h.state in('unique','selected')
 join public.source_revisions r on r.tenant_id=t and r.id=h.selected_revision_id and r.canonical_id=c.id and r.customer_id=c.id and r.connection_id=c.connection_id and r.entity_type='customer' and r.external_id=c.external_id and r.provenance->>'adapter_version'='csv-customer-v1' and r.provenance->>'ingestion_profile'='hubspot-contact-csv-v1' and r.provenance->>'account_id'=cn.account_id
 join public.import_rows ir on ir.tenant_id=t and ir.payload_ref=r.provenance->>'payload_ref' and ir.state in('accepted','duplicate') and ir.provenance->'result'->>'canonical_id'=c.id::text
 join public.imports i on i.tenant_id=t and i.id=ir.import_id and i.connection_id=c.connection_id and i.mapping_version=r.mapping_version and i.provenance->'mapping'->>'profile'='hubspot-contact-csv-v1'
 join origins o on o.entry->>'importId'=i.id::text and o.entry->>'fileHash'=i.file_hash and o.entry->>'mappingVersion'=i.mapping_version and o.entry->>'connectionId'=i.connection_id::text and o.entry->>'portalId'=f.portal_id and o.entry->>'namespace'='hubspot-contact'
 where not public.retention_source_deleted_internal(t,c.connection_id,'customer',c.external_id)
 union all
 select f.id,'conversation',c.id,c.connection_id,c.external_id,cr.id,ch.version::bigint,o.approval_id,o.version,o.entry_hash,i.id,ir.id
 from facts f join public.conversations c on c.tenant_id=t and (owner_choice or c.connection_id=f.source_connection_id) and (c.external_id='hubspot:'||f.ticket_id or c.external_id='gorgias:'||(f.ev->'bridge'->'property'->>'value') or owner_choice and exists(select 1 from jsonb_array_elements(f.ev->'bridge'->'notes') n where c.external_id='gorgias:'||(n->>'gorgiasId')))
 join public.connections cn on cn.tenant_id=t and cn.id=c.connection_id and cn.status='active' and cn.source='csv'
 join public.source_heads ch on ch.tenant_id=t and ch.id=c.id and ch.connection_id=c.connection_id and ch.entity_type='conversation' and ch.external_id=c.external_id and ch.state in('unique','selected')
 join public.source_revisions cr on cr.tenant_id=t and cr.id=ch.selected_revision_id and cr.canonical_id=c.id and cr.conversation_id=c.id and cr.connection_id=c.connection_id and cr.entity_type='conversation' and cr.source_revision='csv-container-v1' and cr.provenance->>'account_id'=cn.account_id
 join public.messages m on m.tenant_id=t and m.connection_id=c.connection_id and m.conversation_id=c.id and m.deleted_at is null
 join public.source_heads mh on mh.tenant_id=t and mh.id=m.id and mh.entity_type='message' and mh.connection_id=c.connection_id and mh.state in('unique','selected')
 join public.source_revisions mr on mr.tenant_id=t and mr.id=mh.selected_revision_id and mr.canonical_id=m.id and mr.message_id=m.id and mr.related_conversation_id=c.id and mr.connection_id=c.connection_id and mr.entity_type='message' and mr.provenance->>'adapter_version'='csv-message-v1'
 join public.import_rows ir on ir.tenant_id=t and ir.payload_ref=mr.provenance->>'payload_ref' and ir.state in('accepted','duplicate') and ir.provenance->'result'->>'canonical_id'=m.id::text
 join public.imports i on i.tenant_id=t and i.id=ir.import_id and i.connection_id=c.connection_id and i.mapping_version=mr.mapping_version
 join origins o on o.entry->>'importId'=i.id::text and o.entry->>'fileHash'=i.file_hash and o.entry->>'mappingVersion'=i.mapping_version and o.entry->>'connectionId'=i.connection_id::text and o.entry->>'portalId'=f.portal_id and o.entry->>'namespace'=case when c.external_id like 'hubspot:%' then 'hubspot-ticket' else 'gorgias-ticket' end
 where c.deleted_at is null and not public.retention_source_deleted_internal(t,c.connection_id,'conversation',c.external_id) and not public.retention_source_deleted_internal(t,m.connection_id,'message',m.external_id)
 ), dedup as(select distinct on(fact_id,kind,id) * from endpoint_rows order by fact_id,kind,id,approval_id,row_id)
 select fact_id,kind,id,connection_id,external_id,revision_id,head_version,jsonb_build_object('approvalId',approval_id,'approvalVersion',version,'entryHash',entry_hash,'importId',import_id,'importRowId',row_id,'canonicalId',id,'revisionId',revision_id,'headVersion',head_version) from dedup
 union all
 select f.id,'conversation',c.id,c.connection_id,c.external_id,r.id,h.version::bigint,jsonb_build_object('native',true,'source','hubspot','accountId',cn.account_id,'connectionId',cn.id,'canonicalId',c.id,'revisionId',r.id,'headVersion',h.version)
 from facts f join public.conversations c on owner_choice and c.tenant_id=t and c.external_id=f.ticket_id and c.source='hubspot' and c.deleted_at is null
 join public.connections cn on cn.tenant_id=t and cn.id=c.connection_id and cn.status='active' and cn.source='hubspot' and cn.account_id=f.portal_id
 join public.source_heads h on h.tenant_id=t and h.id=c.id and h.entity_type='conversation' and h.connection_id=c.connection_id and h.external_id=c.external_id and h.state in('unique','selected')
 join public.source_revisions r on r.tenant_id=t and r.id=h.selected_revision_id and r.canonical_id=c.id and r.conversation_id=c.id and r.entity_type='conversation' and r.connection_id=c.connection_id and r.provenance->>'source'='hubspot' and r.provenance->>'account_id'=f.portal_id
 where not public.retention_source_deleted_internal(t,c.connection_id,'conversation',c.external_id)
$$;
create function public.association_payload_valid(a jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(a)='object' and a-array['schema','provider','portalId','ticketId','contactId','nativePair','source','bridge','evidenceHash','sourceVersionHash','globalOrdinal']='{}'::jsonb
 and a->>'schema'='association-payload-v1' and a->>'provider'='hubspot' and a->>'portalId'~'^[0-9]+$' and a->>'ticketId'~'^[0-9]+$' and a->>'contactId'~'^[0-9]+$'
 and a->>'sourceVersionHash'~'^[a-f0-9]{64}$' and a->>'globalOrdinal'~'^[0-9]+$'
 and a->'nativePair'->'from'->>'id'=a->>'ticketId' and a->'nativePair'->'to'->>'toObjectId'=a->>'contactId'
 and jsonb_typeof(a->'nativePair'->'to'->'associationTypes')='array'
 and a->'source'->>'sourceFileSha256'~'^[a-f0-9]{64}$' and a->'source'->>'containerSha256'~'^[a-f0-9]{64}$' and a->'source'->>'sourceIndex'~'^[0-9]+$' and a->'source'->>'pairIndex'~'^[0-9]+$'
 and a->'bridge'->>'schema'='association-bridge-v1' and a->'bridge'->'property'->>'status' in('missing','malformed','valid') and jsonb_typeof(a->'bridge'->'notes')='array' and jsonb_typeof(a->'bridge'->'archivedTicket')='boolean'
 and a->'bridge'->'property'->'proof'->>'field'='properties.gorgias_id' and a->'bridge'->'property'->'proof'->>'sourceFileSha256'~'^[a-f0-9]{64}$'
 and ((a->'bridge'->'property'->>'status'='valid' and a->'bridge'->'property'->>'value'~'^[0-9]+$') or (a->'bridge'->'property'->>'status'<>'valid' and a->'bridge'->'property'->'value'='null'::jsonb))
 and not exists(select 1 from jsonb_array_elements(a->'bridge'->'notes') n where n->>'gorgiasId'!~'^[0-9]+$' or n->'proof'->>'field' is distinct from 'properties.hs_note_body' or n->'proof'->>'sourceFileSha256'!~'^[a-f0-9]{64}$')
 and not exists(select 1 from jsonb_array_elements_text(a->'bridge'->'sourceNamespaceCandidates') n where n<>'hubspot:'||(a->>'ticketId') and n is distinct from 'gorgias:'||(a->'bridge'->'property'->>'value') and not exists(select 1 from jsonb_array_elements(a->'bridge'->'notes') x where n='gorgias:'||(x->>'gorgiasId')))
 and a->>'evidenceHash'=public.association_hash(jsonb_build_object('schema','association-evidence-v1','nativePair',a->'nativePair','source',a->'source','bridge',a->'bridge')),false)
$$;
create function public.association_commit_batch(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=nullif(current_setting('vexa.tenant_id',true),'')::uuid;i public.imports;batch jsonb;ids uuid[];result jsonb;actor uuid:=auth.uid();begin
 if public.vexa_backend_action(t,array['import']) is not true or public.vexa_member(t,array['owner','analyst']) is not true then raise insufficient_privilege;end if;
 if p-array['importId','records']<>'{}'::jsonb or jsonb_typeof(p->'records') is distinct from 'array' or jsonb_array_length(p->'records') not between 1 and 500 or octet_length(p::text)>20971520 then raise check_violation using message='ASSOCIATION_CHUNK_INVALID';end if;
 select * into i from public.imports where tenant_id=t and id=(p->>'importId')::uuid;
 if i.id is null or i.provenance->'mapping'->>'profile' is distinct from 'hubspot-ticket-contact-association-v1' or not exists(select 1 from public.connections where tenant_id=t and id=i.connection_id and status='active') then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text||':native-customer-associations',0));perform pg_advisory_xact_lock(hashtextextended(t::text||':'||i.connection_id::text,0));
 if exists(select 1 from jsonb_array_elements(p->'records') r where r->>'profile' is distinct from 'hubspot-ticket-contact-association-v1' or r->>'row_ref'!~'^[0-9]+$' or r->>'mapping_version' is distinct from i.mapping_version or r->>'batch_hash' is distinct from i.file_hash or (not r ? 'validation_error' and (r-array['profile','association','row_ref','row_hash','batch_hash','mapping_version','payload_ref']<>'{}'::jsonb or not public.association_payload_valid(r->'association') or r->>'row_hash' is distinct from r->'association'->>'evidenceHash' or r->>'payload_ref' is distinct from 'csv:'||i.file_hash||':line:'||(r->>'row_ref')))) then raise check_violation using message='ASSOCIATION_RECORD_INVALID';end if;
 if (select count(*) from jsonb_array_elements(p->'records'))<>(select count(distinct r->>'row_ref') from jsonb_array_elements(p->'records') r) then raise check_violation;end if;
 if exists(select 1 from jsonb_array_elements(p->'records') r join public.import_rows old on old.tenant_id=t and old.import_id=i.id and old.row_ref=r->>'row_ref' where old.row_hash is distinct from coalesce(r->>'row_hash',r->>'raw_hash') or old.payload_ref is distinct from coalesce(r->>'payload_ref','csv:'||i.file_hash||':line:'||(r->>'row_ref'))) then raise serialization_failure using message='ASSOCIATION_ROW_REPLAY_CONFLICT';end if;
 with r as(select x,ord,case when x ? 'validation_error' then null else public.association_fact_id(t,i.connection_id,x->'association') end fid from jsonb_array_elements(p->'records') with ordinality a(x,ord) where not exists(select 1 from public.import_rows old where old.tenant_id=t and old.import_id=i.id and old.row_ref=x->>'row_ref')),
 ranked as(select *,row_number() over(partition by fid,x->>'row_hash' order by ord) rn,first_value(x->>'row_hash') over(partition by fid order by ord) first_hash from r),
 classified as(select *,case when x ? 'validation_error' then 'rejected' when rn>1 or exists(select 1 from public.import_rows old where old.tenant_id=t and old.provenance->'result'->>'fact_id'=fid::text and old.provenance->'result'->>'evidence_hash'=x->>'row_hash') or exists(select 1 from public.native_customer_associations f where f.tenant_id=t and f.id=fid and f.first_evidence_hash=x->>'row_hash') then 'duplicate' else 'accepted' end st,
 coalesce((select first_evidence_hash from public.native_customer_associations f where f.tenant_id=t and f.id=fid),first_hash) original_hash from ranked)
 select coalesce(jsonb_agg(x||jsonb_build_object('_id',gen_random_uuid(),'_fact',fid,'_state',st,'_status',case when st='rejected' then 'rejected' when st='duplicate' then 'association_duplicate' when original_hash is distinct from x->>'row_hash' then 'association_evidence_conflict' else 'association_recorded' end) order by ord),'[]') into batch from classified;
 select coalesce(array_agg(distinct (r->>'_fact')::uuid) filter(where r->>'_fact' is not null),'{}') into ids from jsonb_array_elements(batch) r;
 insert into public.native_customer_associations(id,tenant_id,source_connection_id,provider,portal_id,ticket_id,contact_id,first_evidence_hash,immutable_evidence,first_import_row_id,source_version_hash,resolution_state,reason,retained_at)
 select distinct on(r->>'_fact') (r->>'_fact')::uuid,t,i.connection_id,'hubspot',r->'association'->>'portalId',r->'association'->>'ticketId',r->'association'->>'contactId',r->>'row_hash',r->'association',(r->>'_id')::uuid,r->'association'->>'sourceVersionHash',
 case when public.retention_source_deleted_internal(t,i.connection_id,'customer',r->'association'->>'contactId') then 'retained' else 'pending' end,
 case when public.retention_source_deleted_internal(t,i.connection_id,'customer',r->'association'->>'contactId') then 'SOURCE_RETAINED' else 'ENDPOINT_UNRESOLVED' end,
 case when public.retention_source_deleted_internal(t,i.connection_id,'customer',r->'association'->>'contactId') then clock_timestamp() end
 from jsonb_array_elements(batch) with ordinality a(r,ord) where r->>'_fact' is not null order by r->>'_fact',ord on conflict(id) do nothing;
 update public.native_customer_associations f set resolution_state='blocked',reason='EVIDENCE_CONFLICT',version=version+1,updated_at=clock_timestamp() where f.tenant_id=t and f.id=any(ids) and f.resolution_state<>'retained' and exists(select 1 from jsonb_array_elements(batch) r where r->>'_fact'=f.id::text and r->>'_status'='association_evidence_conflict');
 update public.conversation_customer_association_bindings b set active=false,deactivated_at=clock_timestamp() where b.tenant_id=t and b.fact_id=any(ids) and active and exists(select 1 from public.native_customer_associations f where f.id=b.fact_id and f.resolution_state in('blocked','retained'));
 -- Candidate reads are a set query, not a procedure loop for each imported row.
 with candidates as materialized(select * from public.association_candidates(t,ids,false)),
 unique_pairs as(select f.id,cv.id conversation_id,cu.id customer_id,cv.connection_id cc,cu.connection_id uc,cv.revision_id cr,cu.revision_id ur,cv.head_version ch,cu.head_version uh,cv.proof cp,cu.proof up
 from public.native_customer_associations f join candidates cv on cv.fact_id=f.id and cv.kind='conversation' join candidates cu on cu.fact_id=f.id and cu.kind='customer'
 where f.tenant_id=t and f.id=any(ids) and f.resolution_state='pending' and not (f.immutable_evidence->'bridge'->>'archivedTicket')::boolean
 and (select count(*) from candidates x where x.fact_id=f.id and x.kind='conversation')=1 and (select count(*) from candidates x where x.fact_id=f.id and x.kind='customer')=1
 and (cv.external_id='hubspot:'||f.ticket_id or f.immutable_evidence->'bridge'->'property'->>'status'='valid' and not exists(select 1 from jsonb_array_elements(f.immutable_evidence->'bridge'->'notes') n where n->>'gorgiasId' is distinct from f.immutable_evidence->'bridge'->'property'->>'value'))),
 changed as(update public.native_customer_associations f set resolution_state='resolved',reason='UNIQUE_EXPLICIT_BRIDGE',selected_evidence_hash=first_evidence_hash,updated_at=clock_timestamp() from unique_pairs u where f.id=u.id returning f.*)
 insert into public.conversation_customer_association_bindings(tenant_id,fact_id,conversation_id,customer_id,conversation_connection_id,customer_connection_id,conversation_revision_id,customer_revision_id,conversation_head_version,customer_head_version,fact_version,evidence_hash,method,decision_id,actor_id,provenance)
 select t,f.id,u.conversation_id,u.customer_id,u.cc,u.uc,u.cr,u.ur,u.ch,u.uh,f.version,f.first_evidence_hash,'unique_explicit_bridge',gen_random_uuid(),actor,jsonb_build_object('originProofs',jsonb_build_array(u.cp,u.up)) from changed f join unique_pairs u on u.id=f.id;
 insert into public.import_rows(id,tenant_id,import_id,row_ref,row_hash,state,error_code,payload_ref,provenance)
 select (r->>'_id')::uuid,t,i.id,r->>'row_ref',coalesce(r->>'row_hash',r->>'raw_hash'),r->>'_state',case when r->>'_state'='rejected' then r->>'validation_error' end,coalesce(r->>'payload_ref','csv:'||i.file_hash||':line:'||(r->>'row_ref')),
 jsonb_build_object('mapping_version',i.mapping_version,'result',case when r->>'_state'='rejected' then jsonb_build_object('status','rejected','code',r->>'validation_error','field',r->>'validation_field') else jsonb_build_object('status',r->>'_status','code',upper(r->>'_status'),'fact_id',r->>'_fact','evidence_hash',r->>'row_hash','resolution_state',f.resolution_state,'evidence',case when f.resolution_state='retained' then jsonb_build_object('retained',true) else r->'association' end,'lineage',case when f.resolution_state='retained' then '{}'::jsonb else jsonb_build_object('sourceVersionHash',r->'association'->>'sourceVersionHash','pieceFileHash',i.file_hash,'globalOrdinal',r->'association'->'globalOrdinal','source',r->'association'->'source') end) end)
 from jsonb_array_elements(batch) r left join public.native_customer_associations f on f.tenant_id=t and f.id=(r->>'_fact')::uuid;
 -- A previously retained native key can never reintroduce its evidence.
 update public.native_customer_associations set immutable_evidence=jsonb_build_object('retained',true) where tenant_id=t and id=any(ids) and resolution_state='retained';
 with counts as(select count(*) n,count(*) filter(where r->>'_state'='accepted') a,count(*) filter(where r->>'_state'='duplicate') d,count(*) filter(where r->>'_state'='rejected') e from jsonb_array_elements(batch) r)
 update public.imports set total=total+counts.n,accepted=accepted+counts.a,duplicates=duplicates+counts.d,rejected=rejected+counts.e,updated_at=clock_timestamp() from counts where tenant_id=t and id=i.id;
 select jsonb_build_object('processed',jsonb_array_length(batch),'accepted',(select count(*) from jsonb_array_elements(batch) r where r->>'_state'='accepted'),'duplicates',(select count(*) from jsonb_array_elements(batch) r where r->>'_state'='duplicate'),'rejected',(select count(*) from jsonb_array_elements(batch) r where r->>'_state'='rejected'),'pendingFacts',count(*) filter(where resolution_state='pending'),'blockedFacts',count(*) filter(where resolution_state='blocked'),'resolvedFacts',count(*) filter(where resolution_state='resolved'),'retainedFacts',count(*) filter(where resolution_state='retained')) into result from public.native_customer_associations where tenant_id=t and id=any(ids);return result;
end $$;
create function public.association_resolve(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=nullif(current_setting('vexa.tenant_id',true),'')::uuid;op text:=p->>'operation';req uuid:=(p->>'requestId')::uuid;rh text:=public.association_hash(p);prior public.audit_events;last public.audit_events;f public.native_customer_associations;answer jsonb;aid uuid;entries jsonb;eh jsonb;chosen jsonb;targets jsonb;conns uuid[];begin
 if public.vexa_backend_action(t,array['import']) is not true or public.vexa_member(t,array['owner']) is not true then raise insufficient_privilege;end if;
 if req is null or p->>'reason' is null or op is null or jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>16384 or length(p->>'reason') not between 1 and 1000 or op not in('resolve','approve_origin','revoke_origin') then raise check_violation;end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text||':native-customer-associations',0));
 select * into prior from public.audit_events where tenant_id=t and action in('association_resolve','association_origin_approved','association_origin_revoked') and provenance->>'requestId'=req::text;
 if prior.id is not null then if prior.provenance->>'requestHash' is distinct from rh then raise serialization_failure using message='ASSOCIATION_REQUEST_REPLAY_CONFLICT';end if;return prior.provenance->'result';end if;
 if op in('approve_origin','revoke_origin') then
  aid=(p->>'approvalId')::uuid;
  if aid is null then raise check_violation;end if;
  select * into last from public.audit_events where tenant_id=t and resource=aid::text and action in('association_origin_approved','association_origin_revoked') order by (provenance->>'version')::bigint desc limit 1;
  if op='approve_origin' then
   if last.id is not null or p->>'expectedVersion' is distinct from '0' then raise serialization_failure;end if;
   if p-array['operation','approvalId','expectedVersion','requestId','manifestHash','entries','reason']<>'{}'::jsonb or p->>'manifestHash' is null or p->>'manifestHash'!~'^[a-f0-9]{64}$' or jsonb_typeof(p->'entries') is distinct from 'array' or jsonb_array_length(p->'entries') not between 1 and 16 then raise check_violation;end if;
   entries=p->'entries';
   if exists(select 1 from jsonb_array_elements(entries) e where jsonb_typeof(e) is distinct from 'object' or exists(select 1 from jsonb_each(e) item where jsonb_typeof(item.value) is distinct from 'string' or item.value#>>'{}'='') or (select count(*) from jsonb_object_keys(e))<>10 or e-array['importId','connectionId','fileHash','mappingVersion','provider','portalId','namespace','sourceManifestHash','sourceInventoryHash','sourceReceiptHash']<>'{}'::jsonb or e->>'provider' is distinct from 'hubspot' or e->>'portalId'!~'^[0-9]+$' or e->>'fileHash'!~'^[a-f0-9]{64}$' or e->>'sourceManifestHash'!~'^[a-f0-9]{64}$' or e->>'sourceInventoryHash'!~'^[a-f0-9]{64}$' or e->>'sourceReceiptHash'!~'^[a-f0-9]{64}$' or e->>'namespace' not in('hubspot-contact','hubspot-ticket','gorgias-ticket')) or (select count(*) from jsonb_array_elements(entries))<>(select count(distinct (e->>'importId',e->>'namespace')) from jsonb_array_elements(entries) e) then raise check_violation;end if;
   perform pg_advisory_xact_lock(hashtextextended(t::text||':'||c,0)) from(select distinct e->>'connectionId' c from jsonb_array_elements(entries) e order by c) locks;
   if exists(select 1 from jsonb_array_elements(entries) e where not exists(
    select 1 from public.imports i join public.connections c on c.tenant_id=t and c.id=i.connection_id and c.status='active' and c.source='csv'
    where i.tenant_id=t and i.id::text=e->>'importId' and i.connection_id::text=e->>'connectionId' and i.file_hash=e->>'fileHash' and i.mapping_version=e->>'mappingVersion' and i.state in('succeeded','partial','cancelled')
    and not exists(select 1 from public.jobs j where j.tenant_id=t and j.import_id=i.id and (j.state in('running','queued') or j.lease_until>clock_timestamp()))
    and exists(select 1 from public.import_rows ir join public.source_revisions sr on sr.tenant_id=t and sr.provenance->>'payload_ref'=ir.payload_ref and sr.canonical_id::text=ir.provenance->'result'->>'canonical_id' and sr.connection_id=i.connection_id and sr.mapping_version=i.mapping_version
     where ir.tenant_id=t and ir.import_id=i.id and ir.state in('accepted','duplicate') and ((e->>'namespace'='hubspot-contact' and i.provenance->'mapping'->>'profile'='hubspot-contact-csv-v1' and sr.entity_type='customer' and sr.provenance->>'adapter_version'='csv-customer-v1')
      or (e->>'namespace' in('hubspot-ticket','gorgias-ticket') and sr.entity_type='message' and sr.provenance->>'adapter_version'='csv-message-v1' and exists(select 1 from public.conversations cv where cv.tenant_id=t and cv.id=sr.related_conversation_id and cv.connection_id=i.connection_id and cv.external_id like case when e->>'namespace'='hubspot-ticket' then 'hubspot:%' else 'gorgias:%' end))))
   )) then raise check_violation using message='ASSOCIATION_ORIGIN_INVALID';end if;
   select jsonb_agg(public.association_hash(e) order by ord) into eh from jsonb_array_elements(entries) with ordinality a(e,ord);
   answer=jsonb_build_object('approvalId',aid,'version',1,'state','approved','requestId',req,'entryHashes',eh);
  else
   if p-array['operation','approvalId','expectedVersion','requestId','reason']<>'{}'::jsonb then raise check_violation;end if;
   if last.id is null or last.provenance->>'state'<>'approved' or last.provenance->>'version' is distinct from p->>'expectedVersion' then raise serialization_failure;end if;
   entries=last.provenance->'entries';eh=last.provenance->'entryHashes';answer=jsonb_build_object('approvalId',aid,'version',(last.provenance->>'version')::bigint+1,'state','revoked','requestId',req,'entryHashes',eh);
   update public.conversation_customer_association_bindings set active=false,deactivated_at=clock_timestamp() where tenant_id=t and active and exists(select 1 from jsonb_array_elements(provenance->'originProofs') x where x->>'approvalId'=aid::text);
  end if;
  insert into public.audit_events(tenant_id,actor,action,resource,reason,trace_id,provenance) values(t,auth.uid()::text,case when op='approve_origin' then 'association_origin_approved' else 'association_origin_revoked' end,aid::text,p->>'reason',req::text,
   jsonb_build_object('schema','association-origin-approval-v1','approvalId',aid,'version',answer->'version','state',answer->'state','requestId',req,'requestHash',rh,'manifestHash',coalesce(p->>'manifestHash',last.provenance->>'manifestHash'),'entries',entries,'entryHashes',eh,'previousEventId',last.id,'result',answer));
  return answer;
 end if;
 if (select count(*) from jsonb_object_keys(p))<>8 or p->>'decision' is null or p->>'evidenceHash' is null or p->>'expectedVersion' is null or p-array['operation','factId','expectedVersion','evidenceHash','requestId','decision','targets','reason']<>'{}'::jsonb or p->>'decision' not in('bind','none') or jsonb_typeof(p->'targets') is distinct from 'array' or jsonb_array_length(p->'targets')>32 or (p->>'decision'='none') is distinct from (jsonb_array_length(p->'targets')=0) then raise check_violation;end if;
 select * into f from public.native_customer_associations where tenant_id=t and id=(p->>'factId')::uuid;
 if f.id is null then raise no_data_found;end if;
 select array_agg(distinct c order by c) into conns from(select f.source_connection_id c union all select connection_id from public.conversations where tenant_id=t and id in(select (x->>'conversationId')::uuid from jsonb_array_elements(p->'targets') x) union all select connection_id from public.customers where tenant_id=t and id in(select (x->>'customerId')::uuid from jsonb_array_elements(p->'targets') x)) a;
 perform pg_advisory_xact_lock(hashtextextended(t::text||':'||c::text,0)) from unnest(conns) c order by c;
 select * into f from public.native_customer_associations where tenant_id=t and id=f.id for update;
 if f.version::text is distinct from p->>'expectedVersion' or f.resolution_state='retained' then raise serialization_failure;end if;
 select ir.provenance->'result'->'evidence' into chosen from public.import_rows ir where ir.tenant_id=t and ir.provenance->'result'->>'fact_id'=f.id::text and ir.provenance->'result'->>'evidence_hash'=p->>'evidenceHash' and not(ir.provenance->'result'->'evidence' ? 'retained') order by id limit 1;
 if chosen is null or public.retention_source_deleted_internal(t,f.source_connection_id,'customer',f.contact_id) then raise check_violation using message='ASSOCIATION_EVIDENCE_INVALID';end if;
 -- Selection is transactional: rejected targets roll this provisional choice back.
 update public.native_customer_associations set selected_evidence_hash=p->>'evidenceHash' where tenant_id=t and id=f.id;
 if jsonb_array_length(p->'targets')<>(select count(distinct(x->>'conversationId',x->>'customerId')) from jsonb_array_elements(p->'targets') x) then raise check_violation;end if;
 with candidates as materialized(select * from public.association_candidates(t,array[f.id],true)),pairs as(
 select x,cv.connection_id cc,cu.connection_id uc,cv.proof cp,cu.proof up from jsonb_array_elements(p->'targets') x
 join candidates cv on cv.kind='conversation' and cv.id::text=x->>'conversationId' and cv.revision_id::text=x->>'conversationRevisionId' and cv.head_version::text=x->>'conversationHeadVersion'
 join candidates cu on cu.kind='customer' and cu.id::text=x->>'customerId' and cu.revision_id::text=x->>'customerRevisionId' and cu.head_version::text=x->>'customerHeadVersion'
 where x-array['conversationId','customerId','conversationHeadVersion','customerHeadVersion','conversationRevisionId','customerRevisionId']='{}'::jsonb)
 select coalesce(jsonb_agg(jsonb_build_object('target',x,'cc',cc,'uc',uc,'cp',cp,'up',up)),'[]') into targets from pairs;
 if jsonb_array_length(targets)<>jsonb_array_length(p->'targets') then raise serialization_failure using message='ASSOCIATION_ENDPOINT_INVALID';end if;
 update public.conversation_customer_association_bindings set active=false,deactivated_at=clock_timestamp() where tenant_id=t and fact_id=f.id and active;
 update public.native_customer_associations set resolution_state='resolved',reason='OWNER_DECISION',version=version+1,updated_at=clock_timestamp() where tenant_id=t and id=f.id;
 with inserted as(insert into public.conversation_customer_association_bindings(tenant_id,fact_id,conversation_id,customer_id,conversation_connection_id,customer_connection_id,conversation_revision_id,customer_revision_id,conversation_head_version,customer_head_version,fact_version,evidence_hash,method,decision_id,actor_id,provenance)
 select t,f.id,(v->'target'->>'conversationId')::uuid,(v->'target'->>'customerId')::uuid,(v->>'cc')::uuid,(v->>'uc')::uuid,(v->'target'->>'conversationRevisionId')::uuid,(v->'target'->>'customerRevisionId')::uuid,(v->'target'->>'conversationHeadVersion')::bigint,(v->'target'->>'customerHeadVersion')::bigint,f.version+1,p->>'evidenceHash','owner_decision',req,auth.uid(),jsonb_build_object('originProofs',jsonb_build_array(v->'cp',v->'up')) from jsonb_array_elements(targets) v returning id)
 select jsonb_build_object('factId',f.id,'version',f.version+1,'state','resolved','requestId',req,'bindingIds',coalesce(jsonb_agg(id order by id),'[]')) into answer from inserted;
 insert into public.audit_events(tenant_id,actor,action,resource,reason,trace_id,provenance) values(t,auth.uid()::text,'association_resolve',f.id::text,p->>'reason',req::text,jsonb_build_object('schema','association-decision-v1','requestId',req,'requestHash',rh,'evidenceHash',p->>'evidenceHash','targets',p->'targets','result',answer));return answer;
end $$;
-- Invoker triggers distinguish the definer RPC from forgeable caller settings.
create function public.association_row_guard() returns trigger language plpgsql set search_path='' as $$
declare owner_name text;begin
 select pg_get_userbyid(proowner) into owner_name from pg_proc where oid='public.association_resolve(jsonb)'::regprocedure;
 if tg_table_name='audit_events' then
  if (case when tg_op='DELETE' then old.action else new.action end) not in('association_origin_approved','association_origin_revoked','association_resolve') then return case when tg_op='DELETE' then old else new end;end if;
 elsif tg_table_name='import_rows' then
  if not (case when tg_op='DELETE' then old.provenance else new.provenance end)->'result' ? 'fact_id' and (tg_op='INSERT' or not old.provenance->'result' ? 'fact_id') then return case when tg_op='DELETE' then old else new end;end if;
 end if;
 if current_user<>owner_name then raise insufficient_privilege;end if;
 if tg_op='DELETE' then raise insufficient_privilege;end if;
 if tg_table_name='import_rows' then
  if new.provenance->'result' ? 'fact_id' and not exists(select 1 from public.native_customer_associations f join public.imports i on i.tenant_id=f.tenant_id and i.id=new.import_id and i.connection_id=f.source_connection_id where f.tenant_id=new.tenant_id and f.id::text=new.provenance->'result'->>'fact_id') then raise check_violation;end if;
 elsif tg_table_name='native_customer_associations' then
  if tg_op='UPDATE' then
   if (row(new.id,new.tenant_id,new.source_connection_id,new.provider,new.portal_id,new.ticket_id,new.contact_id,new.first_evidence_hash,new.first_import_row_id,new.source_version_hash) is distinct from row(old.id,old.tenant_id,old.source_connection_id,old.provider,old.portal_id,old.ticket_id,old.contact_id,old.first_evidence_hash,old.first_import_row_id,old.source_version_hash) or (new.immutable_evidence is distinct from old.immutable_evidence and (new.resolution_state<>'retained' or new.immutable_evidence is distinct from '{"retained":true}'::jsonb))) then raise check_violation;end if;
  end if;
 end if;
 return new;
end $$;
create trigger association_fact_guard before insert or update or delete on public.native_customer_associations for each row execute function public.association_row_guard();
create trigger association_binding_guard before insert or update or delete on public.conversation_customer_association_bindings for each row execute function public.association_row_guard();
create trigger association_import_row_guard before insert or update or delete on public.import_rows for each row execute function public.association_row_guard();
create trigger association_origin_audit_guard before insert or update or delete on public.audit_events for each row execute function public.association_row_guard();
create function public.association_raw_available(p_import uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.imports i join public.memberships m on m.tenant_id=i.tenant_id and m.user_id=auth.uid() and m.status='active'
 where i.id=p_import and i.object_path is not null and not exists(select 1 from public.retention_artifacts a where a.tenant_id=i.tenant_id and a.object_path=i.object_path and a.status in('pending','deleted')))
$$;
-- Restrictive: this grants no access and retains 0041's operation/session policy.
create function public.association_storage_available(p_path text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare i public.imports;begin
 select * into i from public.imports where object_path=p_path;
 if i.id is null then return false;end if;
 if i.provenance->'mapping'->>'profile' is distinct from 'hubspot-ticket-contact-association-v1' then return true;end if;
 return public.association_raw_available(i.id);
end $$;
create policy association_pending_raw_read on storage.objects as restrictive for select to authenticated using(bucket_id<>'vexa-private' or split_part(name,'/',2)<>'imports' or public.association_storage_available(name) or (storage.allow_any_operation(array['object.delete_many']) and public.retention_storage_authorized(name)));
-- The footprint and erase share one typed selector, before any evidence is erased.
create function public.association_retention_facts(t uuid,c uuid,k text,e text) returns uuid[] language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(f.id order by f.id),'{}') from public.native_customer_associations f where f.tenant_id=t and
 (exists(select 1 from public.retention_ledger l join public.retention_redactions r on r.tenant_id=l.tenant_id and r.request_id=l.id where l.tenant_id=t and l.connection_id=c and l.entity_type=k and l.external_id=e and r.table_name='native_customer_associations' and r.row_id=f.id)
 or (f.source_connection_id=c and ((k='customer' and f.contact_id=e) or (k='conversation' and (e='hubspot:'||f.ticket_id or e='gorgias:'||(f.immutable_evidence->'bridge'->'property'->>'value') or exists(select 1 from public.import_rows ir,jsonb_array_elements(ir.provenance->'result'->'evidence'->'bridge'->'notes') n where ir.tenant_id=t and ir.provenance->'result'->>'fact_id'=f.id::text and e='gorgias:'||(n->>'gorgiasId'))))))
 or exists(select 1 from public.conversation_customer_association_bindings b where b.tenant_id=t and b.fact_id=f.id and ((k='customer' and b.customer_connection_id=c and exists(select 1 from public.customers u where u.tenant_id=t and u.id=b.customer_id and u.external_id=e)) or (k='conversation' and b.conversation_connection_id=c and exists(select 1 from public.conversations v where v.tenant_id=t and v.id=b.conversation_id and v.external_id=e)) or (k='message' and exists(select 1 from public.messages m where m.tenant_id=t and m.connection_id=c and m.external_id=e and m.conversation_id=b.conversation_id)))))
$$;
create function public.association_retention_derived(t uuid,ids uuid[]) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('table',tab,'id',id,'hash',encode(sha256(convert_to(doc::text,'UTF8')),'hex')) order by tab,id),'[]') from(
 select 'native_customer_associations' tab,f.id,to_jsonb(f) doc from public.native_customer_associations f where f.tenant_id=t and f.id=any(ids)
 union all select 'conversation_customer_association_bindings',b.id,to_jsonb(b) from public.conversation_customer_association_bindings b where b.tenant_id=t and b.fact_id=any(ids)
 union all select 'import_rows',r.id,to_jsonb(r) from public.import_rows r where r.tenant_id=t and r.provenance->'result'->>'fact_id'=any(ids::text[])
 union all select 'audit_events',a.id,to_jsonb(a) from public.audit_events a where a.tenant_id=t and a.action='association_resolve' and a.resource=any(ids::text[])) rows
$$;
alter table public.retention_redactions drop constraint retention_redactions_table_name_check;
alter table public.retention_redactions add constraint retention_redactions_table_name_check check(table_name in('extraction_runs','weekly_briefs','native_customer_associations','conversation_customer_association_bindings','import_rows','audit_events'));
create function public.association_retention_erase(t uuid,ids uuid[],rid uuid) returns void language plpgsql security definer set search_path='' as $$
declare x record;oldrow jsonb;newrow jsonb;doc jsonb;erased_at timestamptz;begin
 select created_at into strict erased_at from public.retention_ledger where tenant_id=t and id=rid;
 -- Four bounded collections, not a loop over ingestion records. Exact signed
 -- before/after digests authorize redaction and match retention_web_scope.
 for x in select * from public.native_customer_associations where tenant_id=t and id=any(ids) order by id for update loop
  oldrow=to_jsonb(x);newrow=oldrow||jsonb_build_object('immutable_evidence',jsonb_build_object('retained',true),'resolution_state','retained','reason','SOURCE_RETAINED','retained_at',coalesce(x.retained_at,erased_at));
  insert into public.retention_redactions values(t,rid,'native_customer_associations',x.id,encode(sha256(convert_to(oldrow::text,'UTF8')),'hex'),encode(sha256(convert_to(newrow::text,'UTF8')),'hex'),clock_timestamp()) on conflict do nothing;
  update public.native_customer_associations set immutable_evidence=newrow->'immutable_evidence',resolution_state='retained',reason='SOURCE_RETAINED',retained_at=(newrow->>'retained_at')::timestamptz where tenant_id=t and id=x.id;
 end loop;
 for x in select * from public.conversation_customer_association_bindings where tenant_id=t and fact_id=any(ids) order by id for update loop
  oldrow=to_jsonb(x);newrow=oldrow||jsonb_build_object('active',false,'deactivated_at',coalesce(x.deactivated_at,erased_at),'provenance',jsonb_build_object('retention',rid));
  insert into public.retention_redactions values(t,rid,'conversation_customer_association_bindings',x.id,encode(sha256(convert_to(oldrow::text,'UTF8')),'hex'),encode(sha256(convert_to(newrow::text,'UTF8')),'hex'),clock_timestamp()) on conflict do nothing;
  update public.conversation_customer_association_bindings set active=false,deactivated_at=(newrow->>'deactivated_at')::timestamptz,provenance=newrow->'provenance' where tenant_id=t and id=x.id;
 end loop;
 for x in select * from public.import_rows where tenant_id=t and provenance->'result'->>'fact_id'=any(ids::text[]) order by id for update loop
  oldrow=to_jsonb(x);doc=x.provenance||jsonb_build_object('result',(x.provenance->'result')||jsonb_build_object('evidence',jsonb_build_object('retained',true),'lineage','{}'::jsonb,'resolution_state','retained'));newrow=jsonb_set(oldrow,'{provenance}',doc);
  insert into public.retention_redactions values(t,rid,'import_rows',x.id,encode(sha256(convert_to(oldrow::text,'UTF8')),'hex'),encode(sha256(convert_to(newrow::text,'UTF8')),'hex'),clock_timestamp()) on conflict do nothing;
  update public.import_rows set provenance=doc where tenant_id=t and id=x.id;
 end loop;
 for x in select * from public.audit_events where tenant_id=t and action='association_resolve' and resource=any(ids::text[]) order by id for update loop
  oldrow=to_jsonb(x);newrow=oldrow||jsonb_build_object('reason','SOURCE_RETAINED','provenance',(x.provenance-array['targets'])||jsonb_build_object('retention',rid));
  insert into public.retention_redactions values(t,rid,'audit_events',x.id,encode(sha256(convert_to(oldrow::text,'UTF8')),'hex'),encode(sha256(convert_to(newrow::text,'UTF8')),'hex'),clock_timestamp()) on conflict do nothing;
  update public.audit_events set provenance=newrow->'provenance',reason='SOURCE_RETAINED' where tenant_id=t and id=x.id;
 end loop;
end $$;

-- Existing retention bodies below retain their legacy branches, adding only
-- association prelock, footprint, typed redaction and shared-file collateral.
create or replace function public.retention_erase(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=nullif(current_setting('vexa.tenant_id',true),'')::uuid;c uuid:=(p->>'connectionId')::uuid;k text:=p->>'entityType';e text:=p->>'externalId';rid uuid:=(p->>'requestId')::uuid;
 pol public.retention_policies;prior public.retention_ledger;mid uuid[];cid uuid[];revs uuid[];import_ids uuid[];probs uuid[];m record;oldrow jsonb;newrow jsonb;redacted jsonb;count_raw integer;count_vectors integer;afids uuid[];aimps uuid[];begin
 if current_setting('vexa.action',true) is distinct from 'retain' or public.vexa_member(t,array['owner']) is not true then raise insufficient_privilege;end if;
 if p->>'confirmed' is distinct from 'true' or k not in('message','conversation','customer') or e is null or length(e) not between 1 and 512 or rid is null then raise check_violation;end if;
 select * into pol from public.retention_policies where tenant_id=t;if pol.tenant_id is null then raise check_violation using message='RETENTION_POLICY_REQUIRED';end if;
 if not exists(select 1 from public.connections where tenant_id=t and id=c) then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text||':native-customer-associations',0));
 perform pg_advisory_xact_lock(hashtextextended(t::text||':'||c::text,0));
 afids=public.association_retention_facts(t,c,k,e);
 select coalesce(array_agg(distinct import_id),'{}') into aimps from public.import_rows where tenant_id=t and provenance->'result'->>'fact_id'=any(afids::text[]);
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
 perform public.association_retention_erase(t,afids,rid);
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
 select coalesce(array_agg(distinct value),'{}') into import_ids from unnest(import_ids||aimps) value;
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
create or replace function public.retention_web_scope(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=nullif(current_setting('vexa.tenant_id',true),'')::uuid;c uuid:=(p->>'connectionId')::uuid;k text:=p->>'entityType';e text:=p->>'externalId';cid uuid[];mid uuid[];revs uuid[];imps uuid[];result jsonb;afids uuid[];aimps uuid[];begin
 if current_setting('vexa.action',true) is distinct from 'retain' or public.vexa_member(t,array['owner']) is not true then raise insufficient_privilege;end if;
 if k not in('message','conversation','customer') or e is null or length(e) not between 1 and 512 then raise check_violation;end if;
 if not exists(select 1 from public.connections where tenant_id=t and id=c) then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text||':native-customer-associations',0));
 perform pg_advisory_xact_lock(hashtextextended(t::text||':'||c::text,0));
 afids=public.association_retention_facts(t,c,k,e);
 select coalesce(array_agg(distinct import_id),'{}') into aimps from public.import_rows where tenant_id=t and provenance->'result'->>'fact_id'=any(afids::text[]);
 perform 1 from public.retention_policies where tenant_id=t for update;
 if not exists(select 1 from public.source_heads where tenant_id=t and connection_id=c and entity_type=k and external_id=e) and not exists(select 1 from public.retention_ledger where tenant_id=t and connection_id=c and entity_type=k and external_id=e) then raise no_data_found;end if;
 select coalesce(array_agg(id order by id),'{}') into cid from public.conversations where tenant_id=t and connection_id=c and ((k='conversation' and external_id=e) or (k='customer' and customer_id in(select id from public.customers where tenant_id=t and connection_id=c and external_id=e)));
 select coalesce(array_agg(id order by id),'{}') into mid from public.messages where tenant_id=t and connection_id=c and ((k='message' and external_id=e) or conversation_id=any(cid));
 select coalesce(array_agg(id order by id),'{}') into revs from public.message_revisions where tenant_id=t and message_id=any(mid);
 if cardinality(mid)>500 or cardinality(revs)>1000 then raise program_limit_exceeded using message='RETENTION_SCOPE_LIMIT';end if;
 select coalesce(array_agg(distinct i.import_id order by i.import_id),'{}') into imps from public.import_rows i join public.message_revisions r on r.tenant_id=i.tenant_id and r.text_ref=i.payload_ref where i.tenant_id=t and r.id=any(revs);
 select coalesce(array_agg(distinct value),'{}') into imps from unnest(imps||aimps) value;
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
 result=jsonb_set(result,'{derived}',(select coalesce(jsonb_agg(x order by x->>'table',x->>'id'),'[]') from jsonb_array_elements((result->'derived')||public.association_retention_derived(t,afids)) x));
 if octet_length(result::text)>131072 then raise program_limit_exceeded using message='RETENTION_SCOPE_LIMIT';end if;
 return result;
end $$;
-- Physical metadata existence is checked only for an authorized pending purge.
-- An authenticated download's 404 may mean RLS denial, never proven absence.
create function public.retention_storage_object_exists(p_path text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare t uuid:=nullif(current_setting('vexa.tenant_id',true),'')::uuid;begin
 if current_setting('vexa.action',true) is distinct from 'retain' or t is null or split_part(p_path,'/',1) is distinct from t::text or public.vexa_member(t,array['owner']) is not true or public.retention_storage_authorized(p_path) is not true then raise insufficient_privilege;end if;
 return exists(select 1 from storage.objects where bucket_id='vexa-private' and name=p_path);
end $$;
revoke all on function public.retention_storage_object_exists(text) from public,anon,authenticated,service_role,vexa_backend;
grant execute on function public.retention_storage_object_exists(text) to vexa_backend;
-- Close every helper's default execute privilege, including PUBLIC defaults.
do $$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p where p.pronamespace='public'::regnamespace and p.proname like 'association_%' loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role,vexa_backend',f.signature);
 end loop;
end $$;
grant execute on function public.association_commit_batch(jsonb),public.association_resolve(jsonb) to vexa_backend;
grant execute on function public.association_raw_available(uuid) to vexa_backend,authenticated;
grant execute on function public.association_storage_available(text) to authenticated;
commit;
