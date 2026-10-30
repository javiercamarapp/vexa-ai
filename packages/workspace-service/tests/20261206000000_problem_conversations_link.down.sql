-- Reversa de 20261206000000_problem_conversations_link.sql. Las filas que esa funcion escribio son DERIVADAS (provenance.kind='problem-link-v1') y se reconstruyen: se borran
-- solo esas; cualquier otra fila de problem_conversations queda intacta. Correr como propietario (BYPASSRLS).
begin;
delete from public.problem_conversations where provenance->>'kind'='problem-link-v1';
drop function if exists public.refresh_problem_conversations(uuid,boolean);
commit;
