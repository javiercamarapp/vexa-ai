begin;
-- Dependencia: 20261210000000_order_links (order_id_normalize, order_retailer_normalize, order_ledger_keys, order_shipments). Falla claro si falta.
do $g$ begin
 if to_regprocedure('public.order_id_normalize(text)') is null or to_regprocedure('public.order_retailer_normalize(text)') is null
  or to_regclass('public.order_ledger_keys') is null or to_regclass('public.order_shipments') is null then
  raise exception 'DEPENDENCIA_FALTANTE: aplique primero 20261210000000_order_links (order_id_normalize, order_retailer_normalize, order_ledger_keys, order_shipments)';
 end if;
end $g$;
-- Devoluciones de marketplace (Amazon, Walmart) con el MINIMO de datos personales. Aditiva: no redefine nada de 20261210000000_order_links.
-- Se guarda: retailer, llave de la devolucion (id/RMA + linea), pedido normalizado (paridad con order_id_normalize), motivo, estado y canal de juego de caracteres
-- y longitud limitados, fechas, id de articulo del marketplace, cantidad y si hubo tracking de retorno (booleano, NUNCA el numero).
-- Guarda contra texto libre/datos personales en motivo, estado y canal (criterio estadistico, no un catalogo): motivo sin corridas de 6+ digitos y <=6 palabras;
-- estado y canal solo letras, espacio y _ . / ( ) - (sin digitos) y <=4 palabras. Un nombre corto sin digitos NO es detectable sin un catalogo cerrado; esas columnas
-- vienen de listas desplegables de cada marketplace y el parser nunca lee las columnas de comentarios. Paridad exacta con devoluciones.mjs (REASON_OK/STATUS_OK/CHANNEL_OK).
-- PROHIBIDO y sin columna: nombre, correo, telefono, direccion, comentarios libres del cliente, numero de seguimiento, nombre del producto, SKU.
-- RLS por tenant de la sesion; escritura solo con la accion 'import'; borrado solo con 'retain' (owner).

create table if not exists public.order_returns (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 retailer text not null check(retailer<>'unknown' and public.order_retailer_normalize(retailer) is not distinct from retailer),
 return_key text not null check(length(return_key) between 1 and 80 and return_key ~ '^[A-Za-z0-9._|-]+$'),
 order_key text check(order_key is null or public.order_id_normalize(order_key) is not distinct from order_key),
 reason text check(reason is null or (length(reason) between 1 and 80 and reason ~ '^[A-Za-z0-9 _:./()'',&+-]+$' and reason !~ '[0-9]{6,}' and reason !~ '^ | $|  ' and array_length(string_to_array(reason,' '),1)<=6)),
 status text check(status is null or (length(status) between 1 and 40 and status ~ '^[A-Za-z _./()-]+$' and status !~ '^ | $|  ' and array_length(string_to_array(status,' '),1)<=4)),
 requested_at date not null, status_at date,
 item_ref text check(item_ref is null or (length(item_ref) between 1 and 40 and item_ref ~ '^[A-Za-z0-9._-]+$')),
 qty integer check(qty is null or qty between 1 and 100000),
 has_return_tracking boolean not null default false,
 channel text check(channel is null or (length(channel) between 1 and 40 and channel ~ '^[A-Za-z _./()-]+$' and channel !~ '^ | $|  ' and array_length(string_to_array(channel,' '),1)<=4)),
 row_hash text not null check(row_hash ~ '^[a-f0-9]{64}$'),
 unique(tenant_id,id), unique(tenant_id,retailer,return_key)
);
create index if not exists order_returns_key on public.order_returns(tenant_id,retailer,order_key) where order_key is not null;
create index if not exists order_returns_month on public.order_returns(tenant_id,retailer,requested_at);

alter table public.order_returns enable row level security;
alter table public.order_returns force row level security;
revoke all on public.order_returns from public,anon,authenticated,service_role,vexa_backend;
grant select,insert,delete on public.order_returns to vexa_backend;
grant update(updated_at,order_key,reason,status,requested_at,status_at,item_ref,qty,has_return_tracking,channel,row_hash) on public.order_returns to vexa_backend;
drop policy if exists backend_read on public.order_returns;
drop policy if exists backend_insert on public.order_returns;
drop policy if exists backend_update on public.order_returns;
drop policy if exists backend_delete on public.order_returns;
create policy backend_read on public.order_returns for select to vexa_backend using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create policy backend_insert on public.order_returns for insert to vexa_backend with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update on public.order_returns for update to vexa_backend using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_backend_action(tenant_id,array['import'])) with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_backend_action(tenant_id,array['import']));
-- Retención: solo la acción 'retain' (rol owner) y solo filas del tenant de la sesión.
create policy backend_delete on public.order_returns for delete to vexa_backend using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_backend_action(tenant_id,array['retain']));

