begin;
create table public.notification_delivery_policies(
 tenant_id uuid not null references public.organizations(id),id uuid not null default gen_random_uuid(),channel text not null check(channel in('inapp','email','push')),version integer not null check(version>0),enabled boolean not null,interval_ms integer not null check(interval_ms between 1000 and 86400000),digest_window_ms integer not null check(digest_window_ms between 0 and 3600000),max_attempts integer not null check(max_attempts between 1 and 10),lifetime_ms bigint not null check(lifetime_ms between 1000 and 2592000000),actor_id uuid not null,created_at timestamptz not null default clock_timestamp(),primary key(tenant_id,id),unique(tenant_id,channel,version),foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id),check(digest_window_ms<lifetime_ms));
create table public.notification_outbox(
 tenant_id uuid not null references public.organizations(id),id uuid not null,user_id uuid not null,channel text not null check(channel in('inapp','email','push')),policy_id uuid not null,used_policy_id uuid,actor_id uuid not null,state text not null default 'queued' check(state in('queued','claimed','sending','accepted','retry','uncertain','blocked','suppressed','dead')),attempts integer not null default 0 check(attempts between 0 and 10),idempotency_key text not null check(idempotency_key~'^[0-9a-f]{64}$'),digest_until timestamptz not null,code text,provider_id text check(provider_id is null or provider_id~'^[A-Za-z0-9_-]{1,200}$'),created_at timestamptz not null default clock_timestamp(),started_at timestamptz,primary key(tenant_id,id),unique(tenant_id,idempotency_key),foreign key(tenant_id,id) references public.jobs(tenant_id,id),foreign key(tenant_id,user_id) references public.memberships(tenant_id,user_id),foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id),foreign key(tenant_id,policy_id) references public.notification_delivery_policies(tenant_id,id),foreign key(tenant_id,used_policy_id) references public.notification_delivery_policies(tenant_id,id));
create table public.notification_outbox_items(
 tenant_id uuid not null,job_id uuid not null,event_id uuid not null,user_id uuid not null,channel text not null,state text not null default 'pending' check(state in('pending','eligible','suppressed','accepted')),primary key(tenant_id,event_id,user_id,channel),foreign key(tenant_id,job_id) references public.notification_outbox(tenant_id,id),foreign key(tenant_id,event_id) references public.notification_events(tenant_id,id),foreign key(tenant_id,user_id) references public.memberships(tenant_id,user_id));
create table public.notification_dispatch_limits(
 tenant_id uuid not null,user_id uuid not null,channel text not null check(channel in('inapp','email','push')),next_allowed_at timestamptz not null default '-infinity',primary key(tenant_id,user_id,channel),foreign key(tenant_id,user_id) references public.memberships(tenant_id,user_id));
create role vexa_notification_verifier nologin noinherit nosuperuser nobypassrls;
grant usage on schema public to vexa_notification_verifier;
create table public.notification_reconciliation_evidence(
 tenant_id uuid not null,id uuid not null,job_id uuid not null,fence bigint not null check(fence>0),decision text not null check(decision in('accepted','not_sent')),idempotency_key text not null check(idempotency_key~'^[0-9a-f]{64}$'),provider_id text,proof_hash text not null check(proof_hash~'^[0-9a-f]{64}$'),verified_by text not null default session_user,created_at timestamptz not null default clock_timestamp(),primary key(tenant_id,id),foreign key(tenant_id,job_id) references public.notification_outbox(tenant_id,id),check((decision='accepted' and provider_id~'^[A-Za-z0-9_-]{1,200}$' and provider_id is not null) or(decision='not_sent' and provider_id is null)));
create function public.notification_evidence_guard() returns trigger language plpgsql security definer set search_path='' as $$declare o public.notification_outbox;j public.jobs;begin
 if tg_op<>'INSERT' or current_setting('role',true) is distinct from 'vexa_notification_verifier' then raise insufficient_privilege;end if;
 select * into j from public.jobs where tenant_id=new.tenant_id and id=new.job_id for share;select * into o from public.notification_outbox where tenant_id=new.tenant_id and id=new.job_id;
 if o.state is distinct from 'uncertain' or j.fencing_token is distinct from new.fence or o.idempotency_key is distinct from new.idempotency_key then raise check_violation;end if;
 new.verified_by=session_user;new.created_at=clock_timestamp();return new;
