begin;
create table public.problem_embedding_requests (
 tenant_id uuid not null,job_id uuid primary key,extraction_run_id uuid not null,actor_id uuid not null,request_key uuid not null,config_hash text not null check(config_hash ~ '^[a-f0-9]{64}$'),
 network_started boolean not null default false,unique(tenant_id,job_id),unique(tenant_id,actor_id,request_key),
 foreign key(tenant_id,job_id) references public.jobs(tenant_id,id),foreign key(tenant_id,extraction_run_id) references public.extraction_runs(tenant_id,id),foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id)
);
create table public.problem_embedding_members (
 tenant_id uuid not null,embedding_id uuid not null,problem_id uuid not null,extraction_run_id uuid not null,conversation_id uuid not null,
 primary key(tenant_id,embedding_id),foreign key(tenant_id,embedding_id) references public.embeddings(tenant_id,id),foreign key(tenant_id,problem_id) references public.problems(tenant_id,id),foreign key(tenant_id,extraction_run_id) references public.extraction_runs(tenant_id,id),foreign key(tenant_id,conversation_id) references public.conversations(tenant_id,id)
);
create function public.problem_actor_authorized(p_job uuid) returns boolean language sql security definer set search_path='' as $$
 select current_setting('vexa.action',true)='import' and exists(select 1 from public.problem_embedding_requests r
 join public.jobs j on j.tenant_id=r.tenant_id and j.id=r.job_id
 join public.memberships a on a.tenant_id=r.tenant_id and a.user_id=r.actor_id
 join public.memberships b on b.tenant_id=r.tenant_id and b.user_id=auth.uid()
 join public.worker_delegations d on d.tenant_id=b.tenant_id and d.user_id=b.user_id
 where r.job_id=p_job and r.tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and j.type='embedding' and j.cancel_requested_at is null
 and a.status='active' and a.role in ('owner','analyst') and b.status='active' and b.role='analyst' and d.enabled)
$$;
revoke all on function public.problem_actor_authorized(uuid) from public,anon,authenticated,service_role;
grant execute on function public.problem_actor_authorized(uuid) to vexa_backend;
create function public.problem_write_authorized(p_tenant uuid) returns boolean language sql security definer set search_path='' as $$
 select p_tenant=nullif(current_setting('vexa.tenant_id',true),'')::uuid and
 (public.vexa_backend_action(p_tenant,array['configure']) and public.vexa_member(p_tenant,array['owner']) or exists(
 select 1 from public.jobs j where j.tenant_id=p_tenant and j.id=nullif(current_setting('vexa.problem_job_id',true),'')::uuid and j.state='running'
 and j.lease_until>clock_timestamp() and j.fencing_token::text=current_setting('vexa.problem_fence',true) and j.lease_owner=current_setting('vexa.problem_lease_owner',true) and public.problem_actor_authorized(j.id)))
$$;
revoke all on function public.problem_write_authorized(uuid) from public,anon,authenticated,service_role;
grant execute on function public.problem_write_authorized(uuid) to vexa_backend;
alter table public.problem_embedding_requests enable row level security;alter table public.problem_embedding_requests force row level security;
alter table public.problem_embedding_members enable row level security;alter table public.problem_embedding_members force row level security;
revoke all on public.problem_embedding_requests,public.problem_embedding_members from public,anon,authenticated,service_role,vexa_backend;
grant select,insert,update on public.problem_embedding_requests,public.problem_embedding_members to vexa_backend;
create policy requests_read on public.problem_embedding_requests for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create policy requests_insert on public.problem_embedding_requests for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and actor_id=auth.uid() and public.vexa_backend_action(tenant_id,array['import']));
create policy requests_update on public.problem_embedding_requests for update to vexa_backend using(public.problem_write_authorized(tenant_id)) with check(public.problem_write_authorized(tenant_id));
create policy members_read on public.problem_embedding_members for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create policy members_insert on public.problem_embedding_members for insert to vexa_backend with check(public.problem_write_authorized(tenant_id));
create policy members_update on public.problem_embedding_members for update to vexa_backend using(public.problem_write_authorized(tenant_id)) with check(public.problem_write_authorized(tenant_id));
create function public.problem_request_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (to_jsonb(new)-'network_started') is distinct from (to_jsonb(old)-'network_started') then raise insufficient_privilege;end if;
 if tg_op='UPDATE' and old.network_started and not new.network_started then raise insufficient_privilege;end if;
 if tg_op='INSERT' and (new.network_started or not exists(select 1 from public.jobs j where j.tenant_id=new.tenant_id and j.id=new.job_id and j.type='embedding' and j.state='queued')) then raise check_violation;end if;
 return new;
