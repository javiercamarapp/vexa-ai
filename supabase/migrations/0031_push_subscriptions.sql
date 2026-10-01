begin;
-- Only server adapters can see endpoints/keys. An active Auth session is required at each send.
create table public.push_subscriptions(
 tenant_id uuid not null,id uuid not null default gen_random_uuid(),user_id uuid not null,
 device_id uuid not null,session_id uuid references auth.sessions(id) on delete set null,
 endpoint text not null check(length(endpoint) between 20 and 4096),p256dh text not null,auth_key text not null,
 status text not null default 'active' check(status in('active','revoked')),consent_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,revoked_at timestamptz,version integer not null default 1,
 primary key(tenant_id,id),unique(tenant_id,user_id,device_id),
 foreign key(tenant_id,user_id) references public.memberships(tenant_id,user_id),
 check(status<>'active' or session_id is not null),
 check(p256dh~'^[A-Za-z0-9_-]{87}$' and auth_key~'^[A-Za-z0-9_-]{22}$'),
 check(endpoint~'^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com)/[^?#[:space:]\\]+$')
);
-- Auth logout removes sessions. Retain the subscription tombstone and durable attempt ledger.
-- SET NULL breaks the lifetime dependency without blocking GoTrue's session deletion.
create function public.push_session_revoked() returns trigger language plpgsql set search_path='' as $$begin
 if new.session_id is null and old.session_id is not null then
  new.status='revoked';new.revoked_at=clock_timestamp();new.version=old.version+1;
 end if;return new;
end $$;
revoke all on function public.push_session_revoked() from public,anon,authenticated,service_role,vexa_backend;
create trigger push_session_revoked before update of session_id on public.push_subscriptions for each row execute function public.push_session_revoked();
create unique index push_endpoint_active on public.push_subscriptions(endpoint) where status='active';
create table public.push_attempts(
 tenant_id uuid not null,subscription_id uuid not null,idempotency_key text not null,
 state text not null check(state in('sending','accepted','retry','uncertain','permanent')),attempt integer not null default 1,
 subscription_version integer not null check(subscription_version>0),
 next_attempt_at timestamptz,updated_at timestamptz not null default clock_timestamp(),
 primary key(tenant_id,subscription_id,idempotency_key),
 foreign key(tenant_id,subscription_id) references public.push_subscriptions(tenant_id,id),
 foreign key(tenant_id,idempotency_key) references public.notification_outbox(tenant_id,idempotency_key)
);
alter table public.push_subscriptions enable row level security;alter table public.push_subscriptions force row level security;
alter table public.push_attempts enable row level security;alter table public.push_attempts force row level security;
revoke all on public.push_subscriptions,public.push_attempts from public,anon,authenticated,service_role,vexa_backend;
create function public.push_own(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=nullif(current_setting('vexa.tenant_id',true),'')::uuid;u uuid:=auth.uid();d uuid;r public.push_subscriptions;sid uuid;exp timestamptz;begin
 if public.notification_own(t,u) is not true then raise insufficient_privilege;end if;
 sid:=(p->>'sessionId')::uuid;
 if not exists(select 1 from auth.sessions sess join auth.users usr on usr.id=sess.user_id where sess.id=sid and sess.user_id=u and (sess.not_after is null or sess.not_after>clock_timestamp()) and usr.deleted_at is null and (usr.banned_until is null or usr.banned_until<=clock_timestamp())) then raise insufficient_privilege;end if;
 if p->>'op'='list' then return coalesce((select jsonb_agg(jsonb_build_object('id',id,'deviceId',device_id,'status',status,'expiresAt',expires_at,'version',version) order by consent_at desc) from public.push_subscriptions where tenant_id=t and user_id=u),'[]');end if;
 if current_setting('vexa.action',true) is distinct from 'notify' then raise insufficient_privilege;end if;
 if p->>'op'='logout' then
  update public.push_subscriptions set status='revoked',revoked_at=clock_timestamp(),version=version+1 where user_id=u and status='active';return jsonb_build_object('revoked',true);
 end if;
 if p->>'op'='revoke' then
  update public.push_subscriptions set status='revoked',revoked_at=clock_timestamp(),version=version+1 where tenant_id=t and user_id=u and id=(p->>'id')::uuid and status='active';return jsonb_build_object('revoked',true);
 end if;
 d:=(p->>'deviceId')::uuid;
 if p->>'op'='scope' then
  update public.push_subscriptions set status='revoked',revoked_at=clock_timestamp(),version=version+1 where user_id=u and device_id=d and status='active';return jsonb_build_object('revoked',true);
 end if;
 if p->>'op' is distinct from 'register' or p->>'consent' is distinct from 'true' then raise check_violation;end if;
 sid:=(p->>'sessionId')::uuid;exp:=to_timestamp((p->>'expiresAt')::double precision);
 if exp<=clock_timestamp() or exp>clock_timestamp()+interval '24 hours' or not exists(select 1 from auth.sessions where id=sid and user_id=u and (not_after is null or not_after>clock_timestamp())) then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended('push-user:'||u::text,0));
 if (select count(*) from public.push_subscriptions where user_id=u and status='active' and expires_at>clock_timestamp() and not(tenant_id=t and device_id=d))>=20 then raise check_violation;end if;
 perform pg_advisory_xact_lock(hashtextextended(p->>'endpoint',0));
 -- Replacing a device is explicit. A live endpoint owned by another session/user never transfers implicitly.
 if exists(select 1 from public.push_subscriptions where endpoint=p->>'endpoint' and status='active' and (tenant_id<>t or user_id<>u or device_id<>d)) then raise unique_violation;end if;
 insert into public.push_subscriptions(tenant_id,user_id,device_id,session_id,endpoint,p256dh,auth_key,expires_at)
 values(t,u,d,sid,p->>'endpoint',p->>'p256dh',p->>'auth',exp)
 on conflict(tenant_id,user_id,device_id) do update set session_id=excluded.session_id,endpoint=excluded.endpoint,p256dh=excluded.p256dh,auth_key=excluded.auth_key,expires_at=excluded.expires_at,status='active',consent_at=clock_timestamp(),revoked_at=null,version=public.push_subscriptions.version+1 returning * into r;
 return jsonb_build_object('id',r.id,'status',r.status,'expiresAt',r.expires_at,'version',r.version);
