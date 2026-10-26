-- Weekly delivery shares receipt/suppression tracking without fabricating a job.
-- Existing sending rows have no actor/claim and deliberately fail closed.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
alter table public.weekly_report_outbox
 add constraint weekly_report_tenant_id_unique unique(tenant_id,id),
 add column delivery_actor_id uuid,
 add column delivery_claimed_at timestamptz;
alter table public.notification_email_messages
 alter column job_id drop not null,
 add column weekly_report_id uuid,
 add constraint notification_email_one_source check ((job_id is null) <> (weekly_report_id is null)),
 add constraint notification_email_weekly_fk foreign key(tenant_id,weekly_report_id)
 references public.weekly_report_outbox(tenant_id,id);
create or replace function public.weekly_report_claim(p_tenant uuid,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r record;
begin
 if not public.pp_ia_authorized(p_tenant) then raise exception 'denied' using errcode='42501'; end if;
 select * into r from public.weekly_report_outbox where tenant_id=p_tenant and id=p_id for update;
 if r.id is null then raise exception 'ANALYSIS_INPUT_INVALID' using errcode='22023'; end if;
 if r.state<>'preview' then return jsonb_build_object('send',false,'reason',r.state); end if;
 if exists(select 1 from public.report_unsubscribes u where u.tenant_id=p_tenant and u.user_id=r.user_id and u.scope='weekly') then
  update public.weekly_report_outbox set state='suppressed',updated_at=now() where id=r.id;
  return jsonb_build_object('send',false,'reason','baja');
 end if;
 update public.weekly_report_outbox set state='sending',updated_at=now(),delivery_actor_id=public.vexa_request_uid(),delivery_claimed_at=clock_timestamp() where id=r.id;
 return jsonb_build_object('send',true,'userId',r.user_id);
end $$;
revoke all on function public.weekly_report_claim(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.weekly_report_claim(uuid,uuid) to vexa_backend;

create or replace function public.notification_email_prepare(k text,t uuid,u uuid,p text) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if msg.tenant_id<>t or msg.user_id<>u or msg.job_id is distinct from o.id or msg.weekly_report_id is not null or msg.provider<>p or msg.mailbox_hash is distinct from mh then return null;end if;
 return r||jsonb_build_object('providerId',msg.provider_id);
end $$;
create function public.notification_weekly_email_prepare(k text,t uuid,u uuid,p text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.weekly_report_outbox; msg public.notification_email_messages; r jsonb; mh text;
begin
 if current_setting('role',true) is distinct from 'vexa_email_service' then raise insufficient_privilege; end if;
 if k is null or k !~ '^[0-9a-f]{64}$' or p is null or p not in ('resend','mailpit') then return null; end if;
 select * into w from public.weekly_report_outbox
 where tenant_id=t and user_id=u and state='sending'
 and encode(sha256(convert_to('weekly|'||tenant_id::text||'|'||to_char(week_start,'YYYY-MM-DD')||'|'||user_id::text,'UTF8')),'hex')=k
 for share;
 -- Fresh claim and fresh actor authorization, matching pp_ia_authorized/import.
 -- Ten minutes is a bounded attempt, not permission to retry an uncertain send.
 if w.id is null or w.delivery_claimed_at is null
 or w.delivery_claimed_at>clock_timestamp()
 or w.delivery_claimed_at<=clock_timestamp()-interval '10 minutes'
 or not exists(select 1 from public.memberships m join auth.users a on a.id=m.user_id
   where m.tenant_id=t and m.user_id=w.delivery_actor_id and m.status='active'
   and m.role in ('owner','analyst') and a.deleted_at is null
   and (a.banned_until is null or a.banned_until<=clock_timestamp()))
 or not exists(select 1 from public.memberships m where m.tenant_id=t and m.user_id=u
   and m.status='active' and m.role in ('owner','analyst'))
 or exists(select 1 from public.report_unsubscribes b where b.tenant_id=t and b.user_id=u and b.scope='weekly')
 then return null; end if;
 r=public.notification_email_recipient(t,u);
 if r is null then return null; end if;
 mh=encode(sha256(convert_to(lower(btrim(r->>'email')),'UTF8')),'hex');
 if exists(select 1 from public.notification_email_suppressions s where s.tenant_id=t and s.user_id=u and s.mailbox_hash=mh) then return null; end if;
 insert into public.notification_email_messages(idempotency_key,tenant_id,weekly_report_id,user_id,mailbox_hash,provider)
 values(k,t,w.id,u,mh,p) on conflict do nothing;
 select * into msg from public.notification_email_messages where idempotency_key=k for update;
 if msg.tenant_id is distinct from t or msg.user_id is distinct from u
 or msg.weekly_report_id is distinct from w.id or msg.job_id is not null
 or msg.provider is distinct from p or msg.mailbox_hash is distinct from mh then return null; end if;
 return r||jsonb_build_object('providerId',msg.provider_id,'weeklyReportId',w.id,
   'subject',w.subject,'html',w.html,'text',w.body_text);
end $$;
revoke all on function public.notification_weekly_email_prepare(text,uuid,uuid,text)
 from public,anon,authenticated,service_role,vexa_backend,vexa_email_service;
grant execute on function public.notification_weekly_email_prepare(text,uuid,uuid,text) to vexa_email_service;
commit;
