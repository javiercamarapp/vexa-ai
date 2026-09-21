begin;
-- One immutable request binds a user decision, conversation and server configuration to a job.
create table public.extraction_requests (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations(id),
 job_id uuid not null, conversation_id uuid not null, actor_id uuid not null references auth.users(id),
 request_key uuid not null, config_hash text not null check(config_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,job_id),unique(tenant_id,actor_id,request_key),
 foreign key(tenant_id,job_id) references public.jobs(tenant_id,id),
 foreign key(tenant_id,conversation_id) references public.conversations(tenant_id,id),
 foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id)
);
alter table public.extraction_requests enable row level security;
alter table public.extraction_requests force row level security;
revoke all on public.extraction_requests from public,anon,authenticated,service_role,vexa_backend;
grant select,insert on public.extraction_requests to vexa_backend;
create policy backend_read on public.extraction_requests for select to vexa_backend using (
 tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id,array['owner','analyst'])
);
create policy backend_insert on public.extraction_requests for insert to vexa_backend with check (
 tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and actor_id=auth.uid()
 and public.vexa_backend_action(tenant_id,array['import'])
 and exists(select 1 from public.jobs j where j.tenant_id=extraction_requests.tenant_id and j.id=extraction_requests.job_id and j.type='extraction' and j.state='queued')
);
-- Only a delegated current analyst may execute; the original request actor must remain authorized.
-- Boolean result reveals no membership data and is bound to the selected tenant and Auth principal.
create function public.extraction_actor_authorized(p_job uuid) returns boolean
language sql security definer set search_path='' as $$
 select current_setting('vexa.action',true)='import' and exists(
 select 1 from public.extraction_requests r
 join public.memberships original on original.tenant_id=r.tenant_id and original.user_id=r.actor_id
 join public.memberships bot on bot.tenant_id=r.tenant_id and bot.user_id=auth.uid()
 join public.worker_delegations d on d.tenant_id=bot.tenant_id and d.user_id=bot.user_id
 where r.job_id=p_job and r.tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid
 and original.status='active' and original.role in ('owner','analyst')
 and bot.status='active' and bot.role='analyst' and d.enabled)
$$;
revoke all on function public.extraction_actor_authorized(uuid) from public,anon,authenticated,service_role;
grant execute on function public.extraction_actor_authorized(uuid) to vexa_backend;
-- Queue-issued jobs also enforce their live capability below the JavaScript repository.
-- Legacy, directly scoped extraction/budget jobs retain their existing reviewed policies.
create function public.extraction_queue_fence(p_job uuid) returns boolean
language sql security definer set search_path='' as $$
 select not exists(select 1 from public.extraction_requests r where r.job_id=p_job
  and r.tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid)
 or (public.extraction_actor_authorized(p_job) and exists(select 1 from public.jobs j
  where j.id=p_job and j.tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid
  and j.type='extraction' and j.state='running' and j.cancel_requested_at is null
  and j.lease_until>clock_timestamp()
  and j.fencing_token::text=current_setting('vexa.extraction_job_fence',true)
  and j.lease_owner=current_setting('vexa.extraction_lease_owner',true)))
$$;
revoke all on function public.extraction_queue_fence(uuid) from public,anon,authenticated,service_role;
grant execute on function public.extraction_queue_fence(uuid) to vexa_backend;
create policy queue_claim_fence on public.extraction_claims as restrictive for insert to vexa_backend
 with check(public.extraction_queue_fence(job_id));
create policy queue_run_insert_fence on public.extraction_runs as restrictive for insert to vexa_backend
 with check(public.extraction_queue_fence(job_id));
create policy queue_run_update_fence on public.extraction_runs as restrictive for update to vexa_backend
 using(public.extraction_queue_fence(job_id)) with check(public.extraction_queue_fence(job_id));
create policy queue_budget_insert_fence on public.ai_budget_reservations as restrictive for insert to vexa_backend
 with check(public.extraction_queue_fence(job_id));
create policy queue_budget_update_fence on public.ai_budget_reservations as restrictive for update to vexa_backend
 using(current_setting('vexa.action',true)='configure' or public.extraction_queue_fence(job_id))
 with check(current_setting('vexa.action',true)='configure' or public.extraction_queue_fence(job_id));
create policy queue_budget_attempt_fence on public.ai_budget_attempts as restrictive for insert to vexa_backend
 with check(exists(select 1 from public.ai_budget_reservations r where r.tenant_id=ai_budget_attempts.tenant_id and r.id=ai_budget_attempts.reservation_id and public.extraction_queue_fence(r.job_id)));
commit;
