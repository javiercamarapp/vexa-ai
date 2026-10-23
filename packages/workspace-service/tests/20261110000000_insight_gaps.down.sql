-- Reversa de 20261110000000_insight_gaps.sql (PROPUESTA, no aplicada).
begin;
drop function if exists public.refresh_gap_insights(uuid,integer);
drop table if exists public.insight_family_pair;
drop table if exists public.insight_complaint_family_month;
drop table if exists public.insight_order_revenue_month;
delete from public.insight_state where insight in('order_revenue_month','complaint_family_month');
alter table public.insight_state drop constraint if exists insight_state_insight_check;
alter table public.insight_state add constraint insight_state_insight_check
 check(insight in('conversation_volume','refund_by_sku_month','thread_resolution','tracker_refund_status','repeat_contact'));
commit;
