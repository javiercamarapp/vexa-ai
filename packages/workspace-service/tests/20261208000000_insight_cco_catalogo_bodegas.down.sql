-- Reversa de 20261208000000_insight_cco_catalogo_bodegas.
-- La migración solo reemplaza la función de solo lectura public.insight_cco_tracker_filas() (misma firma); no hay datos que perder.
-- La definición ANTERIOR (bodegas escritas en el SQL) contiene nombres del cliente y por eso NO vive en este repositorio público.
-- Para volver exactamente a ella, ejecute el respaldo privado que guarda quien administra la base (fuera del repo):
--   (respaldo privado, no versionado) insight_cco_tracker_filas-ANTERIOR.sql
-- Sin ese archivo, la reversa segura es dejar la función actual y definir VEXA_CCO_CATALOGO con el catálogo deseado:
-- el resultado con el catálogo real es idéntico al de la función anterior, y sin catálogo toda bodega sale 'otra' (nunca se asigna en silencio).
begin;
select 1;
commit;
