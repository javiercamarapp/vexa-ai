-- 20261104000000 (PROPUESTA, NO APLICADA): MOTOR DE «INSIGHTS PRECALCULADOS» (insight_*) y estado de sincronización por fuente (source_sync_state).
-- Por qué: las pantallas calculaban al abrirse contra tablas grandes con RLS lenta (25-35 s). Aquí el cálculo corre FUERA de la ruta del usuario, de forma INCREMENTAL
-- cuando cambia una fuente (fin de una importación, tick de sincronización, programador) y las pantallas solo hacen SELECT sobre unas decenas/cientos de filas.
-- Qué AÑADE: source_sync_state, insight_state, insight_conversation_volume, insight_refund_by_sku_month, insight_thread_resolution, insight_tracker_refund_status,
--   record_source_sync(...) y refresh_insights(tenant, fuente, desde, presupuesto_ms) (+ ayudantes internos sin ningún GRANT).
-- Qué NO hace: no cambia política, función ni dato existente; no toca vercel.json; no programa nada (el disparo vive en la aplicación, ver docs/DATOS-VIVOS.md).
-- Contacto repetido NO se duplica: lo calcula refresh_contact_repeat (20261102000000, BUILD-FUGA). Si existe, refresh_insights('contacts') lo invoca y registra su frescura aquí;
--   si no existe, se omite («skipped»), nunca se inventa.
-- Orden: puede aplicarse antes o después del código. Sin la migración el código cae al camino anterior. Requiere 20261022000000 (summary_refresh_state no se usa, pero vexa_member sí).
-- Seguridad: refresh_insights y record_source_sync son SECURITY DEFINER con search_path vacío; EXECUTE solo para vexa_backend y SOLO si la sesión es la del worker con vexa.action='import'
--   sobre su propio tenant (vexa_backend_action) o si quien llama es superusuario/BYPASSRLS (operador). Las tablas son de solo lectura para la aplicación.
-- Reversa: packages/workspace-service/tests/20261104000000_insights_engine.down.sql
begin;
set local lock_timeout='3s';
do $$
begin
 if to_regclass('public.economic_ledger_entries') is null or to_regclass('public.conversations') is null or to_regclass('public.messages') is null then
  raise exception 'faltan tablas base: aplique antes 0002_sources y 0018_economic_runtime';
 end if;
 if to_regclass('public.sync_raw_objects') is null or to_regclass('public.tracker_row_revisions') is null then raise exception 'faltan sync_raw_objects (0008) o tracker_row_revisions (0052)'; end if;
 if to_regprocedure('public.vexa_member(uuid,text[])') is null or to_regprocedure('public.vexa_backend_action(uuid,text[])') is null then raise exception 'faltan vexa_member / vexa_backend_action'; end if;
 if not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
  raise exception 'el propietario de la migración (%) debe ser superusuario o tener BYPASSRLS', current_user;
 end if;
end $$;

-- 1) Estado de sincronización POR FUENTE (lo que la pantalla «Datos y fuentes» muestra: método, último éxito, siguiente corrida, error, latencia).
create table if not exists public.source_sync_state(
 tenant_id uuid not null references public.organizations(id),
 source_key text not null check(source_key ~ '^[a-z0-9_.:-]{1,80}$'),
 method text not null check(method in('api_poll','webhook','file_drop','sheet_sync','manual_upload','stub')),
 status text not null default 'never' check(status in('never','ok','error','running','paused')),
 last_attempt_at timestamptz,
 last_success_at timestamptz,
 last_new_records bigint check(last_new_records is null or last_new_records>=0),
 last_error_code text check(last_error_code is null or last_error_code ~ '^[A-Z0-9_]{2,64}$'),
 last_latency_ms integer check(last_latency_ms is null or last_latency_ms>=0),
 next_run_at timestamptz,
 expected_every_seconds integer check(expected_every_seconds is null or expected_every_seconds between 30 and 31536000),
 data_watermark timestamptz,
 updated_at timestamptz not null default now(),
 primary key(tenant_id,source_key)
);

-- 2) Estado de cada insight: cuándo se calculó, contra qué corte del origen y de dónde sale. cursor = meses/semanas pendientes si el refresco se cortó por tiempo (reanudable).
create table if not exists public.insight_state(
 tenant_id uuid not null references public.organizations(id),
 insight text not null check(insight in('conversation_volume','refund_by_sku_month','thread_resolution','tracker_refund_status','repeat_contact')),
 status text not null check(status in('ready','partial','failed','skipped')),
 refreshed_at timestamptz not null,
 source_watermark timestamptz,
 source_rows bigint not null default 0 check(source_rows>=0),
 duration_ms integer not null default 0 check(duration_ms>=0),
 cursor jsonb not null default '{}'::jsonb check(jsonb_typeof(cursor)='object'),
 computed_from jsonb not null default '{}'::jsonb check(jsonb_typeof(computed_from)='object'),
 detail jsonb not null default '{}'::jsonb check(jsonb_typeof(detail)='object'),
 error_code text check(error_code is null or length(error_code)<=16),
 primary key(tenant_id,insight)
);

