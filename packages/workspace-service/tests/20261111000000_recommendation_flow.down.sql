-- Reversa de 20261111000000_recommendation_flow. DESTRUYE el historial de eventos del flujo (aprobaciones, seguimiento y resultados manuales): respáldalo antes.
begin;
set local lock_timeout='3s';
drop trigger if exists recommendation_flow_approved_immutable on public.recommendations;
drop function if exists public.recommendation_flow_approved_immutable();
drop trigger if exists recommendation_flow_guard on public.recommendation_flow_events;
drop function if exists public.recommendation_flow_guard();
drop table if exists public.recommendation_flow_events;
commit;
