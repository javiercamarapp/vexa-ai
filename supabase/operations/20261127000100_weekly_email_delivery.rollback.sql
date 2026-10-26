-- Before-use rollback only: never discard a weekly message or its receipts.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
lock table public.weekly_report_outbox,public.notification_email_messages in access exclusive mode;
do $guard$
begin
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.weekly_report_claim(uuid,uuid)')) is distinct from '86219077f137039803925be16d31dc2e'
 or (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.notification_email_prepare(text,uuid,uuid,text)')) is distinct from 'b1c0ad7e6f013686016e940f51f58a6d'
 or (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.notification_weekly_email_prepare(text,uuid,uuid,text)')) is distinct from '4b81538a1c39cc4b433fe36418a3c0df' then raise exception 'WEEKLY_ROLLBACK_SOURCE_DRIFT'; end if;
 if exists(select 1 from public.notification_email_messages where weekly_report_id is not null) then
  raise exception 'WEEKLY_ROLLBACK_ALREADY_USED';
 end if;
end $guard$;
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
 update public.weekly_report_outbox set state='sending',updated_at=now() where id=r.id;
 return jsonb_build_object('send',true,'userId',r.user_id);
end $$;
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
 if msg.tenant_id<>t or msg.user_id<>u or msg.job_id<>o.id or msg.provider<>p or msg.mailbox_hash is distinct from mh then return null;end if;
 return r||jsonb_build_object('providerId',msg.provider_id);
end $$;
drop function public.notification_weekly_email_prepare(text,uuid,uuid,text) restrict;
alter table public.notification_email_messages
 drop constraint notification_email_weekly_fk,
 drop constraint notification_email_one_source,
 drop column weekly_report_id,
 alter column job_id set not null;
alter table public.weekly_report_outbox
 drop column delivery_actor_id,
 drop column delivery_claimed_at,
 drop constraint weekly_report_tenant_id_unique;
commit;
