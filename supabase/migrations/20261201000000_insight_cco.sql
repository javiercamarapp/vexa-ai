-- 20261201000000 (PROPUESTA, NO APLICADA): agregados de SOLO LECTURA para la pestaña CCO (/cco) y las seis herramientas del agente.
-- Por qué: el CCO pregunta por rendimiento por SKU, SKU sin venta, bodegas, estados y subcanales de retailer. Todo se deriva de lo que ya está cargado
-- (libro económico, insight_* existentes y Tracker de Excel); no se ingiere nada nuevo ni se guarda texto de clientes.
-- Qué AÑADE (solo funciones; ninguna tabla, ningún dato, ninguna política existente cambia):
--   insight_cco_ventanas()           ventana COMÚN de pedidos y devoluciones por canal (solo meses completos dentro de las ventanas declaradas de las fuentes).
--   insight_cco_sku_canal(canal)     SKU base × canal × moneda: líneas, ingreso bruto, reembolsos e importe reembolsado, SOLO dentro de la ventana común del canal.
--   insight_cco_sin_venta()          SKU base con su último mes de venta y líneas en los últimos 3, 6 y 9 meses (señal INFERIDA, sin inventario).
--   insight_cco_tracker_casos(dim)   casos del Tracker por SKU y tipo de defecto, SKU y tipo de hoja, o subcanal de retailer; k-anonimato mínimo 5.
--   insight_cco_bodega(dim)          casos del Tracker con bodega, por latencia de despacho o por motivo; k-anonimato mínimo 5.
--   insight_cco_cobertura()          conteos de cobertura de columnas del Tracker (para decir qué porcentaje es legible).
--   insight_cco_k(celdas, minimo)    ayudante interno: oculta celdas con menos de 5 casos y pliega el resto para que no se pueda restar.
-- Estado por dirección (pregunta D) NO está aquí a propósito: el extractor de estado vive en JS (packages/workspace-service/geo-estado.mjs) y descarta el texto de la dirección;
--   duplicarlo en SQL sería una segunda lógica que diverge. La pantalla reutiliza el repositorio del mapa.
-- Reglas de verdad: ingreso BRUTO (sin costo ni margen); lo desconocido sale NULL, jamás 0; monedas nunca se suman; tasas solo en la ventana común del canal;
--   una exposición inferida no es pérdida; sin tiempo real (los insight_* se refrescan por lotes).
-- Seguridad: todas son SECURITY INVOKER con search_path vacío; leen bajo la RLS del llamador (rol vexa_backend) Y filtran por el tenant de la sesión (vexa.tenant_id).
--   EXECUTE solo para vexa_backend. Sin SQL dinámico, sin texto libre hacia SQL (dim es un enumerado validado).
--   Cliente piloto: el prefijo de su retailer propio NO está escrito aquí; la aplicación lo fija por sesión (set_config vexa.tienda_propia_prefijo, en minúsculas). Vacío o ausente = ninguna fila se clasifica como propia.
-- Orden: requiere 0018 (libro), 0052 (Tracker), 20261104000000 (insights_engine) y 20261110000000 (insight_gaps). Idempotente (create or replace).
-- Reversa: packages/workspace-service/tests/20261201000000_insight_cco.down.sql
begin;
set local lock_timeout='3s';
do $$
begin
 if to_regclass('public.insight_order_revenue_month') is null or to_regclass('public.insight_refund_by_sku_month') is null then
  raise exception 'faltan insight_order_revenue_month / insight_refund_by_sku_month: aplique antes 20261104000000 y 20261110000000';
 end if;
 if to_regclass('public.economic_source_versions') is null or to_regclass('public.tracker_row_heads') is null then raise exception 'faltan economic_source_versions (0018) o tracker_row_heads (0052)'; end if;
end $$;

