begin;
drop view if exists public.order_link_coverage; drop view if exists public.order_ledger_keys;
drop function if exists public.order_shipments_ingest(jsonb); drop function if exists public.ticket_order_refs_ingest(jsonb);
drop table if exists public.order_shipments; drop table if exists public.ticket_order_refs;
drop function if exists public.order_id_normalize(text); drop function if exists public.order_retailer_normalize(text);
commit;
