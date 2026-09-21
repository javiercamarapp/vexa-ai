begin;
-- Approved manual catalog/rates, separate from the immutable native money ledger.
create table public.economic_currency_versions(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,currency text not null check(currency ~ '^[A-Z]{3}$'),exponent integer not null check(exponent between 0 and 4),version integer not null check(version>0),active boolean not null,actor_id uuid not null,source text not null check(length(btrim(source)) between 1 and 200),reference text not null check(length(btrim(reference)) between 1 and 500),effective_date date not null,report text not null check(length(report) between 20 and 4000),attested boolean not null check(attested),created_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,id),unique(tenant_id,currency,version),foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id)
);
create table public.economic_fx_versions(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,rate_id uuid not null,version integer not null check(version>0),base text not null check(base ~ '^[A-Z]{3}$'),quote text not null check(quote ~ '^[A-Z]{3}$'),base_catalog_id uuid not null,quote_catalog_id uuid not null,rate text not null check(length(rate)<=128 and rate ~ '^(0|[1-9][0-9]*)(\.[0-9]{1,36})?$' and rate::numeric>0),rounding text not null check(rounding in ('half_up','half_even','toward_zero')),active boolean not null,actor_id uuid not null,source text not null check(length(btrim(source)) between 1 and 200),reference text not null check(length(btrim(reference)) between 1 and 500),effective_date date not null,report text not null check(length(report) between 20 and 4000),attested boolean not null check(attested),created_at timestamptz not null default clock_timestamp(),check(base<>quote),
 unique(tenant_id,id),unique(tenant_id,rate_id,version),foreign key(tenant_id,base_catalog_id) references public.economic_currency_versions(tenant_id,id),foreign key(tenant_id,quote_catalog_id) references public.economic_currency_versions(tenant_id,id),foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id)
);
alter table public.economic_currency_versions enable row level security;alter table public.economic_currency_versions force row level security;
alter table public.economic_fx_versions enable row level security;alter table public.economic_fx_versions force row level security;
revoke all on public.economic_currency_versions,public.economic_fx_versions from public,anon,authenticated,service_role,vexa_backend;grant select,insert on public.economic_currency_versions,public.economic_fx_versions to vexa_backend;
create policy economic_currency_read on public.economic_currency_versions for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create policy economic_currency_write on public.economic_currency_versions for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and actor_id=auth.uid() and public.vexa_member(tenant_id,array['owner']) and public.vexa_backend_action(tenant_id,array['configure']));
create policy economic_fx_read on public.economic_fx_versions for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create policy economic_fx_write on public.economic_fx_versions for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and actor_id=auth.uid() and public.vexa_member(tenant_id,array['owner']) and public.vexa_backend_action(tenant_id,array['configure']));
create function public.economic_money_config_guard() returns trigger language plpgsql set search_path='' as $$
declare prior_version integer; a public.economic_currency_versions;b public.economic_currency_versions;
begin
 if tg_op<>'INSERT' then raise insufficient_privilege;end if;
 if new.tenant_id is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or new.actor_id is distinct from auth.uid() or not public.vexa_member(new.tenant_id,array['owner']) or not public.vexa_backend_action(new.tenant_id,array['configure']) then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':money-config',0));
 if not isfinite(new.effective_date) or new.effective_date>(clock_timestamp() at time zone 'UTC')::date then raise check_violation;end if;
 if tg_table_name='economic_currency_versions' then
  select max(version) into prior_version from public.economic_currency_versions where tenant_id=new.tenant_id and currency=new.currency;
 else
  select max(version) into prior_version from public.economic_fx_versions where tenant_id=new.tenant_id and rate_id=new.rate_id;
  if exists(select 1 from public.economic_fx_versions p where p.tenant_id=new.tenant_id and p.rate_id=new.rate_id and (p.base<>new.base or p.quote<>new.quote)) then raise check_violation;end if;
  select * into a from public.economic_currency_versions where tenant_id=new.tenant_id and id=new.base_catalog_id;
  select * into b from public.economic_currency_versions where tenant_id=new.tenant_id and id=new.quote_catalog_id;
  if a.id is null or b.id is null or a.currency<>new.base or b.currency<>new.quote then raise check_violation;end if;
  if new.active and (not a.active or not b.active or not public.economic_contributor_active(new.tenant_id,a.actor_id) or not public.economic_contributor_active(new.tenant_id,b.actor_id) or a.version<>(select max(version) from public.economic_currency_versions where tenant_id=new.tenant_id and currency=new.base) or b.version<>(select max(version) from public.economic_currency_versions where tenant_id=new.tenant_id and currency=new.quote)) then raise check_violation;end if;
 end if;
 if new.version<>coalesce(prior_version,0)+1 then raise serialization_failure;end if;
 return new;
end $$;
revoke all on function public.economic_money_config_guard() from public,anon,authenticated,service_role;
create trigger economic_currency_append before insert or update or delete on public.economic_currency_versions for each row execute function public.economic_money_config_guard();
create trigger economic_fx_append before insert or update or delete on public.economic_fx_versions for each row execute function public.economic_money_config_guard();
commit;
