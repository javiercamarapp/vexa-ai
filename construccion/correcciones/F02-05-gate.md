# F02-05 — corrección externa pendiente de validación completa

## Evidencia del CSV y precondición de consumo — 20-sep

Una corrida Node22 produjo sólo cabecera CSV. Se preservó el rojo: no guardaba estado del job antes de limpiar, por lo que su causa original sigue desconocida. Un diagnóstico parcial y otro completo27/27 con el mismo producto no lo reprodujeron; verify oficial Node26 también pasó27/27 con observación SQL de sólo lectura. Esto no demuestra que el fallo original esté corregido.

Se corrigió la carencia de diagnóstico del examen, sin cambiar producto, bytes esperados ni introducir reintentos: guardar estado/checkpoint/contadores/intentos en recibo0600 y exigir partial/done/offset103/una rechazada antes de descargar. Revisión independiente del único archivo aprobada; seis probes sintéticos y dos casos SQL/browser reales: no-consumo falla por CSV_CONSUME_TERMINAL con recibo queued/sin intentos; consumo real pasa CSV exacto. El wrapper del rojo confirma el fallo esperado, no aprueba ese producto.

El primer candidato verificado se preserva/rechaza para congelar esta guarda. Sus regresiones F02-01/02/03/04 y cuatro jobs CI pasaron con huellas y cleanup intactos; se reutilizan para el producto idéntico. Nuevo verify/accept debe ejecutar el examen reforzado, conservando la incidencia no reproducida para seguimiento y auditoría final.

## Revisión independiente y correcciones de cierre — 20-sep

Revisión de producto rechazó historial que quedaba vacío tras queued→terminal y no permitía recuperar503. La UI comunica estado/checkpoint y permite actualizar historial; el caso externo ahora abre queued, provoca503, reintenta, comprueba aparición automática y conserva CAS409→200. Rojo anterior por `HISTORY_RETRY_AVAILABLE`, verde corregido; no timeout contado como mutante.

Revisión del control rechazó un import Playwright desde TMP histórico y la sustitución del journal externo. El cliente se obtiene ahora de la imagen Docker fijada dentro de TMP propio; broker/journal heredados se conservan con offset. Ambas corridas de navegador registraron seis recursos en el journal externo y verificaron limpieza. Recheck independiente aprobó estos cuatro archivos; lint verde. La corrida previa completa Node26 pasó27grupos y mutantes; la versión corregida todavía debe completar verify/regresiones/accept limpio. La presencia del gate no acredita aceptación.

## Historial de autoría

Base ff5f9bf8813b8d7956f3b1482d2b220cc4b8e6ca;15/60 aceptadas. Reutilizar los16grupos aprobados del informe FINAL de gate56. Conservar rechazo P1 de0007: INSERT delegaciónB desde scopeA y cambio de identidad; no relajar oráculos para el producto viejo. No inferir vulnerabilidad de cambio tenantA→B que sí rechazó42501.

El examen ampliado añade dispatcher/coldstarts multitenant/bootstrap, refresh Auth real, terminal auditable por revocación con replay, dedup entre imports/claves y fallo SQL canario fila103 conservando primer chunk. Los mutantes fence/atomic/health deben demostrar0→1→0 por aserción de dominio, nunca setup/timeout. Launcher exige inventario27grupos exacto y0skip; no marcador aislado.

Validación full05 y standalone06 en Node22/26 contra snapshot fijo nuevo permanece requerida; no aceptación, freeze, revisión global007 ni publicación implícitas. Ver support/F02-durable-final/README.md y recibos TMP de esta entrega.