-- 3) Conversaciones por semana y por mes (fecha = started_at o primer mensaje no borrado; misma definición que conversation_monthly).
create table if not exists public.insight_conversation_volume(
 tenant_id uuid not null references public.organizations(id),
 grain text not null check(grain in('week','month')),
 period date not null,
 n bigint not null check(n>0),
 refreshed_at timestamptz not null,
 source_watermark timestamptz,
 primary key(tenant_id,grain,period)
);

-- 4) Reembolsos del libro por mes × canal × SKU base × moneda. Sin sumar monedas. «amount_active_minor» excluye cancelados; sku_base='' = sin SKU en el external_id (Shopify/otros).
create table if not exists public.insight_refund_by_sku_month(
 tenant_id uuid not null references public.organizations(id),
 month date not null check(month=date_trunc('month',month)::date),
 channel text not null check(channel in('amazon','walmart','shopify','bestbuy','otro')),
 sku_base text not null check(length(sku_base)<=80),
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 exponent smallint not null check(exponent between 0 and 4),
 n bigint not null check(n>0),
 n_known bigint not null check(n_known between 0 and n),
 n_cancelled bigint not null check(n_cancelled between 0 and n),
 amount_minor numeric not null,
 amount_active_minor numeric not null,
 refreshed_at timestamptz not null,
 source_watermark timestamptz,
 computed_from jsonb not null default '{}'::jsonb check(jsonb_typeof(computed_from)='object'),
 primary key(tenant_id,month,channel,sku_base,currency,exponent)
);

-- 5) Cierre y reapertura de hilos de HubSpot API (grain 'month' = mes de creación del hilo; 'all' = periodo 0001-01-01).
create table if not exists public.insight_thread_resolution(
 tenant_id uuid not null references public.organizations(id),
 grain text not null check(grain in('month','all')),
 period date not null,
 threads bigint not null check(threads>=0),
 closed bigint not null check(closed between 0 and threads),
 reopened_threads bigint not null check(reopened_threads between 0 and threads),
 close_p50_hours numeric,
 close_p90_hours numeric,
 closed_lt_1h bigint not null default 0,
 closed_gt_7d bigint not null default 0,
 status_events bigint not null default 0,
 refreshed_at timestamptz not null,
 source_watermark timestamptz,
 primary key(tenant_id,grain,period)
);

-- 6) Estado de reembolsos del Tracker (hoja Refunds, última revisión por fila). Solo categorías de catálogo cerrado (sin texto libre ni PII); monto sin moneda declarada (supuesto USD).
create table if not exists public.insight_tracker_refund_status(
 tenant_id uuid not null references public.organizations(id),
 status_class text not null check(status_class in('reembolsado','vencido','no_reembolsable','rechazado','enviado','otro','sin_estado')),
 reason_class text not null,
 retailer_class text not null,
 n bigint not null check(n>0),
 n_amount bigint not null check(n_amount between 0 and n),
 amount_minor numeric not null,
 assumed_currency text not null default 'USD',
 refreshed_at timestamptz not null,
 source_watermark timestamptz,
 primary key(tenant_id,status_class,reason_class,retailer_class)
);

-- 7) RLS forzada, solo lectura para la aplicación, patrón initplan (la membresía se evalúa UNA vez por sentencia).
do $$
declare t text;
begin
 foreach t in array array['source_sync_state','insight_state','insight_conversation_volume','insight_refund_by_sku_month','insight_thread_resolution','insight_tracker_refund_status'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role,vexa_backend',t);
  execute format('grant select on public.%I to vexa_backend',t);
  execute format('drop policy if exists insight_read on public.%I',t);
  execute format('create policy insight_read on public.%I for select to vexa_backend using(tenant_id=nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid and (select public.vexa_member(nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid)))',t);
 end loop;
end $$;

-- 8) Autorización: worker del propio tenant con vexa.action='import' (analyst/owner) o superusuario/BYPASSRLS conectado SIN `set role` (operador; un SET ROLE vexa_backend no hereda ese privilegio).
create or replace function public.insights_authorized(p_tenant uuid) returns boolean language sql stable security definer set search_path='' as $$
 select p_tenant is not null and (
  (current_setting('vexa.action',true)='import' and p_tenant=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_backend_action(p_tenant,array['import']))
  or (current_setting('role')='none' and exists(select 1 from pg_roles where rolname=session_user and (rolsuper or rolbypassrls))))
