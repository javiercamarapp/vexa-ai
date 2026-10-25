-- Reversa de 20261128000000_cfo_access_log.sql. OJO: borra la bitácora de consultas del CFO (solo huellas de argumentos y resultados, nunca preguntas ni datos).
-- Tras aplicarla, el chat de CFO vuelve a negarse a ejecutar herramientas (falla cerrado) hasta recrear la tabla.
begin;
drop trigger if exists cfo_access_log_immutable on public.cfo_access_log;
drop function if exists public.cfo_access_log_append_only();
drop table if exists public.cfo_access_log;
commit;
