-- ROLLBACK de 0051 (importador economico por lotes). Solo elimina funciones; NO toca tablas ni datos.
-- IRREVERSIBLE (por diseno): los asientos que ya inserto economic_batch_import en economic_ledger_entries
-- son solo-insercion (trigger economic_append_guard). Este rollback NO los borra ni debe intentarlo.
-- Si hay que anular importes ya cargados se compensa con asientos nuevos (kind='reversal'/'refund'), nunca con DELETE.
-- Seguro de ejecutar con la aplicacion en marcha: nadie mas referencia estas funciones (verificado con pg_depend en test.mjs).
begin;
set local lock_timeout='5s';
drop function if exists public.economic_batch_import(jsonb);
drop function if exists public.economic_batch_entry_error(jsonb);
drop function if exists public.economic_batch_entity_id(uuid,uuid,text,text);
drop function if exists public.economic_batch_instant(text);
commit;
