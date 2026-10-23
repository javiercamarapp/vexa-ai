-- PROPUESTA (NO aplicada): agregados precalculados para «Brechas de ingreso» (/gaps). Prefijo >= 20261110000000; se aplica DESPUÉS de 20261104000000_insights_engine.
-- Qué AÑADE (todo por tenant, RLS forzada y solo lectura para la app, mismo patrón que insight_refund_by_sku_month):
--   insight_order_revenue_month   ingreso bruto del libro (pedidos) por mes × canal × SKU base × moneda; cancelados y «a revisar» aparte; primer y último día con datos (para detectar meses parciales).
--   insight_complaint_family_month  conversaciones de soporte por mes × familia de producto (extraction_runs.provenance.product_families, taxonomía v2). family '*' = analizadas ese mes; '+' = con alguna familia.
--   insight_family_pair           conversaciones donde se mencionan DOS familias a la vez (para cross-selling). Solo pares con >= 5 conversaciones.
--   refresh_gap_insights(tenant, presupuesto_ms)  recálculo completo e idempotente de las tres; se salta si el corte del origen no cambió.
-- Regla de datos: última revisión de cada entidad; SKU base = upper sin -WMn / -nnnA-nnn / -NEW (igual que insight_refund_by_sku_month); solo Amazon y Walmart traen SKU del vendedor (Best Buy/Shopify: sku_base '').
-- Nunca suma monedas. Sin costo por producto: todo es INGRESO BRUTO. Sin PII (solo códigos de familia).
-- Reversa: packages/workspace-service/tests/20261110000000_insight_gaps.down.sql (copia idéntica en este directorio).
begin;

-- 0) insight_state debe aceptar los nombres nuevos.
alter table public.insight_state drop constraint if exists insight_state_insight_check;
alter table public.insight_state add constraint insight_state_insight_check
 check(insight in('conversation_volume','refund_by_sku_month','thread_resolution','tracker_refund_status','repeat_contact','order_revenue_month','complaint_family_month'));

create table if not exists public.insight_order_revenue_month(
 tenant_id uuid not null references public.organizations(id),
 month date not null check(month=date_trunc('month',month)::date),
 channel text not null check(channel in('amazon','walmart','shopify','bestbuy','otro')),
 sku_base text not null check(length(sku_base)<=80),
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 exponent smallint not null check(exponent between 0 and 4),
 n bigint not null check(n>0),
 n_cancelled bigint not null check(n_cancelled between 0 and n),
 n_review bigint not null check(n_review between 0 and n),
 amount_minor numeric not null,
 amount_cancelled_minor numeric not null,
 amount_review_minor numeric not null,
 first_day date not null,
 last_day date not null,
 refreshed_at timestamptz not null,
 source_watermark timestamptz,
 computed_from jsonb not null default '{}'::jsonb check(jsonb_typeof(computed_from)='object'),
 primary key(tenant_id,month,channel,sku_base,currency,exponent)
);

create table if not exists public.insight_complaint_family_month(
 tenant_id uuid not null references public.organizations(id),
 month date not null check(month=date_trunc('month',month)::date),
 family text not null check(family in('*','+') or family ~ '^(cat|cod):[A-Za-z0-9_-]{1,24}$'),
 conversations bigint not null check(conversations>0),
 refreshed_at timestamptz not null,
 source_watermark timestamptz,
 primary key(tenant_id,month,family)
);

create table if not exists public.insight_family_pair(
 tenant_id uuid not null references public.organizations(id),
 family_a text not null check(family_a ~ '^(cat|cod):[A-Za-z0-9_-]{1,24}$'),
 family_b text not null check(family_b ~ '^(cat|cod):[A-Za-z0-9_-]{1,24}$' and family_a<family_b),
 conversations bigint not null check(conversations>=5),
 refreshed_at timestamptz not null,
 primary key(tenant_id,family_a,family_b)
);

