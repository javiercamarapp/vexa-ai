begin;
-- Confirmed manual identity and relations. Legacy orders/CRM UUIDs are not interchangeable.
create table public.economic_problem_links(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,version integer not null check(version>0),actor_id uuid not null,report text not null check(length(report) between 20 and 4000),attested boolean not null check(attested),created_at timestamptz not null default clock_timestamp(),unique(tenant_id,id),foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id),problem_id uuid not null,entity_id uuid not null,ledger_row_id uuid not null,active boolean not null,unique(tenant_id,problem_id,entity_id,version),foreign key(tenant_id,problem_id) references public.problems(tenant_id,id),foreign key(tenant_id,ledger_row_id) references public.economic_ledger_entries(tenant_id,id));
create table public.economic_order_aliases(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,version integer not null check(version>0),actor_id uuid not null,report text not null check(length(report) between 20 and 4000),attested boolean not null check(attested),created_at timestamptz not null default clock_timestamp(),unique(tenant_id,id),foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id),alias_entity_id uuid not null,canonical_entity_id uuid not null,alias_row_id uuid not null,canonical_row_id uuid not null,active boolean not null,check(alias_entity_id<>canonical_entity_id),unique(tenant_id,alias_entity_id,version),foreign key(tenant_id,alias_row_id) references public.economic_ledger_entries(tenant_id,id),foreign key(tenant_id,canonical_row_id) references public.economic_ledger_entries(tenant_id,id));
create table public.economic_order_customers(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,version integer not null check(version>0),actor_id uuid not null,report text not null check(length(report) between 20 and 4000),attested boolean not null check(attested),created_at timestamptz not null default clock_timestamp(),unique(tenant_id,id),foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id),entity_id uuid not null,order_row_id uuid not null,customer_key text check(customer_key is null or length(btrim(customer_key)) between 1 and 200),unique(tenant_id,entity_id,version),foreign key(tenant_id,order_row_id) references public.economic_ledger_entries(tenant_id,id));
create table public.economic_relation_coverage(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,version integer not null check(version>0),actor_id uuid not null,report text not null check(length(report) between 20 and 4000),attested boolean not null check(attested),created_at timestamptz not null default clock_timestamp(),unique(tenant_id,id),foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id),scope_key text not null check(scope_key ~ '^[a-f0-9]{64}$'),input_hash text not null check(input_hash ~ '^[a-f0-9]{64}$'),scope jsonb not null check(jsonb_typeof(scope)='object'),complete boolean not null,unique(tenant_id,scope_key,version));
alter table public.economic_problem_links enable row level security;alter table public.economic_problem_links force row level security;revoke all on public.economic_problem_links from public,anon,authenticated,service_role,vexa_backend;grant select,insert on public.economic_problem_links to vexa_backend;
create policy economic_problem_links_read on public.economic_problem_links for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create policy economic_problem_links_write on public.economic_problem_links for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and actor_id=auth.uid() and public.vexa_backend_action(tenant_id,array['configure']) and public.vexa_member(tenant_id,array['owner']));
alter table public.economic_order_aliases enable row level security;alter table public.economic_order_aliases force row level security;revoke all on public.economic_order_aliases from public,anon,authenticated,service_role,vexa_backend;grant select,insert on public.economic_order_aliases to vexa_backend;
create policy economic_order_aliases_read on public.economic_order_aliases for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create policy economic_order_aliases_write on public.economic_order_aliases for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and actor_id=auth.uid() and public.vexa_backend_action(tenant_id,array['configure']) and public.vexa_member(tenant_id,array['owner']));
alter table public.economic_order_customers enable row level security;alter table public.economic_order_customers force row level security;revoke all on public.economic_order_customers from public,anon,authenticated,service_role,vexa_backend;grant select,insert on public.economic_order_customers to vexa_backend;
create policy economic_order_customers_read on public.economic_order_customers for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create policy economic_order_customers_write on public.economic_order_customers for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and actor_id=auth.uid() and public.vexa_backend_action(tenant_id,array['configure']) and public.vexa_member(tenant_id,array['owner']));
alter table public.economic_relation_coverage enable row level security;alter table public.economic_relation_coverage force row level security;revoke all on public.economic_relation_coverage from public,anon,authenticated,service_role,vexa_backend;grant select,insert on public.economic_relation_coverage to vexa_backend;
create policy economic_relation_coverage_read on public.economic_relation_coverage for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create policy economic_relation_coverage_write on public.economic_relation_coverage for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and actor_id=auth.uid() and public.vexa_backend_action(tenant_id,array['configure']) and public.vexa_member(tenant_id,array['owner']));
-- A boolean scoped lookup avoids opening the membership self-RLS policy.
create function public.economic_contributor_active(p_tenant uuid,p_actor uuid) returns boolean language sql stable security definer set search_path='' as $$
 select p_tenant=nullif(current_setting('vexa.tenant_id',true),'')::uuid and current_setting('vexa.action',true) in ('read','configure')
 and exists(select 1 from public.memberships caller where caller.tenant_id=p_tenant and caller.user_id=auth.uid() and caller.status='active' and caller.role in ('owner','analyst','operator','viewer'))
 and exists(select 1 from public.memberships contributor where contributor.tenant_id=p_tenant and contributor.user_id=p_actor and contributor.status='active' and contributor.role='owner')