end $$;
revoke all on function public.push_own(jsonb) from public,anon,authenticated,service_role;grant execute on function public.push_own(jsonb) to vexa_backend;
create function public.push_worker(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=nullif(current_setting('vexa.tenant_id',true),'')::uuid;u uuid:=(p->>'userId')::uuid;s public.push_subscriptions;a public.push_attempts;o public.notification_outbox;pol public.notification_delivery_policies;backoff integer;begin
 if public.notification_worker(t) is not true or p->>'tenantId' is distinct from t::text then raise insufficient_privilege;end if;
 if p->>'op'='resolve' then
  return coalesce((select jsonb_agg(id order by id) from public.push_subscriptions where tenant_id=t and user_id=u and status='active' and expires_at>clock_timestamp()),'[]');
 end if;
 if current_setting('vexa.action',true) is distinct from 'import' then raise insufficient_privilege;end if;
 select * into o from public.notification_outbox where tenant_id=t and user_id=u and channel='push' and idempotency_key=p->>'key' and state='sending';
 if o.id is null then raise insufficient_privilege;end if;
 select * into s from public.push_subscriptions where tenant_id=t and user_id=u and id=(p->>'subscriptionId')::uuid for update;
 if s.id is null then return jsonb_build_object('kind','permanent');end if;
 select * into a from public.push_attempts where tenant_id=t and subscription_id=s.id and idempotency_key=p->>'key' for update;
 if p->>'op'='finish' then
  if a.state is distinct from 'sending' or a.attempt is distinct from (p->>'attempt')::integer then raise serialization_failure;end if;
  if p->>'kind' not in('accepted','retry','uncertain','permanent') then raise check_violation;end if;
  backoff:=coalesce((p->>'retryAfterMs')::integer,60000);if backoff not between 0 and 86400000 then raise check_violation;end if;
  update public.push_attempts set state=p->>'kind',updated_at=clock_timestamp(),next_attempt_at=case when p->>'kind'='retry' then clock_timestamp()+backoff*interval '1 millisecond' end where tenant_id=t and subscription_id=s.id and idempotency_key=p->>'key';
  -- A late410 applies only to the registration that was actually sent, never a newer explicit rotation.
  if p->>'revoke'='true' then update public.push_subscriptions set status='revoked',revoked_at=clock_timestamp(),version=version+1 where tenant_id=t and id=s.id and version=a.subscription_version;end if;
  return jsonb_build_object('kind',p->>'kind');
 end if;
 if p->>'op' is distinct from 'begin' then raise check_violation;end if;
 if a.state in('accepted','uncertain','permanent') then return jsonb_build_object('kind',a.state);end if;
 if a.state='sending' then return jsonb_build_object('kind','uncertain');end if;
 if a.state='retry' and a.next_attempt_at>clock_timestamp() then return jsonb_build_object('kind','retry','retryAfterMs',ceil(extract(epoch from a.next_attempt_at-clock_timestamp())*1000));end if;
 -- Revalidate only before a NEW effect. Historical accepted/uncertain receipts above never resend.
 select * into pol from public.notification_delivery_policies where tenant_id=t and channel='push' order by version desc limit 1;
 if pol.enabled is not true or not exists(select 1 from public.memberships m join auth.users usr on usr.id=m.user_id where m.tenant_id=t and m.user_id=pol.actor_id and m.role='owner' and m.status='active' and usr.deleted_at is null and (usr.banned_until is null or usr.banned_until<=clock_timestamp())) or not exists(select 1 from public.memberships m join auth.users usr on usr.id=m.user_id where m.tenant_id=t and m.user_id=o.actor_id and m.role='owner' and m.status='active' and usr.deleted_at is null and (usr.banned_until is null or usr.banned_until<=clock_timestamp())) then return jsonb_build_object('kind','permanent');end if;
 if not exists(select 1 from public.jobs j join auth.users usr on usr.id::text=j.lease_owner where j.tenant_id=t and j.id=o.id and j.type='notification' and j.state='running' and j.lease_owner=auth.uid()::text and j.lease_until>clock_timestamp() and j.deadline>clock_timestamp() and usr.deleted_at is null and (usr.banned_until is null or usr.banned_until<=clock_timestamp())) then return jsonb_build_object('kind','permanent');end if;
 -- Digest payload is generic, but an item revoked since beginSend must not be marked as accepted.
 if s.status<>'active' or s.expires_at<=clock_timestamp() or not exists(select 1 from auth.sessions sess join auth.users usr on usr.id=sess.user_id where sess.id=s.session_id and sess.user_id=u and (sess.not_after is null or sess.not_after>clock_timestamp()) and usr.deleted_at is null and (usr.banned_until is null or usr.banned_until<=clock_timestamp())) or not exists(select 1 from public.memberships where tenant_id=t and user_id=u and status='active') or not exists(select 1 from public.notification_outbox_items where tenant_id=t and job_id=o.id and state='eligible') or exists(select 1 from public.notification_outbox_items i join public.notification_events e on e.tenant_id=i.tenant_id and e.id=i.event_id where i.tenant_id=t and i.job_id=o.id and i.state='eligible' and public.notification_recipient_current(t,u,e.type,e.resource_id,'push') is not true) then return jsonb_build_object('kind','permanent');end if;
 insert into public.push_attempts(tenant_id,subscription_id,idempotency_key,state,subscription_version) values(t,s.id,p->>'key','sending',s.version) on conflict(tenant_id,subscription_id,idempotency_key) do update set state='sending',subscription_version=s.version,attempt=public.push_attempts.attempt+1,updated_at=clock_timestamp() returning * into a;
 return jsonb_build_object('kind','ready','attempt',a.attempt,'deliveryScope',jsonb_build_object('subscriptionId',s.id,'version',s.version),'subscription',jsonb_build_object('endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth_key)));
end $$;
revoke all on function public.push_worker(jsonb) from public,anon,authenticated,service_role;grant execute on function public.push_worker(jsonb) to vexa_backend;
commit;