-- 1) Ayudante de k-anonimato. Entrada: arreglo de {d1,d2,n}. Celdas con n < k (k nunca menor que 5) no salen; lo oculto se pliega en una sola fila «otros» y, si ese resto
--    quedara entre 1 y k-1, se le suma la celda visible más pequeña para que el total mostrado no permita restar una celda pequeña.
create or replace function public.insight_cco_k(p_cells jsonb,p_min integer default 5) returns table(d1 text,d2 text,n bigint,es_otros boolean)
language sql immutable set search_path='' as $$
 with k as (select greatest(coalesce(p_min,5),5) as k),
 c as (select e->>'d1' as d1,e->>'d2' as d2,(e->>'n')::bigint as n from jsonb_array_elements(case when jsonb_typeof(coalesce(p_cells,'[]'::jsonb))='array' then coalesce(p_cells,'[]'::jsonb) else '[]'::jsonb end) e),
 vis as (select c.d1,c.d2,c.n,row_number() over(order by c.n asc,c.d1,c.d2) as rn from c,k where c.n>=k.k),
 f as (select coalesce((select sum(c.n) from c,k where c.n<k.k),0)::bigint as s,(select v.n from vis v where v.rn=1) as m,(select k.k from k) as k)
 select v.d1,v.d2,v.n,false from vis v,f where not (f.s>0 and f.s<f.k and v.rn=1)
 union all
 select null::text,null::text,(f.s+case when f.s<f.k then coalesce(f.m,0) else 0 end)::bigint,true from f where f.s>=f.k or (f.s>0 and f.s<f.k and f.m is not null)
$$;

-- 2) Ventana COMÚN por canal. Las fuentes del libro declaran su ventana (window_start/window_end) y están marcadas incompletas; una tasa solo vale donde pedidos Y devoluciones
--    tienen datos. Se toman solo MESES COMPLETOS: el primero es el mes que empieza en o después del inicio común; el último es el mes que termina en o antes del fin común.
--    Canal sin fuente de devoluciones (Best Buy hoy): refunds_available=false y la ventana es la de pedidos; sus devoluciones son DESCONOCIDAS, no cero.
create or replace function public.insight_cco_ventanas() returns table(channel text,refunds_available boolean,orders_from date,orders_to date,refunds_from date,refunds_to date,month_from date,month_to date,months integer,complete boolean)
language sql stable set search_path='' as $$
 with t as (select nullif(current_setting('vexa.tenant_id',true),'')::uuid as id),
 v as (select distinct on(s.source_id) s.source_id,s.name,s.evidence_type,s.window_start,s.window_end,s.complete from public.economic_source_versions s,t where s.tenant_id=t.id and s.active order by s.source_id,s.version desc),
 c as (select case when lower(name) like '%amazon%' then 'amazon' when lower(name) like '%walmart%' then 'walmart' when lower(name) like '%shopify%' then 'shopify'
    when lower(name) like '%best buy%' or lower(name) like '%bestbuy%' or lower(name) like '%mirakl%' then 'bestbuy' else 'otro' end as channel,evidence_type,window_start,window_end,complete from v where evidence_type in('order_export','payment_ledger')),
 a as (select channel,min(window_start) filter(where evidence_type='order_export') os,max(window_end) filter(where evidence_type='order_export') oe,
    min(window_start) filter(where evidence_type='payment_ledger') rs,max(window_end) filter(where evidence_type='payment_ledger') re,bool_and(complete) as complete
   from c where channel<>'otro' group by channel having bool_or(evidence_type='order_export')),
 b as (select channel,(rs is not null) as ra,(os at time zone 'UTC')::date od0,(oe at time zone 'UTC')::date od1,(rs at time zone 'UTC')::date rd0,(re at time zone 'UTC')::date rd1,
    case when rs is null then os else greatest(os,rs) end as lo,case when re is null then oe else least(oe,re) end as hi,complete from a),
 m as (select b.*,case when (lo at time zone 'UTC')=date_trunc('month',lo at time zone 'UTC') then date_trunc('month',lo at time zone 'UTC')::date else (date_trunc('month',lo at time zone 'UTC')+interval '1 month')::date end as mf,
    (date_trunc('month',hi at time zone 'UTC')-interval '1 month')::date as mt from b)
 select channel,ra,od0,od1,rd0,rd1,mf,mt,
  case when mt>=mf then ((extract(year from mt)::int-extract(year from mf)::int)*12+extract(month from mt)::int-extract(month from mf)::int+1) else 0 end,complete
 from m
