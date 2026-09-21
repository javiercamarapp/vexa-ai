-- Local F04-02 proposal. Monetary units are USD micro-units; no automatic expiry release.
create table public.ai_budget_limits (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.organizations(id),
 purpose text not null check(purpose in ('all','extraction','explorer','embedding','brief')),window_key text not null check(length(window_key) between 1 and 100),
 limit_minor numeric not null check(limit_minor>=0 and limit_minor=trunc(limit_minor) and limit_minor<1e30),
 version integer not null default 1 check(version>0),unique(tenant_id,id),unique(tenant_id,purpose,window_key)
);
create table public.ai_budget_reservations (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.organizations(id),job_id uuid not null,
 purpose text not null check(purpose in ('extraction','explorer','embedding','brief')),window_key text not null check(length(window_key) between 1 and 100),
 task_key text not null check(length(task_key) between 1 and 200),fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 actor_id uuid not null,owner_token uuid not null,state text not null default 'reserved' check(state in ('reserved','uncertain','settled','released')),
 held_minor numeric not null check(held_minor>0 and held_minor=trunc(held_minor) and held_minor<1e30),
 actual_minor numeric check(actual_minor>=0 and actual_minor=trunc(actual_minor) and actual_minor<1e30),
 reported_minor numeric not null default 0 check(reported_minor>=0 and reported_minor=trunc(reported_minor) and reported_minor<1e30),
 version integer not null default 1 check(version>0),created_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,id),unique(tenant_id,purpose,task_key),
 foreign key(tenant_id,job_id) references public.jobs(tenant_id,id),
 foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id)
);
create index ai_budget_usage on public.ai_budget_reservations(tenant_id,window_key,purpose);
create table public.ai_budget_attempts (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,reservation_id uuid not null,owner_token uuid not null,
 attempt_index integer not null check(attempt_index between 0 and 2),state text not null check(state in ('started','received','not_sent')),
 model text,provider text,pricing_version text,ceiling_minor numeric check(ceiling_minor>0 and ceiling_minor=trunc(ceiling_minor) and ceiling_minor<1e30),
 http_status integer check(http_status between 100 and 599),remote_id_hash text check(remote_id_hash ~ '^[a-f0-9]{64}$'),
 reported_minor numeric check(reported_minor>=0 and reported_minor=trunc(reported_minor) and reported_minor<1e30),
 usage jsonb not null default '{}'::jsonb,created_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,id),unique(tenant_id,reservation_id,attempt_index,state),
 foreign key(tenant_id,reservation_id) references public.ai_budget_reservations(tenant_id,id),
 check((state='started' and model is not null and provider is not null and pricing_version is not null and length(model) between 1 and 200 and length(provider) between 1 and 200 and length(pricing_version) between 1 and 200 and ceiling_minor is not null and http_status is null and remote_id_hash is null and reported_minor is null and usage='{}'::jsonb)
 or(state='not_sent' and model is null and provider is null and pricing_version is null and ceiling_minor is null and http_status is null and remote_id_hash is null and reported_minor is null and usage='{}'::jsonb)
 or(state='received' and model is null and provider is null and pricing_version is null and ceiling_minor is null and http_status is not null))
);
create table public.ai_budget_reconciliations (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,reservation_id uuid not null,actor_id uuid not null,
 expected_version integer not null check(expected_version>0),actual_minor numeric not null check(actual_minor>=0 and actual_minor=trunc(actual_minor) and actual_minor<1e30),
 evidence_hash text not null check(evidence_hash ~ '^[a-f0-9]{64}$'),confirmed_provider_evidence boolean not null check(confirmed_provider_evidence),
 created_at timestamptz not null default clock_timestamp(),unique(tenant_id,id),unique(tenant_id,reservation_id),unique(tenant_id,evidence_hash),
 foreign key(tenant_id,reservation_id) references public.ai_budget_reservations(tenant_id,id),
 foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id)
);
create function public.ai_budget_limit_guard() returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
 if new.tenant_id is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or not public.vexa_backend_action(new.tenant_id,array['configure']) then raise exception 'budget configure denied' using errcode='42501';end if;
 if tg_op='INSERT' and new.version<>1 then raise exception 'budget version invalid' using errcode='23514';end if;
 if tg_op='UPDATE' and ((new.id,new.tenant_id,new.purpose,new.window_key) is distinct from (old.id,old.tenant_id,old.purpose,old.window_key) or new.version<>old.version+1) then raise exception 'budget identity immutable' using errcode='23514';end if;
 return new;
