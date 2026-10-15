begin;
do $guard$
begin
 if not exists(select 1 from pg_catalog.pg_proc where oid=pg_catalog.to_regprocedure('public.extraction_metadata_claim(jsonb)') and pg_catalog.md5(prosrc)='54406645995466450259222e85a4d02f' and prosecdef) then raise exception 'METADATA_LEAD_SOURCE_MISMATCH';end if;
 if not exists(select 1 from pg_catalog.pg_proc where oid=pg_catalog.to_regprocedure('public.reserve_worker_scope(text)') and pg_catalog.md5(prosrc)='38260a4f3fc6213f6c1850cbf05c09cf' and prosecdef) then raise exception 'METADATA_LEAD_SOURCE_MISMATCH';end if;
end
$guard$;
create or replace function public.extraction_metadata_claim(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare t uuid=public.metadata_authorize(p,'materialize');s public.extraction_metadata_scopes;begin
 if (select count(*) from jsonb_object_keys(p))<>2 or not(p ?& array['tenantId','templateHash']) then raise check_violation;end if;
 select * into s from public.extraction_metadata_scopes m where m.tenant_id=t and m.template_hash=p->>'templateHash' and m.enabled and m.next_attempt_at<=clock_timestamp() and (m.lease_expires_at is null or m.lease_expires_at<=clock_timestamp()) and (m.state='blocked' or m.head_snapshot_hash is null or exists(select 1 from public.extraction_metadata_snapshots b where b.tenant_id=m.tenant_id and b.template_hash=m.template_hash and b.snapshot_hash=m.head_snapshot_hash and b.expires_at<=clock_timestamp()+interval '20 minutes')) for update skip locked;
 if not found then return null;end if;
 update public.extraction_metadata_scopes set lease_token=gen_random_uuid(),lease_actor_id=auth.uid(),lease_expires_at=clock_timestamp()+interval '30 seconds',last_attempt_at=clock_timestamp(),next_attempt_at=clock_timestamp()+interval '15 minutes' where tenant_id=t and template_hash=s.template_hash returning * into s;
 return public.metadata_scope_view(s)||jsonb_build_object('leaseToken',s.lease_token,'leaseExpiresAt',s.lease_expires_at);
end $$;
create or replace function public.reserve_worker_scope(p_consumer text) returns uuid
language plpgsql security definer set search_path='' as $$
declare chosen uuid;
begin
 if auth.uid() is null or current_setting('vexa.action',true) is distinct from 'worker_dispatch' then
  raise insufficient_privilege using message='worker identity required';
 end if;
 if p_consumer is null or p_consumer not in ('imports','crm','extraction','problems','notifications','metadata') then
  raise invalid_parameter_value using message='worker consumer invalid';
 end if;
 if p_consumer='metadata' then
  select m.tenant_id into chosen from public.extraction_metadata_scopes m
  join public.worker_delegations d on d.tenant_id=m.tenant_id and d.user_id=auth.uid()
  join public.memberships member on member.tenant_id=d.tenant_id and member.user_id=d.user_id
  where d.enabled and member.status='active' and member.role='analyst' and m.enabled and m.next_attempt_at<=clock_timestamp()
   and (m.lease_expires_at is null or m.lease_expires_at<=clock_timestamp())
   and (m.state='blocked' or m.head_snapshot_hash is null or exists(select 1 from public.extraction_metadata_snapshots b where b.tenant_id=m.tenant_id and b.template_hash=m.template_hash and b.snapshot_hash=m.head_snapshot_hash and b.expires_at<=clock_timestamp()+interval '20 minutes'))
  order by m.next_attempt_at,m.tenant_id limit 1 for update of m skip locked;
  return chosen;
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
