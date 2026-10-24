-- Reversa de 20261125000000: borra los precálculos de SLA y reembolsos. /api/workload y /api/refunds vuelven solos al cálculo en vivo con tope.
begin;
set local lock_timeout='3s';
drop function if exists public.refresh_perf_frio(uuid,text);
drop table if exists public.insight_thread_sla;
drop table if exists public.insight_refund_ledger_digest;
drop table if exists public.insight_order_lines_digest;
commit;
