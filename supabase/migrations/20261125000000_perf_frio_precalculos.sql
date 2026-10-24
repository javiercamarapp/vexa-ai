-- 20261125000000 (PROPUESTA, NO APLICADA): precálculos para que «Carga y SLA» (/api/workload) y «Fuga de reembolsos» (/api/refunds) no escaneen datos crudos en frío.
-- Por qué (medido 24-oct sobre CLIENTEX como superusuario, sin RLS, Mac cargada): la parte SLA de /workload no cabe en 120 s la primera vez (solo la lectura de hilos de
--   sync_raw_objects tarda 14.1 s con 75k buffers; las conversaciones de HubSpot 8.8 s por Seq Scan de 104k filas); /refunds: lineas de reembolso 6.4 s, pedidos 0.46 s.
--   Con estas tablas cada parte es un SELECT de unos cientos de filas. Mientras no se aplique, la aplicación calcula en vivo con tope (comportamiento anterior).
-- Qué AÑADE (todo por tenant, RLS forzada y solo lectura para la app, mismo patrón que 20261112000000_insight_inbound_load):
--   insight_thread_sla           un renglón por hilo de HubSpot API: creación, estado, primer mensaje de cliente y primera respuesta de agente posterior (sin PII: id opaco, fechas, estado).
--   insight_refund_ledger_digest reembolsos del libro (última revisión de cada entidad) por canal x SKU base x mes x estado x moneda: mismas columnas que la consulta en vivo.
--   insight_order_lines_digest   líneas de pedido USD de Amazon/Walmart por canal x SKU base x mes (todas las revisiones y solo la última), para el denominador de la intensidad.
--   refresh_perf_frio(tenant, qué) recálculo idempotente; se salta si el corte del origen no cambió. «qué»: sla | ledger | all.
-- Reglas: ingreso bruto (no margen), monedas separadas (nunca se suman), unknown != 0 (sin_monto se cuenta aparte), HubSpot es la fuente del SLA. Sin PII.
-- Disparo: la aplicación llama refresh_perf_frio tras cada refresh_insights (gancho existente de imports/CRM, cron de 5 min). Primera carga: `select public.refresh_perf_frio('<tenant>');`
-- Reversa: packages/workspace-service/tests/20261125000000_perf_frio_precalculos.down.sql
begin;
set local lock_timeout='3s';
do $$ begin
 if to_regprocedure('public.insights_authorized(uuid)') is null then raise exception 'aplique antes 20261104000000_insights_engine'; end if;
 if to_regclass('public.sync_raw_objects') is null or to_regclass('public.economic_ledger_entries') is null or to_regclass('public.messages') is null then raise exception 'faltan tablas base'; end if;
end $$;

create table if not exists public.insight_thread_sla(
 tenant_id uuid not null references public.organizations(id),
 thread_id text not null check(length(thread_id)<=80),
 created_at timestamptz,
 status text,
 first_customer_at timestamptz,
 first_agent_at timestamptz,
 seen_at timestamptz,
 refreshed_at timestamptz not null,
 source_watermark timestamptz,
 source_rows bigint,
 messages_watermark timestamptz,
 primary key(tenant_id,thread_id)
);
create table if not exists public.insight_refund_ledger_digest(
 tenant_id uuid not null references public.organizations(id),
 ch text not null check(ch in('amazon','walmart','shopify','bestbuy','otro')),
 sku text not null,
 month text not null check(month ~ '^\d{4}-\d{2}$'),
 status text not null,
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 exponent smallint not null check(exponent between 0 and 4),
 n integer not null check(n>0),
 sin_monto integer not null check(sin_monto between 0 and n),
 amount_minor numeric not null,
 first_day text not null,
 last_day text not null,
 refreshed_at timestamptz not null,
 source_watermark timestamptz,
 primary key(tenant_id,ch,sku,month,status,currency,exponent)
);
create table if not exists public.insight_order_lines_digest(
 tenant_id uuid not null references public.organizations(id),
 ch text not null check(ch in('amazon','walmart')),
 sku text not null,
 month text not null check(month ~ '^\d{4}-\d{2}$'),
 n_all integer not null check(n_all>0),
 revised_all integer not null check(revised_all between 0 and n_all),
 n_latest integer not null check(n_latest>=0),
 revised_latest integer not null check(revised_latest between 0 and n_latest),
 refreshed_at timestamptz not null,
 source_watermark timestamptz,
 primary key(tenant_id,ch,sku,month)
);