do $$
declare t text;
begin
 foreach t in array array['insight_order_revenue_month','insight_complaint_family_month','insight_family_pair'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role,vexa_backend',t);
  execute format('grant select on public.%I to vexa_backend',t);
  execute format('drop policy if exists insight_read on public.%I',t);
  execute format('create policy insight_read on public.%I for select to vexa_backend using(tenant_id=nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid and (select public.vexa_member(nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid)))',t);
 end loop;
end $$;

create or replace function public.refresh_gap_insights(p_tenant uuid,p_budget_ms integer default 60000) returns jsonb language plpgsql security definer set search_path='' as $$
declare t0 timestamptz:=clock_timestamp(); wm timestamptz; ents bigint; ist public.insight_state%rowtype; out jsonb:='[]'::jsonb; wm2 timestamptz; runs bigint; done_n int;
 cf jsonb:=jsonb_build_object('table','economic_ledger_entries','kind','order','revision_rule','latest_by_entity','sku_rule','upper(split_part(external_id,''|'',3)) sin -WMn / -nnnA-nnn / -NEW; solo amazon y walmart','amount','ingreso bruto de la línea (sin costo ni margen)','currency_rule','sin sumar monedas');
 cf2 jsonb:=jsonb_build_object('table','extraction_runs','field','provenance.product_families','taxonomy','v2*','month_rule','mes de conversations.started_at (UTC)');
begin
 if not public.insights_authorized(p_tenant) then raise exception 'denied' using errcode='42501'; end if;
 if p_budget_ms is null or p_budget_ms<500 or p_budget_ms>600000 then raise exception 'INSIGHT_INPUT_INVALID' using errcode='22023'; end if;
 if not exists(select 1 from public.organizations where id=p_tenant) then raise exception 'INSIGHT_TENANT_UNKNOWN' using errcode='22023'; end if;
 perform set_config('lock_timeout','5s',true);
 if not pg_try_advisory_xact_lock(hashtextextended(p_tenant::text||':insights:gaps',0)) then return jsonb_build_object('tenant',p_tenant,'status','busy'); end if;

 -- A) Ingreso del libro por mes × canal × SKU × moneda.
 select max(recorded_at),count(*) into wm,ents from public.economic_ledger_entries where tenant_id=p_tenant and kind='order';
 select * into ist from public.insight_state where tenant_id=p_tenant and insight='order_revenue_month';
 if ist.tenant_id is not null and ist.status='ready' and ist.source_watermark is not distinct from wm and ist.source_rows=ents then
  out:=out||jsonb_build_array(jsonb_build_object('insight','order_revenue_month','status','noop'));
 else
  delete from public.insight_order_revenue_month where tenant_id=p_tenant;
  insert into public.insight_order_revenue_month(tenant_id,month,channel,sku_base,currency,exponent,n,n_cancelled,n_review,amount_minor,amount_cancelled_minor,amount_review_minor,first_day,last_day,refreshed_at,source_watermark,computed_from)
  with latest as (select distinct on(entity_id) external_id,status,effective_at,currency,exponent,amount_minor from public.economic_ledger_entries where tenant_id=p_tenant and kind='order' order by entity_id,revision desc),
  k as (select (date_trunc('month',effective_at at time zone 'UTC'))::date month,
    case when external_id like 'amazon|%' then 'amazon' when external_id like 'walmart|%' then 'walmart' when external_id like 'gid://shopify/%' then 'shopify' when external_id like 'mirakl_bestbuy%' then 'bestbuy' else 'otro' end channel,
    case when external_id like 'amazon|%' or external_id like 'walmart|%' then left(regexp_replace(upper(btrim(split_part(external_id,'|',3))),'(-WM[0-9]+|-[0-9]{3}A-[0-9]{3}|-NEW)$',''),80) else '' end sku_base,
    currency,exponent,status,amount_minor,(effective_at at time zone 'UTC')::date day from latest where amount_minor is not null)
  select p_tenant,month,channel,sku_base,currency,exponent,count(*),count(*) filter(where status='cancelled'),count(*) filter(where status='unknown'),sum(amount_minor),
   coalesce(sum(amount_minor) filter(where status='cancelled'),0),coalesce(sum(amount_minor) filter(where status='unknown'),0),min(day),max(day),t0,wm,cf
  from k group by month,channel,sku_base,currency,exponent;
  get diagnostics done_n=row_count;
  insert into public.insight_state(tenant_id,insight,status,refreshed_at,source_watermark,source_rows,duration_ms,computed_from,detail,error_code)
  values(p_tenant,'order_revenue_month','ready',t0,wm,ents,(extract(epoch from clock_timestamp()-t0)*1000)::int,cf,jsonb_build_object('rows',done_n),null)
  on conflict(tenant_id,insight) do update set status='ready',refreshed_at=excluded.refreshed_at,source_watermark=excluded.source_watermark,source_rows=excluded.source_rows,duration_ms=excluded.duration_ms,cursor='{}'::jsonb,computed_from=excluded.computed_from,detail=excluded.detail,error_code=null;
  out:=out||jsonb_build_array(jsonb_build_object('insight','order_revenue_month','status','ready','rows',done_n));
 end if;

 -- B) Familias de producto en conversaciones (taxonomía v2). Se salta si no hay corridas nuevas.
 select max(updated_at),count(*) into wm2,runs from public.extraction_runs where tenant_id=p_tenant and provenance->>'taxonomy_version' like 'v2%';
 select * into ist from public.insight_state where tenant_id=p_tenant and insight='complaint_family_month';
 if ist.tenant_id is not null and ist.status='ready' and ist.source_watermark is not distinct from wm2 and ist.source_rows=runs then
  out:=out||jsonb_build_array(jsonb_build_object('insight','complaint_family_month','status','noop'));
 else
  delete from public.insight_complaint_family_month where tenant_id=p_tenant;
  delete from public.insight_family_pair where tenant_id=p_tenant;
  insert into public.insight_complaint_family_month(tenant_id,month,family,conversations,refreshed_at,source_watermark)
  with base as (select distinct r.conversation_id,(date_trunc('month',c.started_at at time zone 'UTC'))::date month,
     case when jsonb_typeof(r.provenance->'product_families')='array' then r.provenance->'product_families' else '[]'::jsonb end fam
   from public.extraction_runs r join public.conversations c on c.id=r.conversation_id and c.tenant_id=r.tenant_id
   where r.tenant_id=p_tenant and r.provenance->>'taxonomy_version' like 'v2%' and r.status in('succeeded','abstained') and c.started_at is not null and c.deleted_at is null)
  select p_tenant,month,'*',count(*),t0,wm2 from base group by month
  union all select p_tenant,month,'+',count(*),t0,wm2 from base where jsonb_array_length(fam)>0 group by month
  union all select p_tenant,month,f,count(*),t0,wm2 from base cross join lateral jsonb_array_elements_text(fam) f where f ~ '^(cat|cod):[A-Za-z0-9_-]{1,24}$' group by month,f;
  insert into public.insight_family_pair(tenant_id,family_a,family_b,conversations,refreshed_at)
  with fam as (select distinct r.conversation_id,f from public.extraction_runs r join public.conversations c on c.id=r.conversation_id and c.tenant_id=r.tenant_id
    cross join lateral jsonb_array_elements_text(case when jsonb_typeof(r.provenance->'product_families')='array' then r.provenance->'product_families' else '[]'::jsonb end) f
    where r.tenant_id=p_tenant and r.provenance->>'taxonomy_version' like 'v2%' and r.status='succeeded' and c.deleted_at is null and f ~ '^(cat|cod):[A-Za-z0-9_-]{1,24}$')
  select p_tenant,x.f,y.f,count(*),t0 from fam x join fam y on x.conversation_id=y.conversation_id and x.f<y.f group by x.f,y.f having count(*)>=5;
  get diagnostics done_n=row_count;
  insert into public.insight_state(tenant_id,insight,status,refreshed_at,source_watermark,source_rows,duration_ms,computed_from,detail,error_code)
  values(p_tenant,'complaint_family_month','ready',t0,wm2,runs,(extract(epoch from clock_timestamp()-t0)*1000)::int,cf2,jsonb_build_object('pairs',done_n),null)
  on conflict(tenant_id,insight) do update set status='ready',refreshed_at=excluded.refreshed_at,source_watermark=excluded.source_watermark,source_rows=excluded.source_rows,duration_ms=excluded.duration_ms,cursor='{}'::jsonb,computed_from=excluded.computed_from,detail=excluded.detail,error_code=null;
  out:=out||jsonb_build_array(jsonb_build_object('insight','complaint_family_month','status','ready','runs',runs));
 end if;
 return jsonb_build_object('tenant',p_tenant,'status','done','results',out,'duration_ms',(extract(epoch from clock_timestamp()-t0)*1000)::int);
end $$;
revoke all on function public.refresh_gap_insights(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.refresh_gap_insights(uuid,integer) to vexa_backend;
commit;
