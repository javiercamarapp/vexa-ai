begin;
-- F06-08: durable user-owned centre. Business emitters/outbox are deliberately not installed here.
create table public.notification_events (
 tenant_id uuid not null references public.organizations(id) on delete restrict,
 id uuid not null default gen_random_uuid(),
 type text not null check(type in('membership.welcome','membership.invited','brief.available','intervention.assigned','connection.attention','processing.failed')),
 resource_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(tenant_id,id)
);
create table public.notification_inbox (
 tenant_id uuid not null references public.organizations(id) on delete restrict,
 id uuid not null default gen_random_uuid(),
 event_id uuid not null,
 user_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 read_at timestamptz,
 primary key(tenant_id,id),unique(tenant_id,user_id,event_id),
 foreign key(tenant_id,event_id) references public.notification_events(tenant_id,id) on delete restrict,
 foreign key(tenant_id,user_id) references public.memberships(tenant_id,user_id) on delete restrict
);
create index notification_inbox_page on public.notification_inbox(tenant_id,user_id,created_at desc,id desc);
create table public.notification_preferences (
 tenant_id uuid not null references public.organizations(id) on delete restrict,
 user_id uuid not null,
 channel text not null check(channel in('inapp','email','push')),
 event_type text not null check(event_type in('*','membership.welcome','membership.invited','brief.available','intervention.assigned','connection.attention','processing.failed')),
 enabled boolean not null,
 version integer not null check(version>0),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(tenant_id,user_id,channel,event_type),
 foreign key(tenant_id,user_id) references public.memberships(tenant_id,user_id) on delete restrict
);
-- Private fixed read adapter. Its SET is function-scoped and restored automatically on return/error.
-- No EXECUTE for runtime callers; the public guard below checks the ORIGINAL capability before entering.
create function public.notification_resource_read(t uuid,u uuid,k text,r uuid) returns boolean
language plpgsql stable security definer set search_path='' set vexa.action='read' as $$
declare i public.interventions;j public.jobs;p public.measurement_plans;mid uuid;begin
 if t is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or u is distinct from auth.uid() or public.vexa_member(t) is not true then return false;end if;
 if k='brief.available' then
  return coalesce(exists(select 1 from public.weekly_briefs where tenant_id=t and id=r and status='published' and brief_schema='brief-v1') and public.brief_visible(t,r),false);
 elsif k='intervention.assigned' then
  select * into i from public.interventions where tenant_id=t and id=r;
  if i.id is null or i.owner_id is distinct from u or public.intervention_authorized(t,r) is not true then return false;end if;
  if i.plan_id is not null then
   select * into p from public.measurement_plans where tenant_id=t and id=i.plan_id;
   if p.id is null or public.intervention_inputs_current(t,p.baseline_ref,'[]') is not true then return false;end if;
   for mid in select value::uuid from jsonb_array_elements_text(p.provenance->'baselineMappingIds') loop
    if not exists(select 1 from public.workspace_order_dimension_versions where tenant_id=t and id=mid and active and public.intervention_member(t,actor_id,array['owner'])) then return false;end if;
   end loop;
  end if;
  if exists(select 1 from public.intervention_results z where z.tenant_id=t and z.intervention_id=r and public.intervention_result_mappings_current(t,z.result) is not true) then return false;end if;
  return true;
 elsif k='membership.welcome' then return r=u;
 elsif k='connection.attention' then return public.vexa_member(t,array['owner']) and exists(select 1 from public.connections where tenant_id=t and id=r);
 elsif k='processing.failed' then
  select * into j from public.jobs where tenant_id=t and id=r;
  return j.id is not null and j.import_id is not null and public.vexa_member(t,array['owner','analyst']) and exists(select 1 from public.imports where tenant_id=t and id=j.import_id);
 end if;return false;
