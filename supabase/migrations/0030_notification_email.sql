begin;
-- This capability is provisioned only to the email server login, never browser/backend identities.
create role vexa_email_service nologin noinherit nosuperuser nobypassrls;
grant usage on schema public to vexa_email_service;
create table public.notification_email_messages(
 idempotency_key text primary key check(idempotency_key~'^[0-9a-f]{64}$'),
 tenant_id uuid not null,job_id uuid not null,user_id uuid not null,
 mailbox_hash text not null check(mailbox_hash~'^[0-9a-f]{64}$'),
 provider text not null check(provider in('resend','mailpit')),provider_id text,
 acceptance text not null default 'unknown' check(acceptance in('unknown','accepted')),
 delivery text not null default 'unknown' check(delivery in('unknown','sent','delayed','delivered','failed','bounced','complained','suppressed')),
 delivery_rank integer not null default 0,created_at timestamptz not null default clock_timestamp(),accepted_at timestamptz,
 unique(provider,provider_id),foreign key(tenant_id,job_id) references public.notification_outbox(tenant_id,id),foreign key(tenant_id,user_id) references public.memberships(tenant_id,user_id),
 check(provider_id is null or provider_id~'^[A-Za-z0-9_-]{1,200}$')
);
create table public.notification_email_receipts(
 event_id text primary key check(event_id~'^[A-Za-z0-9_-]{1,200}$'),
 provider_id text not null check(provider_id~'^[A-Za-z0-9_-]{1,200}$'),
 event_type text not null check(event_type in('email.sent','email.delivered','email.delivery_delayed','email.bounced','email.complained','email.failed','email.suppressed')),
 occurred_at timestamptz not null,verified_at timestamptz not null default clock_timestamp(),payload_hash text not null check(payload_hash~'^[0-9a-f]{64}$'),
 idempotency_key text references public.notification_email_messages(idempotency_key),
 bounce_kind text check(bounce_kind is null or(bounce_kind in('Permanent','Transient','Undetermined') and event_type='email.bounced'))
);
-- Permanent delivery failures bind to the actual sent mailbox, not the account's current email.
-- Immutable for runtime callers: preference opt-in or a later delivered event cannot undo suppression.
-- A different Auth-confirmed mailbox with active preferences is a new binding; old receipts never move it.
create table public.notification_email_suppressions(
 tenant_id uuid not null,user_id uuid not null,mailbox_hash text not null check(mailbox_hash~'^[0-9a-f]{64}$'),
 reason text not null check(reason in('complaint','permanent_bounce','provider_suppressed')),
 source_event_id text not null references public.notification_email_receipts(event_id),
 created_at timestamptz not null default clock_timestamp(),
 primary key(tenant_id,user_id,mailbox_hash),foreign key(tenant_id,user_id) references public.memberships(tenant_id,user_id)
);
alter table public.notification_email_suppressions enable row level security;
alter table public.notification_email_suppressions force row level security;
revoke all on public.notification_email_suppressions from public,anon,authenticated,service_role,vexa_backend,vexa_email_service;
create index notification_email_orphans on public.notification_email_receipts(provider_id) where idempotency_key is null;
alter table public.notification_email_messages enable row level security;
alter table public.notification_email_messages force row level security;
alter table public.notification_email_receipts enable row level security;
alter table public.notification_email_receipts force row level security;
revoke all on public.notification_email_messages,public.notification_email_receipts from public,anon,authenticated,service_role,vexa_backend,vexa_email_service;
-- Restricted tenant-aware status access reuses the existing worker boundary.
grant select on public.notification_email_messages to vexa_backend;
create policy email_status_worker on public.notification_email_messages for select to vexa_backend using(public.notification_worker(tenant_id));
create function public.notification_email_recipient(t uuid,u uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if current_setting('role',true) is distinct from 'vexa_email_service' then raise insufficient_privilege;end if;
 return(select jsonb_build_object('tenantId',t,'userId',u,'channel','email','email',a.email,'emailVerified',true) from auth.users a join public.memberships m on m.user_id=a.id and m.tenant_id=t where a.id=u and m.status='active' and a.email_confirmed_at is not null and a.deleted_at is null and (a.banned_until is null or a.banned_until<=clock_timestamp()));
end $$;
-- Private fresh resource check; the email service never receives direct EXECUTE or user claims.
create function public.notification_email_items_current(t uuid,jid uuid,u uuid) returns boolean language plpgsql stable security definer set search_path='' as $$
declare prior_tenant text:=current_setting('vexa.tenant_id',true);permitted boolean;begin
 perform set_config('vexa.tenant_id',t::text,true);
 select count(*)>0 and bool_and(public.notification_recipient_current(t,u,e.type,e.resource_id,'email') is true) into permitted
 from public.notification_outbox_items i join public.notification_events e on e.tenant_id=i.tenant_id and e.id=i.event_id
 where i.tenant_id=t and i.job_id=jid and i.user_id=u and i.channel='email' and i.state='eligible';
 perform set_config('vexa.tenant_id',coalesce(prior_tenant,''),true);return permitted;
exception when others then perform set_config('vexa.tenant_id',coalesce(prior_tenant,''),true);raise;
end $$;
revoke all on function public.notification_email_items_current(uuid,uuid,uuid) from public,anon,authenticated,service_role,vexa_backend,vexa_email_service;
create function public.notification_email_prepare(k text,t uuid,u uuid,p text) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.notification_outbox;msg public.notification_email_messages;pol public.notification_delivery_policies;r jsonb;mh text;begin
 if current_setting('role',true) is distinct from 'vexa_email_service' then raise insufficient_privilege;end if;
 select * into o from public.notification_outbox where tenant_id=t and user_id=u and idempotency_key=k and channel='email' and state='sending' for share;
 -- A known authorization/configuration denial returns NULL: the transport blocks before any provider effect.
 if o.id is null or p is null or p not in('resend','mailpit') or not exists(select 1 from public.jobs j join public.memberships w on w.tenant_id=j.tenant_id and w.user_id::text=j.lease_owner join auth.users a on a.id=w.user_id where j.tenant_id=t and j.id=o.id and j.type='notification' and j.state='running' and j.lease_until>clock_timestamp() and j.deadline>clock_timestamp() and w.status='active' and (w.role='owner' or(w.role='analyst' and exists(select 1 from public.worker_delegations d where d.tenant_id=t and d.user_id=w.user_id and d.enabled))) and a.deleted_at is null and (a.banned_until is null or a.banned_until<=clock_timestamp())) then return null;end if;
 select * into pol from public.notification_delivery_policies where tenant_id=t and channel='email' order by version desc limit 1;
 if pol.enabled is not true or not exists(select 1 from public.memberships m join auth.users a on a.id=m.user_id where m.tenant_id=t and m.user_id=pol.actor_id and m.status='active' and m.role='owner' and a.deleted_at is null and (a.banned_until is null or a.banned_until<=clock_timestamp())) or not exists(select 1 from public.memberships m join auth.users a on a.id=m.user_id where m.tenant_id=t and m.user_id=o.actor_id and m.status='active' and m.role='owner' and a.deleted_at is null and (a.banned_until is null or a.banned_until<=clock_timestamp())) then return null;end if;
 r=public.notification_email_recipient(t,u);if r is null or public.notification_email_items_current(t,o.id,u) is not true then return null;end if;
 mh=encode(sha256(convert_to(lower(btrim(r->>'email')),'UTF8')),'hex');
 if exists(select 1 from public.notification_email_suppressions where tenant_id=t and user_id=u and mailbox_hash=mh) then return null;end if;
 insert into public.notification_email_messages(idempotency_key,tenant_id,job_id,user_id,mailbox_hash,provider) values(k,t,o.id,u,mh,p) on conflict do nothing;
 select * into msg from public.notification_email_messages where idempotency_key=k for update;
 if msg.tenant_id<>t or msg.user_id<>u or msg.job_id<>o.id or msg.provider<>p or msg.mailbox_hash is distinct from mh then return null;end if;
 return r||jsonb_build_object('providerId',msg.provider_id);
end $$;
-- Recompute from the complete authenticated event set: event arrival order cannot regress state.
create function public.notification_email_reduce(pid text) returns void language plpgsql security definer set search_path='' as $$declare k text;st text;rank integer;begin
 select idempotency_key into k from public.notification_email_messages where provider='resend' and provider_id=pid for update;
 if k is null then return;end if;
 update public.notification_email_receipts set idempotency_key=k where provider_id=pid and idempotency_key is null;
 select replace(event_type,'email.',''),case event_type when 'email.sent' then 1 when 'email.delivery_delayed' then 2 when 'email.delivered' then 3 when 'email.failed' then 4 when 'email.suppressed' then 5 when 'email.bounced' then 6 when 'email.complained' then 7 end into st,rank from public.notification_email_receipts where idempotency_key=k order by 2 desc,occurred_at desc,event_id desc limit 1;
 if st is not null then update public.notification_email_messages set delivery=case st when 'delivery_delayed' then 'delayed' else st end,delivery_rank=rank where idempotency_key=k;end if;
 insert into public.notification_email_suppressions(tenant_id,user_id,mailbox_hash,reason,source_event_id)
 select m.tenant_id,m.user_id,m.mailbox_hash,case e.event_type when 'email.complained' then 'complaint' when 'email.bounced' then 'permanent_bounce' else 'provider_suppressed' end,e.event_id
 from public.notification_email_messages m join public.notification_email_receipts e on e.idempotency_key=m.idempotency_key
 where m.idempotency_key=k and(e.event_type in('email.complained','email.suppressed') or(e.event_type='email.bounced' and e.bounce_kind='Permanent'))
 order by case e.event_type when 'email.complained' then 1 when 'email.bounced' then 2 else 3 end,e.occurred_at,e.event_id limit 1
 on conflict(tenant_id,user_id,mailbox_hash) do nothing;
end $$;
create function public.notification_email_accepted(k text,p text,pid text) returns jsonb language plpgsql security definer set search_path='' as $$declare m public.notification_email_messages;begin
 if current_setting('role',true) is distinct from 'vexa_email_service' then raise insufficient_privilege;end if;
 if pid is null or pid!~'^[A-Za-z0-9_-]{1,200}$' then raise check_violation;end if;
 perform pg_advisory_xact_lock(hashtextextended('email-receipt:'||pid,0));
 select * into m from public.notification_email_messages where idempotency_key=k for update;
 if m.idempotency_key is null or m.provider<>p or(m.provider_id is not null and m.provider_id<>pid) then raise check_violation;end if;
 update public.notification_email_messages set provider_id=pid,acceptance='accepted',accepted_at=coalesce(accepted_at,clock_timestamp()) where idempotency_key=k;
 if p='resend' then perform public.notification_email_reduce(pid);end if;
 return jsonb_build_object('accepted',true);
end $$;
create function public.notification_email_receipt(eid text,pid text,et text,occurred timestamptz,ph text,bounce_kind text default null) returns jsonb language plpgsql security definer set search_path='' as $$declare existing public.notification_email_receipts;begin
 if current_setting('role',true) is distinct from 'vexa_email_service' then raise insufficient_privilege;end if;
 if occurred is null or occurred>clock_timestamp()+interval '5 minutes' or not isfinite(occurred) or (bounce_kind is not null and (et is distinct from 'email.bounced' or bounce_kind not in('Permanent','Transient','Undetermined'))) then raise check_violation;end if;
 perform pg_advisory_xact_lock(hashtextextended('email-receipt:'||pid,0));
 insert into public.notification_email_receipts(event_id,provider_id,event_type,occurred_at,payload_hash,bounce_kind) values(eid,pid,et,occurred,ph,bounce_kind) on conflict do nothing;
 if not found then select * into existing from public.notification_email_receipts where event_id=eid;if existing.payload_hash is distinct from ph or existing.provider_id is distinct from pid or existing.event_type is distinct from et or existing.occurred_at is distinct from occurred or existing.bounce_kind is distinct from bounce_kind then raise check_violation;end if;return jsonb_build_object('replay',true);end if;
 perform public.notification_email_reduce(pid);
 return jsonb_build_object('replay',false);
end $$;
revoke all on function public.notification_email_recipient(uuid,uuid),public.notification_email_prepare(text,uuid,uuid,text),public.notification_email_reduce(text),public.notification_email_accepted(text,text,text),public.notification_email_receipt(text,text,text,timestamptz,text,text) from public,anon,authenticated,service_role,vexa_backend,vexa_email_service;
grant execute on function public.notification_email_recipient(uuid,uuid),public.notification_email_prepare(text,uuid,uuid,text),public.notification_email_accepted(text,text,text),public.notification_email_receipt(text,text,text,timestamptz,text,text) to vexa_email_service;
commit;
