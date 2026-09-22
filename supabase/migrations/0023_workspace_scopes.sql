begin;
-- Dimensions are explicitly declared by an owner for a physical economic row.
-- Bindings are immutable manifests of references, not another financial store.
create table public.workspace_order_dimension_versions(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,ledger_row_id uuid not null,version integer not null check(version>0),actor_id uuid not null,
 skus text[],source text check(source in ('hubspot','zendesk','csv','excel')),active boolean not null,report text not null check(length(report) between 20 and 4000),attested boolean not null check(attested),created_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,id),unique(tenant_id,ledger_row_id,version),foreign key(tenant_id) references public.organizations(id),foreign key(tenant_id,ledger_row_id) references public.economic_ledger_entries(tenant_id,id),foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id)
);
create table public.workspace_scope_bindings(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,base_snapshot_id uuid not null,base_scope_hash text not null check(base_scope_hash ~ '^[a-f0-9]{64}$'),scope_hash text not null check(scope_hash ~ '^[a-f0-9]{64}$'),filters jsonb not null,projection_version text not null check(projection_version='workspace-projection-v1'),mapping_ids uuid[] not null,problem_versions jsonb not null,canonical_input text not null,created_at timestamptz not null default clock_timestamp(),created_by uuid not null,
 unique(tenant_id,id),unique(tenant_id,scope_hash),foreign key(tenant_id) references public.organizations(id),foreign key(tenant_id,base_snapshot_id) references public.metric_snapshots(tenant_id,id),foreign key(tenant_id,created_by) references public.memberships(tenant_id,user_id)
);
alter table public.workspace_order_dimension_versions enable row level security;alter table public.workspace_order_dimension_versions force row level security;
alter table public.workspace_scope_bindings enable row level security;alter table public.workspace_scope_bindings force row level security;
revoke all on public.workspace_order_dimension_versions,public.workspace_scope_bindings from public,anon,authenticated,service_role,vexa_backend;
grant select,insert on public.workspace_order_dimension_versions,public.workspace_scope_bindings to vexa_backend;
create policy workspace_dimensions_read on public.workspace_order_dimension_versions for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create policy workspace_dimensions_write on public.workspace_order_dimension_versions for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and actor_id=auth.uid() and public.vexa_backend_action(tenant_id,array['configure']) and public.vexa_member(tenant_id,array['owner']));
create policy workspace_binding_read on public.workspace_scope_bindings for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create policy workspace_binding_write on public.workspace_scope_bindings for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and created_by=auth.uid() and current_setting('vexa.action',true)='materialize' and public.vexa_member(tenant_id));
create function public.workspace_dimension_guard() returns trigger language plpgsql set search_path='' as $$
declare previous integer;
begin
 if tg_op<>'INSERT' then raise insufficient_privilege;end if;
 if new.tenant_id is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or new.actor_id is distinct from auth.uid() or not public.vexa_member(new.tenant_id,array['owner']) or not public.vexa_backend_action(new.tenant_id,array['configure']) then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':workspace-mappings',0));
 if new.skus is not null and (cardinality(new.skus)>100 or array_ndims(new.skus)>1 or exists(select 1 from unnest(new.skus) x where x is null or length(x) not between 1 and 100 or btrim(x)<>x) or cardinality(new.skus)<>(select count(distinct x) from unnest(new.skus) x)) then raise check_violation;end if;
 if not public.economic_record_current(new.tenant_id,new.ledger_row_id,array['order']) then raise check_violation;end if;
 select max(version) into previous from public.workspace_order_dimension_versions where tenant_id=new.tenant_id and ledger_row_id=new.ledger_row_id;
 if new.version<>coalesce(previous,0)+1 then raise serialization_failure;end if;
 new.created_at=clock_timestamp();return new;