end $$;
revoke all on function public.notification_evidence_guard() from public,anon,authenticated,service_role,vexa_backend,vexa_notification_verifier;
create trigger notification_evidence_append before insert or update or delete on public.notification_reconciliation_evidence for each row execute function public.notification_evidence_guard();
alter table public.notification_reconciliation_evidence enable row level security;alter table public.notification_reconciliation_evidence force row level security;
revoke all on public.notification_reconciliation_evidence from public,anon,authenticated,service_role,vexa_backend,vexa_notification_verifier;
grant insert,select on public.notification_reconciliation_evidence to vexa_notification_verifier;
create policy notification_verifier_read on public.notification_reconciliation_evidence for select to vexa_notification_verifier using(verified_by=session_user);
create policy notification_verifier_insert on public.notification_reconciliation_evidence for insert to vexa_notification_verifier with check(current_user='vexa_notification_verifier');
create table public.notification_reconciliations(
 tenant_id uuid not null,id uuid not null default gen_random_uuid(),job_id uuid not null,request_key uuid not null,fingerprint text not null,evidence_id uuid not null,decision text not null check(decision in('accepted','not_sent')),actor_id uuid not null,created_at timestamptz not null default clock_timestamp(),primary key(tenant_id,id),unique(tenant_id,request_key),foreign key(tenant_id,job_id) references public.notification_outbox(tenant_id,id),foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id),foreign key(tenant_id,evidence_id) references public.notification_reconciliation_evidence(tenant_id,id));
create function public.notification_worker(t uuid) returns boolean language sql stable security definer set search_path='' as $$select coalesce(t=nullif(current_setting('vexa.tenant_id',true),'')::uuid and current_setting('vexa.action',true) in('read','import') and (public.vexa_member(t,array['owner']) or(public.vexa_member(t,array['analyst']) and exists(select 1 from public.worker_delegations where tenant_id=t and user_id=auth.uid() and enabled))),false)$$;
revoke all on function public.notification_worker(uuid) from public,anon,authenticated,service_role;grant execute on function public.notification_worker(uuid) to vexa_backend;
-- Private recipient check. Runtime-local context supports managed PostgreSQL owners.
-- Restore the previous subject on every normal return or exception; no caller controls claim strings.
create function public.notification_recipient_current(t uuid,u uuid,k text,r uuid,c text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare prior_sub text:=current_setting('request.jwt.claim.sub',true); permitted boolean;begin
 perform set_config('request.jwt.claim.sub',u::text,true);
 permitted:=exists(select 1 from public.memberships where tenant_id=t and user_id=u and status='active') and (select count(*)=2 and bool_and(enabled) from public.notification_preferences where tenant_id=t and user_id=u and channel=c and event_type in('*',k)) and public.notification_resource_read(t,u,k,r) is true;
 perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);
 return permitted;
exception when others then
 perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);
 raise;
end $$;
revoke all on function public.notification_recipient_current(uuid,uuid,text,uuid,text) from public,anon,authenticated,service_role,vexa_backend;
create function public.notification_policy_set(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare t uuid=nullif(current_setting('vexa.tenant_id',true),'')::uuid;v integer;x public.notification_delivery_policies;begin
 if current_setting('vexa.action',true) is distinct from 'configure' or public.vexa_member(t,array['owner']) is not true then raise insufficient_privilege;end if;
 if jsonb_typeof(p) is distinct from 'object' or (select count(*) from jsonb_object_keys(p))<>7 or not(p ?& array['channel','enabled','expectedVersion','intervalMs','digestWindowMs','maxAttempts','lifetimeMs']) or jsonb_typeof(p->'enabled') is distinct from 'boolean' or exists(select 1 from unnest(array['expectedVersion','intervalMs','digestWindowMs','maxAttempts','lifetimeMs']) k where jsonb_typeof(p->k) is distinct from 'number' or (p->>k)!~'^[0-9]+$') then raise check_violation;end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text||':notification-policy:'||(p->>'channel'),0));select coalesce(max(version),0) into v from public.notification_delivery_policies where tenant_id=t and channel=p->>'channel';if v<>(p->>'expectedVersion')::integer then raise serialization_failure;end if;
 insert into public.notification_delivery_policies(tenant_id,channel,version,enabled,interval_ms,digest_window_ms,max_attempts,lifetime_ms,actor_id) values(t,p->>'channel',v+1,(p->>'enabled')::boolean,(p->>'intervalMs')::integer,(p->>'digestWindowMs')::integer,(p->>'maxAttempts')::integer,(p->>'lifetimeMs')::bigint,auth.uid()) returning * into x;return to_jsonb(x);
