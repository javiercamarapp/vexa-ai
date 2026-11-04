-- 20261213000000: RESUMEN PRECOMPUTADO de la cobertura de pedidos, envíos y devoluciones. SOLO aditiva: una tabla y una función; no cambia ninguna vista, política ni dato.
-- Por qué: order_link_coverage (19.6 s medidos) y order_returns_coverage (4.4 s) recalculan order_ledger_keys (última revisión por entidad sobre ~86 mil asientos, con funciones de
-- normalización) en CADA lectura; el panel tiene un tope de 4 s. Aquí el cálculo corre UNA vez por refresco, fuera de la ruta del usuario, y la lectura es un SELECT de dos filas.
-- Patrón de 20261022000000_precomputed_summaries: RLS forzada, política summary_read con vexa_member, SELECT solo a vexa_backend, función SECURITY DEFINER sin ningún GRANT
-- (la ejecuta solo el propietario/operador), idempotente. La aplicación NO puede escribir. Ausente != cero: sin fila el panel dice «el resumen aún no se ha calculado».
-- No se duplica la lógica de cobertura: la función lee de las vistas existentes (filtrando por tenant_id). Las filas son agregados por retailer/tipo/mes: sin IDs de pedido ni datos personales.
-- NOTA: el tope de tiempo del cálculo (~25 s medidos) lo fija la sesión que llama (scripts/13-refrescar: set statement_timeout antes del select); una función no puede ampliar el tope de la sentencia en curso.
-- ORDEN: aplicar migración -> desplegar el código -> refrescar (select public.refresh_order_coverage(<tenant>)). Sin migración el código dice «no disponible»; sin refresco, «aún no calculado».
-- Dependencias: 20261210000000_order_links, 20261211000000_order_returns y 20261212000000_order_returns_po (las vistas). Falla claro si faltan.
-- Idempotente: tabla «if not exists», política drop+create, función create or replace. Bloqueo: lock_timeout 3 s; una tabla nueva no bloquea nada existente.
begin;
set local lock_timeout='3s';
do $$
begin
 if to_regclass('public.order_link_coverage') is null or to_regclass('public.order_returns_coverage') is null then
  raise exception 'DEPENDENCIA_FALTANTE: aplique primero 20261210000000_order_links, 20261211000000_order_returns y 20261212000000_order_returns_po';
 end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='order_returns' and column_name='po_key') then
  raise exception 'DEPENDENCIA_FALTANTE: falta order_returns.po_key (20261212000000_order_returns_po)';
 end if;
 if to_regclass('public.organizations') is null or to_regprocedure('public.vexa_member(uuid,text[])') is null then raise exception 'DEPENDENCIA_FALTANTE: falta organizations o public.vexa_member'; end if;
 -- La función SECURITY DEFINER lee las vistas (sin permisos para nadie más) y escribe en una tabla con RLS forzada: su propietario debe poder saltar RLS.
 if not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
  raise exception 'SIN_BYPASSRLS: el propietario de la migración (%) debe ser superusuario o tener BYPASSRLS', current_user;
 end if;
end $$;

create table if not exists public.order_coverage_summary(
 tenant_id uuid not null references public.organizations(id),
 kind text not null check(kind in('enlaces','devoluciones')),
 rows jsonb not null check(jsonb_typeof(rows)='array'),
 refreshed_at timestamptz not null,
 source_rows bigint not null check(source_rows>=0),
 primary key(tenant_id,kind)
);
alter table public.order_coverage_summary enable row level security;
alter table public.order_coverage_summary force row level security;
revoke all on public.order_coverage_summary from public,anon,authenticated,service_role,vexa_backend;
grant select on public.order_coverage_summary to vexa_backend;
drop policy if exists summary_read on public.order_coverage_summary;
create policy summary_read on public.order_coverage_summary for select to vexa_backend
 using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (select public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid)));

-- Reemplaza las dos filas del tenant dentro de UNA transacción: repetirla da el mismo resultado y los lectores ven el resumen anterior hasta el commit.
-- Un candado consultivo por tenant evita que dos refrescos se pisen. Solo el propietario la ejecuta (sin GRANT); la aplicación (vexa_backend) no puede llamarla.
create or replace function public.refresh_order_coverage(p_tenant uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare ts timestamptz:=clock_timestamp(); n_e bigint; n_d bigint;
begin
 if p_tenant is null then raise exception 'SUMMARY_INPUT_INVALID' using errcode='22023'; end if;
 if not exists(select 1 from public.organizations where id=p_tenant) then raise exception 'SUMMARY_TENANT_UNKNOWN' using errcode='22023'; end if;
 perform set_config('lock_timeout','5s',true);
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':summary:order_coverage',0));
 insert into public.order_coverage_summary(tenant_id,kind,rows,refreshed_at,source_rows)
 select p_tenant,'enlaces',coalesce(jsonb_agg(to_jsonb(v)-'tenant_id' order by v.retailer,v.entidad,v.tipo),'[]'::jsonb),ts,count(*) from public.order_link_coverage v where v.tenant_id=p_tenant
 on conflict(tenant_id,kind) do update set rows=excluded.rows,refreshed_at=excluded.refreshed_at,source_rows=excluded.source_rows;
 insert into public.order_coverage_summary(tenant_id,kind,rows,refreshed_at,source_rows)
 select p_tenant,'devoluciones',coalesce(jsonb_agg(to_jsonb(v)-'tenant_id' order by v.retailer,v.mes),'[]'::jsonb),ts,count(*) from public.order_returns_coverage v where v.tenant_id=p_tenant
 on conflict(tenant_id,kind) do update set rows=excluded.rows,refreshed_at=excluded.refreshed_at,source_rows=excluded.source_rows;
 select source_rows into n_e from public.order_coverage_summary where tenant_id=p_tenant and kind='enlaces';
 select source_rows into n_d from public.order_coverage_summary where tenant_id=p_tenant and kind='devoluciones';
 return jsonb_build_object('summary','order_coverage','enlaces',n_e,'devoluciones',n_d,'refreshed_at',ts);
end $$;
revoke all on function public.refresh_order_coverage(uuid) from public,anon,authenticated,service_role,vexa_backend;
commit;
