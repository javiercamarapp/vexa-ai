-- No provider calls; actual migration functions and receipt reducer on synthetic rows.
create function public.test_weekly(k text,t uuid,u uuid,p text default 'resend') returns jsonb language plpgsql as $$
declare r jsonb;begin
 perform set_config('role','vexa_email_service',true);
 r=public.notification_weekly_email_prepare(k,t,u,p);
 perform set_config('role','none',true);return r;
end $$;
create function public.test_normal(k text,t uuid,u uuid) returns jsonb language plpgsql as $$
declare r jsonb;begin
 perform set_config('role','vexa_email_service',true);
 r=public.notification_email_prepare(k,t,u,'resend');
 perform set_config('role','none',true);return r;
end $$;
do $$
declare t uuid:='11111111-1111-1111-1111-111111111111'; u uuid:='aaaaaaaa-0000-0000-0000-000000000002'; actor uuid:='aaaaaaaa-0000-0000-0000-000000000001';
 w uuid; k text; r jsonb; suppression_reason text; et text; pid text; norm text:=repeat('f',64); jid uuid:=gen_random_uuid(); eid uuid:=gen_random_uuid(); wk date:='2026-10-19';
begin
 perform set_config('vexa.tenant_id',t::text,true); perform set_config('vexa.action','import',true); perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.weekly_report_outbox(tenant_id,week_start,user_id,state,subject,html,body_text) values(t,wk,u,'preview','Stored subject','<p>Stored</p>','Stored text') returning id into w;
 k=encode(sha256(convert_to('weekly|'||t::text||'|2026-10-19|'||u::text,'UTF8')),'hex');
 assert public.test_weekly(k,t,u) is null,'preview denied';
 perform set_config('role','vexa_backend',true);
 r=public.weekly_report_claim(t,w);
 perform set_config('role','none',true);
 assert (r->>'send')::boolean,'claim allowed';
 assert (select delivery_actor_id=actor and delivery_claimed_at is not null from weekly_report_outbox where id=w),'claim attribution';
 assert public.test_weekly(repeat('0',64),t,u) is null,'wrong key';
 assert public.test_weekly(k,'22222222-2222-2222-2222-222222222222',u) is null,'wrong tenant';
 assert public.test_weekly(k,t,actor) is null,'wrong recipient';
 assert public.test_weekly(k,t,u,'unknown') is null,'unknown provider';
 update memberships set status='inactive' where tenant_id=t and user_id=actor;
 assert public.test_weekly(k,t,u) is null,'revoked actor';
 update memberships set status='active' where tenant_id=t and user_id=actor;
 update auth.users set banned_until=now()+interval '1 day' where id=actor;
 assert public.test_weekly(k,t,u) is null,'banned actor';
 update auth.users set banned_until=null where id=actor;
 update weekly_report_outbox set delivery_claimed_at=now()-interval '11 minutes' where id=w;
 assert public.test_weekly(k,t,u) is null,'stale claim';
 update weekly_report_outbox set delivery_claimed_at=null where id=w;
 assert public.test_weekly(k,t,u) is null,'legacy sending without claim';
 update weekly_report_outbox set delivery_claimed_at=clock_timestamp() where id=w;
 insert into report_unsubscribes values(t,u,'weekly',now());
 assert public.test_weekly(k,t,u) is null,'unsubscribe after claim';
 delete from report_unsubscribes where tenant_id=t and user_id=u;
 update memberships set role='viewer' where tenant_id=t and user_id=u;
 assert public.test_weekly(k,t,u) is null,'recipient demotion';
 update memberships set role='analyst' where tenant_id=t and user_id=u;
 update auth.users set email_confirmed_at=null where id=u;
 assert public.test_weekly(k,t,u) is null,'unverified recipient';
 update auth.users set email_confirmed_at=now() where id=u;
 assert not exists(select 1 from notification_email_messages),'denials create no tracking row';
 r=public.test_weekly(k,t,u);
 assert r->>'subject'='Stored subject' and r->>'html'='<p>Stored</p>' and r->>'text'='Stored text','persisted content';
 assert (select job_id is null and weekly_report_id=w from notification_email_messages where idempotency_key=k),'weekly source';
 assert public.test_weekly(k,t,u)=r,'idempotent prepare';
 assert (select count(*)=1 from notification_email_messages),'one tracking row';
 assert public.test_weekly(k,t,u,'mailpit') is null,'provider collision';
 update auth.users set email='changed@example.test' where id=u;
 assert public.test_weekly(k,t,u) is null,'mailbox collision';
 update auth.users set email=u::text||'@example.test' where id=u;
 -- Existing normal flow still authorizes, records acceptance and reduces delivery.
 insert into notification_outbox values(t,jid,u,norm,'email','sending',actor);
 insert into jobs values(t,jid,'notification','running',actor::text,now()+interval '1 hour',now()+interval '1 hour');
 insert into notification_delivery_policies values(t,'email',1,true,actor);
 insert into notification_events values(t,eid,'digest.available',gen_random_uuid());
 insert into notification_outbox_items values(t,jid,u,'email','eligible',eid);
 assert public.test_normal(norm,t,u) is not null,'normal path intact';
 assert (select job_id=jid and weekly_report_id is null from notification_email_messages where idempotency_key=norm),'normal source';
 -- Normal outbox key collision with a weekly tracking record must fail closed.
 update notification_outbox set idempotency_key=k where id=jid;
 assert public.test_normal(k,t,u) is null,'normal cannot reuse weekly record';
 update notification_outbox set idempotency_key=norm where id=jid;
 perform set_config('role','vexa_email_service',true);
 perform public.notification_email_accepted(norm,'resend','normal_id');
 perform public.notification_email_receipt('normal_event','normal_id','email.delivered',now(),repeat('a',64));
 perform set_config('role','none',true);
 assert (select delivery='delivered' and acceptance='accepted' from notification_email_messages where idempotency_key=norm),'normal receipts intact';
 -- Each permanent suppression arises via real receipt reduction, not direct fixture insertion.
 foreach suppression_reason in array array['complaint','permanent_bounce','provider_suppressed'] loop
  pid='weekly_'||suppression_reason;
  et=case suppression_reason when 'complaint' then 'email.complained' when 'permanent_bounce' then 'email.bounced' else 'email.suppressed' end;
  perform set_config('role','vexa_email_service',true);
  -- Receipt may arrive before provider acceptance; accepted must attach/reduce it.
  perform public.notification_email_receipt('event_'||suppression_reason,pid,et,now(),repeat('b',64),case when suppression_reason='permanent_bounce' then 'Permanent' else null end);
  perform public.notification_email_accepted(k,'resend',pid);
  perform set_config('role','none',true);
  assert (select idempotency_key=k from notification_email_receipts where event_id='event_'||suppression_reason),'weekly receipt associated';
  assert (select s.reason=suppression_reason from notification_email_suppressions s where tenant_id=t and user_id=u),'suppression reducer';
  assert public.test_weekly(k,t,u) is null,'suppressed weekly blocked';
  assert public.test_normal(norm,t,u) is null,'suppression also blocks normal';
  -- Administrative fixture reset solely to independently exercise each reason.
  delete from notification_email_suppressions;
  delete from notification_email_receipts where event_id='event_'||suppression_reason;
  update notification_email_messages set provider_id=null,acceptance='unknown',delivery='unknown',delivery_rank=0 where idempotency_key=k;
 end loop;
 perform set_config('role','vexa_email_service',true);
 perform public.notification_email_accepted(k,'resend','weekly_final');
 perform set_config('role','none',true);
 assert public.test_weekly(k,t,u)->>'providerId'='weekly_final','accepted retry returns provider id';
 -- Reverse collision: a normal-source tracking row under the weekly key is rejected.
 update notification_email_messages set weekly_report_id=null,job_id=jid where idempotency_key=k;
 assert public.test_weekly(k,t,u) is null,'weekly cannot reuse normal record';
 update notification_email_messages set weekly_report_id=w,job_id=null where idempotency_key=k;
 update weekly_report_outbox set state='sent' where id=w;
 assert public.test_weekly(k,t,u) is null,'sent row cannot prepare again';
 update weekly_report_outbox set state='sending' where id=w;
 begin
  perform public.notification_weekly_email_prepare(k,t,u,'resend');
  raise exception 'wrong role accepted';
 exception when insufficient_privilege then null; end;
 -- Exactly one source and tenant-scoped FK are enforced structurally.
 begin update notification_email_messages set job_id=jid where idempotency_key=k; raise exception 'both sources accepted'; exception when check_violation then null; end;
 begin update notification_email_messages set weekly_report_id=null where idempotency_key=k; raise exception 'no source accepted'; exception when check_violation then null; end;
 begin update notification_email_messages set tenant_id='22222222-2222-2222-2222-222222222222' where idempotency_key=k; raise exception 'cross tenant accepted'; exception when foreign_key_violation then null; end;
 assert not has_function_privilege('vexa_backend','public.notification_weekly_email_prepare(text,uuid,uuid,text)','EXECUTE'),'backend cannot prepare';
 assert not has_function_privilege('authenticated','public.notification_weekly_email_prepare(text,uuid,uuid,text)','EXECUTE'),'browser cannot prepare';
 assert not has_table_privilege('vexa_email_service','public.weekly_report_outbox','SELECT'),'no raw weekly grants';
 raise notice 'weekly authorization, normal flow, receipts, suppression, constraints: ALL-OK';
end $$;