end $$;
create trigger problem_request_guard before insert or update on public.problem_embedding_requests for each row execute function public.problem_request_guard();
-- Generated vector snapshots are immutable; legacy records keep their previous contract.
create function public.problem_snapshot_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op<>'INSERT' and old.provenance->>'kind'='vector-problem-v1' then raise insufficient_privilege;end if;
 if tg_op='INSERT' and new.provenance->>'kind'='vector-problem-v1' then
  if not public.problem_write_authorized(new.tenant_id) then raise insufficient_privilege;end if;
  perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':vector-problems',0));
  if new.version<>coalesce((select max(version) from public.problem_versions where tenant_id=new.tenant_id and problem_id=new.problem_id),0)+1 then raise serialization_failure;end if;
 end if;if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger problem_snapshot_guard before insert or update or delete on public.problem_versions for each row execute function public.problem_snapshot_guard();
alter policy backend_insert_capability on public.problems with check (public.vexa_backend_action(tenant_id,array['import']) or (public.vexa_backend_action(tenant_id,array['configure']) and public.vexa_member(tenant_id,array['owner'])));
alter policy backend_update_capability on public.problems using (public.vexa_backend_action(tenant_id,array['import']) or (public.vexa_backend_action(tenant_id,array['configure']) and public.vexa_member(tenant_id,array['owner']))) with check (public.vexa_backend_action(tenant_id,array['import']) or (public.vexa_backend_action(tenant_id,array['configure']) and public.vexa_member(tenant_id,array['owner'])));
alter policy backend_insert_capability on public.problem_versions with check (public.vexa_backend_action(tenant_id,array['import']) or (public.vexa_backend_action(tenant_id,array['configure']) and public.vexa_member(tenant_id,array['owner'])));
alter policy backend_update_capability on public.problem_versions using (public.vexa_backend_action(tenant_id,array['import']) or (public.vexa_backend_action(tenant_id,array['configure']) and public.vexa_member(tenant_id,array['owner']))) with check (public.vexa_backend_action(tenant_id,array['import']) or (public.vexa_backend_action(tenant_id,array['configure']) and public.vexa_member(tenant_id,array['owner'])));
alter table public.worker_delegations add column problems_last_dispatched_at timestamptz;
create or replace function public.reserve_worker_scope(p_consumer text) returns uuid
language plpgsql security definer set search_path='' as $$
declare chosen uuid;
begin
 if auth.uid() is null or current_setting('vexa.action',true) is distinct from 'worker_dispatch' then
  raise insufficient_privilege using message='worker identity required';
 end if;
 if p_consumer is null or p_consumer not in ('imports','crm','extraction','problems') then
  raise invalid_parameter_value using message='worker consumer invalid';
 end if;
 if p_consumer='imports' then return public.reserve_worker_scope(); end if;
 select d.tenant_id into chosen from public.worker_delegations d
 join public.memberships m on m.tenant_id=d.tenant_id and m.user_id=d.user_id
 where d.user_id=auth.uid() and d.enabled and m.status='active' and m.role='analyst'
 order by case p_consumer when 'crm' then d.crm_last_dispatched_at when 'extraction' then d.extraction_last_dispatched_at else d.problems_last_dispatched_at end nulls first,
  d.tenant_id limit 1 for update of d skip locked;
 if chosen is not null then
  update public.worker_delegations set
   problems_last_dispatched_at=case when p_consumer='problems' then clock_timestamp() else problems_last_dispatched_at end,
   crm_last_dispatched_at=case when p_consumer='crm' then clock_timestamp() else crm_last_dispatched_at end,
   extraction_last_dispatched_at=case when p_consumer='extraction' then clock_timestamp() else extraction_last_dispatched_at end
   where tenant_id=chosen and user_id=auth.uid();
 end if;
 return chosen;
end $$;
revoke all on function public.problem_request_guard(),public.problem_snapshot_guard() from public,anon,authenticated,service_role;
commit;
