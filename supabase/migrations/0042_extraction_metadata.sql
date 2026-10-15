begin;
create table public.extraction_metadata_scopes(
 tenant_id uuid not null references public.organizations(id),template_hash text not null check(template_hash~'^[a-f0-9]{64}$'),
 runtime_code_hash text not null check(runtime_code_hash~'^[a-f0-9]{64}$'),normalizer_version text not null check(normalizer_version='extraction-metadata-v1'),normalizer_code_hash text not null check(normalizer_code_hash~'^[a-f0-9]{64}$'),
 enabled boolean not null default false,state text not null check(state in('pending','ready','blocked','disabled')),
 eligibility_version bigint not null default 1 check(eligibility_version>0),head_snapshot_hash text,
 lease_token uuid,lease_actor_id uuid,lease_expires_at timestamptz,last_attempt_at timestamptz,next_attempt_at timestamptz not null default '-infinity',
 reason_code text,receipts jsonb not null default '[]' check(octet_length(receipts::text)<=8192),
 primary key(tenant_id,template_hash),check((lease_token is null)=(lease_actor_id is null)),check((lease_token is null)=(lease_expires_at is null))
);
create unique index extraction_metadata_one_enabled on public.extraction_metadata_scopes(tenant_id) where enabled;
create table public.extraction_metadata_snapshots(
 tenant_id uuid not null,template_hash text not null,snapshot_hash text not null check(snapshot_hash~'^[a-f0-9]{64}$'),effective_config_hash text not null check(effective_config_hash~'^[a-f0-9]{64}$'),
 observed_at timestamptz not null,expires_at timestamptz not null,batch jsonb not null check(octet_length(batch::text)<=98304),
 primary key(tenant_id,template_hash,snapshot_hash),unique(tenant_id,template_hash,effective_config_hash),foreign key(tenant_id,template_hash) references public.extraction_metadata_scopes(tenant_id,template_hash),check(expires_at=observed_at+interval '1 hour')
);
alter table public.extraction_metadata_scopes add foreign key(tenant_id,template_hash,head_snapshot_hash) references public.extraction_metadata_snapshots(tenant_id,template_hash,snapshot_hash);
alter table public.extraction_metadata_scopes enable row level security;alter table public.extraction_metadata_scopes force row level security;
alter table public.extraction_metadata_snapshots enable row level security;alter table public.extraction_metadata_snapshots force row level security;
revoke all on public.extraction_metadata_scopes,public.extraction_metadata_snapshots from public,anon,authenticated,service_role,vexa_backend;
-- Helpers are private to definer RPCs; no direct execute grant.
create function public.metadata_worker(t uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.vexa_member(t,array['analyst']) is true and exists(select 1 from public.worker_delegations where tenant_id=t and user_id=auth.uid() and enabled)
$$;
create function public.metadata_scope_view(s public.extraction_metadata_scopes) returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('tenantId',s.tenant_id,'templateHash',s.template_hash,'runtimeCodeHash',s.runtime_code_hash,'normalizerVersion',s.normalizer_version,'normalizerCodeHash',s.normalizer_code_hash,'enabled',s.enabled,'state',s.state,'eligibilityVersion',s.eligibility_version,'headSnapshotHash',s.head_snapshot_hash)$$;
create function public.metadata_authorize(p jsonb,a text) returns uuid language plpgsql stable security definer set search_path='' as $$declare t uuid=nullif(current_setting('vexa.tenant_id',true),'')::uuid;begin
 if t is null or t is distinct from (p->>'tenantId')::uuid or current_setting('vexa.action',true) is distinct from a or (case when a='configure' then public.vexa_member(t,array['owner']) when a='materialize' then public.metadata_worker(t) else public.vexa_member(t,array['owner','analyst']) end) is not true then raise insufficient_privilege;end if;
 return t;
end $$;
create function public.extraction_metadata_configure(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare t uuid=public.metadata_authorize(p,'configure');s public.extraction_metadata_scopes;begin
 if jsonb_typeof(p) is distinct from 'object' or (select count(*) from jsonb_object_keys(p))<>6 or not(p ?& array['tenantId','templateHash','runtimeCodeHash','normalizerVersion','normalizerCodeHash','enabled']) or jsonb_typeof(p->'enabled') is distinct from 'boolean' or coalesce(p->>'templateHash','')!~'^[a-f0-9]{64}$' or coalesce(p->>'runtimeCodeHash','')!~'^[a-f0-9]{64}$' or coalesce(p->>'normalizerCodeHash','')!~'^[a-f0-9]{64}$' or p->>'normalizerVersion' is distinct from 'extraction-metadata-v1' then raise check_violation;end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text||':candidate-selection',0));
 if (p->>'enabled')::boolean and (select candidate_id from public.candidate_selections where tenant_id=t order by version desc limit 1) is not null then raise check_violation;end if;
 update public.extraction_metadata_scopes set enabled=false,state='disabled',eligibility_version=eligibility_version+1,lease_token=null,lease_actor_id=null,lease_expires_at=null where tenant_id=t and enabled;
 insert into public.extraction_metadata_scopes(tenant_id,template_hash,runtime_code_hash,normalizer_version,normalizer_code_hash,enabled,state) values(t,p->>'templateHash',p->>'runtimeCodeHash',p->>'normalizerVersion',p->>'normalizerCodeHash',(p->>'enabled')::boolean,case when (p->>'enabled')::boolean then 'pending' else 'disabled' end)
 on conflict(tenant_id,template_hash) do update set runtime_code_hash=excluded.runtime_code_hash,normalizer_version=excluded.normalizer_version,normalizer_code_hash=excluded.normalizer_code_hash,enabled=excluded.enabled,state=excluded.state,head_snapshot_hash=null,eligibility_version=public.extraction_metadata_scopes.eligibility_version+1,lease_token=null,lease_actor_id=null,lease_expires_at=null,next_attempt_at='-infinity';
 select * into s from public.extraction_metadata_scopes where tenant_id=t and template_hash=p->>'templateHash';return public.metadata_scope_view(s);
