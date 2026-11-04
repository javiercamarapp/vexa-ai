begin;
-- Aditiva sobre 20261211000000_order_returns. Walmart trae DOS numeros por devolucion: CUSTOMER_ORDER_NO (order_key, 2000+11 digitos) y PO_NO (15 digitos que empiezan con 1:
-- en los archivos reales prefijos 1090, 1190, 1191, 1290 y 1291). El libro puede identificar el pedido por cualquiera de los dos: po_key guarda el segundo (solo una referencia de pedido, sin datos personales)
-- y la cobertura busca en el libro y en Speedship por order_key O po_key del mismo retailer.
do $g$ begin
 if to_regclass('public.order_returns') is null or to_regprocedure('public.order_returns_ingest(jsonb)') is null or to_regclass('public.order_returns_coverage') is null
  or to_regclass('public.order_ledger_keys') is null or to_regclass('public.order_shipments') is null or to_regprocedure('public.order_id_normalize(text)') is null then
  raise exception 'DEPENDENCIA_FALTANTE: aplique primero 20261210000000_order_links y 20261211000000_order_returns';
 end if;
end $g$;

alter table public.order_returns add column if not exists po_key text check(po_key is null or public.order_id_normalize(po_key) is not distinct from po_key);
grant update(po_key) on public.order_returns to vexa_backend;
create index if not exists order_returns_po_key on public.order_returns(tenant_id,retailer,po_key) where po_key is not null;

-- Lote (<=250). p_rows: [{retailer,return_key,order_key,po_key,reason,status,requested_at,status_at,item_ref,qty,has_return_tracking,channel,row_hash}]
-- El row_hash lo calcula el parser e incluye po_key solo cuando no es null: re-ejecutar la carga actualiza exactamente las filas cuyo po_key cambia.
create or replace function public.order_returns_ingest(p_rows jsonb) returns jsonb language plpgsql set search_path='' as $$
declare t uuid:=nullif(current_setting('vexa.tenant_id',true),'')::uuid; n integer; ins integer; upd integer;
begin
 if t is null then raise exception 'TENANT_REQUIRED' using errcode='42501'; end if;
 if jsonb_typeof(p_rows)<>'array' then raise exception 'INVALID_BATCH'; end if;
 n:=jsonb_array_length(p_rows); if n=0 or n>250 then raise exception 'BATCH_SIZE_INVALID'; end if;
 if (select count(distinct (e->>'retailer')||'|'||(e->>'return_key')) from jsonb_array_elements(p_rows) e)<>n then raise exception 'DUPLICATE_IN_BATCH'; end if;
 with r as (
  insert into public.order_returns(tenant_id,retailer,return_key,order_key,po_key,reason,status,requested_at,status_at,item_ref,qty,has_return_tracking,channel,row_hash)
  select t,e->>'retailer',e->>'return_key',e->>'order_key',e->>'po_key',e->>'reason',e->>'status',(e->>'requested_at')::date,(e->>'status_at')::date,e->>'item_ref',(e->>'qty')::integer,coalesce((e->>'has_return_tracking')::boolean,false),e->>'channel',e->>'row_hash'
  from jsonb_array_elements(p_rows) e
  on conflict(tenant_id,retailer,return_key) do update set order_key=excluded.order_key,po_key=excluded.po_key,reason=excluded.reason,status=excluded.status,requested_at=excluded.requested_at,status_at=excluded.status_at,item_ref=excluded.item_ref,qty=excluded.qty,has_return_tracking=excluded.has_return_tracking,channel=excluded.channel,row_hash=excluded.row_hash,updated_at=now()
   where public.order_returns.row_hash<>excluded.row_hash
  returning (xmax=0) as inserted)
 select count(*) filter(where inserted),count(*) filter(where not inserted) into ins,upd from r;
 return jsonb_build_object('inserted',ins,'updated',upd,'unchanged',n-ins-upd);
end $$;
revoke all on function public.order_returns_ingest(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.order_returns_ingest(jsonb) to vexa_backend;

-- Cobertura: con_pedido / con_envio = la devolucion encuentra su pedido (libro) o su envio (Speedship) por order_key O po_key, mismo retailer.
-- Mismas columnas que antes. sin_id = sin ninguna de las dos llaves. Cada llave se une (LEFT JOIN) contra un conjunto DISTINTO (tenant,retailer,llave): a lo mas una pareja por llave,
-- (CTE NOT MATERIALIZED: cada referencia se planifica como el conjunto distinto; materializar fuerza bucles anidados con estimaciones de 1 fila) y se cuenta la FILA una vez aunque coincidan las dos (count(*) filter(where a or b)): sin duplicar y sin subconsultas correlacionadas.
create or replace view public.order_returns_coverage with (security_invoker=true) as
with ok as not materialized (select distinct tenant_id,retailer r,order_key k from public.order_ledger_keys where order_key is not null and retailer<>'unknown'),
 sk as not materialized (select distinct tenant_id,retailer r,order_key k from public.order_shipments where order_key is not null and retailer<>'unknown')
select x.tenant_id,x.retailer,x.mes,x.devoluciones,x.sin_id,x.devoluciones-x.sin_id as denominador,x.con_pedido,x.con_envio,
 case when x.devoluciones-x.sin_id=0 then null else x.con_pedido::numeric/(x.devoluciones-x.sin_id) end as cobertura_pedido,
 case when x.devoluciones-x.sin_id=0 then null else x.con_envio::numeric/(x.devoluciones-x.sin_id) end as cobertura_envio
from (
 select d.tenant_id,d.retailer,date_trunc('month',d.requested_at)::date as mes,count(*) as devoluciones,
  count(*) filter(where d.order_key is null and d.po_key is null) as sin_id,
  count(*) filter(where o1.k is not null or o2.k is not null) as con_pedido,
  count(*) filter(where s1.k is not null or s2.k is not null) as con_envio
 from public.order_returns d
  left join ok o1 on o1.tenant_id=d.tenant_id and o1.r=d.retailer and o1.k=d.order_key
  left join ok o2 on o2.tenant_id=d.tenant_id and o2.r=d.retailer and o2.k=d.po_key
  left join sk s1 on s1.tenant_id=d.tenant_id and s1.r=d.retailer and s1.k=d.order_key
  left join sk s2 on s2.tenant_id=d.tenant_id and s2.r=d.retailer and s2.k=d.po_key
 group by d.tenant_id,d.retailer,date_trunc('month',d.requested_at)::date) x;
revoke all on public.order_returns_coverage from public,anon,authenticated,service_role,vexa_backend;
grant select on public.order_returns_coverage to vexa_backend;
commit;
