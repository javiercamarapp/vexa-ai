-- 20261208000000 (PROPUESTA, NO APLICADA): el catálogo de bodegas sale del SQL y pasa a configuración externa por sesión.
-- Por qué: 20261201000000 traía escrita la lista de bodegas reales del cliente piloto en insight_cco_tracker_filas(). Ese repositorio es público: los nombres del cliente no pueden vivir en el código.
-- Qué HACE: reemplaza UNA función de solo lectura, public.insight_cco_tracker_filas() (misma firma, mismas columnas), para que la columna `warehouse` salga del catálogo que la aplicación fija por sesión
--   (set_config 'vexa.cco_catalogo_bodegas', JSON [{"p": prefijo en mayúsculas, "e": etiqueta o null, "l": sufijo libre}], validado en JS desde VEXA_CCO_CATALOGO). Ninguna tabla, dato ni política cambia.
--   Sin catálogo ('[]' o ausente) toda bodega con valor sale 'otra' y una celda vacía sale null: lo desconocido no se asigna en silencio. Con el catálogo real el resultado es idéntico al anterior.
-- Por qué es una migración NUEVA: 20261201000000 pudo haberse aplicado ya; su texto en el repo quedó con esta misma definición neutral, y esta migración actualiza las bases donde la versión anterior (con nombres fijos) está instalada.
-- Idempotente (create or replace). Requiere 20261201000000 (las demás funciones insight_cco_* llaman a esta). No se aplica sola: la aplica Javier.
-- Antes de aplicarla: definir VEXA_CCO_CATALOGO en producción (~/vexa-notas-28oct/4-poner-catalogo-cco-vercel.sh) y desplegar el código que la lee; si no, B/C/E/F degradan a 'otra' / «Sin dato» hasta que ambas estén.
-- Reversa: supabase/operations/20261208000000_insight_cco_catalogo_bodegas.rollback.sql (y packages/workspace-service/tests/20261208000000_insight_cco_catalogo_bodegas.down.sql, mismo contenido).
begin;
set local lock_timeout='3s';
do $$
begin
 if to_regprocedure('public.insight_cco_tracker_filas()') is null then
  raise exception 'falta insight_cco_tracker_filas: aplique antes 20261201000000_insight_cco';
 end if;
end $$;

create or replace function public.insight_cco_tracker_filas() returns table(
 sheet text,sheet_type text,sku_base text,retailer_class text,defect_class text,warehouse text,latency_class text,reason_class text,has_address boolean)
