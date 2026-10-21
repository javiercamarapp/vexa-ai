-- Reversión de 20261020000000 (solo el índice; ningún dato).
begin;
drop index if exists public.economic_ledger_entries_recent_idx;
commit;
