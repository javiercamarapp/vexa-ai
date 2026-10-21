-- 20261022000000: RESÚMENES PRECOMPUTADOS (libro económico por mes, conversaciones por mes, conteos del libro y de asociaciones).
-- Por qué: el libro tiene ~85 mil asientos y /cfo, la gráfica «Conversaciones» y la cobertura recalculaban «última revisión por entidad» / «primer mensaje por
-- conversación» en CADA lectura (7.4 s medidos, tope 4.5 s). Aquí el cálculo pesado corre UNA vez por refresco (fuera de la ruta del usuario) y la lectura
-- es un SELECT sobre unas decenas de filas. NO cambia ninguna política, función ni dato existente: solo AÑADE tablas, funciones e índices.
-- Qué NO hace: no se refresca solo (ver NOTAS: el refresco lo ejecuta un operador con `select public.refresh_*`), y la aplicación no puede escribir en ellos.
-- Orden de aplicación: puede aplicarse antes o después del código. Sin la migración el código usa el camino anterior (consulta directa/muestra rotulada «Estimado»);
-- con la migración pero sin refrescar, igual (las lecturas ven el resumen ausente). Solo cuando existe el refresco se muestra «Resumen al <fecha>».
-- Bloqueo: los CREATE INDEX (no CONCURRENTLY: corren en transacción) bloquean escrituras de cada tabla ~1 s mientras se construyen; las lecturas no. lock_timeout falla pronto.
-- Idempotente: tablas/índices «if not exists», políticas drop+create, funciones create or replace.
begin;
set local lock_timeout='3s';
do $$
begin
 if to_regclass('public.economic_ledger_entries') is null or to_regclass('public.conversations') is null or to_regclass('public.messages') is null then
  raise exception 'faltan tablas base: aplique antes 0002_sources y 0018_economic_runtime';
 end if;
 if to_regclass('public.native_customer_associations') is null or to_regclass('public.conversation_customer_association_bindings') is null then
  raise exception 'faltan tablas de asociaciones: aplique antes 0045_native_customer_associations';
 end if;
 if to_regprocedure('public.vexa_member(uuid,text[])') is null then raise exception 'falta public.vexa_member'; end if;
 -- Las funciones SECURITY DEFINER escriben en tablas con RLS forzada: su propietario (postgres en Supabase) debe poder saltar RLS.
 if not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
  raise exception 'el propietario de la migración (%) debe ser superusuario o tener BYPASSRLS', current_user;
 end if;
end $$;

-- 1) Índices que hacen barata la DETECCIÓN DE OBSOLESCENCIA (máximo de una columna de fecha por tenant = una lectura de índice).
create index if not exists economic_ledger_entries_recent_idx on public.economic_ledger_entries(tenant_id,effective_at desc,entity_id desc);
create index if not exists economic_ledger_entries_recorded_idx on public.economic_ledger_entries(tenant_id,recorded_at desc);
create index if not exists association_fact_updated on public.native_customer_associations(tenant_id,updated_at desc);
create index if not exists association_binding_created on public.conversation_customer_association_bindings(tenant_id,created_at desc);
create index if not exists association_binding_deactivated on public.conversation_customer_association_bindings(tenant_id,deactivated_at desc) where deactivated_at is not null;

-- 2) Estado de refresco: una fila por (resumen, alcance). Dice CUÁNDO se calculó y contra qué corte del origen; sin fila = nunca calculado (ausente), no «cero».
create table if not exists public.summary_refresh_state(
 tenant_id uuid not null references public.organizations(id),
 summary text not null check(summary in('ledger_monthly','ledger_counts','conversation_monthly','association_counts')),
 scope_month date not null default date '0001-01-01' check(scope_month=date_trunc('month',scope_month)::date),
 refreshed_at timestamptz not null,
 source_watermark timestamptz,
 source_count bigint check(source_count is null or source_count>=0),
 source_rows bigint not null check(source_rows>=0),
 detail jsonb not null default '{}'::jsonb check(jsonb_typeof(detail)='object'),
 primary key(tenant_id,summary,scope_month)
);

