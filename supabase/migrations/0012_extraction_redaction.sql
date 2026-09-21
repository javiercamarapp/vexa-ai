begin;
-- Maps are private server data; the redacted immutable revision is the public citation target.
create table public.redaction_maps (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations(id),
 original_revision_id uuid not null, redacted_revision_id uuid not null,
 policy_hash text not null check(policy_hash ~ '^[a-f0-9]{64}$'), private_map jsonb not null check(jsonb_typeof(private_map)='array'),
 created_at timestamptz not null default now(), unique(tenant_id,id), unique(tenant_id,original_revision_id,policy_hash),unique(tenant_id,redacted_revision_id),
 foreign key(tenant_id,original_revision_id) references public.message_revisions(tenant_id,id),
 foreign key(tenant_id,redacted_revision_id) references public.message_revisions(tenant_id,id),
 check(original_revision_id<>redacted_revision_id)
);
create table public.extraction_claims (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.organizations(id),
 run_id uuid not null,job_id uuid not null,task_key text not null check(length(task_key) between 1 and 200),
 actor_id uuid not null references auth.users(id),owner_token uuid not null,created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,task_key),unique(tenant_id,run_id),
 foreign key(tenant_id,run_id) references public.extraction_runs(tenant_id,id),
 foreign key(tenant_id,job_id) references public.jobs(tenant_id,id)
);
create table public.extraction_inputs (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.organizations(id),
 run_id uuid not null,redaction_id uuid not null,created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,run_id,redaction_id),
 foreign key(tenant_id,run_id) references public.extraction_runs(tenant_id,id),
 foreign key(tenant_id,redaction_id) references public.redaction_maps(tenant_id,id)
);
do $$ declare tab text; begin
 foreach tab in array array['redaction_maps','extraction_claims','extraction_inputs'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('alter table public.%I force row level security',tab);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role,vexa_backend',tab);
  execute format('grant select,insert on public.%I to vexa_backend',tab);
  execute format('create policy backend_read on public.%I for select to vexa_backend using (tenant_id=nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid and public.vexa_member(tenant_id,array[''owner'',''analyst'']))',tab);
  execute format('create policy backend_insert on public.%I for insert to vexa_backend with check (tenant_id=nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid and public.vexa_backend_action(tenant_id,array[''import'']))',tab);
 end loop;
end $$;
-- A claim is an execution capability: bind its actor and run to the same live job.
-- Tenant-only INSERT permission is insufficient even within the backend role.
alter policy backend_insert on public.extraction_claims with check (
 tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid
 and actor_id=auth.uid()
 and public.vexa_backend_action(tenant_id,array['import'])
 and exists (
  select 1 from public.extraction_runs r join public.jobs j on j.tenant_id=r.tenant_id and j.id=r.job_id
  where r.tenant_id=extraction_claims.tenant_id and r.id=extraction_claims.run_id
  and r.job_id=extraction_claims.job_id and r.status='running'
  and j.type='extraction' and j.state='running' and j.cancel_requested_at is null
 )
);
-- A running claim can only be completed by its server worker. Terminal results retain history.
create function public.vexa_extraction_terminal_guard() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare claim public.extraction_claims; begin
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
revoke all on function public.vexa_extraction_terminal_guard() from public,anon,authenticated,service_role;
create trigger extraction_terminal_guard before update on public.extraction_runs for each row execute function public.vexa_extraction_terminal_guard();
commit;