end $$;
create trigger ai_budget_limit_guard before insert or update on public.ai_budget_limits for each row execute function public.ai_budget_limit_guard();
create function public.ai_budget_reservation_guard() returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare quota record;seen integer:=0;used numeric;known numeric;started integer;received integer;unknown_cost integer;
begin
 if new.tenant_id is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid then raise exception 'budget tenant denied' using errcode='42501';end if;
 if tg_op='INSERT' then
  if new.owner_token is distinct from nullif(current_setting('vexa.budget_owner_token',true),'')::uuid then raise exception 'budget owner token required' using errcode='42501';end if;
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'budget requires read committed' using errcode='40001';end if;
  if not public.vexa_backend_action(new.tenant_id,array['import']) or new.actor_id is distinct from nullif(current_setting('request.jwt.claim.sub',true),'')::uuid then raise exception 'budget actor denied' using errcode='42501';end if;
  if not exists(select 1 from public.jobs where tenant_id=new.tenant_id and id=new.job_id and type=new.purpose) then raise exception 'budget job purpose mismatch' using errcode='23514';end if;
  if new.state<>'reserved' or new.actual_minor is not null or new.reported_minor<>0 or new.version<>1 then raise exception 'budget initial state invalid' using errcode='23514';end if;
  for quota in select * from public.ai_budget_limits where tenant_id=new.tenant_id and window_key=new.window_key and purpose in ('all',new.purpose) order by purpose for update loop
   seen:=seen+1;
   select coalesce(sum(case when state in ('settled','released') then actual_minor else greatest(held_minor,reported_minor,coalesce((select sum(a.reported_minor) from public.ai_budget_attempts a where a.tenant_id=r.tenant_id and a.reservation_id=r.id and a.state='received'),0)) end),0) into used from public.ai_budget_reservations r where tenant_id=new.tenant_id and window_key=new.window_key and (quota.purpose='all' or purpose=new.purpose);
   if used+new.held_minor>quota.limit_minor then raise exception 'budget exceeded' using errcode='23514';end if;
  end loop;
  if seen<>2 then raise exception 'budget limit missing' using errcode='23514';end if;
 else
  if (new.id,new.tenant_id,new.job_id,new.purpose,new.window_key,new.task_key,new.fingerprint,new.actor_id,new.owner_token,new.held_minor,new.created_at) is distinct from (old.id,old.tenant_id,old.job_id,old.purpose,old.window_key,old.task_key,old.fingerprint,old.actor_id,old.owner_token,old.held_minor,old.created_at) or new.version<>old.version+1 then raise exception 'budget identity immutable' using errcode='23514';end if;
  if old.state in ('reserved','uncertain') and public.vexa_backend_action(new.tenant_id,array['configure']) then
   if not public.vexa_backend_action(new.tenant_id,array['configure']) or new.state<>'settled' or new.actual_minor is null or new.reported_minor<>new.actual_minor or not exists(select 1 from public.ai_budget_reconciliations p where p.tenant_id=new.tenant_id and p.reservation_id=new.id and p.expected_version=old.version and p.actual_minor=new.actual_minor) then raise exception 'budget reconciliation required' using errcode='42501';end if;
  elsif old.state='reserved' then
   if old.owner_token is distinct from nullif(current_setting('vexa.budget_owner_token',true),'')::uuid then raise exception 'budget owner token required' using errcode='42501';end if;
   if not public.vexa_backend_action(new.tenant_id,array['import']) or old.actor_id is distinct from nullif(current_setting('request.jwt.claim.sub',true),'')::uuid then raise exception 'budget actor denied' using errcode='42501';end if;
   select count(*) filter(where state='started'),count(*) filter(where state in ('received','not_sent')),count(*) filter(where state='received'and reported_minor is null),coalesce(sum(reported_minor) filter(where state='received'),0) into started,received,unknown_cost,known from public.ai_budget_attempts where tenant_id=new.tenant_id and reservation_id=new.id;
   if new.state='uncertain' then
    if new.actual_minor is not null or new.reported_minor<known then raise exception 'uncertain cost cannot be discarded' using errcode='23514';end if;
   elsif new.state in ('settled','released') then
    if started<>received or unknown_cost<>0 or new.actual_minor is distinct from known or new.reported_minor<>known or (new.state='released'and started<>0) then raise exception 'budget settlement unsupported' using errcode='23514';end if;
   else raise exception 'budget transition invalid' using errcode='23514';end if;
  else raise exception 'budget terminal immutable' using errcode='23514';end if;
 end if;
 return new;