-- Lote (<=250) de devoluciones: upsert por (tenant,retailer,return_key); idempotente por row_hash.
-- p_rows: [{retailer,return_key,order_key,reason,status,requested_at,status_at,item_ref,qty,has_return_tracking,channel,row_hash}]
create or replace function public.order_returns_ingest(p_rows jsonb) returns jsonb language plpgsql set search_path='' as $$
declare t uuid:=nullif(current_setting('vexa.tenant_id',true),'')::uuid; n integer; ins integer; upd integer;
begin
 if t is null then raise exception 'TENANT_REQUIRED' using errcode='42501'; end if;
 if jsonb_typeof(p_rows)<>'array' then raise exception 'INVALID_BATCH'; end if;
 n:=jsonb_array_length(p_rows); if n=0 or n>250 then raise exception 'BATCH_SIZE_INVALID'; end if;
 if (select count(distinct (e->>'retailer')||'|'||(e->>'return_key')) from jsonb_array_elements(p_rows) e)<>n then raise exception 'DUPLICATE_IN_BATCH'; end if;
 with r as (
  insert into public.order_returns(tenant_id,retailer,return_key,order_key,reason,status,requested_at,status_at,item_ref,qty,has_return_tracking,channel,row_hash)
  select t,e->>'retailer',e->>'return_key',e->>'order_key',e->>'reason',e->>'status',(e->>'requested_at')::date,(e->>'status_at')::date,e->>'item_ref',(e->>'qty')::integer,coalesce((e->>'has_return_tracking')::boolean,false),e->>'channel',e->>'row_hash'
  from jsonb_array_elements(p_rows) e
  on conflict(tenant_id,retailer,return_key) do update set order_key=excluded.order_key,reason=excluded.reason,status=excluded.status,requested_at=excluded.requested_at,status_at=excluded.status_at,item_ref=excluded.item_ref,qty=excluded.qty,has_return_tracking=excluded.has_return_tracking,channel=excluded.channel,row_hash=excluded.row_hash,updated_at=now()
   where public.order_returns.row_hash<>excluded.row_hash
  returning (xmax=0) as inserted)
 select count(*) filter(where inserted),count(*) filter(where not inserted) into ins,upd from r;
 return jsonb_build_object('inserted',ins,'updated',upd,'unchanged',n-ins-upd);
end $$;
revoke all on function public.order_returns_ingest(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.order_returns_ingest(jsonb) to vexa_backend;

-- Cobertura de devoluciones por retailer y mes de solicitud. NUNCA es un % de ventas ni de pedidos: el denominador es el de las propias devoluciones.
--  devoluciones = total; sin_id = sin Order ID valido; denominador = devoluciones - sin_id; con_pedido = su pedido (mismo retailer) esta en el libro;
--  con_envio = su pedido tiene un envio Speedship (mismo retailer). Cobertura = con_x / denominador, NULL (nunca 0 %) si el denominador es 0.
-- Rendimiento: LEFT JOIN contra conjuntos DISTINTOS (tenant,retailer,llave); cada devolucion encuentra a lo mas una pareja: sin subconsultas correlacionadas.
create or replace view public.order_returns_coverage with (security_invoker=true) as
with ok as (select distinct tenant_id,retailer r,order_key k from public.order_ledger_keys where order_key is not null and retailer<>'unknown'),
 sk as (select distinct tenant_id,retailer r,order_key k from public.order_shipments where order_key is not null and retailer<>'unknown')
select x.tenant_id,x.retailer,x.mes,x.devoluciones,x.sin_id,x.devoluciones-x.sin_id as denominador,x.con_pedido,x.con_envio,
 case when x.devoluciones-x.sin_id=0 then null else x.con_pedido::numeric/(x.devoluciones-x.sin_id) end as cobertura_pedido,
 case when x.devoluciones-x.sin_id=0 then null else x.con_envio::numeric/(x.devoluciones-x.sin_id) end as cobertura_envio
from (
 select d.tenant_id,d.retailer,date_trunc('month',d.requested_at)::date as mes,count(*) as devoluciones,
  count(*) filter(where d.order_key is null) as sin_id,count(ok.k) as con_pedido,count(sk.k) as con_envio
 from public.order_returns d
  left join ok on ok.tenant_id=d.tenant_id and ok.r=d.retailer and ok.k=d.order_key
  left join sk on sk.tenant_id=d.tenant_id and sk.r=d.retailer and sk.k=d.order_key
 group by d.tenant_id,d.retailer,date_trunc('month',d.requested_at)::date) x;
revoke all on public.order_returns_coverage from public,anon,authenticated,service_role,vexa_backend;
grant select on public.order_returns_coverage to vexa_backend;
commit;
