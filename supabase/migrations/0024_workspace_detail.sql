begin;
create table public.workspace_customer_identity_versions(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,customer_key text not null check(length(btrim(customer_key)) between 1 and 200),customer_id uuid not null,customer_revision_id uuid not null,version integer not null check(version>0),actor_id uuid not null,active boolean not null,report text not null check(length(report) between 20 and 4000),attested boolean not null check(attested),created_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,id),unique(tenant_id,customer_key,version),foreign key(tenant_id) references public.organizations(id),foreign key(tenant_id,customer_id) references public.customers(tenant_id,id),foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id),foreign key(tenant_id,customer_id,customer_revision_id) references public.source_revisions(tenant_id,canonical_id,id)
);
create table public.workspace_detail_bindings(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,workspace_binding_id uuid not null,base_snapshot_id uuid not null,scope_hash text not null check(scope_hash ~ '^[a-f0-9]{64}$'),detail_hash text not null check(detail_hash ~ '^[a-f0-9]{64}$'),identity_ids uuid[] not null,conversation_refs jsonb not null,canonical_input text not null,created_by uuid not null,created_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,id),unique(tenant_id,detail_hash),foreign key(tenant_id) references public.organizations(id),foreign key(tenant_id,workspace_binding_id) references public.workspace_scope_bindings(tenant_id,id),foreign key(tenant_id,base_snapshot_id) references public.metric_snapshots(tenant_id,id),foreign key(tenant_id,created_by) references public.memberships(tenant_id,user_id)
);
alter table public.workspace_customer_identity_versions enable row level security;alter table public.workspace_customer_identity_versions force row level security;
alter table public.workspace_detail_bindings enable row level security;alter table public.workspace_detail_bindings force row level security;
revoke all on public.workspace_customer_identity_versions,public.workspace_detail_bindings from public,anon,authenticated,service_role,vexa_backend;
grant select,insert on public.workspace_customer_identity_versions,public.workspace_detail_bindings to vexa_backend;
create policy workspace_customer_identity_read on public.workspace_customer_identity_versions for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create policy workspace_customer_identity_write on public.workspace_customer_identity_versions for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and actor_id=auth.uid() and public.vexa_member(tenant_id,array['owner']) and public.vexa_backend_action(tenant_id,array['configure']));
create policy workspace_detail_read on public.workspace_detail_bindings for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create policy workspace_detail_write on public.workspace_detail_bindings for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and created_by=auth.uid() and public.vexa_member(tenant_id) and current_setting('vexa.action',true)='materialize');
create function public.workspace_customer_identity_guard() returns trigger language plpgsql set search_path='' as $$
declare previous integer;
begin
 if tg_op<>'INSERT' then raise insufficient_privilege;end if;
 if new.tenant_id is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or new.actor_id is distinct from auth.uid() or not public.vexa_member(new.tenant_id,array['owner']) or not public.vexa_backend_action(new.tenant_id,array['configure']) then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':workspace-customer-identities',0));
 if not exists(select 1 from public.source_revisions r join public.source_heads h on h.tenant_id=r.tenant_id and h.id=r.canonical_id join public.connections c on c.tenant_id=r.tenant_id and c.id=r.connection_id where r.tenant_id=new.tenant_id and r.id=new.customer_revision_id and r.canonical_id=new.customer_id and r.entity_type='customer' and h.selected_revision_id=r.id and h.state in ('unique','selected') and c.status='active') then raise check_violation;end if;
 if not exists(select 1 from public.economic_order_customers e where e.tenant_id=new.tenant_id and e.customer_key=new.customer_key and public.economic_contributor_active(e.tenant_id,e.actor_id)) then raise check_violation;end if;
 select max(version) into previous from public.workspace_customer_identity_versions where tenant_id=new.tenant_id and customer_key=new.customer_key;
 if new.version<>coalesce(previous,0)+1 then raise serialization_failure;end if;
 new.created_at=clock_timestamp();return new;