$$;
revoke all on function public.economic_contributor_active(uuid,uuid) from public,anon,authenticated,service_role;grant execute on function public.economic_contributor_active(uuid,uuid) to vexa_backend;
create function public.economic_record_current(p_tenant uuid,p_row uuid,p_kinds text[]) returns boolean language sql stable set search_path='' as $$
 select p_tenant=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(p_tenant) and exists(
 select 1 from public.economic_ledger_entries e join public.economic_source_versions src on src.tenant_id=e.tenant_id and src.source_id=e.source_id
 where e.tenant_id=p_tenant and e.id=p_row and e.kind=any(p_kinds) and public.economic_contributor_active(e.tenant_id,e.actor_id)
 and e.revision=(select max(v.revision) from public.economic_ledger_entries v where v.tenant_id=e.tenant_id and v.entity_id=e.entity_id)
 and src.version=(select max(v.version) from public.economic_source_versions v where v.tenant_id=src.tenant_id and v.source_id=src.source_id)
 and src.active and public.economic_contributor_active(src.tenant_id,src.actor_id))
$$;
revoke all on function public.economic_record_current(uuid,uuid,text[]) from public,anon,authenticated,service_role;grant execute on function public.economic_record_current(uuid,uuid,text[]) to vexa_backend;
create function public.economic_link_guard() returns trigger language plpgsql set search_path='' as $$
declare a public.economic_ledger_entries; b public.economic_ledger_entries; previous_version integer;
begin
 if tg_op<>'INSERT' then raise insufficient_privilege;end if;
 if new.tenant_id is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or new.actor_id is distinct from auth.uid() or not public.vexa_backend_action(new.tenant_id,array['configure']) or not public.vexa_member(new.tenant_id,array['owner']) then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':economic-relations',0));
 if tg_table_name='economic_problem_links' then
  select * into a from public.economic_ledger_entries where tenant_id=new.tenant_id and id=new.ledger_row_id;
  if a.id is null or a.entity_id<>new.entity_id or a.kind not in ('order','refund','reversal','replacement','support_model') then raise check_violation;end if;
  if new.active and not public.economic_record_current(new.tenant_id,new.ledger_row_id,array['order','refund','reversal','replacement','support_model']) then raise check_violation;end if;
  if new.active and not exists(select 1 from public.problem_versions p where p.tenant_id=new.tenant_id and p.problem_id=new.problem_id and p.provenance->>'kind'='vector-problem-v1') then raise check_violation;end if;
  select max(version) into previous_version from public.economic_problem_links where tenant_id=new.tenant_id and problem_id=new.problem_id and entity_id=new.entity_id;
 elsif tg_table_name='economic_order_aliases' then
  select * into a from public.economic_ledger_entries where tenant_id=new.tenant_id and id=new.alias_row_id;
  select * into b from public.economic_ledger_entries where tenant_id=new.tenant_id and id=new.canonical_row_id;
  if a.id is null or b.id is null or a.entity_id<>new.alias_entity_id or b.entity_id<>new.canonical_entity_id or a.kind<>'order' or b.kind<>'order' then raise check_violation;end if;
  if new.active then
   if not public.economic_record_current(new.tenant_id,a.id,array['order']) or not public.economic_record_current(new.tenant_id,b.id,array['order']) or (a.currency,a.exponent,a.basis,a.amount_minor,a.status,a.effective_at) is distinct from (b.currency,b.exponent,b.basis,b.amount_minor,b.status,b.effective_at) then raise check_violation;end if;
   if exists(with recursive current_alias as (select distinct on(alias_entity_id) alias_entity_id,canonical_entity_id,active from public.economic_order_aliases where tenant_id=new.tenant_id order by alias_entity_id,version desc), chain(id) as (select new.canonical_entity_id union select x.canonical_entity_id from current_alias x join chain c on x.alias_entity_id=c.id where x.active) select 1 from chain where id=new.alias_entity_id) then raise check_violation;end if;
  end if;
  select max(version) into previous_version from public.economic_order_aliases where tenant_id=new.tenant_id and alias_entity_id=new.alias_entity_id;
 elsif tg_table_name='economic_order_customers' then
  select * into a from public.economic_ledger_entries where tenant_id=new.tenant_id and id=new.order_row_id;
  if a.id is null or a.entity_id<>new.entity_id or a.kind<>'order' then raise check_violation;end if;
  if new.customer_key is not null and not public.economic_record_current(new.tenant_id,new.order_row_id,array['order']) then raise check_violation;end if;
  select max(version) into previous_version from public.economic_order_customers where tenant_id=new.tenant_id and entity_id=new.entity_id;
 else
  if not (new.scope ?& array['start','end','timezone','dateBasis','currency','exponent','basis']) or new.scope-array['start','end','timezone','dateBasis','currency','exponent','basis']<>'{}'::jsonb or jsonb_typeof(new.scope->'start') is distinct from 'string' or jsonb_typeof(new.scope->'end') is distinct from 'string' or new.scope->>'timezone' is distinct from 'UTC' or new.scope->>'dateBasis' is distinct from 'occurred_at' or jsonb_typeof(new.scope->'currency') is distinct from 'string' or (new.scope->>'currency') !~ '^[A-Z]{3}$' or jsonb_typeof(new.scope->'exponent') is distinct from 'number' or (new.scope->>'exponent') !~ '^[0-4]$' or jsonb_typeof(new.scope->'basis') is distinct from 'string' or length(btrim(new.scope->>'basis')) not between 1 and 200 then raise check_violation;end if;
  if (new.scope->>'start') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$' or (new.scope->>'end') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$' then raise check_violation;end if;
  begin
   if (new.scope->>'start')::timestamptz >= (new.scope->>'end')::timestamptz then raise check_violation;end if;
  exception when invalid_datetime_format or datetime_field_overflow then raise check_violation;
  end;
  if new.complete and (new.scope->>'end')::timestamptz>clock_timestamp() then raise check_violation;end if;
  select max(version) into previous_version from public.economic_relation_coverage where tenant_id=new.tenant_id and scope_key=new.scope_key;
 end if;
 if new.version<>coalesce(previous_version,0)+1 then raise serialization_failure;end if;
 return new;
end $$;
revoke all on function public.economic_link_guard() from public,anon,authenticated,service_role;
create trigger economic_problem_links_append before insert or update or delete on public.economic_problem_links for each row execute function public.economic_link_guard();
create trigger economic_order_aliases_append before insert or update or delete on public.economic_order_aliases for each row execute function public.economic_link_guard();
create trigger economic_order_customers_append before insert or update or delete on public.economic_order_customers for each row execute function public.economic_link_guard();
create trigger economic_relation_coverage_append before insert or update or delete on public.economic_relation_coverage for each row execute function public.economic_link_guard();
commit;