-- 3) Libro económico por mes: MISMA lógica que LEDGER_MONTHLY_SQL (última revisión por entidad, mes UTC de effective_at, sin sumar monedas ni bases).
create table if not exists public.economic_ledger_monthly(
 tenant_id uuid not null references public.organizations(id),
 month date not null check(month=date_trunc('month',month)::date),
 source_id uuid not null,
 kind text not null check(kind in('order','refund')),
 status text not null,
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 exponent smallint not null check(exponent between 0 and 4),
 basis text not null,
 n bigint not null check(n>0),
 known bigint not null check(known between 0 and n),
 amount_minor numeric not null,
 refreshed_at timestamptz not null,
 ledger_watermark timestamptz,
 primary key(tenant_id,month,source_id,kind,status,currency,exponent,basis)
);

-- 4) Conteos del libro por fuente·moneda·tipo (para la cobertura): entidades distintas y revisiones guardadas.
create table if not exists public.economic_ledger_counts(
 tenant_id uuid not null references public.organizations(id),
 source_id uuid not null,
 currency text not null,
 kind text not null,
 entities bigint not null check(entities>0),
 revisions bigint not null check(revisions>=entities),
 refreshed_at timestamptz not null,
 ledger_watermark timestamptz,
 primary key(tenant_id,source_id,currency,kind)
);

-- 5) Conversaciones por mes de su fecha: started_at o, si falta, el primer messages.occurred_at (misma definición que la gráfica). La cuenta sin fecha vive en el estado.
create table if not exists public.conversation_monthly(
 tenant_id uuid not null references public.organizations(id),
 month date not null check(month=date_trunc('month',month)::date),
 n bigint not null check(n>0),
 refreshed_at timestamptz not null,
 source_watermark timestamptz,
 primary key(tenant_id,month)
);

-- 6) Conteos mantenidos de las asociaciones HubSpot: NO dependen de la política initplan 20261021000000 (se calculan con el rol propietario, sin RLS por fila).
create table if not exists public.association_counts(
 tenant_id uuid not null references public.organizations(id),
 metric text not null check(metric in('fact_resolved','fact_pending','fact_blocked','fact_retained','binding_active')),
 n bigint not null check(n>=0),
 refreshed_at timestamptz not null,
 source_watermark timestamptz,
 primary key(tenant_id,metric)
);

-- 7) RLS forzada, solo lectura para la aplicación, mismo patrón que 0055: la membresía se evalúa UNA vez por sentencia.
do $$
declare t text;
begin
 foreach t in array array['summary_refresh_state','economic_ledger_monthly','economic_ledger_counts','conversation_monthly','association_counts'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role,vexa_backend',t);
  execute format('grant select on public.%I to vexa_backend',t);
  execute format('drop policy if exists summary_read on public.%I',t);
  execute format('create policy summary_read on public.%I for select to vexa_backend using(tenant_id=nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid and (select public.vexa_member(nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid)))',t);
 end loop;
end $$;

-- 8) Funciones de refresco. SECURITY DEFINER acotadas: search_path vacío, nombres calificados, entradas validadas, un candado consultivo por (tenant, resumen)
-- para que dos refrescos no se pisen, y SIN ningún GRANT: solo las ejecuta el propietario (operador con rol postgres). La aplicación (vexa_backend) no puede llamarlas.
-- Cada una REEMPLAZA su alcance dentro de UNA transacción: repetirla da el mismo resultado (idempotente) y los lectores ven el resumen anterior hasta el commit.
create or replace function public.refresh_economic_ledger_monthly(p_tenant uuid,p_month date) returns jsonb language plpgsql security definer set search_path='' as $$
declare m date; lo timestamptz; hi timestamptz; wm timestamptz; cnt bigint; ts timestamptz:=clock_timestamp(); rows_n bigint; ents bigint;
begin
 if p_tenant is null or p_month is null or p_month<date '2000-01-01' or p_month>=date '2100-01-01' then raise exception 'SUMMARY_INPUT_INVALID' using errcode='22023'; end if;
 if not exists(select 1 from public.organizations where id=p_tenant) then raise exception 'SUMMARY_TENANT_UNKNOWN' using errcode='22023'; end if;
 m:=date_trunc('month',p_month)::date; lo:=m::timestamp at time zone 'UTC'; hi:=(m+interval '1 month')::timestamp at time zone 'UTC';
 perform set_config('lock_timeout','5s',true);
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':summary:ledger_monthly:'||m::text,0));
 -- Corte del origen ANTES de calcular: lo que llegue después se marcará como posterior (conservador).
 select max(recorded_at),count(*) into wm,cnt from public.economic_ledger_entries where tenant_id=p_tenant;
 delete from public.economic_ledger_monthly where tenant_id=p_tenant and month=m;
 -- Entidades con alguna revisión en el mes (candidatas) -> su ÚLTIMA revisión global -> se conserva si esa última cae en el mes.
 with cand as (select distinct entity_id from public.economic_ledger_entries where tenant_id=p_tenant and kind in('order','refund') and effective_at>=lo and effective_at<hi),
 latest as (select distinct on(e.entity_id) e.source_id,e.kind,e.status,e.effective_at,e.currency,e.exponent,e.basis,e.amount_minor
   from public.economic_ledger_entries e join cand c on c.entity_id=e.entity_id where e.tenant_id=p_tenant and e.kind in('order','refund') order by e.entity_id,e.revision desc)
 insert into public.economic_ledger_monthly(tenant_id,month,source_id,kind,status,currency,exponent,basis,n,known,amount_minor,refreshed_at,ledger_watermark)
 select p_tenant,m,source_id,kind,status,currency,exponent,basis,count(*),count(amount_minor),coalesce(sum(amount_minor),0),ts,wm
 from latest where effective_at>=lo and effective_at<hi group by source_id,kind,status,currency,exponent,basis;
 get diagnostics rows_n=row_count;
 select coalesce(sum(n),0) into ents from public.economic_ledger_monthly where tenant_id=p_tenant and month=m;
 insert into public.summary_refresh_state(tenant_id,summary,scope_month,refreshed_at,source_watermark,source_count,source_rows,detail)
 values(p_tenant,'ledger_monthly',m,ts,wm,cnt,rows_n,jsonb_build_object('entities',ents))
 on conflict(tenant_id,summary,scope_month) do update set refreshed_at=excluded.refreshed_at,source_watermark=excluded.source_watermark,source_count=excluded.source_count,source_rows=excluded.source_rows,detail=excluded.detail;
 return jsonb_build_object('summary','ledger_monthly','month',m,'rows',rows_n,'entities',ents,'ledger_watermark',wm,'ledger_rows',cnt,'refreshed_at',ts);
