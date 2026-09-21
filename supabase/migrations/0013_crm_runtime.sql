begin;
create table public.crm_sync_settings (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.organizations(id),
 connection_id uuid not null,actor_id uuid not null references auth.users(id),enabled boolean not null default false,
 history_from timestamptz not null,backfill_to timestamptz not null,overlap_seconds integer not null default 60 check(overlap_seconds between 0 and 86400),
 version integer not null default 1 check(version>0),generation integer not null default 1 check(generation>0),poll_seconds integer not null default 300 check(poll_seconds between 60 and 86400),last_dispatched_at timestamptz,next_attempt_at timestamptz not null default now(),
 failure_count integer not null default 0 check(failure_count between 0 and 4),error_code text check(error_code in ('CRM_CREDENTIAL_CONFIGURATION_REQUIRED','RECONNECT_REQUIRED','SYNC_FAILED')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,connection_id),check(history_from<backfill_to),
 foreign key(tenant_id,connection_id) references public.connections(tenant_id,id)
);
alter table public.crm_sync_settings enable row level security;
alter table public.crm_sync_settings force row level security;
revoke all on public.crm_sync_settings from public,anon,authenticated,service_role,vexa_backend;
grant select,insert,update on public.crm_sync_settings to vexa_backend;
create policy crm_read on public.crm_sync_settings for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create policy crm_insert on public.crm_sync_settings for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and actor_id=auth.uid() and public.vexa_backend_action(tenant_id,array['configure']));
-- Boolean only. The delegated worker cannot discover arbitrary memberships.
create function public.crm_actor_authorized(p_connection uuid) returns boolean language sql security definer set search_path='' as $$
 select current_setting('vexa.action',true)='import' and exists(
  select 1 from public.crm_sync_settings s
  join public.connections c on c.tenant_id=s.tenant_id and c.id=s.connection_id
  join public.memberships actor on actor.tenant_id=s.tenant_id and actor.user_id=s.actor_id
  join public.memberships bot on bot.tenant_id=s.tenant_id and bot.user_id=auth.uid()
  left join public.worker_delegations d on d.tenant_id=bot.tenant_id and d.user_id=bot.user_id
  where s.connection_id=p_connection and s.tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid
  and s.enabled and c.status='active' and actor.status='active' and actor.role='owner'
  and bot.status='active' and ((bot.user_id=actor.user_id and bot.role='owner') or (bot.role='analyst' and d.enabled)))
$$;
revoke all on function public.crm_actor_authorized(uuid) from public,anon,authenticated,service_role;
grant execute on function public.crm_actor_authorized(uuid) to vexa_backend;
create policy crm_update on public.crm_sync_settings for update to vexa_backend
 using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (public.vexa_backend_action(tenant_id,array['configure']) or public.crm_actor_authorized(connection_id)))
 with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (public.vexa_backend_action(tenant_id,array['configure']) or public.crm_actor_authorized(connection_id)));
create function public.crm_settings_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if NEW.id<>OLD.id or NEW.tenant_id<>OLD.tenant_id or NEW.connection_id<>OLD.connection_id then raise insufficient_privilege;end if;
 if current_setting('vexa.action',true)='configure' then
  if NEW.version<>OLD.version+1 or NEW.actor_id<>auth.uid() then raise check_violation;end if;
 elsif (to_jsonb(NEW)-array['last_dispatched_at','next_attempt_at','failure_count','error_code','updated_at'])
  is distinct from (to_jsonb(OLD)-array['last_dispatched_at','next_attempt_at','failure_count','error_code','updated_at']) then raise insufficient_privilege;
 end if;
 return NEW;
end $$;
revoke all on function public.crm_settings_guard() from public,anon,authenticated,service_role;
create trigger crm_settings_guard before update on public.crm_sync_settings for each row execute function public.crm_settings_guard();
commit;