end $$;
create trigger workspace_customer_identity_append before insert or update or delete on public.workspace_customer_identity_versions for each row execute function public.workspace_customer_identity_guard();
create function public.workspace_detail_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare snap public.metric_snapshots; binding public.workspace_scope_bindings; identity_id uuid; identity_row public.workspace_customer_identity_versions; ref jsonb; rid text; run public.extraction_runs; src public.source_revisions; body jsonb;
begin
 if tg_op<>'INSERT' then raise insufficient_privilege;end if;
 if new.tenant_id is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or new.created_by is distinct from auth.uid() or current_setting('vexa.action',true) is distinct from 'materialize' or not public.vexa_member(new.tenant_id) then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':workspace-customer-identities',0));
 select * into binding from public.workspace_scope_bindings where tenant_id=new.tenant_id and id=new.workspace_binding_id;
 select * into snap from public.metric_snapshots where tenant_id=new.tenant_id and id=new.base_snapshot_id;
 if binding.id is null or snap.id is null or snap.status<>'published' or snap.economic_schema_version is distinct from 'economic-snapshot-v1' or binding.base_snapshot_id is distinct from snap.id or binding.scope_hash is distinct from new.scope_hash then raise check_violation;end if;
 if array_ndims(new.identity_ids)>1 or cardinality(new.identity_ids)<>(select count(distinct x) from unnest(new.identity_ids) x) then raise check_violation;end if;
 foreach identity_id in array new.identity_ids loop
  select * into identity_row from public.workspace_customer_identity_versions where tenant_id=new.tenant_id and id=identity_id;
  if identity_row.id is null or not identity_row.active or not exists(select 1 from public.memberships m where m.tenant_id=new.tenant_id and m.user_id=identity_row.actor_id and m.role='owner' and m.status='active') or not exists(select 1 from public.economic_order_customers c join lateral jsonb_array_elements(snap.input_manifest->'refs') r on r->>'id'=c.id::text and r->>'table'='economic_order_customers' and r->'authorized'='true'::jsonb and r->'active'='true'::jsonb where c.tenant_id=new.tenant_id and c.customer_key=identity_row.customer_key) then raise check_violation;end if;
  if identity_row.version<>(select max(v.version) from public.workspace_customer_identity_versions v where v.tenant_id=new.tenant_id and v.customer_key=identity_row.customer_key) then raise check_violation;end if;
 end loop;
 if jsonb_typeof(new.conversation_refs) is distinct from 'array' or jsonb_array_length(new.conversation_refs)<>(select count(*) from jsonb_array_elements(snap.input_manifest->'models')) or jsonb_array_length(new.conversation_refs)<>(select count(distinct (x->>'runId')::uuid) from jsonb_array_elements(new.conversation_refs) x) then raise check_violation;end if;
 for ref in select value from jsonb_array_elements(new.conversation_refs) loop
  if jsonb_typeof(ref) is distinct from 'object' or not(ref ?& array['runId','conversationId','sourceRevisionIds']) or (select count(*) from jsonb_object_keys(ref))<>3 or jsonb_typeof(ref->'sourceRevisionIds') is distinct from 'array' then raise check_violation;end if;
  select * into run from public.extraction_runs where tenant_id=new.tenant_id and id=(ref->>'runId')::uuid;
  if run.id is null or ref->>'conversationId' is distinct from run.conversation_id::text or not exists(select 1 from jsonb_array_elements(snap.input_manifest->'models') m where m->>'id'=run.id::text) then raise check_violation;end if;
  if jsonb_array_length(ref->'sourceRevisionIds')<>(select count(distinct value::uuid) from jsonb_array_elements_text(ref->'sourceRevisionIds')) then raise check_violation;end if;
  if jsonb_array_length(ref->'sourceRevisionIds')<>(select count(*) from public.source_revisions r where r.tenant_id=new.tenant_id and r.canonical_id=run.conversation_id and r.entity_type='conversation' and r.created_at<=run.created_at) then raise check_violation;end if;
  for rid in select value from jsonb_array_elements_text(ref->'sourceRevisionIds') loop
   select * into src from public.source_revisions where tenant_id=new.tenant_id and id=rid::uuid;
   if src.id is null or src.entity_type<>'conversation' or src.canonical_id<>run.conversation_id or src.created_at>run.created_at then raise check_violation;end if;
  end loop;
 end loop;
 body=jsonb_build_object('workspaceBindingId',new.workspace_binding_id,'baseSnapshotId',new.base_snapshot_id,'scopeHash',new.scope_hash,'identityIds',to_jsonb(new.identity_ids),'conversationRefs',new.conversation_refs,'version','workspace-detail-v1');
 if new.canonical_input::jsonb is distinct from body or new.detail_hash is distinct from encode(sha256(convert_to(new.canonical_input,'UTF8')),'hex') then raise check_violation;end if;
 new.created_at=clock_timestamp();return new;
end $$;
create trigger workspace_detail_append before insert or update or delete on public.workspace_detail_bindings for each row execute function public.workspace_detail_guard();
revoke all on function public.workspace_customer_identity_guard(),public.workspace_detail_guard() from public,anon,authenticated,service_role;
commit;