end $$;
create function public.metadata_candidate_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':candidate-selection',0));
 if exists(select 1 from public.extraction_metadata_scopes where tenant_id=new.tenant_id and enabled) then raise check_violation;end if;return new;
end $$;
create trigger metadata_candidate_selection before insert on public.candidate_selections for each row execute function public.metadata_candidate_guard();
create function public.extraction_metadata_claim(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare t uuid=public.metadata_authorize(p,'materialize');s public.extraction_metadata_scopes;begin
 if (select count(*) from jsonb_object_keys(p))<>2 or not(p ?& array['tenantId','templateHash']) then raise check_violation;end if;
 select * into s from public.extraction_metadata_scopes m where m.tenant_id=t and m.template_hash=p->>'templateHash' and m.enabled and m.next_attempt_at<=clock_timestamp() and (m.lease_expires_at is null or m.lease_expires_at<=clock_timestamp()) and (m.state='blocked' or m.head_snapshot_hash is null or exists(select 1 from public.extraction_metadata_snapshots b where b.tenant_id=m.tenant_id and b.template_hash=m.template_hash and b.snapshot_hash=m.head_snapshot_hash and b.expires_at<=clock_timestamp()+interval '15 minutes')) for update skip locked;
 if not found then return null;end if;
 update public.extraction_metadata_scopes set lease_token=gen_random_uuid(),lease_actor_id=auth.uid(),lease_expires_at=clock_timestamp()+interval '30 seconds',last_attempt_at=clock_timestamp(),next_attempt_at=clock_timestamp()+interval '15 minutes' where tenant_id=t and template_hash=s.template_hash returning * into s;
 return public.metadata_scope_view(s)||jsonb_build_object('leaseToken',s.lease_token,'leaseExpiresAt',s.lease_expires_at);
end $$;
create function public.extraction_metadata_publish(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare t uuid=public.metadata_authorize(p,'materialize');s public.extraction_metadata_scopes;b jsonb=p->'batch';observed timestamptz;expires timestamptz;begin
 if (select count(*) from jsonb_object_keys(p))<>4 or not(p ?& array['tenantId','templateHash','leaseToken','batch']) then raise check_violation;end if;
 select * into s from public.extraction_metadata_scopes where tenant_id=t and template_hash=p->>'templateHash' for update;
 if s.enabled is not true or s.lease_token is distinct from (p->>'leaseToken')::uuid or s.lease_actor_id is distinct from auth.uid() or s.lease_expires_at<=clock_timestamp() then raise serialization_failure;end if;
 if jsonb_typeof(b) is distinct from 'object' or octet_length(b::text)>98304 or (select count(*) from jsonb_object_keys(b))<>10 or not(b ?& array['templateHash','runtimeCodeHash','normalizerVersion','normalizerCodeHash','snapshotHash','effectiveConfigHash','observationStartedAt','expiresAt','projection','receipts']) or b->>'templateHash' is distinct from s.template_hash or b->>'runtimeCodeHash' is distinct from s.runtime_code_hash or b->>'normalizerVersion' is distinct from s.normalizer_version or b->>'normalizerCodeHash' is distinct from s.normalizer_code_hash or coalesce(b->>'snapshotHash','')!~'^[a-f0-9]{64}$' or coalesce(b->>'effectiveConfigHash','')!~'^[a-f0-9]{64}$' or jsonb_typeof(b->'projection') is distinct from 'object' or octet_length((b->'projection')::text)>65536 or jsonb_typeof(b->'receipts') is distinct from 'array' or jsonb_array_length(b->'receipts')<>4 or octet_length((b->'receipts')::text)>8192 then raise check_violation;end if;
 observed=(b->>'observationStartedAt')::timestamptz;expires=(b->>'expiresAt')::timestamptz;if observed>clock_timestamp() or expires is distinct from observed+interval '1 hour' or expires<=clock_timestamp() then raise check_violation;end if;
 insert into public.extraction_metadata_snapshots(tenant_id,template_hash,snapshot_hash,effective_config_hash,observed_at,expires_at,batch) values(t,s.template_hash,b->>'snapshotHash',b->>'effectiveConfigHash',observed,expires,b) on conflict do nothing;
 if not exists(select 1 from public.extraction_metadata_snapshots where tenant_id=t and template_hash=s.template_hash and snapshot_hash=b->>'snapshotHash' and batch=b) then raise check_violation;end if;
 if public.metadata_worker(t) is not true or s.lease_expires_at<=clock_timestamp() then raise insufficient_privilege;end if;
 update public.extraction_metadata_scopes set state='ready',head_snapshot_hash=b->>'snapshotHash',eligibility_version=eligibility_version+1,lease_token=null,lease_actor_id=null,lease_expires_at=null,reason_code=null,receipts='[]' where tenant_id=t and template_hash=s.template_hash returning * into s;
 return jsonb_build_object('snapshotHash',s.head_snapshot_hash,'effectiveConfigHash',b->>'effectiveConfigHash','eligibilityVersion',s.eligibility_version);
end $$;
create function public.extraction_metadata_fail(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare t uuid=public.metadata_authorize(p,'materialize');s public.extraction_metadata_scopes;f jsonb=p->'failure';begin
 if (select count(*) from jsonb_object_keys(p))<>4 or not(p ?& array['tenantId','templateHash','leaseToken','failure']) or jsonb_typeof(f) is distinct from 'object' or (select count(*) from jsonb_object_keys(f))<>3 or not(f ?& array['kind','reasonCode','receipts']) or coalesce(f->>'kind','') not in('blocked','incomplete') or coalesce(f->>'reasonCode','') not in('transport','timeout','response_limit','parse','observation_invalid','model_unavailable','endpoint_unavailable','zdr_unavailable','capabilities_incompatible','pricing_incompatible','snapshot_invalid') or jsonb_typeof(f->'receipts') is distinct from 'array' or jsonb_array_length(f->'receipts')>4 or octet_length((f->'receipts')::text)>8192 or (f->>'kind'='blocked' and jsonb_array_length(f->'receipts')<>4) then raise check_violation;end if;
 select * into s from public.extraction_metadata_scopes where tenant_id=t and template_hash=p->>'templateHash' for update;
 if s.enabled is not true or s.lease_token is distinct from (p->>'leaseToken')::uuid or s.lease_actor_id is distinct from auth.uid() or s.lease_expires_at<=clock_timestamp() then raise serialization_failure;end if;
 update public.extraction_metadata_scopes set state=case when f->>'kind'='blocked' then 'blocked' else state end,eligibility_version=eligibility_version+case when f->>'kind'='blocked' then 1 else 0 end,lease_token=null,lease_actor_id=null,lease_expires_at=null,reason_code=f->>'reasonCode',receipts=f->'receipts' where tenant_id=t and template_hash=s.template_hash returning * into s;return public.metadata_scope_view(s);
end $$;
create function public.extraction_metadata_read(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare t uuid=public.metadata_authorize(p,'read');s public.extraction_metadata_scopes;b jsonb;result jsonb;begin
 if (select count(*) from jsonb_object_keys(p))<>3 or not(p ?& array['tenantId','templateHash','configHash']) then raise check_violation;end if;
 select * into s from public.extraction_metadata_scopes where tenant_id=t and template_hash=p->>'templateHash';if not found then return null;end if;
 select batch into b from public.extraction_metadata_snapshots where tenant_id=t and template_hash=s.template_hash and (case when p->>'configHash' is null then snapshot_hash=s.head_snapshot_hash else effective_config_hash=p->>'configHash' end);
 result=jsonb_build_object('scope',public.metadata_scope_view(s),'snapshot',b);if octet_length(result::text)>131072 then raise check_violation;end if;return result;
end $$;
create function public.extraction_metadata_admit(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare t uuid=public.metadata_authorize(p,'read');s public.extraction_metadata_scopes;old public.extraction_metadata_snapshots;head public.extraction_metadata_snapshots;begin
 if public.metadata_worker(t) is not true then raise insufficient_privilege;end if;
 if (select count(*) from jsonb_object_keys(p))<>5 or not(p ?& array['tenantId','templateHash','configHash','model','provider']) or coalesce(p->>'model','') not in('anthropic/claude-haiku-5.5','anthropic/claude-sonnet-5.5') or p->>'provider' is distinct from 'google-vertex/global' then raise check_violation;end if;
 select * into s from public.extraction_metadata_scopes where tenant_id=t and template_hash=p->>'templateHash';
 if s.enabled is not true or s.state<>'ready' then raise check_violation;end if;
 select * into old from public.extraction_metadata_snapshots where tenant_id=t and template_hash=s.template_hash and effective_config_hash=p->>'configHash';select * into head from public.extraction_metadata_snapshots where tenant_id=t and template_hash=s.template_hash and snapshot_hash=s.head_snapshot_hash;
 if old.snapshot_hash is null or head.snapshot_hash is null or old.expires_at<=clock_timestamp() or head.expires_at<=clock_timestamp() then raise check_violation;end if;
 return jsonb_build_object('configHash',old.effective_config_hash,'model',p->>'model','provider',p->>'provider','eligibilityVersion',s.eligibility_version,'headSnapshotHash',head.snapshot_hash,'expiresAt',least(old.expires_at,head.expires_at));
end $$;
revoke all on function public.metadata_worker(uuid),public.metadata_scope_view(public.extraction_metadata_scopes),public.metadata_authorize(jsonb,text),public.metadata_candidate_guard() from public,anon,authenticated,service_role,vexa_backend;
revoke all on function public.extraction_metadata_configure(jsonb),public.extraction_metadata_claim(jsonb),public.extraction_metadata_publish(jsonb),public.extraction_metadata_fail(jsonb),public.extraction_metadata_read(jsonb),public.extraction_metadata_admit(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.extraction_metadata_configure(jsonb),public.extraction_metadata_claim(jsonb),public.extraction_metadata_publish(jsonb),public.extraction_metadata_fail(jsonb),public.extraction_metadata_read(jsonb),public.extraction_metadata_admit(jsonb) to vexa_backend;
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
   and (m.state='blocked' or m.head_snapshot_hash is null or exists(select 1 from public.extraction_metadata_snapshots b where b.tenant_id=m.tenant_id and b.template_hash=m.template_hash and b.snapshot_hash=m.head_snapshot_hash and b.expires_at<=clock_timestamp()+interval '15 minutes'))
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
