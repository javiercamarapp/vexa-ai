begin;
-- Revierte solo 20261212000000_order_returns_po: restaura la vista y la funcion de 20261211 y quita po_key (la vista nueva depende de la columna: se reemplaza primero).
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
drop index if exists public.order_returns_po_key;
alter table public.order_returns drop column if exists po_key;
commit;