end $$;
create trigger workspace_dimension_append before insert or update or delete on public.workspace_order_dimension_versions for each row execute function public.workspace_dimension_guard();
create function public.workspace_binding_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare snap public.metric_snapshots; f jsonb; body jsonb; mid uuid; m public.workspace_order_dimension_versions; pv jsonb;
begin
 if tg_op<>'INSERT' then raise insufficient_privilege;end if;
 if new.tenant_id is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or new.created_by is distinct from auth.uid() or current_setting('vexa.action',true) is distinct from 'materialize' or not public.vexa_member(new.tenant_id) then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':workspace-mappings',0));
 select * into snap from public.metric_snapshots where tenant_id=new.tenant_id and id=new.base_snapshot_id;
 if snap.id is null or snap.status<>'published' or snap.economic_schema_version is distinct from 'economic-snapshot-v1' or snap.scope_hash is distinct from new.base_scope_hash then raise check_violation;end if;
 f=new.filters;
 if jsonb_typeof(f) is distinct from 'object' or (select count(*) from jsonb_object_keys(f))<>10 or not(f ?& array['date_start','date_end','timezone','date_basis','currency','basis','exponent','sku','source','snapshot_id']) or f->>'timezone' is distinct from 'UTC' or f->>'date_basis' is distinct from 'occurred_at' or f->>'snapshot_id' is distinct from new.base_snapshot_id::text or jsonb_typeof(f->'sku') is distinct from 'array' or jsonb_typeof(f->'source') is distinct from 'array' or jsonb_typeof(f->'exponent') is distinct from 'number' then raise check_violation;end if;
 if f->>'date_start' is distinct from left(snap.provenance->'scope'->>'start',10) or f->>'date_end' is distinct from left(snap.provenance->'scope'->>'end',10) or f->>'currency' is distinct from snap.provenance->'scope'->>'currency' or f->>'basis' is distinct from snap.provenance->'scope'->>'basis' or f->'exponent' is distinct from snap.provenance->'scope'->'exponent' then raise check_violation;end if;
 if jsonb_array_length(f->'sku')>20 or exists(select 1 from jsonb_array_elements(f->'sku') x where jsonb_typeof(x)<>'string' or length(x#>>'{}') not between 1 and 100 or btrim(x#>>'{}')<>x#>>'{}') or exists(select 1 from jsonb_array_elements(f->'source') x where jsonb_typeof(x)<>'string' or x#>>'{}' not in ('hubspot','zendesk','csv','excel')) then raise check_violation;end if;
 if cardinality(new.mapping_ids)<>(select count(distinct x) from unnest(new.mapping_ids) x) or array_ndims(new.mapping_ids)>1 then raise check_violation;end if;
 foreach mid in array new.mapping_ids loop
  select * into m from public.workspace_order_dimension_versions where tenant_id=new.tenant_id and id=mid;
  if m.id is null or not exists(select 1 from public.memberships a where a.tenant_id=new.tenant_id and a.user_id=m.actor_id and a.status='active' and a.role='owner') or not exists(select 1 from jsonb_array_elements(snap.input_manifest->'refs') r where r->>'table'='economic_ledger_entries' and r->>'id'=m.ledger_row_id::text and r->'authorized'='true'::jsonb and r->'active'='true'::jsonb) then raise check_violation;end if;
 end loop;
 if exists(select 1 from public.workspace_order_dimension_versions where tenant_id=new.tenant_id and id=any(new.mapping_ids) group by ledger_row_id having count(*)>1) then raise check_violation;end if;
 if jsonb_typeof(new.problem_versions) is distinct from 'array' then raise check_violation;end if;
 if (select count(*) from jsonb_array_elements(new.problem_versions))<>(select count(distinct x->>'problemId') from jsonb_array_elements(snap.provenance->'exposure'->'membership') x) then raise check_violation;end if;
 if (select count(*) from jsonb_array_elements(new.problem_versions))<>(select count(distinct x->>'problemId') from jsonb_array_elements(new.problem_versions) x) then raise check_violation;end if;
 for pv in select value from jsonb_array_elements(new.problem_versions) loop
  if jsonb_typeof(pv) is distinct from 'object' or not(pv ?& array['problemId','versionId']) or (select count(*) from jsonb_object_keys(pv))<>2 or not exists(select 1 from jsonb_array_elements(snap.provenance->'exposure'->'membership') l where l->>'problemId'=pv->>'problemId') then raise check_violation;end if;
  if pv->'versionId'<>'null'::jsonb and not exists(select 1 from public.problem_versions p where p.tenant_id=new.tenant_id and p.id=(pv->>'versionId')::uuid and p.problem_id=(pv->>'problemId')::uuid and p.created_at<=snap.as_of and p.provenance->>'kind'='vector-problem-v1') then raise check_violation;end if;
 end loop;
 body=jsonb_build_object('baseSnapshotId',new.base_snapshot_id,'baseScopeHash',new.base_scope_hash,'filters',f,'mappingIds',to_jsonb(new.mapping_ids),'problemVersions',new.problem_versions,'version',new.projection_version);
 if new.canonical_input::jsonb is distinct from body or new.scope_hash is distinct from encode(sha256(convert_to(new.canonical_input,'UTF8')),'hex') then raise check_violation;end if;
 new.created_at=clock_timestamp();return new;
end $$;
create trigger workspace_binding_append before insert or update or delete on public.workspace_scope_bindings for each row execute function public.workspace_binding_guard();
revoke all on function public.workspace_dimension_guard(),public.workspace_binding_guard() from public,anon,authenticated,service_role;
commit;
