begin;
-- Each hosted consumer must rotate independently even when their cron ticks interleave.
-- Preserve last_dispatched_at and the no-argument RPC for existing import callers.
alter table public.worker_delegations add column crm_last_dispatched_at timestamptz;
alter table public.worker_delegations add column extraction_last_dispatched_at timestamptz;
create function public.reserve_worker_scope(p_consumer text) returns uuid
language plpgsql security definer set search_path='' as $$
declare chosen uuid;
begin
 if auth.uid() is null or current_setting('vexa.action',true) is distinct from 'worker_dispatch' then
  raise insufficient_privilege using message='worker identity required';
 end if;
 if p_consumer is null or p_consumer not in ('imports','crm','extraction') then
  raise invalid_parameter_value using message='worker consumer invalid';
 end if;
 if p_consumer='imports' then return public.reserve_worker_scope(); end if;
 select d.tenant_id into chosen from public.worker_delegations d
 join public.memberships m on m.tenant_id=d.tenant_id and m.user_id=d.user_id
 where d.user_id=auth.uid() and d.enabled and m.status='active' and m.role='analyst'
 order by case p_consumer when 'crm' then d.crm_last_dispatched_at else d.extraction_last_dispatched_at end nulls first,
  d.tenant_id limit 1 for update of d skip locked;
 if chosen is not null then
  update public.worker_delegations set
   crm_last_dispatched_at=case when p_consumer='crm' then clock_timestamp() else crm_last_dispatched_at end,
   extraction_last_dispatched_at=case when p_consumer='extraction' then clock_timestamp() else extraction_last_dispatched_at end
   where tenant_id=chosen and user_id=auth.uid();
 end if;
 return chosen;
end $$;
revoke all on function public.reserve_worker_scope(text) from public,anon,authenticated,service_role;
grant execute on function public.reserve_worker_scope(text) to vexa_backend;
commit;