do $$
declare t text;
begin
 foreach t in array array['insight_thread_sla','insight_refund_ledger_digest','insight_order_lines_digest'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role,vexa_backend',t);
  execute format('grant select on public.%I to vexa_backend',t);
  execute format('drop policy if exists insight_read on public.%I',t);
  execute format($p$create policy insight_read on public.%I for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (select public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid)))$p$,t);
 end loop;
end $$;

-- Recálculo. p_what: 'sla' | 'ledger' | 'all'. Autorizado como refresh_insights (worker del propio tenant con acción import u operador). Candado consultivo por tenant.
create or replace function public.refresh_perf_frio(p_tenant uuid,p_what text default 'all') returns jsonb language plpgsql security definer set search_path='' as $$
declare ts timestamptz:=clock_timestamp(); wm timestamptz; wm2 timestamptz; total bigint; ex record; out jsonb:='{}'::jsonb; n_ bigint;
begin
 if not public.insights_authorized(p_tenant) then raise exception 'denied' using errcode='42501'; end if;
 if p_what is null or p_what not in('sla','ledger','all') then raise exception 'INSIGHT_INPUT_INVALID' using errcode='22023'; end if;
 if not exists(select 1 from public.organizations where id=p_tenant) then raise exception 'INSIGHT_TENANT_UNKNOWN' using errcode='22023'; end if;
 perform set_config('lock_timeout','5s',true);
 if not pg_try_advisory_xact_lock(hashtextextended(p_tenant::text||':perf_frio',0)) then return jsonb_build_object('status','busy'); end if;

 if p_what in('sla','all') then
  select max(created_at),count(*) into wm,total from public.sync_raw_objects where tenant_id=p_tenant;
  select max(created_at) into wm2 from public.messages where tenant_id=p_tenant;
  select source_watermark,source_rows,messages_watermark into ex from public.insight_thread_sla where tenant_id=p_tenant limit 1;
  if found and ex.source_watermark is not distinct from wm and ex.source_rows is not distinct from total and ex.messages_watermark is not distinct from wm2 then
   out:=out||jsonb_build_object('sla','noop');
  else
   delete from public.insight_thread_sla where tenant_id=p_tenant;
   -- Mismo criterio que la consulta en vivo: hilo = payload sin type con createdAt y status (última versión por id); conversación de HubSpot con ese external_id;
   -- primer mensaje de cliente; primera respuesta de agente en o después de ese instante.
   insert into public.insight_thread_sla(tenant_id,thread_id,created_at,status,first_customer_at,first_agent_at,seen_at,refreshed_at,source_watermark,source_rows,messages_watermark)
   with t as (select distinct on(original->'payload'->>'id') original->'payload'->>'id' tid,(original->'payload'->>'createdAt')::timestamptz creado,original->'payload'->>'status' estado,created_at visto
     from public.sync_raw_objects where tenant_id=p_tenant and original->'payload'->>'type' is null and original->'payload' ? 'createdAt' and original->'payload' ? 'status'
      and original->'payload'->>'createdAt' ~ '^\d{4}-\d\d-\d\dT' and original->'payload'->>'id' is not null order by original->'payload'->>'id',created_at desc)
   select p_tenant,t.tid,t.creado,t.estado,f.c1,f.a1,t.visto,ts,wm,total,wm2
   from t left join public.conversations cv on cv.tenant_id=p_tenant and cv.external_id=t.tid and cv.source='hubspot' and cv.deleted_at is null
   left join lateral (select x.c1,(select min(m.occurred_at) from public.messages m where m.tenant_id=p_tenant and m.conversation_id=cv.id and m.deleted_at is null and m.role='agent' and m.occurred_at>=x.c1) a1
     from (select min(occurred_at) c1 from public.messages where tenant_id=p_tenant and conversation_id=cv.id and deleted_at is null and role='customer') x where x.c1 is not null) f on true;
   get diagnostics n_=row_count;
   out:=out||jsonb_build_object('sla',jsonb_build_object('status','ready','rows',n_));
  end if;
 end if;

 if p_what in('ledger','all') then
  select max(recorded_at) into wm from public.economic_ledger_entries where tenant_id=p_tenant;
  select source_watermark into ex from (select source_watermark from public.insight_refund_ledger_digest where tenant_id=p_tenant limit 1) z;
  if wm is not null and found and ex.source_watermark is not distinct from wm and exists(select 1 from public.insight_order_lines_digest where tenant_id=p_tenant limit 1) then
   out:=out||jsonb_build_object('ledger','noop');
  else
   delete from public.insight_refund_ledger_digest where tenant_id=p_tenant;
   delete from public.insight_order_lines_digest where tenant_id=p_tenant;
   -- Canal y SKU base: idéntico a fuga-reembolsos.mjs (CH, SKU4 para reembolsos, SKU3 para pedidos).
   insert into public.insight_refund_ledger_digest(tenant_id,ch,sku,month,status,currency,exponent,n,sin_monto,amount_minor,first_day,last_day,refreshed_at,source_watermark)
   select p_tenant,
    case when external_id like 'amazon|%' then 'amazon' when external_id like 'walmart|%' then 'walmart' when external_id like 'gid://shopify/%' then 'shopify' when external_id like 'mirakl_bestbuy%' then 'bestbuy' else 'otro' end,
    regexp_replace(upper(split_part(external_id,'|',4)),'(-WM[0-9]+|-[0-9]{3}A-[0-9]{3}|-NEW)$',''),
    to_char(effective_at at time zone 'UTC','YYYY-MM'),status,currency,exponent::smallint,count(*)::int,(count(*) filter(where amount_minor is null))::int,coalesce(sum(amount_minor),0),
    to_char(min(effective_at) at time zone 'UTC','YYYY-MM-DD'),to_char(max(effective_at) at time zone 'UTC','YYYY-MM-DD'),ts,wm
   from public.economic_ledger_entries e
   where tenant_id=p_tenant and kind='refund' and not exists(select 1 from public.economic_ledger_entries l2 where l2.tenant_id=e.tenant_id and l2.entity_id=e.entity_id and l2.revision>e.revision)
   group by 2,3,4,5,6,7;
   get diagnostics n_=row_count;
   out:=out||jsonb_build_object('ledger',jsonb_build_object('status','ready','refund_rows',n_));
   insert into public.insight_order_lines_digest(tenant_id,ch,sku,month,n_all,revised_all,n_latest,revised_latest,refreshed_at,source_watermark)
   select p_tenant,ch,sku,month,count(*)::int,(count(*) filter(where revision>1))::int,(count(*) filter(where es_ultima))::int,(count(*) filter(where es_ultima and revision>1))::int,ts,wm
   from (select case when external_id like 'amazon|%' then 'amazon' when external_id like 'walmart|%' then 'walmart' when external_id like 'gid://shopify/%' then 'shopify' when external_id like 'mirakl_bestbuy%' then 'bestbuy' else 'otro' end as ch,
      regexp_replace(upper(split_part(external_id,'|',3)),'(-WM[0-9]+|-[0-9]{3}A-[0-9]{3}|-NEW)$','') as sku,to_char(effective_at at time zone 'UTC','YYYY-MM') as month,revision,
      not exists(select 1 from public.economic_ledger_entries l2 where l2.tenant_id=e.tenant_id and l2.entity_id=e.entity_id and l2.revision>e.revision) as es_ultima
     from public.economic_ledger_entries e where tenant_id=p_tenant and kind='order' and currency='USD' and exponent=2) x
   where ch in('amazon','walmart') group by ch,sku,month;
  end if;
 end if;
 return jsonb_build_object('tenant',p_tenant,'what',p_what,'results',out,'duration_ms',(extract(epoch from clock_timestamp()-ts)*1000)::int);
end $$;
revoke all on function public.refresh_perf_frio(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.refresh_perf_frio(uuid,text) to vexa_backend;
commit;
