-- 20261207000000 (PROPUESTA, NO APLICADA): casos del Tracker por subcanal de cumplimiento, cruzados con tipo de caso, defecto, despacho, bodega y SKU.
-- Por qué: las preguntas E y F del CCO piden comparar modalidades de venta y de envío en marketplaces. La modalidad (quién vende, de qué bodega sale, qué marketplace)
--   se deriva en la aplicación del subcanal que ya expone insight_cco_tracker_filas().retailer_class; lo que faltaba era el cruce con SKU, tipo de caso y defecto.
-- Qué AÑADE: UNA función de solo lectura, insight_cco_modalidad_casos(p_min). Ninguna tabla, ningún dato, ninguna política cambia. No toca 20261201000000.
--   Devuelve celdas (dim, d1, d2, n, es_otros) para siete cruces, solo de filas Amazon y Walmart, con k-anonimato mínimo 5 (insight_cco_k, que nunca baja de 5):
--     subcanal_tipo        d1 subcanal,   d2 tipo de hoja (garantía, reembolso, etiqueta de devolución, lista de espera, otro)
--     subcanal_defecto     d1 subcanal,   d2 clase de defecto
--     subcanal_despacho    d1 subcanal,   d2 clase de latencia de despacho (solo filas con bodega)
--     subcanal_bodega      d1 subcanal,   d2 bodega (solo filas con bodega)
--     sku_subcanal         d1 SKU base,   d2 subcanal
--     sku_subcanal_tipo    d1 SKU base,   d2 «subcanal|tipo»
--     sku_subcanal_defecto d1 SKU base,   d2 «subcanal|defecto»
--   Las filas del Tracker se leen UNA sola vez (CTE materializada). Una fila de hoja es un caso, no una venta: no hay denominador de ventas.
--   Lo desconocido (SKU, defecto, bodega sin dato) no se cuenta como cero ni se asigna: queda fuera de su cruce.
-- Seguridad: SECURITY INVOKER con search_path vacío (igual que 20261201000000); lee bajo la RLS del llamador y el tenant de la sesión. EXECUTE solo para vexa_backend.
--   El prefijo del cliente piloto NO está aquí: viene por sesión (vexa.tienda_propia_prefijo) a través de insight_cco_tracker_filas().
-- Orden: requiere 20261201000000. Idempotente (create or replace). Reversa: packages/workspace-service/tests/20261207000000_insight_cco_modalidad.down.sql
begin;
set local lock_timeout='3s';
do $$
begin
 if to_regprocedure('public.insight_cco_tracker_filas()') is null or to_regprocedure('public.insight_cco_k(jsonb,integer)') is null then
  raise exception 'faltan insight_cco_tracker_filas / insight_cco_k: aplique antes 20261201000000_insight_cco';
 end if;
end $$;

create or replace function public.insight_cco_modalidad_casos(p_min integer default 5) returns table(dim text,d1 text,d2 text,n bigint,es_otros boolean)
language plpgsql stable set search_path='' as $$
declare c1 jsonb; c2 jsonb; c3 jsonb; c4 jsonb; c5 jsonb; c6 jsonb; c7 jsonb;
begin
 with f as materialized (
   select * from public.insight_cco_tracker_filas() x where x.retailer_class like 'amazon%' or x.retailer_class like 'walmart%')
 select
  coalesce((select jsonb_agg(jsonb_build_object('d1',g.d1,'d2',g.d2,'n',g.n)) from (select f.retailer_class as d1,f.sheet_type as d2,count(*) as n from f group by 1,2) g),'[]'::jsonb),
  coalesce((select jsonb_agg(jsonb_build_object('d1',g.d1,'d2',g.d2,'n',g.n)) from (select f.retailer_class as d1,f.defect_class as d2,count(*) as n from f where f.defect_class is not null group by 1,2) g),'[]'::jsonb),
  coalesce((select jsonb_agg(jsonb_build_object('d1',g.d1,'d2',g.d2,'n',g.n)) from (select f.retailer_class as d1,f.latency_class as d2,count(*) as n from f where f.warehouse is not null and f.latency_class is not null group by 1,2) g),'[]'::jsonb),
  coalesce((select jsonb_agg(jsonb_build_object('d1',g.d1,'d2',g.d2,'n',g.n)) from (select f.retailer_class as d1,f.warehouse as d2,count(*) as n from f where f.warehouse is not null group by 1,2) g),'[]'::jsonb),
  coalesce((select jsonb_agg(jsonb_build_object('d1',g.d1,'d2',g.d2,'n',g.n)) from (select f.sku_base as d1,f.retailer_class as d2,count(*) as n from f where f.sku_base is not null group by 1,2) g),'[]'::jsonb),
  coalesce((select jsonb_agg(jsonb_build_object('d1',g.d1,'d2',g.d2,'n',g.n)) from (select f.sku_base as d1,f.retailer_class||'|'||f.sheet_type as d2,count(*) as n from f where f.sku_base is not null group by 1,2) g),'[]'::jsonb),
  coalesce((select jsonb_agg(jsonb_build_object('d1',g.d1,'d2',g.d2,'n',g.n)) from (select f.sku_base as d1,f.retailer_class||'|'||f.defect_class as d2,count(*) as n from f where f.sku_base is not null and f.defect_class is not null group by 1,2) g),'[]'::jsonb)
 into c1,c2,c3,c4,c5,c6,c7;
 return query
  select 'subcanal_tipo'::text,k.d1,k.d2,k.n,k.es_otros from public.insight_cco_k(c1,p_min) k
  union all select 'subcanal_defecto',k.d1,k.d2,k.n,k.es_otros from public.insight_cco_k(c2,p_min) k
  union all select 'subcanal_despacho',k.d1,k.d2,k.n,k.es_otros from public.insight_cco_k(c3,p_min) k
  union all select 'subcanal_bodega',k.d1,k.d2,k.n,k.es_otros from public.insight_cco_k(c4,p_min) k
  union all select 'sku_subcanal',k.d1,k.d2,k.n,k.es_otros from public.insight_cco_k(c5,p_min) k
  union all select 'sku_subcanal_tipo',k.d1,k.d2,k.n,k.es_otros from public.insight_cco_k(c6,p_min) k
  union all select 'sku_subcanal_defecto',k.d1,k.d2,k.n,k.es_otros from public.insight_cco_k(c7,p_min) k;
end $$;

revoke all on function public.insight_cco_modalidad_casos(integer) from public,anon,authenticated,service_role;
grant execute on function public.insight_cco_modalidad_casos(integer) to vexa_backend;
commit;
