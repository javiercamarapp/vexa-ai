begin;

-- Only committed business transitions create notifications. No public emit RPC.
-- Source keys contain internal IDs/version counters, never CRM content or PII.
create table public.notification_business_events (
 tenant_id uuid not null references public.organizations(id),
 source_key text not null check(length(source_key) between 1 and 256),
 event_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(tenant_id,source_key),
 foreign key(tenant_id,event_id) references public.notification_events(tenant_id,id)
);
alter table public.notification_business_events enable row level security;
alter table public.notification_business_events force row level security;
revoke all on public.notification_business_events from public,anon,authenticated,service_role,vexa_backend;

-- This private helper is callable only by the table triggers below. The owner's
-- current delivery policy authorizes fanout; it does not authorize the business
-- mutation. That mutation has already passed its own RLS/validation boundary.
-- Runtime-local settings support managed PostgreSQL; restore the caller on every exit.
create function public.notification_emit_business(t uuid,k text,r uuid,source_key text,target_user uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare pol public.notification_delivery_policies; member_id uuid; eid uuid;
 prior_sub text:=current_setting('request.jwt.claim.sub',true);
 prior_tenant text:=current_setting('vexa.tenant_id',true);
 prior_action text:=current_setting('vexa.action',true);
begin
 if k not in('membership.welcome','brief.available','intervention.assigned','connection.attention','processing.failed') or t is null or r is null or source_key is null or length(source_key)>256 then raise check_violation;end if;
 perform set_config('vexa.tenant_id',t::text,true);
 perform set_config('vexa.action','import',true);
 perform pg_advisory_xact_lock(hashtextextended(t::text||':notification-business:'||source_key,0));
 select b.event_id into eid from public.notification_business_events b where b.tenant_id=t and b.source_key=notification_emit_business.source_key;
 for pol in
  select current_policy.* from (
   select distinct on(channel) * from public.notification_delivery_policies where tenant_id=t order by channel,version desc
  ) current_policy
  where current_policy.enabled and exists(select 1 from public.memberships m join auth.users u on u.id=m.user_id where m.tenant_id=t and m.user_id=current_policy.actor_id and m.status='active' and m.role='owner' and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp()))
 loop
  perform set_config('request.jwt.claim.sub',pol.actor_id::text,true);
  for member_id in select m.user_id from public.memberships m join auth.users u on u.id=m.user_id where m.tenant_id=t and m.status='active' and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp()) and (target_user is null or m.user_id=target_user) order by m.user_id
  loop
   if public.notification_recipient_current(t,member_id,k,r,pol.channel) is not true then continue;end if;
   if eid is null then
    eid=gen_random_uuid();
    insert into public.notification_events(tenant_id,id,type,resource_id) values(t,eid,k,r);
    insert into public.notification_business_events(tenant_id,source_key,event_id) values(t,source_key,eid);
   end if;
   perform public.notification_enqueue(jsonb_build_object('eventId',eid,'type',k,'resourceId',r,'userId',member_id,'channel',pol.channel));
  end loop;
 end loop;
 perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);
 perform set_config('vexa.tenant_id',coalesce(prior_tenant,''),true);
 perform set_config('vexa.action',coalesce(prior_action,''),true);
exception when query_canceled or others then
 perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);
 perform set_config('vexa.tenant_id',coalesce(prior_tenant,''),true);
 perform set_config('vexa.action',coalesce(prior_action,''),true);
 raise;
end $$;
revoke all on function public.notification_emit_business(uuid,text,uuid,text,uuid) from public,anon,authenticated,service_role,vexa_backend;

create function public.notification_business_transition() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='weekly_briefs' then
  if new.status='published' and new.brief_schema='brief-v1' and (tg_op='INSERT' or old.status is distinct from new.status) then
   perform public.notification_emit_business(new.tenant_id,'brief.available',new.id,'brief:'||new.id::text,null);
  end if;
 elsif tg_table_name='interventions' then
  if new.owner_id is not null and (tg_op='INSERT' or old.owner_id is distinct from new.owner_id) then
   perform public.notification_emit_business(new.tenant_id,'intervention.assigned',new.id,'assignment:'||new.id::text||':'||new.version::text,new.owner_id);
  end if;
 elsif tg_table_name='connection_health' then
  if new.state in('reconnect_required','partial','stale') and (tg_op='INSERT' or old.state is distinct from new.state or old.attempt_id is distinct from new.attempt_id) then
   perform public.notification_emit_business(new.tenant_id,'connection.attention',new.connection_id,'connection:'||new.connection_id::text||':'||new.attempt_id::text||':'||new.state,null);
  end if;
 elsif tg_table_name='jobs' then
  -- A notification failure must never recursively notify about itself.
  if new.type<>'notification' and new.import_id is not null and new.state='failed' and (tg_op='INSERT' or old.state is distinct from new.state) then
   perform public.notification_emit_business(new.tenant_id,'processing.failed',new.id,'job:'||new.id::text||':'||new.fencing_token::text||':'||new.failure_count::text,null);
  end if;
 elsif tg_table_name='memberships' then
  if new.status='active' and (tg_op='INSERT' or old.status is distinct from new.status) then
   perform public.notification_emit_business(new.tenant_id,'membership.welcome',new.user_id,'membership:'||new.user_id::text||':'||new.permissions_version::text,new.user_id);
  end if;
 else raise check_violation;
 end if;
 return new;
end $$;
revoke all on function public.notification_business_transition() from public,anon,authenticated,service_role,vexa_backend;
create trigger notification_business_brief after insert or update on public.weekly_briefs for each row execute function public.notification_business_transition();
create trigger notification_business_assignment after insert or update on public.interventions for each row execute function public.notification_business_transition();
create trigger notification_business_connection after insert or update on public.connection_health for each row execute function public.notification_business_transition();
create trigger notification_business_job after insert or update on public.jobs for each row execute function public.notification_business_transition();
create trigger notification_business_membership after insert or update on public.memberships for each row execute function public.notification_business_transition();
commit;