end $$;
create function public.notification_enqueue(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$declare t uuid=nullif(current_setting('vexa.tenant_id',true),'')::uuid;pol public.notification_delivery_policies;e public.notification_events;o public.notification_outbox;jid uuid;eid uuid;u uuid;c text;k text;r uuid;begin
 if current_setting('vexa.action',true) is distinct from 'import' or public.vexa_member(t,array['owner']) is not true then raise insufficient_privilege;end if;
 if jsonb_typeof(p) is distinct from 'object' or (select count(*) from jsonb_object_keys(p))<>5 or not(p ?& array['eventId','type','resourceId','userId','channel']) then raise check_violation;end if;
 eid=(p->>'eventId')::uuid;u=(p->>'userId')::uuid;c=p->>'channel';k=p->>'type';r=(p->>'resourceId')::uuid;
 if not exists(select 1 from public.memberships where tenant_id=t and user_id=u and status='active') then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text||':notification-queue:'||u::text||':'||c,0));
 select * into e from public.notification_events where tenant_id=t and id=eid;
 if e.id is not null and(e.type is distinct from k or e.resource_id is distinct from r) then raise unique_violation;end if;
 select job_id into jid from public.notification_outbox_items where tenant_id=t and event_id=eid and user_id=u and channel=c;if jid is not null then return jid;end if;
 select * into pol from public.notification_delivery_policies where tenant_id=t and channel=c order by version desc limit 1;if pol.id is null then raise check_violation;end if;
 if e.id is null then insert into public.notification_events(tenant_id,id,type,resource_id) values(t,eid,k,r);end if;
 -- Recipient authorization is rechecked at beginSend; disabled preferences/config do not manufacture an effect.
 if pol.digest_window_ms>0 then select b.* into o from public.notification_outbox b join public.jobs j on j.tenant_id=b.tenant_id and j.id=b.id where b.tenant_id=t and b.user_id=u and b.channel=c and b.policy_id=pol.id and b.state='queued' and j.state='queued' and b.digest_until>clock_timestamp() and(select count(*) from public.notification_outbox_items where tenant_id=t and job_id=b.id)<100 order by b.created_at,b.id limit 1 for update of j;end if;
 if o.id is null then jid=gen_random_uuid();insert into public.jobs(id,tenant_id,type,input_ref,input_hash,version,next_attempt_at,deadline,max_attempts) values(jid,t,'notification',jid::text,encode(sha256(convert_to(jid::text,'UTF8')),'hex'),'notification-v1',clock_timestamp()+pol.digest_window_ms*interval '1 millisecond',clock_timestamp()+pol.lifetime_ms*interval '1 millisecond',pol.max_attempts);
 insert into public.notification_outbox(tenant_id,id,user_id,channel,policy_id,actor_id,idempotency_key,digest_until) values(t,jid,u,c,pol.id,auth.uid(),encode(sha256(convert_to(t::text||':'||jid::text,'UTF8')),'hex'),clock_timestamp()+pol.digest_window_ms*interval '1 millisecond');else jid=o.id;end if;
 insert into public.notification_outbox_items(tenant_id,job_id,event_id,user_id,channel) values(t,jid,eid,u,c);return jid;