end $$;

create or replace function public.refresh_economic_ledger_counts(p_tenant uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare wm timestamptz; cnt bigint; ts timestamptz:=clock_timestamp(); rows_n bigint;
begin
 if p_tenant is null then raise exception 'SUMMARY_INPUT_INVALID' using errcode='22023'; end if;
 if not exists(select 1 from public.organizations where id=p_tenant) then raise exception 'SUMMARY_TENANT_UNKNOWN' using errcode='22023'; end if;
 perform set_config('lock_timeout','5s',true);
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':summary:ledger_counts',0));
 select max(recorded_at),count(*) into wm,cnt from public.economic_ledger_entries where tenant_id=p_tenant;
 delete from public.economic_ledger_counts where tenant_id=p_tenant;
 insert into public.economic_ledger_counts(tenant_id,source_id,currency,kind,entities,revisions,refreshed_at,ledger_watermark)
 select p_tenant,source_id,currency,kind,count(distinct entity_id),count(*),ts,wm from public.economic_ledger_entries where tenant_id=p_tenant group by source_id,currency,kind;
 get diagnostics rows_n=row_count;
 insert into public.summary_refresh_state(tenant_id,summary,scope_month,refreshed_at,source_watermark,source_count,source_rows,detail)
 values(p_tenant,'ledger_counts',date '0001-01-01',ts,wm,cnt,rows_n,'{}'::jsonb)
 on conflict(tenant_id,summary,scope_month) do update set refreshed_at=excluded.refreshed_at,source_watermark=excluded.source_watermark,source_count=excluded.source_count,source_rows=excluded.source_rows,detail=excluded.detail;
 return jsonb_build_object('summary','ledger_counts','rows',rows_n,'ledger_watermark',wm,'ledger_rows',cnt,'refreshed_at',ts);
end $$;

