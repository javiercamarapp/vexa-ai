begin;
-- Intake revisions are separate from historical economic_events: that table has
-- unsigned amounts/observed statuses and reversals FK cannot retain orphan intake.
-- No historical constraints or RLS policies are loosened.
create table public.economic_source_versions(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,source_id uuid not null,version integer not null check(version>0),actor_id uuid not null,created_at timestamptz not null default clock_timestamp(),
 name text not null check(length(name) between 1 and 200),evidence_type text not null check(evidence_type in ('order_export','payment_ledger','replacement_invoice','support_timesheet','scenario_assumption')),
 active boolean not null,complete boolean not null,window_start timestamptz not null,window_end timestamptz not null,watermark timestamptz not null,report text not null check(length(report) between 20 and 8000),report_hash text not null check(report_hash ~ '^[a-f0-9]{64}$'),attested boolean not null check(attested),
 unique(tenant_id,id),unique(tenant_id,source_id,version),check(window_end>window_start),foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id)
);
create table public.economic_ledger_entries(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,entity_id uuid not null,source_id uuid not null,source_version integer not null,revision integer not null check(revision>0),actor_id uuid not null,recorded_at timestamptz not null default clock_timestamp(),
 external_id text not null check(length(external_id) between 1 and 200),kind text not null check(kind in ('order','refund','reversal','replacement','support_model','future_scenario')),effective_at timestamptz not null,
 currency text not null check(currency ~ '^[A-Z]{3}$'),exponent smallint not null check(exponent between 0 and 4),basis text not null check(length(basis) between 1 and 200),amount_minor numeric check(amount_minor=trunc(amount_minor) and abs(amount_minor)<1e37),status text not null check(status in ('recorded','settled','pending','cancelled','unknown','modeled')),
 order_id uuid,reversal_of uuid,details jsonb not null check(jsonb_typeof(details)='object'),report text not null check(length(report) between 20 and 8000),report_hash text not null check(report_hash ~ '^[a-f0-9]{64}$'),attested boolean not null check(attested),
 unique(tenant_id,id),unique(tenant_id,entity_id,revision),unique(tenant_id,source_id,kind,external_id,revision),
 foreign key(tenant_id,source_id,source_version) references public.economic_source_versions(tenant_id,source_id,version),foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id),
 check(amount_minor is null or (kind='reversal' and amount_minor<=0) or (kind<>'reversal' and amount_minor>=0)),check((kind='reversal')=(reversal_of is not null)),
 check((kind='order' and status in ('recorded','pending','cancelled','unknown')) or (kind in ('refund','reversal','replacement') and status in ('settled','pending','cancelled','unknown')) or (kind in ('support_model','future_scenario') and status='modeled' and amount_minor is null))
);
alter table public.economic_source_versions enable row level security;alter table public.economic_source_versions force row level security;
alter table public.economic_ledger_entries enable row level security;alter table public.economic_ledger_entries force row level security;
revoke all on public.economic_source_versions,public.economic_ledger_entries from public,anon,authenticated,service_role,vexa_backend;
grant select,insert on public.economic_source_versions,public.economic_ledger_entries to vexa_backend;
create policy economic_sources_read on public.economic_source_versions for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create policy economic_sources_insert on public.economic_source_versions for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and actor_id=auth.uid() and public.vexa_backend_action(tenant_id,array['configure']) and public.vexa_member(tenant_id,array['owner']));
create policy economic_ledger_read on public.economic_ledger_entries for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create policy economic_ledger_insert on public.economic_ledger_entries for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and actor_id=auth.uid() and public.vexa_backend_action(tenant_id,array['configure']) and public.vexa_member(tenant_id,array['owner']));
create function public.economic_append_guard() returns trigger language plpgsql set search_path='' as $$
declare source public.economic_source_versions; prior public.economic_ledger_entries;
begin
 if tg_op<>'INSERT' then raise insufficient_privilege;end if;
 if new.tenant_id is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or new.actor_id is distinct from auth.uid() or not public.vexa_backend_action(new.tenant_id,array['configure']) or not public.vexa_member(new.tenant_id,array['owner']) then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':economic-ledger',0));
 if tg_table_name='economic_source_versions' then
  if new.version<>coalesce((select max(version) from public.economic_source_versions where tenant_id=new.tenant_id and source_id=new.source_id),0)+1 then raise serialization_failure;end if;
  if new.watermark>clock_timestamp() then raise check_violation;end if;
  if exists(select 1 from public.economic_source_versions previous_source where previous_source.tenant_id=new.tenant_id and previous_source.source_id=new.source_id and previous_source.evidence_type<>new.evidence_type) then raise check_violation;end if;
 else
  select * into source from public.economic_source_versions where tenant_id=new.tenant_id and source_id=new.source_id order by version desc limit 1;
  if not found or not source.active or source.version<>new.source_version then raise check_violation;end if;
  if source.evidence_type<>(case new.kind when 'order' then 'order_export' when 'refund' then 'payment_ledger' when 'reversal' then 'payment_ledger' when 'replacement' then 'replacement_invoice' when 'support_model' then 'support_timesheet' else 'scenario_assumption' end) then raise check_violation;end if;
  select * into prior from public.economic_ledger_entries where tenant_id=new.tenant_id and entity_id=new.entity_id order by revision desc limit 1;
  if new.revision<>coalesce(prior.revision,0)+1 then raise serialization_failure;end if;
  if prior.id is not null and (prior.source_id<>new.source_id or prior.kind<>new.kind or prior.external_id<>new.external_id) then raise check_violation;end if;
  if new.effective_at>clock_timestamp() and new.kind<>'future_scenario' then raise check_violation;end if;
 end if;
 return new;
end $$;
revoke all on function public.economic_append_guard() from public,anon,authenticated,service_role;
create trigger economic_source_immutable before insert or update or delete on public.economic_source_versions for each row execute function public.economic_append_guard();
create trigger economic_entry_immutable before insert or update or delete on public.economic_ledger_entries for each row execute function public.economic_append_guard();
commit;