end $$;
create function public.notification_job_view(t uuid,jid uuid) returns jsonb language sql stable security definer set search_path='' as $$select case when public.notification_worker(t) then(select to_jsonb(o)||jsonb_build_object('fencing_token',j.fencing_token::text,'lease_until',j.lease_until,'deadline',j.deadline,'job_state',j.state,'items',coalesce((select jsonb_agg(jsonb_build_object('eventId',e.id,'type',e.type,'resourceId',e.resource_id,'state',i.state) order by e.created_at,e.id) from public.notification_outbox_items i join public.notification_events e on e.tenant_id=i.tenant_id and e.id=i.event_id where i.tenant_id=t and i.job_id=jid),'[]')) from public.notification_outbox o join public.jobs j on j.tenant_id=o.tenant_id and j.id=o.id where o.tenant_id=t and o.id=jid) else null end $$;
create function public.notification_alarm(t uuid,jid uuid,reason text) returns void language sql security definer set search_path='' as $$insert into public.dead_letters(tenant_id,job_id,reason,provenance) select t,jid,reason,jsonb_build_object('kind','notification-v1') where not exists(select 1 from public.dead_letters where tenant_id=t and job_id=jid and dead_letters.reason=notification_alarm.reason)$$;
revoke all on function public.notification_alarm(uuid,uuid,text) from public,anon,authenticated,service_role,vexa_backend;
create function public.notification_claim(lease_ms integer) returns jsonb language plpgsql security definer set search_path='' as $$declare t uuid=nullif(current_setting('vexa.tenant_id',true),'')::uuid;j public.jobs;o public.notification_outbox;begin
 if current_setting('vexa.action',true) is distinct from 'import' or public.notification_worker(t) is not true then raise insufficient_privilege;end if;if lease_ms not between 100 and 300000 or lease_ms is null then raise check_violation;end if;
 for j in select a.* from public.jobs a join public.notification_outbox b on b.tenant_id=a.tenant_id and b.id=a.id where a.tenant_id=t and a.type='notification' and((a.state='running' and a.lease_until<=clock_timestamp()) or(a.state='queued' and a.deadline<=clock_timestamp())) for update of a skip locked loop
  select * into o from public.notification_outbox where tenant_id=t and id=j.id;
  if o.state='sending' then update public.notification_outbox set state='uncertain',code='lease_expired_during_send' where tenant_id=t and id=j.id;update public.jobs set state='failed',lease_until=null where tenant_id=t and id=j.id;perform public.notification_alarm(t,j.id,'NOTIFICATION_UNCERTAIN');
  elsif j.deadline<=clock_timestamp() then update public.notification_outbox set state='dead',code='deadline_exhausted' where tenant_id=t and id=j.id;update public.jobs set state='failed',lease_until=null where tenant_id=t and id=j.id;perform public.notification_alarm(t,j.id,'NOTIFICATION_DEAD');
  else update public.notification_outbox set state='retry',code='lease_expired_before_send' where tenant_id=t and id=j.id;update public.jobs set state='queued',lease_until=null where tenant_id=t and id=j.id;end if;
  update public.attempts set state=case when o.state='sending' then 'uncertain' else 'failed' end,finished_at=clock_timestamp(),error_code='LEASE_EXPIRED' where tenant_id=t and job_id=j.id and state='running';
 end loop;
 select a.* into j from public.jobs a join public.notification_outbox b on b.tenant_id=a.tenant_id and b.id=a.id where a.tenant_id=t and a.type='notification' and a.state='queued' and b.state in('queued','retry') and a.next_attempt_at<=clock_timestamp() and a.deadline>clock_timestamp() order by a.created_at,a.id limit 1 for update of a skip locked;
 if j.id is null then return null;end if;
 update public.jobs set state='running',fencing_token=fencing_token+1,lease_owner=auth.uid()::text,lease_until=clock_timestamp()+lease_ms*interval '1 millisecond',updated_at=clock_timestamp() where tenant_id=t and id=j.id returning * into j;
 update public.notification_outbox set state='claimed' where tenant_id=t and id=j.id;
 insert into public.attempts(tenant_id,job_id,state,attempt_number,fencing_token) values(t,j.id,'running',j.fencing_token::integer,j.fencing_token);
 return public.notification_job_view(t,j.id);
end $$;
create function public.notification_fence(t uuid,jid uuid,f bigint) returns public.jobs language plpgsql security definer set search_path='' as $$declare j public.jobs;begin
 if current_setting('vexa.action',true) is distinct from 'import' or public.notification_worker(t) is not true then raise insufficient_privilege;end if;
 select * into j from public.jobs where tenant_id=t and id=jid and type='notification' for update;
 if j.id is null or j.state<>'running' or j.fencing_token is distinct from f or j.lease_owner is distinct from auth.uid()::text or j.lease_until<=clock_timestamp() or j.deadline<=clock_timestamp() then raise serialization_failure;end if;return j;
end $$;
revoke all on function public.notification_fence(uuid,uuid,bigint) from public,anon,authenticated,service_role,vexa_backend;
create function public.notification_renew(jid uuid,f bigint,lease_ms integer) returns void language plpgsql security definer set search_path='' as $$declare t uuid=nullif(current_setting('vexa.tenant_id',true),'')::uuid;begin
 perform public.notification_fence(t,jid,f);if lease_ms not between 100 and 300000 or lease_ms is null then raise check_violation;end if;
 update public.jobs set lease_until=least(deadline,clock_timestamp()+lease_ms*interval '1 millisecond'),updated_at=clock_timestamp() where tenant_id=t and id=jid;
