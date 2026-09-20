# F02-05 — corrección externa pendiente de validación completa

## Revisión independiente y correcciones de cierre — 20-sep

Revisión de producto rechazó historial que quedaba vacío tras queued→terminal y no permitía recuperar503. La UI comunica estado/checkpoint y permite actualizar historial; el caso externo ahora abre queued, provoca503, reintenta, comprueba aparición automática y conserva CAS409→200. Rojo anterior por `HISTORY_RETRY_AVAILABLE`, verde corregido; no timeout contado como mutante.

Revisión del control rechazó un import Playwright desde TMP histórico y la sustitución del journal externo. El cliente se obtiene ahora de la imagen Docker fijada dentro de TMP propio; broker/journal heredados se conservan con offset. Ambas corridas de navegador registraron seis recursos en el journal externo y verificaron limpieza. Recheck independiente aprobó estos cuatro archivos; lint verde. La corrida previa completa Node26 pasó27grupos y mutantes; la versión corregida todavía debe completar verify/regresiones/accept limpio. La presencia del gate no acredita aceptación.

## Historial de autoría

Base ff5f9bf8813b8d7956f3b1482d2b220cc4b8e6ca;15/60 aceptadas. Reutilizar los16grupos aprobados del informe FINAL de gate56. Conservar rechazo P1 de0007: INSERT delegaciónB desde scopeA y cambio de identidad; no relajar oráculos para el producto viejo. No inferir vulnerabilidad de cambio tenantA→B que sí rechazó42501.

El examen ampliado añade dispatcher/coldstarts multitenant/bootstrap, refresh Auth real, terminal auditable por revocación con replay, dedup entre imports/claves y fallo SQL canario fila103 conservando primer chunk. Los mutantes fence/atomic/health deben demostrar0→1→0 por aserción de dominio, nunca setup/timeout. Launcher exige inventario27grupos exacto y0skip; no marcador aislado.

Validación full05 y standalone06 en Node22/26 contra snapshot fijo nuevo permanece requerida; no aceptación, freeze, revisión global007 ni publicación implícitas. Ver support/F02-durable-final/README.md y recibos TMP de esta entrega.
