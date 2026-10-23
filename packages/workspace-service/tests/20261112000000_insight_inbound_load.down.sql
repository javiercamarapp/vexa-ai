-- Reversa de 20261112000000: borra la carga entrante precalculada. La pantalla /workload vuelve sola al cálculo en vivo con tope.
begin;
set local lock_timeout='3s';
drop function if exists public.refresh_inbound_load(uuid,date);
drop table if exists public.insight_inbound_load;
commit;
