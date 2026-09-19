begin;

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  type text not null, state text not null default 'queued' check (state in ('queued','running','partial','succeeded','failed','cancelled')), input_ref text not null, input_hash text not null, version text not null, lease_until timestamptz, lease_owner text, fencing_token bigint not null default 0 check (fencing_token>=0), next_attempt_at timestamptz not null default now(), deadline timestamptz, cancel_requested_at timestamptz, max_attempts integer not null default 5 check (max_attempts>0),
  import_id uuid,
  unique (tenant_id,type,input_hash,version)
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  state text not null check (state in ('running','succeeded','failed','uncertain','cancelled')), attempt_number integer not null default 1 check (attempt_number>0), fencing_token bigint not null default 0 check (fencing_token>=0), started_at timestamptz not null default now(), finished_at timestamptz, error_code text,
  job_id uuid not null
);

create table public.checkpoints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  checkpoint jsonb not null check (jsonb_typeof(checkpoint)='object'), stage text not null default 'default', fencing_token bigint not null default 0 check (fencing_token>=0),
  job_id uuid not null,
  unique (tenant_id,job_id,stage)
);

create table public.outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  state text not null default 'pending' check (state in ('pending','claimed','published','uncertain','failed','cancelled')), input_ref text not null, topic text not null default 'pipeline', idempotency_key text, next_attempt_at timestamptz not null default now(), lease_until timestamptz, fencing_token bigint not null default 0 check (fencing_token>=0), published_at timestamptz,
  job_id uuid,
  unique (tenant_id,topic,idempotency_key)
);

create table public.dead_letters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  reason text not null, failed_at timestamptz not null default now(),
  job_id uuid not null,
  attempt_id uuid
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  actor text not null, action text not null, resource text not null, reason text not null, trace_id text not null, occurred_at timestamptz not null default now()
);

create table public.tombstones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  deleted_source_key text not null, reason text, deleted_at timestamptz not null default now(),
  connection_id uuid,
  unique (tenant_id,deleted_source_key)
);

alter table public.jobs add foreign key (tenant_id,import_id) references public.imports(tenant_id,id) on delete restrict;
create index on public.jobs(tenant_id,import_id);

alter table public.attempts add foreign key (tenant_id,job_id) references public.jobs(tenant_id,id) on delete restrict;
create index on public.attempts(tenant_id,job_id);

alter table public.checkpoints add foreign key (tenant_id,job_id) references public.jobs(tenant_id,id) on delete restrict;
create index on public.checkpoints(tenant_id,job_id);

alter table public.outbox add foreign key (tenant_id,job_id) references public.jobs(tenant_id,id) on delete restrict;
create index on public.outbox(tenant_id,job_id);

alter table public.dead_letters add foreign key (tenant_id,job_id) references public.jobs(tenant_id,id) on delete restrict;
create index on public.dead_letters(tenant_id,job_id);

alter table public.dead_letters add foreign key (tenant_id,attempt_id) references public.attempts(tenant_id,id) on delete restrict;
create index on public.dead_letters(tenant_id,attempt_id);

alter table public.tombstones add foreign key (tenant_id,connection_id) references public.connections(tenant_id,id) on delete restrict;
create index on public.tombstones(tenant_id,connection_id);

alter table public.jobs enable row level security;
alter table public.jobs force row level security;
revoke all on public.jobs from public,anon,authenticated,service_role;
grant select on public.jobs to authenticated;
grant select,insert,update,delete on public.jobs to vexa_backend;
create policy member_read on public.jobs for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.jobs to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.jobs for each row execute function public.vexa_immutable_tenant();
create index on public.jobs(tenant_id,created_at,id);

alter table public.attempts enable row level security;
alter table public.attempts force row level security;
revoke all on public.attempts from public,anon,authenticated,service_role;
grant select on public.attempts to authenticated;
grant select,insert,update,delete on public.attempts to vexa_backend;
create policy member_read on public.attempts for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.attempts to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.attempts for each row execute function public.vexa_immutable_tenant();
create index on public.attempts(tenant_id,created_at,id);

alter table public.checkpoints enable row level security;
alter table public.checkpoints force row level security;
revoke all on public.checkpoints from public,anon,authenticated,service_role;
grant select on public.checkpoints to authenticated;
grant select,insert,update,delete on public.checkpoints to vexa_backend;
create policy member_read on public.checkpoints for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.checkpoints to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.checkpoints for each row execute function public.vexa_immutable_tenant();
create index on public.checkpoints(tenant_id,created_at,id);

alter table public.outbox enable row level security;
alter table public.outbox force row level security;
revoke all on public.outbox from public,anon,authenticated,service_role;
grant select on public.outbox to authenticated;
grant select,insert,update,delete on public.outbox to vexa_backend;
create policy member_read on public.outbox for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.outbox to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.outbox for each row execute function public.vexa_immutable_tenant();
create index on public.outbox(tenant_id,created_at,id);

alter table public.dead_letters enable row level security;
alter table public.dead_letters force row level security;
revoke all on public.dead_letters from public,anon,authenticated,service_role;
grant select on public.dead_letters to authenticated;
grant select,insert,update,delete on public.dead_letters to vexa_backend;
create policy member_read on public.dead_letters for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.dead_letters to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.dead_letters for each row execute function public.vexa_immutable_tenant();
create index on public.dead_letters(tenant_id,created_at,id);

alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;
revoke all on public.audit_events from public,anon,authenticated,service_role;
grant select on public.audit_events to authenticated;
grant select,insert,update,delete on public.audit_events to vexa_backend;
create policy member_read on public.audit_events for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.audit_events to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.audit_events for each row execute function public.vexa_immutable_tenant();
create index on public.audit_events(tenant_id,created_at,id);

alter table public.tombstones enable row level security;
alter table public.tombstones force row level security;
revoke all on public.tombstones from public,anon,authenticated,service_role;
grant select on public.tombstones to authenticated;
grant select,insert,update,delete on public.tombstones to vexa_backend;
create policy member_read on public.tombstones for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.tombstones to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.tombstones for each row execute function public.vexa_immutable_tenant();
create index on public.tombstones(tenant_id,created_at,id);

create index jobs_ready on public.jobs(tenant_id,state,next_attempt_at);
create index outbox_ready on public.outbox(tenant_id,state,next_attempt_at);

commit;
