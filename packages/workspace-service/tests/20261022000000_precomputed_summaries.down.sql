-- Reversa de 20261022000000: borra los resúmenes y sus funciones (son derivados; los datos de origen no se tocan). Conserva economic_ledger_entries_recent_idx (la creó
-- también 20261020000000). Las lecturas de la aplicación vuelven solas al camino anterior (consulta directa / muestra rotulada «Estimado»).
begin;
set local lock_timeout='3s';
drop function if exists public.refresh_economic_ledger_monthly(uuid,date),public.refresh_economic_ledger_counts(uuid),public.refresh_conversation_monthly(uuid),public.refresh_association_counts(uuid);
drop table if exists public.economic_ledger_monthly,public.economic_ledger_counts,public.conversation_monthly,public.association_counts,public.summary_refresh_state;
drop index if exists public.economic_ledger_entries_recorded_idx,public.association_fact_updated,public.association_binding_created,public.association_binding_deactivated;
commit;
