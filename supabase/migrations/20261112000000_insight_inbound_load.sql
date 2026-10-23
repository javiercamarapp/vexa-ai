-- 20261112000000 (PROPUESTA, NO APLICADA): carga entrante por mes x día de la semana x hora (America/Mexico_City), precalculada.
-- Por qué: «Carga y SLA» (/workload) hoy calcula la matriz al abrirse escaneando mensajes (≈6.5 s como superusuario; bajo RLS puede pasar de 25 s) y se queda en «No disponible ahora»
-- si no cabe en el tope. Con esta tabla la pantalla hace un SELECT de unas cuantas decenas de filas (7 x 24 x meses). Mientras no se aplique, la pantalla sigue calculando en vivo con tope.
-- Definición: conversación entrante = primer mensaje del cliente (role='customer') de cada conversación; el mes/día/hora se toman en America/Mexico_City.
-- Mismo patrón que 20261104000000 (RLS initplan, solo SELECT para vexa_backend, escritura solo por función SECURITY DEFINER autorizada). Depende de 20261104000000 (insights_authorized, insight_state).
do $$ begin
 if to_regprocedure('public.insights_authorized(uuid)') is null or to_regclass('public.insight_state') is null then raise exception 'aplique antes 20261104000000_insights_engine'; end if;
end $$;

create table if not exists public.insight_inbound_load(
 tenant_id uuid not null references public.organizations(id),
 month date not null check(month=date_trunc('month',month)::date),
 dow smallint not null check(dow between 1 and 7),   -- ISO: lunes=1 … domingo=7
 hour smallint not null check(hour between 0 and 23),
 n integer not null check(n>=0),
 refreshed_at timestamptz not null,
 source_watermark timestamptz,
 primary key(tenant_id,month,dow,hour)
);
alter table public.insight_inbound_load enable row level security;
alter table public.insight_inbound_load force row level security;
revoke all on public.insight_inbound_load from public,anon,authenticated,service_role,vexa_backend;
grant select on public.insight_inbound_load to vexa_backend;
drop policy if exists insight_read on public.insight_inbound_load;
create policy insight_read on public.insight_inbound_load for select to vexa_backend
 using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (select public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid)));

-- Recalcula un mes (o todos si p_month es null). Idempotente: reemplaza los meses tocados completos. Sin PII: solo conteos.
create or replace function public.refresh_inbound_load(p_tenant uuid,p_month date default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare ts timestamptz:=clock_timestamp(); wm timestamptz; rows_n bigint;
begin
 if not public.insights_authorized(p_tenant) then raise exception 'denied' using errcode='42501'; end if;
 select max(occurred_at) into wm from public.messages where tenant_id=p_tenant and role='customer';
 delete from public.insight_inbound_load where tenant_id=p_tenant and (p_month is null or month=date_trunc('month',p_month)::date);
 insert into public.insight_inbound_load(tenant_id,month,dow,hour,n,refreshed_at,source_watermark)
 select p_tenant,date_trunc('month',c1 at time zone 'America/Mexico_City')::date,extract(isodow from c1 at time zone 'America/Mexico_City')::int,extract(hour from c1 at time zone 'America/Mexico_City')::int,count(*),ts,wm
 from (select conversation_id,min(occurred_at) c1 from public.messages where tenant_id=p_tenant and deleted_at is null and role='customer' group by 1) f
 where p_month is null or date_trunc('month',c1 at time zone 'America/Mexico_City')::date=date_trunc('month',p_month)::date
 group by 2,3,4;
 get diagnostics rows_n=row_count;
 return jsonb_build_object('insight','inbound_load','status','ready','rows',rows_n,'source_watermark',wm);
end $$;
revoke all on function public.refresh_inbound_load(uuid,date) from public,anon,authenticated,service_role;
grant execute on function public.refresh_inbound_load(uuid,date) to vexa_backend;
-- Disparo: tras aplicarla, el operador corre `select public.refresh_inbound_load('<tenant>');` (≈7 s); el gancho de refresh_insights puede llamarla después (no se cambió aquí).
