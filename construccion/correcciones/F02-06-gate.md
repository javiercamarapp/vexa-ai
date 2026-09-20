# F02-06 — corrección externa pendiente de validación completa

## Evidencia del CSV y precondición de consumo — 20-sep

Una corrida Node22 produjo sólo cabecera CSV. Se preservó el rojo: no guardaba estado del job antes de limpiar, por lo que su causa original sigue desconocida. Un diagnóstico parcial y otro completo27/27 con el mismo producto no lo reprodujeron; verify oficial Node26 también pasó27/27 con observación SQL de sólo lectura. Esto no demuestra que el fallo original esté corregido.

Se corrigió la carencia de diagnóstico del examen, sin cambiar producto, bytes esperados ni introducir reintentos: guardar estado/checkpoint/contadores/intentos en recibo0600 y exigir partial/done/offset103/una rechazada antes de descargar. Revisión independiente del único archivo aprobada; seis probes sintéticos y dos casos SQL/browser reales: no-consumo falla por CSV_CONSUME_TERMINAL con recibo queued/sin intentos; consumo real pasa CSV exacto. El wrapper del rojo confirma el fallo esperado, no aprueba ese producto.

El primer candidato verificado se preserva/rechaza para congelar esta guarda. Sus regresiones F02-01/02/03/04 y cuatro jobs CI pasaron con huellas y cleanup intactos; se reutilizan para el producto idéntico. Nuevo verify/accept debe ejecutar el examen reforzado, conservando la incidencia no reproducida para seguimiento y auditoría final.

## Revisión independiente y correcciones de cierre — 20-sep

Revisión de producto rechazó historial que quedaba vacío tras queued→terminal y no permitía recuperar503. La UI comunica estado/checkpoint y permite actualizar historial; el caso externo ahora abre queued, provoca503, reintenta, comprueba aparición automática y conserva CAS409→200. Rojo anterior por `HISTORY_RETRY_AVAILABLE`, verde corregido; no timeout contado como mutante.

Revisión del control rechazó un import Playwright desde TMP histórico y la sustitución del journal externo. El cliente se obtiene ahora de la imagen Docker fijada dentro de TMP propio; broker/journal heredados se conservan con offset. Ambas corridas de navegador registraron seis recursos en el journal externo y verificaron limpieza. Recheck independiente aprobó estos cuatro archivos; lint verde. La corrida previa completa Node26 pasó27grupos y mutantes; la versión corregida todavía debe completar verify/regresiones/accept limpio. La presencia del gate no acredita aceptación.

## Historial de autoría

Estado15/60; F02-04 ya aceptada/publicada. No declarar17/60. Conservar los16grupos anteriores y el health mutant con identidad owner; ningún subset sustituye full05 o standalone06.

Nuevos oráculos ejecutables: umbrales120/60 versus60/30 sobre SQL real; Next machine-auth sin cookie como autorización, body/query scopes rechazados sin efectos; coldstarts Next con progreso multitenant; bytes exactos CSV y neutralización de fórmula, descarga Chromium,503/retry conservando estado; clicks historia y selección CAS con409y recuperación. Exigir inventario completo27grupos,0skip y recibos de limpieza por IDs.

Pendientes de cierre: full05 y standalone06 en Node22/26 sobre snapshot fijo nuevo; matriz global007/revisión independiente/freeze/verify/accept. Provider cron/net/Vault, cloud y connection-ready no están acreditados. No copiar evidencia sensible o journals0600 al control.