end $$;
create trigger ai_budget_reservation_guard before insert or update on public.ai_budget_reservations for each row execute function public.ai_budget_reservation_guard();
create function public.ai_budget_attempt_guard() returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare r public.ai_budget_reservations;tokens record;n integer;
begin
 if tg_op<>'INSERT' then raise exception 'budget evidence immutable' using errcode='23514';end if;
 if new.tenant_id is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or not public.vexa_backend_action(new.tenant_id,array['import']) then raise exception 'budget attempt denied' using errcode='42501';end if;
 select * into r from public.ai_budget_reservations where tenant_id=new.tenant_id and id=new.reservation_id for update;
 if new.owner_token is distinct from nullif(current_setting('vexa.budget_owner_token',true),'')::uuid then raise exception 'budget owner token required' using errcode='42501';end if;
 if r.id is null or r.state<>'reserved' or r.owner_token<>new.owner_token or r.actor_id is distinct from nullif(current_setting('request.jwt.claim.sub',true),'')::uuid then raise exception 'budget attempt fence lost' using errcode='42501';end if;
 if new.state='started' then
  select count(*) into n from public.ai_budget_attempts where tenant_id=new.tenant_id and reservation_id=new.reservation_id and state='started';
  if new.attempt_index<>n then raise exception 'budget attempt order invalid' using errcode='23514';end if;
 elsif not exists(select 1 from public.ai_budget_attempts where tenant_id=new.tenant_id and reservation_id=new.reservation_id and attempt_index=new.attempt_index and state='started') then raise exception 'budget attempt missing start' using errcode='23514';end if;
 if new.state in ('received','not_sent') and exists(select 1 from public.ai_budget_attempts where tenant_id=new.tenant_id and reservation_id=new.reservation_id and attempt_index=new.attempt_index and state in ('received','not_sent')) then raise exception 'budget attempt already completed' using errcode='23514';end if;
 if jsonb_typeof(new.usage)<>'object' then raise exception 'budget usage invalid' using errcode='23514';end if;
 for tokens in select * from jsonb_each(new.usage) loop
  if tokens.key not in ('prompt_tokens','completion_tokens','total_tokens') or jsonb_typeof(tokens.value)<>'number' or tokens.value::text !~ '^[0-9]{1,9}$' then raise exception 'budget usage invalid' using errcode='23514';end if;
 end loop;
 return new;
end $$;
create trigger ai_budget_attempt_guard before insert or update or delete on public.ai_budget_attempts for each row execute function public.ai_budget_attempt_guard();
create function public.ai_budget_reconciliation_guard() returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare r public.ai_budget_reservations;
begin
 if tg_op<>'INSERT' then raise exception 'budget evidence immutable' using errcode='23514';end if;
 if new.tenant_id is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or not public.vexa_backend_action(new.tenant_id,array['configure']) or new.actor_id is distinct from nullif(current_setting('request.jwt.claim.sub',true),'')::uuid then raise exception 'budget reconciliation denied' using errcode='42501';end if;
 select * into r from public.ai_budget_reservations where tenant_id=new.tenant_id and id=new.reservation_id for update;
 if r.id is null or r.state not in ('reserved','uncertain') or r.version<>new.expected_version then raise exception 'budget reconciliation stale' using errcode='23514';end if;
 return new;
end $$;
create trigger ai_budget_reconciliation_guard before insert or update or delete on public.ai_budget_reconciliations for each row execute function public.ai_budget_reconciliation_guard();
-- Default-deny, current membership and selected tenant bind every statement, including direct SQL.
do $$declare t text;begin
 foreach t in array array['ai_budget_limits','ai_budget_reservations','ai_budget_attempts','ai_budget_reconciliations']loop
  execute format('alter table public.%I enable row level security',t);execute format('alter table public.%I force row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select,insert on public.%I to vexa_backend',t);
  execute format('create policy budget_read on public.%I for select to vexa_backend using(tenant_id=nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid and public.vexa_member(tenant_id,array[''owner'',''analyst'',''operator'',''viewer'']))',t);
  execute format('create policy budget_insert on public.%I for insert to vexa_backend with check(tenant_id=nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid and public.vexa_backend_action(tenant_id,array[''import'',''configure'']))',t);
 end loop;
 foreach t in array array['ai_budget_limits','ai_budget_reservations']loop
  execute format('grant update on public.%I to vexa_backend',t);
  execute format('create policy budget_update on public.%I for update to vexa_backend using(tenant_id=nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid and public.vexa_backend_action(tenant_id,array[''import'',''configure''])) with check(tenant_id=nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid and public.vexa_backend_action(tenant_id,array[''import'',''configure'']))',t);
 end loop;
end $$;
revoke all on function public.ai_budget_limit_guard(),public.ai_budget_reservation_guard(),public.ai_budget_attempt_guard(),public.ai_budget_reconciliation_guard() from public;