end $$;
create function public.notification_begin_send(jid uuid,f bigint,configured boolean) returns jsonb language plpgsql security definer set search_path='' as $$declare t uuid=nullif(current_setting('vexa.tenant_id',true),'')::uuid;j public.jobs;o public.notification_outbox;p public.notification_delivery_policies;n integer;lim timestamptz;begin
 j=public.notification_fence(t,jid,f);select * into o from public.notification_outbox where tenant_id=t and id=jid for update;
 if o.state<>'claimed' then raise serialization_failure;end if;
 select * into p from public.notification_delivery_policies where tenant_id=t and channel=o.channel order by version desc limit 1;
 if configured is not true or p.enabled is not true or not exists(select 1 from public.memberships where tenant_id=t and user_id=p.actor_id and role='owner' and status='active') then return jsonb_build_object('kind','blocked','code','configuration_unavailable');end if;
 if not exists(select 1 from public.memberships where tenant_id=t and user_id=o.actor_id and status='active' and role='owner') then return jsonb_build_object('kind','suppressed','code','producer_revoked');end if;
 if o.attempts>=p.max_attempts then return jsonb_build_object('kind','permanent','code','attempts_exhausted');end if;
 update public.notification_outbox_items i set state=case when public.notification_recipient_current(t,o.user_id,e.type,e.resource_id,o.channel) then 'eligible' else 'suppressed' end from public.notification_events e where i.tenant_id=t and i.job_id=jid and e.tenant_id=i.tenant_id and e.id=i.event_id;
 select count(*) into n from public.notification_outbox_items where tenant_id=t and job_id=jid and state='eligible';if n=0 then return jsonb_build_object('kind','suppressed','code','not_authorized');end if;
 insert into public.notification_dispatch_limits(tenant_id,user_id,channel) values(t,o.user_id,o.channel) on conflict do nothing;
 select next_allowed_at into lim from public.notification_dispatch_limits where tenant_id=t and user_id=o.user_id and channel=o.channel for update;
 if lim>clock_timestamp() then return jsonb_build_object('kind','retry','retryAfterMs',ceil(extract(epoch from(lim-clock_timestamp()))*1000),'code','frequency_limited');end if;
 update public.notification_dispatch_limits set next_allowed_at=clock_timestamp()+p.interval_ms*interval '1 millisecond' where tenant_id=t and user_id=o.user_id and channel=o.channel;
 update public.notification_outbox set state='sending',attempts=attempts+1,started_at=clock_timestamp(),used_policy_id=p.id where tenant_id=t and id=jid;
 return jsonb_build_object('kind','ready','count',n,'tenantId',t,'userId',o.user_id,'channel',o.channel,'idempotencyKey',o.idempotency_key);
