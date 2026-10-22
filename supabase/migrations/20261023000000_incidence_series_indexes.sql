-- PROPUESTA, NO APLICADA (20261023000000). El código de incidencias (packages/workspace-service/incidences.mjs) funciona SIN esta migración:
-- usa los índices existentes (issues(tenant_id,extraction_run_id), messages(tenant_id,conversation_id), extraction_runs PK) y un tope local de statement_timeout (2.5 s);
-- si lo supera responde «no disponible ahora». Estos índices solo lo acercan a <1.5 s cuando el volumen crezca. Solo AÑADE índices; no cambia datos, políticas ni funciones.
-- Aplicarla requiere autorización de Javier. Los CREATE INDEX (no CONCURRENTLY, por la transacción) bloquean escrituras de cada tabla mientras se construyen; las lecturas no.
begin;
set local lock_timeout='3s';
-- Conteo por categoría: recorrido solo de índice (tenant, categoría) en lugar de leer las ~9.6 mil filas completas.
create index if not exists issues_tenant_category_idx on public.issues(tenant_id,category);
-- Evolución por problema: hoy problem_embedding_members solo tiene la PK (tenant_id,embedding_id); filtrar por problema recorre la tabla.
create index if not exists problem_embedding_members_problem_idx on public.problem_embedding_members(tenant_id,problem_id,extraction_run_id);
commit;