$$;

-- 3) Rendimiento por SKU base y canal dentro de la ventana común. Líneas = líneas de pedido con importe, sin canceladas (el insight de pedidos solo cuenta líneas con importe);
--    ingreso = BRUTO de esas líneas (sin costo ni margen), por moneda. Reembolsos: filas vigentes no canceladas; el importe es NULL si ninguna trae importe (desconocido, no cero).
--    sku_base '' = renglones sin SKU en el libro (Best Buy y Shopify); se devuelven para calcular cobertura y no se clasifican como SKU.
create or replace function public.insight_cco_sku_canal(p_channel text default null) returns table(
 channel text,sku_base text,currency text,exponent smallint,month_from date,month_to date,months integer,window_complete boolean,refunds_available boolean,
 order_lines bigint,order_gross_minor numeric,refund_n bigint,refund_n_unknown_amount bigint,refund_amount_minor numeric,refunds_per_100_lines numeric)
language sql stable set search_path='' as $$
 with t as (select nullif(current_setting('vexa.tenant_id',true),'')::uuid as id),
 w as (select * from public.insight_cco_ventanas() x where x.months>0 and (p_channel is null or x.channel=p_channel)),
 o as (select r.channel,r.sku_base,r.currency,r.exponent,sum(r.n-r.n_cancelled)::bigint as lines,sum(r.amount_minor-r.amount_cancelled_minor) as gross
   from public.insight_order_revenue_month r join t on r.tenant_id=t.id join w on w.channel=r.channel and r.month between w.month_from and w.month_to group by 1,2,3,4),
 f as (select r.channel,r.sku_base,r.currency,r.exponent,sum(r.n-r.n_cancelled)::bigint as n,sum(r.n-r.n_known)::bigint as unk,
     case when sum(r.n_known)=0 then null else sum(r.amount_active_minor) end as amt
   from public.insight_refund_by_sku_month r join t on r.tenant_id=t.id join w on w.channel=r.channel and w.refunds_available and r.month between w.month_from and w.month_to group by 1,2,3,4),
 k as (select coalesce(o.channel,f.channel) as channel,coalesce(o.sku_base,f.sku_base) as sku_base,coalesce(o.currency,f.currency) as currency,coalesce(o.exponent,f.exponent) as exponent,
     o.lines,o.gross,f.n,f.unk,f.amt from o full join f on o.channel=f.channel and o.sku_base=f.sku_base and o.currency=f.currency and o.exponent=f.exponent)
 select k.channel,k.sku_base,k.currency,k.exponent,w.month_from,w.month_to,w.months,w.complete,w.refunds_available,
  coalesce(k.lines,0),coalesce(k.gross,0),
  case when w.refunds_available then coalesce(k.n,0) end,case when w.refunds_available then coalesce(k.unk,0) end,
  case when w.refunds_available then k.amt end,
  case when w.refunds_available and coalesce(k.lines,0)>0 then round(coalesce(k.n,0)*100.0/k.lines,2) end
 from k join w on w.channel=k.channel
$$;

-- 4) SKU sin venta reciente (SEÑAL INFERIDA: un SKU sin venta en Amazon y Walmart puede venderse en otro canal, y no hay inventario ni estado de descontinuado).
--    Solo Amazon y Walmart traen SKU del vendedor. Referencia = último mes COMPLETO con datos (si el corte cae a mitad de mes, el mes en curso no cuenta como «sin venta»).
create or replace function public.insight_cco_sin_venta() returns table(
 sku_base text,first_sale_month date,last_sale_month date,months_without_sale integer,lines_last_3m bigint,lines_last_6m bigint,lines_last_9m bigint,channels text[],
 skus_with_sales bigint,reference_month date,data_through date)
