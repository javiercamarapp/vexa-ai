# F06-09 — control independiente del outbox

La revisión separa composición, pruebas del consumidor y permisos SQL. Usa PostgreSQL, Auth y HTTP locales con identidades sintéticas. No envía mensajes a proveedores ni acredita producción.

El contrato exige inserción atómica de evento/trabajo/outbox; identidad y destinatario del equipo autorizado; lease y fencing; cuota antes del efecto; incertidumbre sin reenvío automático; conciliación con recibos vinculados e inmutables; permisos y preferencias actuales antes de un efecto interno.

La composición409 conserva el consumidor histórico y la configuración TLS del runtime vigente. La revisión funcional411 comprobó 17 controles, además del timeout HTTP con reinicio sin reenvío y SIGTERM durante un envío. La revisión410 comprobó nueve grupos SQL y extendió la matriz general a las seis tablas nuevas, permisos mínimos y dieciséis relaciones con equipo vinculado.

## Defecto reproducido y corrección

Una revocación del productor entre `notification_begin_send` y `notification_finish` permitía insertar el aviso interno cuando el autor de la política seguía autorizado. El examen separa esas identidades: antes observó `accepted` e inbox1; la corrección exige que el productor siga siendo owner activo antes de insertar. Después observa `suppressed` e inbox0. Los canales externos conservan su tratamiento de resultados ya enviados.

SQL revisado: `491c7760f957f458eff57ef779bc07fcbbc78ac4bbbb6da25e30afe6584ff6fe`. El caso focal y los nueve grupos SQL pasan con esa corrección. Los rojos previos, incluidos errores de fixtures, permanecen identificados en los recibos privados; no se atribuyen al producto.

## Gate y límites

El examen protegido `tests/acceptance/F06-09.test.mjs` verifica primero la presencia del código, después carga los controles de contrato, SQL, revocación, consumidor y parada. Los mutantes causales prueban que eliminar controles de identidad, recibos o preferencias produce fallos semánticos. La matriz F01-03 conserva sus controles anteriores y añade lecturas, mutaciones denegadas, revocación y relaciones entre equipos para el outbox.

Este documento describe el examen; su existencia no significa aceptación. La promoción requiere `prepare → verify → accept` desde Git limpio y publicación por el publisher autorizado. Correo, push y emisores de eventos corresponden a F06-10..12; las cuentas reales, migración remota, operación y auditoría global conservan su comprobación propia.

## Arranque de infraestructura de pruebas

Bajo carga del equipo, hubo fallos de disponibilidad de Storage antes de ejecutar las aserciones del producto. Se conservan esos fallos y no se atribuye una causa exacta a los contenedores originales ya recogidos. Una calibración independiente del producto retarda veinte segundos el arranque real de Storage: la espera anterior de cien sondeos cada100ms falla con el contenedor sano; una espera acotada a60s obtiene HTTP200 real en25,46s. Los dos harness de infraestructura usan ahora ese plazo de arranque. No se eliminan controles, no se sustituyen servicios por mocks y el gate F06-09 mantiene su límite global de900s.

## Calibración de recuperación tras interrupción

El ensayo de mutación conserva la duplicación HTTP real como control negativo y exige ausencia de reenvío después de restaurar exactamente SQL. Su plazo de lease era1s: una calibración externa con1200ms de latencia tras el HTTP provoca `notification_renew` SQLSTATE40001 y conflicto409; con5s el mismo escenario pasa. Sólo los dos consumidores de ese ensayo usan ahora5s, conservando expiración real, `response.ok`, estado aceptado del mutante, incertidumbre restaurada y conteos HTTP. No se cambia el plazo predeterminado del producto ni el límite global900s. La corrida natural focal y la calibración causal pasan5/5 cada una; la causa exacta del fallo histórico, cuyo SQLSTATE se sanitizó, permanece inferida.
