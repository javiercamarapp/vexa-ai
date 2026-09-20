# F02-06 — corrección externa pendiente de validación completa

## Revisión independiente y correcciones de cierre — 20-sep

Revisión de producto rechazó historial que quedaba vacío tras queued→terminal y no permitía recuperar503. La UI comunica estado/checkpoint y permite actualizar historial; el caso externo ahora abre queued, provoca503, reintenta, comprueba aparición automática y conserva CAS409→200. Rojo anterior por `HISTORY_RETRY_AVAILABLE`, verde corregido; no timeout contado como mutante.

Revisión del control rechazó un import Playwright desde TMP histórico y la sustitución del journal externo. El cliente se obtiene ahora de la imagen Docker fijada dentro de TMP propio; broker/journal heredados se conservan con offset. Ambas corridas de navegador registraron seis recursos en el journal externo y verificaron limpieza. Recheck independiente aprobó estos cuatro archivos; lint verde. La corrida previa completa Node26 pasó27grupos y mutantes; la versión corregida todavía debe completar verify/regresiones/accept limpio. La presencia del gate no acredita aceptación.

## Historial de autoría

Estado15/60; F02-04 ya aceptada/publicada. No declarar17/60. Conservar los16grupos anteriores y el health mutant con identidad owner; ningún subset sustituye full05 o standalone06.

Nuevos oráculos ejecutables: umbrales120/60 versus60/30 sobre SQL real; Next machine-auth sin cookie como autorización, body/query scopes rechazados sin efectos; coldstarts Next con progreso multitenant; bytes exactos CSV y neutralización de fórmula, descarga Chromium,503/retry conservando estado; clicks historia y selección CAS con409y recuperación. Exigir inventario completo27grupos,0skip y recibos de limpieza por IDs.

Pendientes de cierre: full05 y standalone06 en Node22/26 sobre snapshot fijo nuevo; matriz global007/revisión independiente/freeze/verify/accept. Provider cron/net/Vault, cloud y connection-ready no están acreditados. No copiar evidencia sensible o journals0600 al control.