create or replace function public.refresh_conversation_monthly(p_tenant uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare wm timestamptz; ts timestamptz:=clock_timestamp(); rows_n bigint; undated bigint; total bigint;
begin
 if p_tenant is null then raise exception 'SUMMARY_INPUT_INVALID' using errcode='22023'; end if;
 if not exists(select 1 from public.organizations where id=p_tenant) then raise exception 'SUMMARY_TENANT_UNKNOWN' using errcode='22023'; end if;
 perform set_config('lock_timeout','5s',true);
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':summary:conversation_monthly',0));
 select greatest((select max(created_at) from public.conversations where tenant_id=p_tenant),(select max(created_at) from public.messages where tenant_id=p_tenant)) into wm;
 delete from public.conversation_monthly where tenant_id=p_tenant;
 -- Fecha de la conversación = started_at o el primer mensaje no borrado (idéntico a trends.mjs); sin ninguna de las dos = «sin fecha».
 create temp table pg_temp._conv_dates on commit drop as
  select coalesce(c.started_at,fm.first_at) as d from public.conversations c
  left join (select conversation_id,min(occurred_at) as first_at from public.messages where tenant_id=p_tenant and deleted_at is null group by conversation_id) fm on fm.conversation_id=c.id and c.started_at is null
  where c.tenant_id=p_tenant and c.deleted_at is null;
 insert into public.conversation_monthly(tenant_id,month,n,refreshed_at,source_watermark)
 select p_tenant,(date_trunc('month',d at time zone 'UTC'))::date,count(*),ts,wm from pg_temp._conv_dates where d is not null group by 2;
 get diagnostics rows_n=row_count;
 select count(*) filter(where d is null),count(*) into undated,total from pg_temp._conv_dates;
 drop table pg_temp._conv_dates;
 insert into public.summary_refresh_state(tenant_id,summary,scope_month,refreshed_at,source_watermark,source_count,source_rows,detail)
 values(p_tenant,'conversation_monthly',date '0001-01-01',ts,wm,null,rows_n,jsonb_build_object('undated',undated,'total',total))
 on conflict(tenant_id,summary,scope_month) do update set refreshed_at=excluded.refreshed_at,source_watermark=excluded.source_watermark,source_count=excluded.source_count,source_rows=excluded.source_rows,detail=excluded.detail;
 return jsonb_build_object('summary','conversation_monthly','months',rows_n,'total',total,'undated',undated,'source_watermark',wm,'refreshed_at',ts);
end $$;

create or replace function public.refresh_association_counts(p_tenant uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare wm timestamptz; ts timestamptz:=clock_timestamp(); facts bigint; links bigint;
begin
 if p_tenant is null then raise exception 'SUMMARY_INPUT_INVALID' using errcode='22023'; end if;
 if not exists(select 1 from public.organizations where id=p_tenant) then raise exception 'SUMMARY_TENANT_UNKNOWN' using errcode='22023'; end if;
 perform set_config('lock_timeout','5s',true);
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':summary:association_counts',0));
 select greatest((select max(updated_at) from public.native_customer_associations where tenant_id=p_tenant),(select max(created_at) from public.conversation_customer_association_bindings where tenant_id=p_tenant),
  (select max(deactivated_at) from public.conversation_customer_association_bindings where tenant_id=p_tenant and deactivated_at is not null)) into wm;
 delete from public.association_counts where tenant_id=p_tenant;
 insert into public.association_counts(tenant_id,metric,n,refreshed_at,source_watermark)
 select p_tenant,'fact_'||s.state,(select count(*) from public.native_customer_associations f where f.tenant_id=p_tenant and f.resolution_state=s.state),ts,wm
 from (values('resolved'),('pending'),('blocked'),('retained')) s(state);
 insert into public.association_counts(tenant_id,metric,n,refreshed_at,source_watermark)
 select p_tenant,'binding_active',count(*),ts,wm from public.conversation_customer_association_bindings where tenant_id=p_tenant and active;
 select coalesce(sum(n) filter(where metric like 'fact_%'),0),coalesce(sum(n) filter(where metric='binding_active'),0) into facts,links from public.association_counts where tenant_id=p_tenant;
 insert into public.summary_refresh_state(tenant_id,summary,scope_month,refreshed_at,source_watermark,source_count,source_rows,detail)
 values(p_tenant,'association_counts',date '0001-01-01',ts,wm,null,5,jsonb_build_object('facts',facts,'links',links))
 on conflict(tenant_id,summary,scope_month) do update set refreshed_at=excluded.refreshed_at,source_watermark=excluded.source_watermark,source_count=excluded.source_count,source_rows=excluded.source_rows,detail=excluded.detail;
 return jsonb_build_object('summary','association_counts','facts',facts,'links',links,'source_watermark',wm,'refreshed_at',ts);
end $$;

revoke all on function public.refresh_economic_ledger_monthly(uuid,date),public.refresh_economic_ledger_counts(uuid),public.refresh_conversation_monthly(uuid),public.refresh_association_counts(uuid) from public,anon,authenticated,service_role,vexa_backend;
commit;
