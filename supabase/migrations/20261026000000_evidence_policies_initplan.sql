-- 20261026000000 (PROPUESTA, NO APLICADA): la verificación de evidencia (Problemas, Explorador, Recomendaciones, señales críticas) paga la membresía POR FILA en issues y evidence_spans.
-- Mediciones (23-oct, producción, solo lectura, emulando la política con vexa_member por fila vs. sub-select no correlacionado; tenant del cliente piloto, sesión owner):
--   evidence_spans (miles de filas del tenant): 758 ms con vexa_member(tenant_id) por fila (~48 µs/fila)  ->  4 ms con el sub-select (EXPLAIN ANALYZE, mismo índice).
--   issues (miles de filas): mismo patrón (~0.45 s por pasada completa). La consulta de incidencias de «señales críticas» toca ~15.5 mil spans y ~15.5 mil issues: ≈1.5 s de membresía por fila.
-- Resto de tablas del camino de lectura con el patrón por fila, y por qué NO se tocan (filas del tenant, costo por fila ≈ 48 µs):
--   problems (cientos, ~19 ms), jobs (cientos), imports (cientos), components, metric_snapshots, recommendations, recommendation_versions, interventions, workspace_scope_bindings (pocas filas),
--   workspace_detail_bindings, economic_source_versions, economic_relation_coverage, economic_snapshot_heads, priority_* (pocas o ninguna fila): < 25 ms cada una; no aportan tiempo real.
-- NO cambia el significado de la política (tenant de la fila = tenant de la sesión Y membresía activa); solo el momento de evaluar vexa_member: una vez por sentencia (mismo patrón que 0055,
-- 20261021, 20261024 y 20261025). WITH CHECK queda como está (escrituras: pocas filas). ALTER POLICY es atómico. Solo estas 2 tablas.
-- Reversa: packages/workspace-service/tests/20261026000000_evidence_policies_initplan.down.sql
begin;
set local lock_timeout='3s';
alter policy backend_scope on public.issues using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (select public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid)));
alter policy backend_scope on public.evidence_spans using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (select public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid)));
commit;
