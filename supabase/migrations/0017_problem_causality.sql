begin;
create table public.problem_operational_evidence(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,problem_id uuid not null,record_id text not null check(length(record_id) between 1 and 200),version integer not null check(version>0),
 actor_id uuid not null,created_at timestamptz not null default now(),source_kind text not null check(source_kind in ('inspection','lab','carrier_record')),observed_at timestamptz not null,
 report text not null check(length(report) between 20 and 16000),digest text not null check(digest ~ '^[a-f0-9]{64}$'),stance text not null check(stance in ('supports','contradicts')),status text not null check(status in ('active','withdrawn')),facts jsonb not null check(jsonb_typeof(facts)='object'),attested boolean not null check(attested),
 unique(tenant_id,id),unique(tenant_id,problem_id,record_id,version),foreign key(tenant_id,problem_id) references public.problems(tenant_id,id),foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id)
);
create table public.problem_causal_versions(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,problem_id uuid not null,version integer not null check(version>0),actor_id uuid not null,created_at timestamptz not null default now(),
 symptom text not null check(length(symptom) between 1 and 2000),probable_cause text check(length(probable_cause) between 1 and 2000),state text not null check(state in ('hypothesis','confirmed','retracted')),reason text not null check(length(reason) between 1 and 2000),
 evidence_ids uuid[] not null,facts jsonb not null check(jsonb_typeof(facts)='object'),critical_review boolean not null,approved boolean not null check(approved),
 unique(tenant_id,id),unique(tenant_id,problem_id,version),foreign key(tenant_id,problem_id) references public.problems(tenant_id,id),foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id),check(state<>'confirmed' or probable_cause is not null)
);
alter table public.problem_operational_evidence enable row level security;alter table public.problem_operational_evidence force row level security;
alter table public.problem_causal_versions enable row level security;alter table public.problem_causal_versions force row level security;
revoke all on public.problem_operational_evidence,public.problem_causal_versions from public,anon,authenticated,service_role,vexa_backend;
grant select,insert on public.problem_operational_evidence,public.problem_causal_versions to vexa_backend;
create policy evidence_read on public.problem_operational_evidence for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create policy evidence_insert on public.problem_operational_evidence for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and actor_id=auth.uid() and public.vexa_backend_action(tenant_id,array['propose']) and public.vexa_member(tenant_id,array['owner','analyst','operator']));
create policy causal_read on public.problem_causal_versions for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create policy causal_insert on public.problem_causal_versions for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and actor_id=auth.uid() and public.vexa_backend_action(tenant_id,array['propose','approve']) and public.vexa_member(tenant_id,array['owner','analyst','operator']) and (state<>'confirmed' or public.vexa_backend_action(tenant_id,array['approve']) and public.vexa_member(tenant_id,array['owner'])));
-- Scoped boolean lookup: does not expose membership rows or relax membership RLS.
create function public.causality_contributor_active(p_tenant uuid,p_actor uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p_tenant=nullif(current_setting('vexa.tenant_id',true),'')::uuid
 and current_setting('vexa.action',true) in ('read','propose','approve')
 and exists(select 1 from public.memberships current_actor where current_actor.tenant_id=p_tenant and current_actor.user_id=auth.uid() and current_actor.status='active' and current_actor.role in ('owner','analyst','operator','viewer'))
 and exists(select 1 from public.memberships contributor where contributor.tenant_id=p_tenant and contributor.user_id=p_actor and contributor.status='active' and contributor.role in ('owner','analyst','operator'))
$$;
revoke all on function public.causality_contributor_active(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.causality_contributor_active(uuid,uuid) to vexa_backend;
create function public.causality_append_guard() returns trigger language plpgsql set search_path='' as $$
declare ref uuid; support_found boolean:=false; item public.problem_operational_evidence;
begin
 if tg_op<>'INSERT' then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':causality:'||new.problem_id::text,0));
 if tg_table_name='problem_operational_evidence' then
  if new.version<>coalesce((select max(version) from public.problem_operational_evidence where tenant_id=new.tenant_id and problem_id=new.problem_id and record_id=new.record_id),0)+1 or new.observed_at>clock_timestamp() then raise check_violation;end if;
 else
  if new.version<>coalesce((select max(version) from public.problem_causal_versions where tenant_id=new.tenant_id and problem_id=new.problem_id),0)+1 then raise serialization_failure;end if;
  foreach ref in array new.evidence_ids loop
   select e.* into item from public.problem_operational_evidence e where e.tenant_id=new.tenant_id and e.problem_id=new.problem_id and e.id=ref and public.causality_contributor_active(e.tenant_id,e.actor_id) and e.status='active' and e.version=(select max(x.version) from public.problem_operational_evidence x where x.tenant_id=e.tenant_id and x.problem_id=e.problem_id and x.record_id=e.record_id);
   if not found then raise check_violation;end if;
   if item.stance='supports' then support_found:=true;end if;
  end loop;
  if new.state='confirmed' and not support_found then raise check_violation;end if;
 end if;
 return new;
end $$;
revoke all on function public.causality_append_guard() from public,anon,authenticated,service_role;
create trigger evidence_append_guard before insert or update or delete on public.problem_operational_evidence for each row execute function public.causality_append_guard();
create trigger causal_append_guard before insert or update or delete on public.problem_causal_versions for each row execute function public.causality_append_guard();
commit;