language sql stable set search_path='' as $$
 with t as (select nullif(current_setting('vexa.tenant_id',true),'')::uuid as id),
 -- Prefijo del cliente piloto (minúsculas): lo fija la aplicación por sesión (vexa.tienda_propia_prefijo); vacío o ausente = nada es propio. Nunca va escrito aquí.
 pp as (select nullif(lower(regexp_replace(btrim(coalesce(current_setting('vexa.tienda_propia_prefijo',true),'')),'\s+',' ','g')),'') as v),
 -- Catálogo de bodegas del cliente (configuración externa VEXA_CCO_CATALOGO, ya validada por la aplicación): JSON [{"p": prefijo en mayúsculas, "e": etiqueta, "l": sufijo libre}], por sesión (vexa.cco_catalogo_bodegas).
 -- Vacío o ausente = '[]': toda bodega con valor sale 'otra'. Los nombres reales de las bodegas nunca van escritos aquí.
 bc as (select case when coalesce(current_setting('vexa.cco_catalogo_bodegas',true),'') ~ '^\s*\[' then current_setting('vexa.cco_catalogo_bodegas',true)::jsonb else '[]'::jsonb end as v),
 hdr as (select distinct h.connection_id,h.sheet_name,(c->>'col')::int as col,lower(regexp_replace(btrim(c->>'v'),'[\s_]+',' ','g')) as name
   from public.tracker_row_heads h join t on h.tenant_id=t.id cross join lateral jsonb_array_elements(h.cells) c
   where h.ticket_state='header' and h.sheet_name not in('WTR','WPR') and c->>'col' ~ '^[0-9]+$'),
 f as (select h.connection_id,h.sheet_name,h.row_number,
   max(case when hd.name in('sku','tool sku','part sku','p sku') then btrim(c->>'v') end) as sku,
   max(case when hd.name='retailer' then lower(regexp_replace(btrim(c->>'v'),'\s+',' ','g')) end) as rt,
   max(case when hd.name in('contact reason') then lower(regexp_replace(btrim(c->>'v'),'\s+',' ','g')) end) as rs,
   max(case when hd.name='subreason' then lower(regexp_replace(btrim(c->>'v'),'\s+',' ','g')) end) as sub,
   max(case when hd.name in('wh','warehouse') then upper(btrim(c->>'v')) end) as wh,
   max(case when hd.name='sla status' then lower(btrim(c->>'v')) end) as sla,
   bool_or(hd.name in('customer address','corrected address (confirmed by customer)','original address (from shopify)') and btrim(coalesce(c->>'v',''))<>'') as addr,
   bool_or(btrim(coalesce(c->>'v',''))<>'') as any_v
   from public.tracker_row_heads h join t on h.tenant_id=t.id cross join lateral jsonb_array_elements(h.cells) c
   join hdr hd on hd.connection_id=h.connection_id and hd.sheet_name=h.sheet_name and hd.col=(c->>'col')::int
   where h.ticket_state<>'header' and h.sheet_name not in('WTR','WPR') group by 1,2,3),
 n as (select f.*,case when sheet_name in('Warranty Tools','Warranty Parts') then 'garantia' when sheet_name in('Refunds','Refunds Requests') then 'reembolso'
      when sheet_name='Return Labels' then 'etiqueta_devolucion' when sheet_name='Waitlist' then 'lista_espera' else 'otro' end as st,
    case when coalesce(sku,'')='' or upper(btrim(sku))='PENDING' or length(btrim(sku))>60 then null
     else nullif(regexp_replace(upper(btrim(sku)),'(-WM[0-9]+|-[0-9]{3}A-[0-9]{3}|-NEW)$',''),'') end as skub,
    -- Slot de horas de despacho: «N hora(s)/hour(s)/hr» o «N día(s)/day(s)». Sin número legible = sin dato (NO cero).
    case when sla ~ '(same day|mismo d[ií]a)' then 0::numeric
         when sla ~ '[0-9]+\s*(horas?|hours?|hrs?)\M' then (substring(sla from '([0-9]+)\s*(?:horas?|hours?|hrs?)\M'))::numeric
         when sla ~ '[0-9]+\s*(d[ií]as?|days?)\M' then (substring(sla from '([0-9]+)\s*(?:d[ií]as?|days?)'))::numeric*24 end as sla_h from f where any_v)
 select n.sheet_name,n.st,n.skub,
  case when coalesce(rt,'')='' then 'sin_retailer' when rt like 'amazon%' then case when pp.v is not null and strpos(rt,'fulfilled by '||pp.v)>0 then 'amazon_cumplido_por_piloto' when rt like '%fulfilled by amazon%' then 'amazon_cumplido_por_amazon'
     when rt like '%amazon.com%' then 'amazon_com' else 'amazon_sin_subcanal' end
   when rt like 'walmart%' then case when pp.v is not null and strpos(rt,'fulfilled by '||pp.v)>0 then 'walmart_cumplido_por_piloto' when rt like '%fulfilled by walmart%' then 'walmart_cumplido_por_walmart' else 'walmart_sin_subcanal' end
   when rt like 'best buy%' then 'bestbuy' when pp.v is not null and left(rt,length(pp.v))=pp.v then 'tienda' when rt like 'lowe%' then 'lowes' when rt like 'home depot%' then 'homedepot' when rt='pending' then 'pendiente' else 'otro' end,
  case when rs='defective' then 'defectuoso' when sub like 'damaged%' then 'danado' when rs='missing parts' or sub like 'missing parts%' then 'faltan_piezas'
   when sub='wrong item received' or rs='wrong item was sent' then 'articulo_equivocado' end,
  case when coalesce(wh,'')='' then null else coalesce((select case when b.e->>'l'='true' then regexp_replace(wh,'\s+','','g') else b.e->>'e' end
     from bc cross join lateral jsonb_array_elements(bc.v) with ordinality as b(e,i) where left(wh,length(b.e->>'p'))=b.e->>'p' order by b.i limit 1),'otra') end,
  case when coalesce(wh,'')='' then null when sla_h is null then 'sin_dato' when sla_h<24 then 'menos_de_1_dia' when sla_h<48 then '1_dia' when sla_h<72 then '2_dias' else '3_o_mas_dias' end,
  case when coalesce(rs,'')='' then 'sin_motivo' when rs in('defective','order','warranty','return','shipping','not as expected','change mind','price match','missing parts','package lost','never shipped',
     'wrong item was sent','bought by mistake','inaccurate website description','item arrived too late','incompatible or not useful') then replace(rs,' ','_') else 'otro' end,
  coalesce(n.addr,false)
 from n cross join pp
$$;

revoke all on function public.insight_cco_tracker_filas() from public,anon,authenticated,service_role;
grant execute on function public.insight_cco_tracker_filas() to vexa_backend;
commit;
