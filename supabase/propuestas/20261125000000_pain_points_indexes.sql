-- PROPUESTA (no aplicada): índice parcial para la evidencia de «Puntos de dolor» (filtros por tipo y estado ordenados por fecha). Sin él, en frío, el total de
-- pedidos cancelados (P5) recorre todo el libro (≈5 s). Debe correr FUERA de transacción (CONCURRENTLY).
create index concurrently if not exists economic_ledger_pain_idx on public.economic_ledger_entries(tenant_id, kind, status, effective_at desc, entity_id desc)
  where kind in ('refund','order');
