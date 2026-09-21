begin;
-- Import needs a row-share lock to serialize connection revocation with page commit.
-- The post-update check remains configure-only: this does not grant import writes.
alter policy backend_update_capability on public.connections
 using(public.vexa_backend_action(tenant_id,array['configure','import']))
 with check(public.vexa_backend_action(tenant_id,array['configure']));
alter table public.imports add unique(tenant_id,id,connection_id);
create table public.sync_cursors (
 id uuid primary key, tenant_id uuid not null references public.organizations(id) on delete restrict,
 connection_id uuid not null, import_id uuid not null, scope_hash text not null check(scope_hash ~ '^[a-f0-9]{64}$'),
 mode text not null check(mode in ('live','backfill')), window_spec jsonb not null check(jsonb_typeof(window_spec)='object'),
 mapping_version text not null, checkpoint jsonb, version bigint not null default 0 check(version>=0),
 done boolean not null default false, worker_id uuid, fence bigint not null default 0 check(fence>=0), lease_until timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(tenant_id,id), unique(tenant_id,scope_hash),unique(tenant_id,id,connection_id,import_id),
 check((worker_id is null)=(lease_until is null)),
 foreign key(tenant_id,connection_id) references public.connections(tenant_id,id) on delete restrict,
 foreign key(tenant_id,import_id,connection_id) references public.imports(tenant_id,id,connection_id) on delete restrict
);
create table public.sync_raw_objects (
 id uuid primary key,tenant_id uuid not null references public.organizations(id) on delete restrict,
 sync_id uuid not null,connection_id uuid not null,import_id uuid not null,row_ref text not null,
 raw_hash text not null check(raw_hash ~ '^[a-f0-9]{64}$'),original jsonb not null,normalized jsonb not null,result jsonb not null,
 created_at timestamptz not null default now(),unique(tenant_id,id),unique(tenant_id,import_id,row_ref),
 foreign key(tenant_id,sync_id,connection_id,import_id) references public.sync_cursors(tenant_id,id,connection_id,import_id) on delete restrict
);
create table public.sync_pages (
 id uuid primary key,tenant_id uuid not null references public.organizations(id) on delete restrict,sync_id uuid not null,
 version bigint not null check(version>0),previous_checkpoint jsonb,checkpoint jsonb,done boolean not null,
 coverage jsonb not null check(jsonb_typeof(coverage)='object'),counts jsonb not null check(jsonb_typeof(counts)='object'),
 created_at timestamptz not null default now(),unique(tenant_id,id),unique(tenant_id,sync_id,version),
 foreign key(tenant_id,sync_id) references public.sync_cursors(tenant_id,id) on delete restrict
);
create function public.vexa_sync_identity() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (new.id,new.tenant_id,new.connection_id,new.import_id,new.scope_hash,new.mode,new.window_spec,new.mapping_version,new.created_at)
 is distinct from (old.id,old.tenant_id,old.connection_id,old.import_id,old.scope_hash,old.mode,old.window_spec,old.mapping_version,old.created_at)
 then raise exception 'immutable sync identity' using errcode='23514'; end if;
 if new.version is distinct from old.version then
  if new.version<>old.version+1 or not exists(select 1 from public.sync_pages p where p.tenant_id=new.tenant_id and p.sync_id=new.id and p.version=new.version and p.checkpoint is not distinct from new.checkpoint and p.previous_checkpoint is not distinct from old.checkpoint and p.done=new.done)
  then raise exception 'checkpoint requires committed page' using errcode='23514'; end if;
 elsif (new.checkpoint,new.done) is distinct from (old.checkpoint,old.done) then
  raise exception 'checkpoint version required' using errcode='23514';
 end if;
 if new.fence is distinct from old.fence and (new.fence<>old.fence+1 or old.lease_until>clock_timestamp() or new.worker_id is null or new.lease_until<=clock_timestamp())
 then raise exception 'invalid lease transition' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function public.vexa_sync_identity() from public,anon,authenticated,service_role;
create trigger immutable_sync_identity before update on public.sync_cursors for each row execute function public.vexa_sync_identity();
alter table public.sync_cursors enable row level security;
alter table public.sync_cursors force row level security;
alter table public.sync_raw_objects enable row level security;
alter table public.sync_raw_objects force row level security;
alter table public.sync_pages enable row level security;
alter table public.sync_pages force row level security;
revoke all on public.sync_cursors,public.sync_raw_objects,public.sync_pages from public,anon,authenticated,service_role;
grant select,insert on public.sync_cursors,public.sync_raw_objects,public.sync_pages to vexa_backend;
grant update on public.sync_cursors to vexa_backend;
-- Raw content is never a direct authenticated/PostgREST table, including for viewers.
create policy backend_read on public.sync_cursors for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and current_setting('vexa.action',true) in ('read','import') and public.vexa_member(tenant_id,array['owner','analyst']));
create policy backend_read on public.sync_raw_objects for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and current_setting('vexa.action',true) in ('read','import') and public.vexa_member(tenant_id,array['owner','analyst']));
create policy backend_read on public.sync_pages for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and current_setting('vexa.action',true) in ('read','import') and public.vexa_member(tenant_id,array['owner','analyst']));
create policy backend_insert on public.sync_cursors for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_backend_action(tenant_id,array['import']));
create policy backend_insert on public.sync_raw_objects for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_backend_action(tenant_id,array['import']));
create policy backend_insert on public.sync_pages for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update on public.sync_cursors for update to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_backend_action(tenant_id,array['import'])) with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_backend_action(tenant_id,array['import']));
create index on public.sync_raw_objects(tenant_id,sync_id);
create index on public.sync_pages(tenant_id,sync_id);
commit;