language sql stable set search_path='' as $$
 with t as (select nullif(current_setting('vexa.tenant_id',true),'')::uuid as id),
 r as (select x.channel,x.sku_base,x.month,x.n-x.n_cancelled as lines,x.last_day from public.insight_order_revenue_month x join t on x.tenant_id=t.id
   where x.channel in('amazon','walmart') and x.sku_base<>''),
 d as (select max(last_day) as dt from r),
 ref as (select dt,case when dt=(date_trunc('month',dt)+interval '1 month - 1 day')::date then date_trunc('month',dt)::date else (date_trunc('month',dt)-interval '1 month')::date end as rm from d where dt is not null),
 s as (select r.sku_base,min(r.month) filter(where r.lines>0) as fm,max(r.month) filter(where r.lines>0) as lm,array_agg(distinct r.channel order by r.channel) filter(where r.lines>0) as ch,
    sum(r.lines) filter(where r.month>(ref.rm-interval '3 months') and r.month<=ref.rm) as l3,sum(r.lines) filter(where r.month>(ref.rm-interval '6 months') and r.month<=ref.rm) as l6,
    sum(r.lines) filter(where r.month>(ref.rm-interval '9 months') and r.month<=ref.rm) as l9
   from r,ref group by r.sku_base)
 select s.sku_base,s.fm,s.lm,greatest(0,(extract(year from ref.rm)::int-extract(year from s.lm)::int)*12+extract(month from ref.rm)::int-extract(month from s.lm)::int),
  coalesce(s.l3,0),coalesce(s.l6,0),coalesce(s.l9,0),s.ch,(select count(*) from s where s.lm is not null),ref.rm,ref.dt
 from s,ref where s.lm is not null
$$;

-- 5) Filas del Tracker ya categóricas (sin texto libre ni dirección: solo un booleano «tiene dirección»). Se concede a la sesión porque las funciones de abajo (SECURITY INVOKER) la llaman. Solo hojas no espejo (WTR y WPR duplican Warranty Tools/Parts). Una fila de hoja = un caso; el mismo ticket puede estar en
--    más de una hoja, así que los conteos son de filas, no de tickets únicos. Catálogos cerrados: lo que no está en ellos sale «otro».
create or replace function public.insight_cco_tracker_filas() returns table(
 sheet text,sheet_type text,sku_base text,retailer_class text,defect_class text,warehouse text,latency_class text,reason_class text,has_address boolean)
language sql stable set search_path='' as $$
 with t as (select nullif(current_setting('vexa.tenant_id',true),'')::uuid as id),
 -- Prefijo del cliente piloto (minúsculas): lo fija la aplicación por sesión (vexa.tienda_propia_prefijo); vacío o ausente = nada es propio. Nunca va escrito aquí.
 pp as (select nullif(lower(regexp_replace(btrim(coalesce(current_setting('vexa.tienda_propia_prefijo',true),'')),'\s+',' ','g')),'') as v),
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
  case when coalesce(wh,'')='' then null when wh like 'BODEGAB-%' then regexp_replace(wh,'\s+','','g') when wh like 'BODEGAA%' then 'BODEGAA USA Inc' when wh like 'BODEGAC%' then 'Bodegac'
   when wh like 'BODEGAD%' then 'Bodegad' when wh like 'BODEGAE%' then 'Bodegae Canada' else 'otra' end,
  case when coalesce(wh,'')='' then null when sla_h is null then 'sin_dato' when sla_h<24 then 'menos_de_1_dia' when sla_h<48 then '1_dia' when sla_h<72 then '2_dias' else '3_o_mas_dias' end,
  case when coalesce(rs,'')='' then 'sin_motivo' when rs in('defective','order','warranty','return','shipping','not as expected','change mind','price match','missing parts','package lost','never shipped',
     'wrong item was sent','bought by mistake','inaccurate website description','item arrived too late','incompatible or not useful') then replace(rs,' ','_') else 'otro' end,
  coalesce(n.addr,false)
 from n cross join pp
