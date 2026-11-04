begin;
-- Revierte solo 20261213000000_order_coverage_summary: quita la función y la tabla (la política y el resumen caen con el drop table). Las vistas y los datos de pedidos no se tocan.
drop function if exists public.refresh_order_coverage(uuid);
drop table if exists public.order_coverage_summary;
commit;
