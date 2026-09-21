begin;
-- Summary only: provider bodies, credentials, URLs, headers and opaque cursors stay out.
create table public.connection_health (
 tenant_id uuid not null references public.organizations(id) on delete restrict,
 connection_id uuid not null, sync_id uuid not null, sync_fence bigint not null check(sync_fence>0), attempt_id uuid not null, actor_id uuid not null,
 state text not null check(state in ('running','healthy','partial','stale','reconnect_required')),
 last_attempt timestamptz not null default clock_timestamp(),last_success timestamptz,
 checkpoint_hash text check(checkpoint_hash ~ '^[a-f0-9]{64}$'),
 observed_unique bigint check(observed_unique>=0),accepted_unique bigint check(accepted_unique>=0),rejected_unique bigint check(rejected_unique>=0),
 provider_permissions text not null default 'unknown' check(provider_permissions in ('unknown','available','revoked')),
 error_code text check(error_code in ('RECONNECT_REQUIRED','TIMEOUT','SYNC_FAILED','CONTINUATION','EMPTY_RESULT','COVERAGE_INCOMPLETE','RECONNECT_REQUESTED')),
 primary key(tenant_id,connection_id),
 foreign key(tenant_id,connection_id) references public.connections(tenant_id,id) on delete restrict,
 foreign key(tenant_id,sync_id) references public.sync_cursors(tenant_id,id) on delete restrict,
 foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id) on delete restrict,
 check((observed_unique is null)=(accepted_unique is null) and (observed_unique is null)=(rejected_unique is null)),
 check(observed_unique is null or observed_unique=accepted_unique+rejected_unique),
 check(last_success is null or last_success<=last_attempt)
);
create index on public.connection_health(tenant_id,sync_id);
create function public.vexa_health_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare current_sync public.sync_cursors;
begin
 if new.tenant_id is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or not public.vexa_backend_action(new.tenant_id,array['import','configure']) then raise exception 'health scope denied' using errcode='42501'; end if;
 if new.actor_id is distinct from auth.uid() then raise exception 'health actor mismatch' using errcode='42501'; end if;
 if current_setting('vexa.action',true)='configure' then
  if tg_op<>'UPDATE' then raise exception 'recheck requires existing health' using errcode='42501'; end if;
  if not public.vexa_backend_action(new.tenant_id,array['configure']) or old.state<>'reconnect_required'
   or new.state<>'stale' or new.error_code is distinct from 'RECONNECT_REQUESTED' or new.provider_permissions<>'unknown'
   or (new.tenant_id,new.connection_id,new.sync_id,new.sync_fence,new.attempt_id,new.last_attempt,new.last_success,new.checkpoint_hash,new.observed_unique,new.accepted_unique,new.rejected_unique)
    is distinct from (old.tenant_id,old.connection_id,old.sync_id,old.sync_fence,old.attempt_id,old.last_attempt,old.last_success,old.checkpoint_hash,old.observed_unique,old.accepted_unique,old.rejected_unique)
  then raise exception 'recheck cannot change synchronization evidence' using errcode='23514'; end if;
  return new;
 end if;
 select * into current_sync from public.sync_cursors where tenant_id=new.tenant_id and id=new.sync_id and connection_id=new.connection_id;
 if current_sync.id is null or current_sync.fence is distinct from new.sync_fence then raise exception 'health sync scope or fence changed' using errcode='40001'; end if;
 if tg_op='INSERT' or new.attempt_id is distinct from old.attempt_id then
  if current_sync.worker_id is null or current_sync.lease_until is null or current_sync.lease_until<=clock_timestamp() then raise exception 'health needs current sync lease' using errcode='40001'; end if;
 end if;
 if new.state='healthy' and not current_sync.done then raise exception 'healthy needs committed terminal page' using errcode='23514'; end if;
 if tg_op='INSERT' then
  if new.state<>'running' or new.last_success is not null or new.observed_unique is not null or new.checkpoint_hash is not null or new.error_code is not null or new.provider_permissions<>'unknown' then
   raise exception 'health starts with an unverified running attempt' using errcode='23514';
  end if;
  new.last_attempt:=clock_timestamp();
 end if;
 if new.state='healthy' and (new.observed_unique is null or new.observed_unique=0 or new.accepted_unique is distinct from new.observed_unique or new.rejected_unique is distinct from 0::bigint or new.error_code is not null or new.provider_permissions<>'available') then
  raise exception 'healthy requires complete nonempty observed coverage' using errcode='23514';
 end if;
 if tg_op='UPDATE' then
  if (new.tenant_id,new.connection_id) is distinct from (old.tenant_id,old.connection_id) then raise exception 'immutable health identity' using errcode='23514'; end if;
  if old.state='reconnect_required' then raise exception 'owner credential reconnection required' using errcode='23514'; end if;
  if new.attempt_id is distinct from old.attempt_id then
   if new.state<>'running' or (old.state='running' and exists(select 1 from public.sync_cursors s where s.tenant_id=old.tenant_id and s.id=old.sync_id and s.fence=old.sync_fence and s.worker_id is not null and s.lease_until>clock_timestamp())) then
    raise exception 'health attempt still active' using errcode='40001';
   end if;
   new.last_attempt:=clock_timestamp();
  elsif old.state<>'running' or (new.last_attempt,new.sync_id,new.sync_fence) is distinct from (old.last_attempt,old.sync_id,old.sync_fence) then
   raise exception 'health terminal attempt is immutable' using errcode='23514';
  end if;
  if new.last_attempt<old.last_attempt or (old.last_success is not null and (new.last_success is null or new.last_success<old.last_success)) then raise exception 'health time regression' using errcode='23514'; end if;
  if new.state<>'healthy' and new.last_success is distinct from old.last_success then raise exception 'failed attempt cannot advance success' using errcode='23514'; end if;
 end if;
 return new;
end $$;
revoke all on function public.vexa_health_guard() from public,anon,authenticated,service_role;
create trigger connection_health_guard before insert or update on public.connection_health for each row execute function public.vexa_health_guard();
alter table public.connection_health enable row level security;
alter table public.connection_health force row level security;
revoke all on public.connection_health from public,anon,authenticated,service_role;
grant select,insert,update on public.connection_health to vexa_backend;
create policy health_read on public.connection_health for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and current_setting('vexa.action',true) in ('read','import','configure') and public.vexa_member(tenant_id,array['owner','analyst','operator','viewer']));
create policy health_insert on public.connection_health for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_backend_action(tenant_id,array['import']));
create policy health_update on public.connection_health for update to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_backend_action(tenant_id,array['import','configure'])) with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_backend_action(tenant_id,array['import','configure']));
commit;