$$;

-- 6) Casos del Tracker por SKU y tipo de defecto, SKU y tipo de hoja, o subcanal de retailer. dim es un enumerado; k-anonimato mínimo 5 (nunca menor, aunque se pida 1).
create or replace function public.insight_cco_tracker_casos(p_dim text,p_min integer default 5) returns table(d1 text,d2 text,n bigint,es_otros boolean)
language plpgsql stable set search_path='' as $$
declare cells jsonb;
begin
 if p_dim is null or p_dim not in('sku_defecto','sku_hoja','subcanal') then raise exception 'INSIGHT_CCO_DIM_INVALID' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('d1',x.d1,'d2',x.d2,'n',x.n)),'[]'::jsonb) into cells from (
  select case p_dim when 'subcanal' then f.retailer_class else f.sku_base end as d1,
   case p_dim when 'sku_defecto' then f.defect_class when 'sku_hoja' then f.sheet_type else null end as d2,count(*) as n
  from public.insight_cco_tracker_filas() f
  where case p_dim when 'subcanal' then true when 'sku_defecto' then f.sku_base is not null and f.defect_class is not null else f.sku_base is not null end
  group by 1,2) x;
 return query select * from public.insight_cco_k(cells,p_min);
end $$;

-- 7) Bodegas: solo filas del Tracker con bodega (reposiciones de garantía y etiquetas de devolución). La latencia es de DESPACHO (cuánto tardó en enviarse el rastreo), no de entrega.
--    No existe denominador de envíos por bodega: nunca se calcula una tasa con estos conteos.
create or replace function public.insight_cco_bodega(p_dim text,p_min integer default 5) returns table(d1 text,d2 text,n bigint,es_otros boolean)
language plpgsql stable set search_path='' as $$
declare cells jsonb;
begin
 if p_dim is null or p_dim not in('latencia','motivo') then raise exception 'INSIGHT_CCO_DIM_INVALID' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('d1',x.d1,'d2',x.d2,'n',x.n)),'[]'::jsonb) into cells from (
  select f.warehouse as d1,case p_dim when 'latencia' then f.latency_class else coalesce(f.defect_class,f.reason_class) end as d2,count(*) as n
  from public.insight_cco_tracker_filas() f where f.warehouse is not null group by 1,2) x;
 return query select * from public.insight_cco_k(cells,p_min);
end $$;

-- 8) Cobertura de columnas del Tracker (conteos agregados, sin valores).
create or replace function public.insight_cco_cobertura() returns table(
 rows_total bigint,with_retailer bigint,with_sku bigint,with_warehouse bigint,with_latency bigint,with_address bigint,sheets bigint,cutoff timestamptz)
language sql stable set search_path='' as $$
 with t as (select nullif(current_setting('vexa.tenant_id',true),'')::uuid as id),
 f as (select * from public.insight_cco_tracker_filas())
 select count(*),count(*) filter(where retailer_class not in('sin_retailer','pendiente')),count(*) filter(where sku_base is not null),count(*) filter(where warehouse is not null),
  count(*) filter(where latency_class is not null and latency_class<>'sin_dato'),count(*) filter(where has_address),count(distinct sheet),
  (select max(coalesce(v.received_at,v.created_at)) from public.tracker_versions v,t where v.tenant_id=t.id)
 from f
$$;

-- 9) Permisos: solo la sesión de la aplicación; ni anon ni authenticated ni service_role.
do $$
declare fn text;
begin
 foreach fn in array array['insight_cco_k(jsonb,integer)','insight_cco_ventanas()','insight_cco_sku_canal(text)','insight_cco_sin_venta()','insight_cco_tracker_filas()','insight_cco_tracker_casos(text,integer)','insight_cco_bodega(text,integer)','insight_cco_cobertura()'] loop
  execute format('revoke all on function public.%s from public,anon,authenticated,service_role',fn);
  execute format('grant execute on function public.%s to vexa_backend',fn);
 end loop;
end $$;
commit;
