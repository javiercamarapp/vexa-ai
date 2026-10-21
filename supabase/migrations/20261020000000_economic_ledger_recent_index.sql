-- 20261020000000: índice para la página reciente del libro económico (GET /api/economics?view=page, límite ≤100 con cursor).
-- NO cambia ninguna política, función, dato ni cifra: solo añade un índice (idempotente) para recorrer los asientos por fecha efectiva descendente
-- sin ordenar los ~85 mil del tenant en cada página. El resto de la vista acotada (agregados por fuente/moneda/base/tipo/mes) usa el índice único
-- existente (tenant_id, entity_id, revision) y no necesita nada más.
-- Orden de aplicación: puede aplicarse antes o después del código; sin el índice la página funciona igual (más lenta: ordena en memoria, ~65 ms a 85 mil filas).
-- Bloqueo: CREATE INDEX (no CONCURRENTLY, porque corre en transacción) retiene un candado que bloquea inserciones en el libro mientras se construye
-- (~1 s a 85 mil filas); las lecturas no se bloquean. lock_timeout hace que falle pronto si otra transacción sostiene la tabla.
begin;
set local lock_timeout='3s';
do $$
begin
 if to_regclass('public.economic_ledger_entries') is null then
  raise exception 'economic_ledger_entries no existe: aplique antes 0018_economic_runtime';
 end if;
end $$;
create index if not exists economic_ledger_entries_recent_idx on public.economic_ledger_entries(tenant_id,effective_at desc,entity_id desc);
commit;