end $$;
create function public.notification_finish(jid uuid,f bigint,result jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare t uuid=nullif(current_setting('vexa.tenant_id',true),'')::uuid;j public.jobs;o public.notification_outbox;p public.notification_delivery_policies;st text;k text;delay bigint;begin
 j=public.notification_fence(t,jid,f);select * into o from public.notification_outbox where tenant_id=t and id=jid for update;select * into p from public.notification_delivery_policies where tenant_id=t and channel=o.channel order by version desc limit 1;k=result->>'kind';
 if jsonb_typeof(result) is distinct from 'object' or k is null or k not in('accepted','retry','uncertain','permanent','blocked','suppressed') or exists(select 1 from jsonb_object_keys(result) key where key not in('kind','providerId','retryAfterMs','code')) then raise check_violation;end if;
 if k='accepted' and(o.state<>'sending' or coalesce(result->>'providerId','')!~'^[A-Za-z0-9_-]{1,200}$') then raise check_violation;end if;
 if k='retry' and (coalesce(result->>'retryAfterMs','0')!~'^[0-9]+$' or (result->>'retryAfterMs')::numeric>86400000) then raise check_violation;end if;
 st=case k when 'accepted' then 'accepted' when 'retry' then 'retry' when 'permanent' then 'dead' else k end;
 if st='retry' then delay=greatest(least(3600000,1000*power(2,greatest(0,o.attempts-1)))::bigint,coalesce((result->>'retryAfterMs')::bigint,0));if o.attempts>=p.max_attempts or clock_timestamp()+delay*interval '1 millisecond'>=j.deadline then st='dead';end if;end if;
 if st='accepted' and o.channel='inapp' then
  update public.notification_outbox_items i set state='suppressed' from public.notification_events e where i.tenant_id=t and i.job_id=jid and e.tenant_id=t and e.id=i.event_id and (public.notification_recipient_current(t,o.user_id,e.type,e.resource_id,o.channel) is not true or p.enabled is not true or not exists(select 1 from public.memberships where tenant_id=t and user_id=p.actor_id and status='active' and role='owner') or not exists(select 1 from public.memberships where tenant_id=t and user_id=o.actor_id and status='active' and role='owner'));
  if not exists(select 1 from public.notification_outbox_items where tenant_id=t and job_id=jid and state='eligible') then st='suppressed';end if;
 end if;
 if st='accepted' and o.channel='inapp' then insert into public.notification_inbox(tenant_id,event_id,user_id) select t,event_id,o.user_id from public.notification_outbox_items where tenant_id=t and job_id=jid and state='eligible' on conflict(tenant_id,user_id,event_id) do nothing;end if;
 update public.notification_outbox set state=st,provider_id=case when st='accepted' then result->>'providerId' else null end,code=case st when 'accepted' then null when 'retry' then 'retry_scheduled' when 'uncertain' then 'effect_uncertain' when 'blocked' then 'configuration_unavailable' when 'suppressed' then 'not_authorized' else 'delivery_exhausted' end where tenant_id=t and id=jid;
 if st='accepted' then update public.notification_outbox_items set state='accepted' where tenant_id=t and job_id=jid and state='eligible';end if;
 update public.jobs set state=case when st='retry' then 'queued' when st in('accepted','suppressed') then 'succeeded' else 'failed' end,lease_until=null,next_attempt_at=case when st='retry' then clock_timestamp()+delay*interval '1 millisecond' else next_attempt_at end,updated_at=clock_timestamp() where tenant_id=t and id=jid;
 update public.attempts set state=case when st='uncertain' then 'uncertain' when st in('accepted','suppressed') then 'succeeded' else 'failed' end,finished_at=clock_timestamp(),error_code=case when st='accepted' then null else upper(st) end where tenant_id=t and job_id=jid and fencing_token=f;
 if st in('uncertain','blocked','dead') then perform public.notification_alarm(t,jid,'NOTIFICATION_'||upper(st));end if;return public.notification_job_view(t,jid);
end $$;
create function public.notification_abort(jid uuid,f bigint) returns jsonb language plpgsql security definer set search_path='' as $$declare t uuid=nullif(current_setting('vexa.tenant_id',true),'')::uuid;j public.jobs;o public.notification_outbox;st text;begin
 if current_setting('vexa.action',true) is distinct from 'import' or public.notification_worker(t) is not true then raise insufficient_privilege;end if;
 select * into j from public.jobs where tenant_id=t and id=jid and type='notification' for update;if j.id is null or j.fencing_token is distinct from f or j.lease_owner is distinct from auth.uid()::text then raise serialization_failure;end if;
 select * into o from public.notification_outbox where tenant_id=t and id=jid;if o.state not in('claimed','sending') then return public.notification_job_view(t,jid);end if;
 st=case when o.state='sending' then 'uncertain' else 'blocked' end;update public.notification_outbox set state=st,code=case when st='uncertain' then 'effect_uncertain' else 'worker_unavailable' end where tenant_id=t and id=jid;
 update public.jobs set state='failed',lease_until=null,updated_at=clock_timestamp() where tenant_id=t and id=jid;
 update public.attempts set state=case when st='uncertain' then 'uncertain' else 'failed' end,finished_at=clock_timestamp(),error_code=upper(st) where tenant_id=t and job_id=jid and fencing_token=f;
 perform public.notification_alarm(t,jid,'NOTIFICATION_'||upper(st));return public.notification_job_view(t,jid);
end $$;
create function public.notification_reconcile(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare t uuid=nullif(current_setting('vexa.tenant_id',true),'')::uuid;j public.jobs;o public.notification_outbox;old public.notification_reconciliations;fp text;st text;pol public.notification_delivery_policies;begin
 if current_setting('vexa.action',true) is distinct from 'configure' or public.vexa_member(t,array['owner']) is not true then raise insufficient_privilege;end if;
 if jsonb_typeof(p) is distinct from 'object' or (select count(*) from jsonb_object_keys(p))<>7 or not(p ?& array['id','expectedFence','decision','evidenceId','requestKey','idempotencyKey','providerId']) or p->>'decision' not in('accepted','not_sent') or coalesce(p->>'expectedFence','')!~'^[0-9]+$' then raise check_violation;end if;
 fp=encode(sha256(convert_to((p-'requestKey')::text,'UTF8')),'hex');perform pg_advisory_xact_lock(hashtextextended(t::text||':notification-reconcile:'||(p->>'requestKey'),0));
 select * into old from public.notification_reconciliations where tenant_id=t and request_key=(p->>'requestKey')::uuid;
 if old.id is not null and old.fingerprint<>fp then raise unique_violation;end if;
 if not exists(select 1 from public.notification_reconciliation_evidence where tenant_id=t and id=(p->>'evidenceId')::uuid and job_id=(p->>'id')::uuid and fence=(p->>'expectedFence')::bigint and decision=p->>'decision' and idempotency_key=p->>'idempotencyKey' and provider_id is not distinct from p->>'providerId') then raise insufficient_privilege;end if;
 if old.id is not null then if old.fingerprint<>fp then raise unique_violation;end if;if exists(select 1 from public.notification_outbox_items i join public.notification_events e on e.tenant_id=i.tenant_id and e.id=i.event_id where i.tenant_id=t and i.job_id=old.job_id and i.state<>'suppressed' and public.notification_recipient_current(t,i.user_id,e.type,e.resource_id,i.channel) is not true) then raise insufficient_privilege;end if;return jsonb_build_object('id',old.job_id,'decision',old.decision,'replayed',true);end if;
 select * into j from public.jobs where tenant_id=t and id=(p->>'id')::uuid and type='notification' for update;select * into o from public.notification_outbox where tenant_id=t and id=j.id;
 if o.id is null or o.state<>'uncertain' or j.fencing_token is distinct from (p->>'expectedFence')::bigint or o.idempotency_key is distinct from p->>'idempotencyKey' then raise serialization_failure;end if;
 if exists(select 1 from public.notification_outbox_items i join public.notification_events e on e.tenant_id=i.tenant_id and e.id=i.event_id where i.tenant_id=t and i.job_id=j.id and i.state<>'suppressed' and public.notification_recipient_current(t,o.user_id,e.type,e.resource_id,o.channel) is not true) then raise insufficient_privilege;end if;
 select * into pol from public.notification_delivery_policies where tenant_id=t and channel=o.channel order by version desc limit 1;if pol.enabled is not true or not exists(select 1 from public.memberships where tenant_id=t and user_id=pol.actor_id and status='active' and role='owner') then raise insufficient_privilege;end if;
 if p->>'decision'='accepted' then if coalesce(p->>'providerId','')!~'^[A-Za-z0-9_-]{1,200}$' then raise check_violation;end if;st='accepted';else if j.deadline<=clock_timestamp() or o.attempts>=pol.max_attempts or p->>'providerId' is not null then raise check_violation;end if;st='retry';end if;
 insert into public.notification_reconciliations(tenant_id,job_id,request_key,fingerprint,evidence_id,decision,actor_id) values(t,j.id,(p->>'requestKey')::uuid,fp,(p->>'evidenceId')::uuid,p->>'decision',auth.uid());
 update public.notification_outbox set state=st,provider_id=p->>'providerId',code='owner_reconciled' where tenant_id=t and id=j.id;
 update public.jobs set state=case when st='accepted' then 'succeeded' else 'queued' end,fencing_token=fencing_token+1,next_attempt_at=clock_timestamp(),lease_until=null,updated_at=clock_timestamp() where tenant_id=t and id=j.id;
 if st='accepted' then update public.notification_outbox_items set state='accepted' where tenant_id=t and job_id=j.id and state='eligible';end if;
 return jsonb_build_object('id',j.id,'decision',p->>'decision','replayed',false);
end $$;
-- Existing operational tables must not expose notification delivery metadata to ordinary members.
create function public.notification_job_readable(t uuid,jid uuid) returns boolean language sql stable security definer set search_path='' as $$select case when public.vexa_member(t) is not true then false when exists(select 1 from public.jobs where tenant_id=t and id=jid and type='notification') then public.notification_worker(t) else true end$$;
revoke all on function public.notification_job_readable(uuid,uuid) from public,anon,service_role;grant execute on function public.notification_job_readable(uuid,uuid) to authenticated,vexa_backend;
create policy notification_attempt_browser on public.attempts as restrictive for select to authenticated,vexa_backend using(public.notification_job_readable(tenant_id,job_id));
create policy notification_deadletter_browser on public.dead_letters as restrictive for select to authenticated,vexa_backend using(public.notification_job_readable(tenant_id,job_id));
-- Runtime never writes these rows directly. The existing jobs lease/fence is the single scheduler authority.
create function public.notification_job_write_guard() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if (case when tg_op='INSERT' then new.type='notification' when tg_op='DELETE' then old.type='notification' else old.type='notification' or new.type='notification' end) and current_user='vexa_backend' then raise insufficient_privilege;end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function public.notification_job_write_guard() from public,anon,authenticated,service_role,vexa_backend;
create trigger notification_job_write before insert or update or delete on public.jobs for each row execute function public.notification_job_write_guard();
create policy notification_job_browser on public.jobs as restrictive for select to authenticated using(type<>'notification');
create policy notification_job_backend on public.jobs as restrictive for select to vexa_backend using(type<>'notification' or public.notification_worker(tenant_id));
alter table public.notification_delivery_policies enable row level security;alter table public.notification_delivery_policies force row level security;
revoke all on public.notification_delivery_policies from public,anon,authenticated,service_role,vexa_backend;
grant select on public.notification_delivery_policies to vexa_backend;
create policy notification_private_read on public.notification_delivery_policies for select to vexa_backend using(public.notification_worker(tenant_id));
alter table public.notification_outbox enable row level security;alter table public.notification_outbox force row level security;
revoke all on public.notification_outbox from public,anon,authenticated,service_role,vexa_backend;
grant select on public.notification_outbox to vexa_backend;
create policy notification_private_read on public.notification_outbox for select to vexa_backend using(public.notification_worker(tenant_id));
alter table public.notification_outbox_items enable row level security;alter table public.notification_outbox_items force row level security;
revoke all on public.notification_outbox_items from public,anon,authenticated,service_role,vexa_backend;
grant select on public.notification_outbox_items to vexa_backend;
create policy notification_private_read on public.notification_outbox_items for select to vexa_backend using(public.notification_worker(tenant_id));
alter table public.notification_dispatch_limits enable row level security;alter table public.notification_dispatch_limits force row level security;
revoke all on public.notification_dispatch_limits from public,anon,authenticated,service_role,vexa_backend;
grant select on public.notification_dispatch_limits to vexa_backend;
create policy notification_private_read on public.notification_dispatch_limits for select to vexa_backend using(public.notification_worker(tenant_id));
alter table public.notification_reconciliations enable row level security;alter table public.notification_reconciliations force row level security;
revoke all on public.notification_reconciliations from public,anon,authenticated,service_role,vexa_backend;
grant select on public.notification_reconciliations to vexa_backend;
create policy notification_private_read on public.notification_reconciliations for select to vexa_backend using(public.notification_worker(tenant_id));
revoke all on function public.notification_policy_set(jsonb) from public,anon,authenticated,service_role;grant execute on function public.notification_policy_set(jsonb) to vexa_backend;
revoke all on function public.notification_enqueue(jsonb) from public,anon,authenticated,service_role;grant execute on function public.notification_enqueue(jsonb) to vexa_backend;
revoke all on function public.notification_job_view(uuid,uuid) from public,anon,authenticated,service_role;grant execute on function public.notification_job_view(uuid,uuid) to vexa_backend;
revoke all on function public.notification_claim(integer) from public,anon,authenticated,service_role;grant execute on function public.notification_claim(integer) to vexa_backend;
revoke all on function public.notification_renew(uuid,bigint,integer) from public,anon,authenticated,service_role;grant execute on function public.notification_renew(uuid,bigint,integer) to vexa_backend;
revoke all on function public.notification_begin_send(uuid,bigint,boolean) from public,anon,authenticated,service_role;grant execute on function public.notification_begin_send(uuid,bigint,boolean) to vexa_backend;
revoke all on function public.notification_finish(uuid,bigint,jsonb) from public,anon,authenticated,service_role;grant execute on function public.notification_finish(uuid,bigint,jsonb) to vexa_backend;
revoke all on function public.notification_abort(uuid,bigint) from public,anon,authenticated,service_role;grant execute on function public.notification_abort(uuid,bigint) to vexa_backend;
revoke all on function public.notification_reconcile(jsonb) from public,anon,authenticated,service_role;grant execute on function public.notification_reconcile(jsonb) to vexa_backend;
alter table public.worker_delegations add column notification_last_dispatched_at timestamptz;
create or replace function public.reserve_worker_scope(p_consumer text) returns uuid
language plpgsql security definer set search_path='' as $$
declare chosen uuid;
begin
 if auth.uid() is null or current_setting('vexa.action',true) is distinct from 'worker_dispatch' then
  raise insufficient_privilege using message='worker identity required';
 end if;
 if p_consumer is null or p_consumer not in ('imports','crm','extraction','problems','notifications') then
  raise invalid_parameter_value using message='worker consumer invalid';
 end if;
 if p_consumer='imports' then return public.reserve_worker_scope(); end if;
 select d.tenant_id into chosen from public.worker_delegations d
 join public.memberships m on m.tenant_id=d.tenant_id and m.user_id=d.user_id
 where d.user_id=auth.uid() and d.enabled and m.status='active' and m.role='analyst'
 order by case p_consumer when 'crm' then d.crm_last_dispatched_at when 'extraction' then d.extraction_last_dispatched_at when 'notifications' then d.notification_last_dispatched_at else d.problems_last_dispatched_at end nulls first,
  d.tenant_id limit 1 for update of d skip locked;
 if chosen is not null then
  update public.worker_delegations set
   notification_last_dispatched_at=case when p_consumer='notifications' then clock_timestamp() else notification_last_dispatched_at end,
   problems_last_dispatched_at=case when p_consumer='problems' then clock_timestamp() else problems_last_dispatched_at end,
   crm_last_dispatched_at=case when p_consumer='crm' then clock_timestamp() else crm_last_dispatched_at end,
   extraction_last_dispatched_at=case when p_consumer='extraction' then clock_timestamp() else extraction_last_dispatched_at end
   where tenant_id=chosen and user_id=auth.uid();
 end if;
 return chosen;
end $$;
commit;
