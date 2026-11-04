begin;
-- Solo revierte lo que crea 20261211000000_order_returns (no toca order_links ni los normalizadores). Las políticas e índices caen con el drop table.
drop view if exists public.order_returns_coverage;
drop function if exists public.order_returns_ingest(jsonb);
drop table if exists public.order_returns;
commit;
