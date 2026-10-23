-- Reversa de 20261104000000: borra el motor de insights, sus tablas (derivados) y el estado por fuente. Los datos de origen no se tocan.
-- Las lecturas de la aplicación vuelven solas al camino anterior (cálculo directo / resúmenes de 20261022000000).
begin;
set local lock_timeout='3s';
drop function if exists public.refresh_insights(uuid,text,timestamptz,integer),
 public.insights_refresh_refund_sku(uuid,timestamptz,timestamptz),public.insights_refresh_conversations(uuid,timestamptz,timestamptz),public.insights_refresh_threads(uuid,timestamptz,timestamptz),
 public.insights_refresh_tracker(uuid,timestamptz,timestamptz),public.insights_refresh_contacts(uuid,timestamptz,timestamptz),
 public.record_source_sync(uuid,text,text,boolean,bigint,text,integer,timestamptz,integer,timestamptz),public.insights_authorized(uuid);
drop table if exists public.insight_conversation_volume,public.insight_refund_by_sku_month,public.insight_thread_resolution,public.insight_tracker_refund_status,public.insight_state,public.source_sync_state;
commit;