$$;
revoke all on function public.insights_authorized(uuid) from public,anon,authenticated,service_role;
grant execute on function public.insights_authorized(uuid) to vexa_backend;

-- 9) Registro del estado de una fuente (lo llaman los conectores y los ganchos de importación). Éxito => last_success_at; fallo => conserva el último éxito.
create or replace function public.record_source_sync(p_tenant uuid,p_source text,p_method text,p_ok boolean,p_new_records bigint default null,p_error text default null,
 p_latency_ms integer default null,p_next_run timestamptz default null,p_expected_every integer default null,p_data_watermark timestamptz default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.insights_authorized(p_tenant) then raise exception 'denied' using errcode='42501'; end if;
 if p_source is null or p_source !~ '^[a-z0-9_.:-]{1,80}$' or p_method is null or p_method not in('api_poll','webhook','file_drop','sheet_sync','manual_upload','stub') then raise exception 'SYNC_STATE_INPUT_INVALID' using errcode='22023'; end if;
 if not exists(select 1 from public.organizations where id=p_tenant) then raise exception 'SYNC_STATE_TENANT_UNKNOWN' using errcode='22023'; end if;
 insert into public.source_sync_state(tenant_id,source_key,method,status,last_attempt_at,last_success_at,last_new_records,last_error_code,last_latency_ms,next_run_at,expected_every_seconds,data_watermark,updated_at)
 values(p_tenant,p_source,p_method,case when p_ok then 'ok' else 'error' end,clock_timestamp(),case when p_ok then clock_timestamp() end,p_new_records,
  case when p_ok then null else upper(regexp_replace(coalesce(nullif(p_error,''),'SYNC_FAILED'),'[^A-Za-z0-9_]','_','g')) end,p_latency_ms,p_next_run,p_expected_every,p_data_watermark,clock_timestamp())
 on conflict(tenant_id,source_key) do update set method=excluded.method,status=excluded.status,last_attempt_at=excluded.last_attempt_at,
  last_success_at=coalesce(excluded.last_success_at,public.source_sync_state.last_success_at),
  last_new_records=case when p_ok then excluded.last_new_records else public.source_sync_state.last_new_records end,
  last_error_code=excluded.last_error_code,last_latency_ms=excluded.last_latency_ms,next_run_at=excluded.next_run_at,
  expected_every_seconds=coalesce(excluded.expected_every_seconds,public.source_sync_state.expected_every_seconds),
  data_watermark=coalesce(excluded.data_watermark,public.source_sync_state.data_watermark),updated_at=excluded.updated_at;
end $$;
revoke all on function public.record_source_sync(uuid,text,text,boolean,bigint,text,integer,timestamptz,integer,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.record_source_sync(uuid,text,text,boolean,bigint,text,integer,timestamptz,integer,timestamptz) to vexa_backend;

-- 10) Ayudantes internos (SIN GRANT: solo los llama refresh_insights). Cada uno devuelve jsonb {insight,status,...} y deja su fila en insight_state.

-- 10a) Reembolsos por SKU × canal × mes: INCREMENTAL por mes afectado. Meses afectados = meses de TODAS las revisiones de las entidades con alguna revisión posterior al corte
-- (con 2 min de traslape por transacciones en vuelo) ∪ meses pendientes del cursor. Cada mes se reemplaza completo (idempotente). Si se agota el presupuesto, lo que falta queda en cursor.
create or replace function public.insights_refresh_refund_sku(p_tenant uuid,p_since timestamptz,p_deadline timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare ist public.insight_state%rowtype; wm timestamptz; ts timestamptz:=clock_timestamp(); since timestamptz; affected date[]; pending date[]:='{}'; todo date[]; rest date[]:='{}'; m date; lo timestamptz; hi timestamptz;
 done_n int:=0; ents bigint; cf jsonb:=jsonb_build_object('table','economic_ledger_entries','kind','refund','revision_rule','latest_by_entity','sku_rule','upper(split_part(external_id,''|'',4)) sin -WMn / -nnnA-nnn / -NEW','currency_rule','sin sumar monedas');
begin
 select * into ist from public.insight_state where tenant_id=p_tenant and insight='refund_by_sku_month';
 select max(recorded_at),count(*) into wm,ents from public.economic_ledger_entries where tenant_id=p_tenant and kind='refund';
 if wm is null then
  delete from public.insight_refund_by_sku_month where tenant_id=p_tenant;
  insert into public.insight_state(tenant_id,insight,status,refreshed_at,source_watermark,source_rows,duration_ms,computed_from) values(p_tenant,'refund_by_sku_month','ready',ts,null,0,0,cf)
   on conflict(tenant_id,insight) do update set status='ready',refreshed_at=excluded.refreshed_at,source_watermark=null,source_rows=0,cursor='{}'::jsonb,error_code=null,computed_from=excluded.computed_from;
  return jsonb_build_object('insight','refund_by_sku_month','status','ready','months',0,'rows',0);
 end if;
 if ist.tenant_id is not null and p_since is null and ist.status='ready' and ist.source_watermark is not distinct from wm then
  return jsonb_build_object('insight','refund_by_sku_month','status','noop','source_watermark',wm);
 end if;
 pending:=coalesce(array(select jsonb_array_elements_text(ist.cursor->'months')::date),'{}');
 if ist.tenant_id is null and p_since is null then
  select coalesce(array_agg(distinct (date_trunc('month',effective_at at time zone 'UTC'))::date),'{}') into affected from public.economic_ledger_entries where tenant_id=p_tenant and kind='refund';
 else
  since:=coalesce(p_since,ist.source_watermark);
  if since is null then affected:='{}';
  else
   select coalesce(array_agg(distinct (date_trunc('month',e.effective_at at time zone 'UTC'))::date),'{}') into affected from public.economic_ledger_entries e
   where e.tenant_id=p_tenant and e.kind='refund' and e.entity_id in(select x.entity_id from public.economic_ledger_entries x where x.tenant_id=p_tenant and x.kind='refund' and x.recorded_at>since-interval '2 minutes');
  end if;
 end if;
 select coalesce(array_agg(mm order by mm desc),'{}') into todo from (select distinct unnest(affected||pending) mm) u;
 foreach m in array todo loop
  if clock_timestamp()>p_deadline then rest:=rest||m; continue; end if;
  lo:=m::timestamp at time zone 'UTC'; hi:=(m+interval '1 month')::timestamp at time zone 'UTC';
  delete from public.insight_refund_by_sku_month where tenant_id=p_tenant and month=m;
  with cand as (select distinct entity_id from public.economic_ledger_entries where tenant_id=p_tenant and kind='refund' and effective_at>=lo and effective_at<hi),
  latest as (select distinct on(e.entity_id) e.external_id,e.kind,e.status,e.effective_at,e.currency,e.exponent,e.amount_minor
   from public.economic_ledger_entries e join cand c on c.entity_id=e.entity_id where e.tenant_id=p_tenant order by e.entity_id,e.revision desc),
  k as (select case when external_id like 'amazon|%' then 'amazon' when external_id like 'walmart|%' then 'walmart' when external_id like 'gid://shopify/%' then 'shopify' when external_id like 'mirakl_bestbuy%' then 'bestbuy' else 'otro' end channel,
   case when external_id like 'amazon|%' or external_id like 'walmart|%' then left(regexp_replace(upper(btrim(split_part(external_id,'|',4))),'(-WM[0-9]+|-[0-9]{3}A-[0-9]{3}|-NEW)$',''),80) else '' end sku_base,
   currency,exponent,status,amount_minor from latest where kind='refund' and effective_at>=lo and effective_at<hi)
  insert into public.insight_refund_by_sku_month(tenant_id,month,channel,sku_base,currency,exponent,n,n_known,n_cancelled,amount_minor,amount_active_minor,refreshed_at,source_watermark,computed_from)
  select p_tenant,m,channel,sku_base,currency,exponent,count(*),count(amount_minor),count(*) filter(where status='cancelled'),coalesce(sum(amount_minor),0),coalesce(sum(amount_minor) filter(where status<>'cancelled'),0),ts,wm,cf
  from k group by channel,sku_base,currency,exponent;
  done_n:=done_n+1;
 end loop;
 insert into public.insight_state(tenant_id,insight,status,refreshed_at,source_watermark,source_rows,duration_ms,cursor,computed_from,detail,error_code)
 values(p_tenant,'refund_by_sku_month',case when cardinality(rest)>0 then 'partial' else 'ready' end,ts,wm,ents,(extract(epoch from clock_timestamp()-ts)*1000)::int,
  case when cardinality(rest)>0 then jsonb_build_object('months',to_jsonb(rest)) else '{}'::jsonb end,cf,jsonb_build_object('months_refreshed',done_n,'months_pending',cardinality(rest)),null)
 on conflict(tenant_id,insight) do update set status=excluded.status,refreshed_at=excluded.refreshed_at,source_watermark=excluded.source_watermark,source_rows=excluded.source_rows,
  duration_ms=excluded.duration_ms,cursor=excluded.cursor,computed_from=excluded.computed_from,detail=excluded.detail,error_code=null;
 return jsonb_build_object('insight','refund_by_sku_month','status',case when cardinality(rest)>0 then 'partial' else 'ready' end,'months',done_n,'pending',cardinality(rest),'source_watermark',wm);
end $$;

-- 10b) Conversaciones por semana/mes: se salta si no hay conversaciones/mensajes posteriores al corte; si los hay, recalcula ambas granularidades en UNA pasada (sin RLS por fila: rol propietario).
create or replace function public.insights_refresh_conversations(p_tenant uuid,p_since timestamptz,p_deadline timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare ist public.insight_state%rowtype; wm timestamptz; ts timestamptz:=clock_timestamp(); rows_n bigint; undated bigint; total bigint; cf jsonb:=jsonb_build_object('tables',jsonb_build_array('conversations','messages'),'date_rule','started_at o primer mensaje no borrado','week','ISO lunes UTC');
begin
 select * into ist from public.insight_state where tenant_id=p_tenant and insight='conversation_volume';
 select greatest((select max(created_at) from public.conversations where tenant_id=p_tenant),(select max(created_at) from public.messages where tenant_id=p_tenant)) into wm;
 if ist.tenant_id is not null and p_since is null and ist.status='ready' and ist.source_watermark is not distinct from wm then return jsonb_build_object('insight','conversation_volume','status','noop','source_watermark',wm); end if;
 perform set_config('statement_timeout',greatest(2000,least(45000,(extract(epoch from p_deadline-clock_timestamp())*1000)::int+30000))::text,true);
 create temp table pg_temp._iv_dates on commit drop as
  select coalesce(c.started_at,fm.first_at) as d from public.conversations c
  left join (select conversation_id,min(occurred_at) as first_at from public.messages where tenant_id=p_tenant and deleted_at is null group by conversation_id) fm on fm.conversation_id=c.id and c.started_at is null
  where c.tenant_id=p_tenant and c.deleted_at is null;
 delete from public.insight_conversation_volume where tenant_id=p_tenant;
 insert into public.insight_conversation_volume(tenant_id,grain,period,n,refreshed_at,source_watermark)
 select p_tenant,'month',(date_trunc('month',d at time zone 'UTC'))::date,count(*),ts,wm from pg_temp._iv_dates where d is not null group by 3
 union all select p_tenant,'week',(date_trunc('week',d at time zone 'UTC'))::date,count(*),ts,wm from pg_temp._iv_dates where d is not null group by 3;
 get diagnostics rows_n=row_count;
 select count(*) filter(where d is null),count(*) into undated,total from pg_temp._iv_dates;
 drop table pg_temp._iv_dates;
 insert into public.insight_state(tenant_id,insight,status,refreshed_at,source_watermark,source_rows,duration_ms,cursor,computed_from,detail,error_code)
 values(p_tenant,'conversation_volume','ready',ts,wm,total,(extract(epoch from clock_timestamp()-ts)*1000)::int,'{}'::jsonb,cf,jsonb_build_object('undated',undated,'total',total),null)
 on conflict(tenant_id,insight) do update set status='ready',refreshed_at=excluded.refreshed_at,source_watermark=excluded.source_watermark,source_rows=excluded.source_rows,duration_ms=excluded.duration_ms,cursor='{}'::jsonb,computed_from=excluded.computed_from,detail=excluded.detail,error_code=null;
 return jsonb_build_object('insight','conversation_volume','status','ready','rows',rows_n,'total',total,'undated',undated,'source_watermark',wm);
end $$;

-- 10c) Cierre y reapertura de hilos de HubSpot API. Hilo = payload sin type con createdAt+status (última versión por id); evento = THREAD_STATUS_CHANGE (última versión por id).
-- Reapertura = evento OPEN inmediatamente después de un CLOSED del mismo hilo. Se salta si no hay objetos nuevos.
create or replace function public.insights_refresh_threads(p_tenant uuid,p_since timestamptz,p_deadline timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare ist public.insight_state%rowtype; wm timestamptz; ts timestamptz:=clock_timestamp(); rows_n bigint; total bigint;
 cf jsonb:=jsonb_build_object('table','sync_raw_objects','threads','payload sin type con createdAt y status','reopen','OPEN justo despues de CLOSED','hours','closedAt-createdAt');
begin
 select * into ist from public.insight_state where tenant_id=p_tenant and insight='thread_resolution';
 select max(created_at),count(*) into wm,total from public.sync_raw_objects where tenant_id=p_tenant;
 if ist.tenant_id is not null and p_since is null and ist.status='ready' and ist.source_watermark is not distinct from wm and ist.source_rows=total then return jsonb_build_object('insight','thread_resolution','status','noop','source_watermark',wm); end if;
 delete from public.insight_thread_resolution where tenant_id=p_tenant;
 create temp table pg_temp._it_th on commit drop as
  with raw as (select original->'payload' p,created_at from public.sync_raw_objects where tenant_id=p_tenant)
  select distinct on(p->>'id') p->>'id' tid,(p->>'createdAt')::timestamptz c,case when p->>'closedAt' ~ '^\d{4}-\d\d-\d\dT' then (p->>'closedAt')::timestamptz end cl,p->>'status' st
  from raw where p->>'type' is null and p ? 'createdAt' and p ? 'status' and p->>'createdAt' ~ '^\d{4}-\d\d-\d\dT' and p->>'id' is not null order by p->>'id',created_at desc;
 create temp table pg_temp._it_ro on commit drop as
  with raw as (select original->'payload' p,created_at from public.sync_raw_objects where tenant_id=p_tenant),
  ev as (select distinct on(p->>'id') p->>'conversationsThreadId' tid,(p->>'createdAt')::timestamptz t,p->>'newStatus' ns from raw where p->>'type'='THREAD_STATUS_CHANGE' and p->>'createdAt' ~ '^\d{4}-\d\d-\d\dT' order by p->>'id',created_at desc)
  select tid,count(*) filter(where ns='OPEN' and prev='CLOSED') reopens,count(*) n_ev from (select tid,ns,lag(ns) over(partition by tid order by t) prev from ev) x group by tid;
 insert into public.insight_thread_resolution(tenant_id,grain,period,threads,closed,reopened_threads,close_p50_hours,close_p90_hours,closed_lt_1h,closed_gt_7d,status_events,refreshed_at,source_watermark)
 select p_tenant,g.grain,g.period,count(*),count(*) filter(where th.cl is not null and th.st='CLOSED'),count(*) filter(where coalesce(ro.reopens,0)>0),
  round((percentile_cont(0.5) within group(order by extract(epoch from th.cl-th.c)/3600) filter(where th.cl>=th.c))::numeric,1),
  round((percentile_cont(0.9) within group(order by extract(epoch from th.cl-th.c)/3600) filter(where th.cl>=th.c))::numeric,1),
  count(*) filter(where th.cl>=th.c and th.cl-th.c<interval '1 hour'),count(*) filter(where th.cl>=th.c and th.cl-th.c>interval '7 days'),coalesce(sum(ro.n_ev),0),ts,wm
 from pg_temp._it_th th left join pg_temp._it_ro ro on ro.tid=th.tid
 cross join lateral (values('month',(date_trunc('month',th.c at time zone 'UTC'))::date),('all',date '0001-01-01')) g(grain,period) group by g.grain,g.period;
 get diagnostics rows_n=row_count;
 drop table pg_temp._it_th,pg_temp._it_ro;
 insert into public.insight_state(tenant_id,insight,status,refreshed_at,source_watermark,source_rows,duration_ms,cursor,computed_from,detail,error_code)
 values(p_tenant,'thread_resolution','ready',ts,wm,total,(extract(epoch from clock_timestamp()-ts)*1000)::int,'{}'::jsonb,cf,'{}'::jsonb,null)
 on conflict(tenant_id,insight) do update set status='ready',refreshed_at=excluded.refreshed_at,source_watermark=excluded.source_watermark,source_rows=excluded.source_rows,duration_ms=excluded.duration_ms,cursor='{}'::jsonb,computed_from=excluded.computed_from,detail='{}'::jsonb,error_code=null;
 return jsonb_build_object('insight','thread_resolution','status','ready','rows',rows_n,'source_watermark',wm);
end $$;

-- 10d) Estado de reembolsos del Tracker (hoja Refunds). Última revisión por fila; se descartan filas vacías (sin estado, motivo ni monto). Categorías cerradas: lo demás es «otro».
create or replace function public.insights_refresh_tracker(p_tenant uuid,p_since timestamptz,p_deadline timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare ist public.insight_state%rowtype; wm timestamptz; ts timestamptz:=clock_timestamp(); rows_n bigint; total bigint;
 cf jsonb:=jsonb_build_object('table','tracker_row_revisions','sheet','Refunds','row_rule','ultima revision por fila','amount','sin moneda declarada (supuesto USD)','categories','catalogo cerrado');
begin
 select * into ist from public.insight_state where tenant_id=p_tenant and insight='tracker_refund_status';
 select max(created_at),count(*) into wm,total from public.tracker_row_revisions where tenant_id=p_tenant and sheet_name='Refunds';
 if ist.tenant_id is not null and p_since is null and ist.status='ready' and ist.source_watermark is not distinct from wm and ist.source_rows=total then return jsonb_build_object('insight','tracker_refund_status','status','noop','source_watermark',wm); end if;
 delete from public.insight_tracker_refund_status where tenant_id=p_tenant;
 with hdr as (select distinct (c->>'col')::int col,c->>'v' name from public.tracker_row_revisions r,jsonb_array_elements(r.cells) c where r.tenant_id=p_tenant and r.sheet_name='Refunds' and r.ticket_state='header'),
 latest as (select distinct on(row_number) row_number,cells from public.tracker_row_revisions where tenant_id=p_tenant and sheet_name='Refunds' and ticket_state<>'header' order by row_number,created_at desc),
 f as (select l.row_number,
   max(case when h.name='Status' then lower(btrim(c->>'v')) end) st,max(case when h.name in('Contact_reason','Contact Reason') then lower(btrim(c->>'v')) end) rs,
   max(case when h.name='Retailer' then lower(btrim(c->>'v')) end) rt,max(case when h.name='Amount' then regexp_replace(coalesce(c->>'v',''),'[^0-9.]','','g') end) amt
   from latest l join lateral jsonb_array_elements(l.cells) c on true join hdr h on h.col=(c->>'col')::int group by l.row_number),
 k as (select case when coalesce(st,'') in('refunded','refunded by amazon') then 'reembolsado' when st='older than 180 days' then 'vencido' when st in('can not refund','cannot refund') then 'no_reembolsable' when st='rejected' then 'rechazado'
    when st='submitted' then 'enviado' when coalesce(st,'')='' then 'sin_estado' else 'otro' end status_class,
   case when coalesce(rs,'')='' then 'sin_motivo' when rs in('defective','order','warranty','return','shipping','not as expected','change mind','price match') then replace(rs,' ','_') else 'otro' end reason_class,
   case when coalesce(rt,'')='' then 'sin_retailer' when rt like 'amazon%' then 'amazon' when rt like 'walmart%' then 'walmart' when rt like 'best buy%' then 'bestbuy' when rt like 'clientex%' then 'tienda' when rt like 'lowe%' then 'lowes' when rt like 'home depot%' then 'homedepot' else 'otro' end retailer_class,
   case when amt ~ '^[0-9]+(\.[0-9]+)?$' then round(amt::numeric*100) end amt_minor,
   (coalesce(st,'')='' and coalesce(rs,'')='' and coalesce(amt,'')='') empty_row from f)
 insert into public.insight_tracker_refund_status(tenant_id,status_class,reason_class,retailer_class,n,n_amount,amount_minor,refreshed_at,source_watermark)
 select p_tenant,status_class,reason_class,retailer_class,count(*),count(amt_minor),coalesce(sum(amt_minor),0),ts,wm from k where not empty_row group by 1,2,3,4;
 get diagnostics rows_n=row_count;
 insert into public.insight_state(tenant_id,insight,status,refreshed_at,source_watermark,source_rows,duration_ms,cursor,computed_from,detail,error_code)
 values(p_tenant,'tracker_refund_status','ready',ts,wm,total,(extract(epoch from clock_timestamp()-ts)*1000)::int,'{}'::jsonb,cf,'{}'::jsonb,null)
 on conflict(tenant_id,insight) do update set status='ready',refreshed_at=excluded.refreshed_at,source_watermark=excluded.source_watermark,source_rows=excluded.source_rows,duration_ms=excluded.duration_ms,cursor='{}'::jsonb,computed_from=excluded.computed_from,detail='{}'::jsonb,error_code=null;
 return jsonb_build_object('insight','tracker_refund_status','status','ready','rows',rows_n,'source_watermark',wm);
end $$;

-- 10e) Contacto repetido: delega en refresh_contact_repeat (20261102000000) si existe; registra su frescura. No duplica el cálculo.
create or replace function public.insights_refresh_contacts(p_tenant uuid,p_since timestamptz,p_deadline timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare ts timestamptz:=clock_timestamp(); wm timestamptz; prev timestamptz; res jsonb; cf jsonb:=jsonb_build_object('function','refresh_contact_repeat','table','contact_repeat_summary');
begin
 if to_regprocedure('public.refresh_contact_repeat(uuid)') is null then
  insert into public.insight_state(tenant_id,insight,status,refreshed_at,computed_from,detail) values(p_tenant,'repeat_contact','skipped',ts,cf,jsonb_build_object('reason','refresh_contact_repeat no existe (aplique 20261102000000)'))
   on conflict(tenant_id,insight) do update set status='skipped',refreshed_at=excluded.refreshed_at,computed_from=excluded.computed_from,detail=excluded.detail;
  return jsonb_build_object('insight','repeat_contact','status','skipped');
 end if;
 select max(created_at) into wm from public.conversation_customer_association_bindings where tenant_id=p_tenant;
 select source_watermark into prev from public.insight_state where tenant_id=p_tenant and insight='repeat_contact' and status='ready';
 if p_since is null and prev is not distinct from wm and exists(select 1 from public.insight_state where tenant_id=p_tenant and insight='repeat_contact' and status='ready') then return jsonb_build_object('insight','repeat_contact','status','noop','source_watermark',wm); end if;
 perform set_config('statement_timeout','45000',true);
 execute 'select public.refresh_contact_repeat($1)' into res using p_tenant;
 insert into public.insight_state(tenant_id,insight,status,refreshed_at,source_watermark,source_rows,duration_ms,computed_from,detail)
 values(p_tenant,'repeat_contact','ready',ts,wm,coalesce((res->>'linked_tickets')::bigint,0),(extract(epoch from clock_timestamp()-ts)*1000)::int,cf,jsonb_build_object('contacts',res->'contacts','contacts_ge2_90',res->'contacts_ge2_90','contacts_ge3_90',res->'contacts_ge3_90'))
 on conflict(tenant_id,insight) do update set status='ready',refreshed_at=excluded.refreshed_at,source_watermark=excluded.source_watermark,source_rows=excluded.source_rows,duration_ms=excluded.duration_ms,computed_from=excluded.computed_from,detail=excluded.detail,error_code=null;
 return jsonb_build_object('insight','repeat_contact','status','ready','source_watermark',wm);
end $$;
revoke all on function public.insights_refresh_refund_sku(uuid,timestamptz,timestamptz),public.insights_refresh_conversations(uuid,timestamptz,timestamptz),public.insights_refresh_threads(uuid,timestamptz,timestamptz),
 public.insights_refresh_tracker(uuid,timestamptz,timestamptz),public.insights_refresh_contacts(uuid,timestamptz,timestamptz) from public,anon,authenticated,service_role,vexa_backend;

-- 11) Despachador. p_source: ledger | conversations | hubspot | tracker | contacts | all. p_since NULL = usar el corte guardado (incremental); un valor fuerza revisar desde esa fecha.
-- Un candado consultivo por (tenant, fuente) evita refrescos simultáneos ('busy'). Cada insight corre en su propio sub-bloque: si falla, queda 'failed' con el código SQLSTATE y los demás siguen.
-- p_budget_ms acota SOLO el reparto entre meses del libro (lo que falta queda en el cursor y se reanuda en la siguiente llamada); el tope de sentencia del rol sigue vigente.
create or replace function public.refresh_insights(p_tenant uuid,p_source text default 'all',p_since timestamptz default null,p_budget_ms integer default 8000) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t0 timestamptz:=clock_timestamp(); deadline timestamptz; out jsonb:='[]'::jsonb; r jsonb; names text[]; n text; ins text;
begin
 if not public.insights_authorized(p_tenant) then raise exception 'denied' using errcode='42501'; end if;
 if p_source is null or p_source not in('ledger','conversations','hubspot','tracker','contacts','all') or p_budget_ms is null or p_budget_ms<500 or p_budget_ms>600000 then raise exception 'INSIGHT_INPUT_INVALID' using errcode='22023'; end if;
 if not exists(select 1 from public.organizations where id=p_tenant) then raise exception 'INSIGHT_TENANT_UNKNOWN' using errcode='22023'; end if;
 perform set_config('lock_timeout','5s',true);
 if not pg_try_advisory_xact_lock(hashtextextended(p_tenant::text||':insights:'||p_source,0)) then return jsonb_build_object('tenant',p_tenant,'source',p_source,'status','busy'); end if;
 deadline:=t0+p_budget_ms*interval '1 millisecond';
 names:=case p_source when 'all' then array['ledger','conversations','hubspot','tracker','contacts'] else array[p_source] end;
 foreach n in array names loop
  ins:=case n when 'ledger' then 'refund_by_sku_month' when 'conversations' then 'conversation_volume' when 'hubspot' then 'thread_resolution' when 'tracker' then 'tracker_refund_status' else 'repeat_contact' end;
  begin
   r:=case n when 'ledger' then public.insights_refresh_refund_sku(p_tenant,p_since,deadline) when 'conversations' then public.insights_refresh_conversations(p_tenant,p_since,deadline)
     when 'hubspot' then public.insights_refresh_threads(p_tenant,p_since,deadline) when 'tracker' then public.insights_refresh_tracker(p_tenant,p_since,deadline) else public.insights_refresh_contacts(p_tenant,p_since,deadline) end;
  exception when others then
   r:=jsonb_build_object('insight',ins,'status','failed','error',sqlstate);
   insert into public.insight_state(tenant_id,insight,status,refreshed_at,error_code) values(p_tenant,ins,'failed',clock_timestamp(),left(sqlstate,16))
    on conflict(tenant_id,insight) do update set status='failed',refreshed_at=excluded.refreshed_at,error_code=excluded.error_code;
  end;
  out:=out||jsonb_build_array(r);
 end loop;
 return jsonb_build_object('tenant',p_tenant,'source',p_source,'status','done','results',out,'duration_ms',(extract(epoch from clock_timestamp()-t0)*1000)::int);
end $$;
revoke all on function public.refresh_insights(uuid,text,timestamptz,integer) from public,anon,authenticated,service_role;
grant execute on function public.refresh_insights(uuid,text,timestamptz,integer) to vexa_backend;
commit;
