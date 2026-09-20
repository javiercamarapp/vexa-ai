begin;
-- Worker delegation is explicit per tenant; SQL callers retain RLS.
alter table public.jobs add column failure_count integer not null default 0 check(failure_count between 0 and 4);
alter table public.jobs add column last_progress_at timestamptz;
alter table public.jobs alter column max_attempts set default 4;
create index durable_heartbeat on public.audit_events(tenant_id,actor,action,occurred_at desc);
-- A worker must already be a real Auth user and active analyst membership.
create table public.worker_delegations (
 tenant_id uuid not null, user_id uuid not null, enabled boolean not null default false,
 last_dispatched_at timestamptz,
 primary key(tenant_id,user_id),
 foreign key(tenant_id,user_id) references public.memberships(tenant_id,user_id)
);
alter table public.worker_delegations enable row level security;
alter table public.worker_delegations force row level security;
revoke all on public.worker_delegations from public,anon,authenticated,service_role;
grant select,insert,update on public.worker_delegations to vexa_backend;
create policy worker_read on public.worker_delegations for select to vexa_backend
 using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create policy worker_insert on public.worker_delegations for insert to vexa_backend
 with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid
 and public.vexa_backend_action(tenant_id,array['configure']));
create policy worker_update on public.worker_delegations for update to vexa_backend
 using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid
 and public.vexa_backend_action(tenant_id,array['configure']))
 with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid
 and public.vexa_backend_action(tenant_id,array['configure']));
-- A delegation names one immutable membership. Reassignment is not revocation.
create function public.worker_delegation_identity_immutable() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.tenant_id is distinct from old.tenant_id or new.user_id is distinct from old.user_id then
  raise insufficient_privilege using message='worker delegation identity is immutable';
 end if;
 return new;
end $$;
revoke all on function public.worker_delegation_identity_immutable() from public,anon,authenticated,service_role;
create trigger worker_delegation_identity_immutable before update on public.worker_delegations
 for each row execute function public.worker_delegation_identity_immutable();
-- Boolean only; cannot enumerate members. Binds tenant, action, caller and saved job actor.
create function public.worker_actor_authorized(p_job uuid) returns boolean
language sql security definer set search_path='' as $$
 select current_setting('vexa.action',true)='import'
 and exists(select 1 from public.jobs j
 join public.import_uploads u on u.tenant_id=j.tenant_id and u.job_id=j.id
 join public.memberships original on original.tenant_id=u.tenant_id and original.user_id=u.user_id
 join public.memberships bot on bot.tenant_id=j.tenant_id and bot.user_id=auth.uid()
 join public.worker_delegations d on d.tenant_id=bot.tenant_id and d.user_id=bot.user_id
 where j.id=p_job and j.tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid
 and original.status='active' and original.role in ('owner','analyst')
 and bot.status='active' and bot.role='analyst' and d.enabled)
$$;
revoke all on function public.worker_actor_authorized(uuid) from public,anon,authenticated,service_role;
grant execute on function public.worker_actor_authorized(uuid) to vexa_backend;
-- Narrow dispatch reservation: only the authenticated bot's explicitly approved scopes.
-- One scope per request, durable rotation even on idle scopes and cold starts.
create function public.reserve_worker_scope() returns uuid
language plpgsql security definer set search_path='' as $$
declare chosen uuid;
begin
 if auth.uid() is null or current_setting('vexa.action',true) is distinct from 'worker_dispatch' then
  raise insufficient_privilege using message='worker identity required';
 end if;
 select d.tenant_id into chosen from public.worker_delegations d
 join public.memberships m on m.tenant_id=d.tenant_id and m.user_id=d.user_id
 where d.user_id=auth.uid() and d.enabled and m.status='active' and m.role='analyst'
 order by d.last_dispatched_at nulls first,d.tenant_id limit 1 for update of d skip locked;
 if chosen is not null then
  update public.worker_delegations set last_dispatched_at=clock_timestamp()
   where tenant_id=chosen and user_id=auth.uid();
 end if;
 return chosen;
end $$;
revoke all on function public.reserve_worker_scope() from public,anon,authenticated,service_role;
grant execute on function public.reserve_worker_scope() to vexa_backend;
commit;