end $$;
revoke all on function public.notification_resource_read(uuid,uuid,text,uuid) from public,anon,authenticated,service_role,vexa_backend;
create function public.notification_resource_current(t uuid,u uuid,k text,r uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$begin
 if t is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or u is distinct from auth.uid() or coalesce(current_setting('vexa.action',true),'') not in('read','notify') or public.vexa_member(t) is not true then return false;end if;
 return public.notification_resource_read(t,u,k,r) is true;
end $$;
revoke all on function public.notification_resource_current(uuid,uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.notification_resource_current(uuid,uuid,text,uuid) to vexa_backend;
create function public.notification_own(t uuid,u uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce(t=nullif(current_setting('vexa.tenant_id',true),'')::uuid and u=auth.uid() and public.vexa_member(t) and current_setting('vexa.action',true) in('read','notify'),false)
$$;
revoke all on function public.notification_own(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.notification_own(uuid,uuid) to vexa_backend;
create function public.notification_visible(t uuid,nid uuid) returns boolean language plpgsql stable security definer set search_path='' as $$declare n public.notification_inbox;e public.notification_events;begin
 select * into n from public.notification_inbox where tenant_id=t and id=nid;
 if n.id is null or public.notification_own(t,n.user_id) is not true then return false;end if;
 select * into e from public.notification_events where tenant_id=t and id=n.event_id;
 return e.id is not null and public.notification_resource_current(t,n.user_id,e.type,e.resource_id) is true;
end $$;
revoke all on function public.notification_visible(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.notification_visible(uuid,uuid) to vexa_backend;
create function public.notification_guard() returns trigger language plpgsql security definer set search_path='' as $$declare e public.notification_events;valid boolean;begin
 if tg_op='DELETE' then raise check_violation;end if;
 if tg_table_name='notification_events' then
  if tg_op<>'INSERT' then raise check_violation;end if;
  valid=case new.type
   when 'membership.welcome' then exists(select 1 from public.memberships where tenant_id=new.tenant_id and user_id=new.resource_id and status='active')
   when 'membership.invited' then false
   when 'brief.available' then exists(select 1 from public.weekly_briefs where tenant_id=new.tenant_id and id=new.resource_id and status='published' and brief_schema='brief-v1')
   when 'intervention.assigned' then exists(select 1 from public.interventions where tenant_id=new.tenant_id and id=new.resource_id)
   when 'connection.attention' then exists(select 1 from public.connections where tenant_id=new.tenant_id and id=new.resource_id)
   when 'processing.failed' then exists(select 1 from public.jobs where tenant_id=new.tenant_id and id=new.resource_id and import_id is not null)
   else false end;
  if valid is not true then raise check_violation;end if;
  new.created_at=clock_timestamp();return new;
 elsif tg_table_name='notification_inbox' then
  if tg_op='INSERT' then
   select * into e from public.notification_events where tenant_id=new.tenant_id and id=new.event_id;
   if e.id is null or e.type='membership.invited' or not exists(select 1 from public.memberships where tenant_id=new.tenant_id and user_id=new.user_id and status='active') or (e.type='membership.welcome' and e.resource_id<>new.user_id) or (e.type='intervention.assigned' and not exists(select 1 from public.interventions where tenant_id=new.tenant_id and id=e.resource_id and owner_id=new.user_id)) then raise check_violation;end if;
   if new.read_at is not null then raise check_violation;end if;
   new.created_at=clock_timestamp();return new;
  end if;
  if new.tenant_id is distinct from old.tenant_id or new.id is distinct from old.id or new.event_id is distinct from old.event_id or new.user_id is distinct from old.user_id or new.created_at is distinct from old.created_at or current_setting('vexa.action',true) is distinct from 'notify' or public.notification_visible(old.tenant_id,old.id) is not true or new.read_at is null then raise check_violation;end if;
  new.read_at=coalesce(old.read_at,clock_timestamp());return new;
 else
  if current_setting('vexa.action',true) is distinct from 'notify' or public.notification_own(new.tenant_id,new.user_id) is not true then raise insufficient_privilege;end if;
  if tg_op='INSERT' then if new.version is distinct from 1 then raise check_violation;end if;
  elsif new.tenant_id is distinct from old.tenant_id or new.user_id is distinct from old.user_id or new.channel is distinct from old.channel or new.event_type is distinct from old.event_type or new.version is distinct from old.version+1 then raise check_violation;end if;
  new.updated_at=clock_timestamp();return new;
 end if;
end $$;
revoke all on function public.notification_guard() from public,anon,authenticated,service_role,vexa_backend;
create trigger notification_event_guard before insert or update or delete on public.notification_events for each row execute function public.notification_guard();
create trigger notification_inbox_guard before insert or update or delete on public.notification_inbox for each row execute function public.notification_guard();
create trigger notification_preference_guard before insert or update or delete on public.notification_preferences for each row execute function public.notification_guard();
alter table public.notification_events enable row level security;alter table public.notification_events force row level security;
alter table public.notification_inbox enable row level security;alter table public.notification_inbox force row level security;
alter table public.notification_preferences enable row level security;alter table public.notification_preferences force row level security;
revoke all on public.notification_events,public.notification_inbox,public.notification_preferences from public,anon,authenticated,service_role,vexa_backend;
grant select on public.notification_events,public.notification_inbox,public.notification_preferences to vexa_backend;
grant update(read_at) on public.notification_inbox to vexa_backend;
grant insert on public.notification_preferences to vexa_backend;
grant update(enabled,version) on public.notification_preferences to vexa_backend;
create policy notification_events_read on public.notification_events for select to vexa_backend using(exists(select 1 from public.notification_inbox n where n.tenant_id=notification_events.tenant_id and n.event_id=notification_events.id and public.notification_visible(n.tenant_id,n.id)));
create policy notification_inbox_read on public.notification_inbox for select to vexa_backend using(public.notification_visible(tenant_id,id));
create policy notification_inbox_update on public.notification_inbox for update to vexa_backend using(current_setting('vexa.action',true)='notify' and public.notification_visible(tenant_id,id)) with check(current_setting('vexa.action',true)='notify' and public.notification_visible(tenant_id,id));
create policy notification_preferences_read on public.notification_preferences for select to vexa_backend using(public.notification_own(tenant_id,user_id));
create policy notification_preferences_insert on public.notification_preferences for insert to vexa_backend with check(current_setting('vexa.action',true)='notify' and public.notification_own(tenant_id,user_id));
create policy notification_preferences_update on public.notification_preferences for update to vexa_backend using(current_setting('vexa.action',true)='notify' and public.notification_own(tenant_id,user_id)) with check(current_setting('vexa.action',true)='notify' and public.notification_own(tenant_id,user_id));
commit;
