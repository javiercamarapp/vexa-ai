-- Reversa de 20261201000000_insight_cco: solo funciones; no hay datos que perder.
begin;
drop function if exists public.insight_cco_cobertura();
drop function if exists public.insight_cco_bodega(text,integer);
drop function if exists public.insight_cco_tracker_casos(text,integer);
drop function if exists public.insight_cco_tracker_filas();
drop function if exists public.insight_cco_sin_venta();
drop function if exists public.insight_cco_sku_canal(text);
drop function if exists public.insight_cco_ventanas();
drop function if exists public.insight_cco_k(jsonb,integer);
commit;
