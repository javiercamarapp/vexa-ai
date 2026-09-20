# Contratos externos F02-02/04/05/06 — autoría parcial, NO congelados

Estos son casos pendientes de automatizar sobre efectos SQL/HTTP reales. No hay
veredicto PASS ni entrypoint vacío para 02/05/06. No editar producto para hacer
pasar el examen ni transportar pruebas del banco como oráculos.

## Binding existente y reutilización

Fuente leída: banco connected, HEAD 5fbf2230b76d24e19cad966f97a136b661d03aaa.
Leer packages/pipeline/IMPLEMENTATION.md y RECOVERY.md antes de código.
`createCanonicalJobRepository({database,rawStorage,redactor,gateway,scope})`
en packages/jobs/canonical.mjs devuelve `enqueueCSV(input)` y `runNext()`;
`consumeCanonicalCSV({repository})` llama al segundo. database se construye con
createDatabase de platform y Auth autorizado; nunca IdentityPort desde body.
Input existente: connection_id, idempotency_key, csv, observed_at,
mapping_version. No overload legacy con executor ni migraciones legacy.
HTTP existente: POST text/csv /api/imports con query connection_id,
mapping_version=csv-message-v1, observed_at; header idempotency-key.
GET /api/imports y /api/imports/:id permite comprobar imports/rows/jobs.
POST nuevo retorna202; replay200; análisis sigue queued/pending.
No equivalencia inventada con protocolo de reserva/token/confirmación:
el contrato de F02-02 exige ese protocolo y hoy su binding falta.

Reutilizar sin editar support/F01-02/infra.mjs para Auth aislado y el harness
support/F01-03/harness.mjs para SQL/Auth/Storage. Envolver ejecución con lifecycle
CI existente y journal0600 en TMP0700 más UUID. resourceBroker ya admite los
nombres de esos harness. No ampliar sus nombres/reglas en esta autoría, ni lanzar
un orquestador alternativo. Docker --pull never, DB sin puertos; reservar por
broker antes de crear, verificar identidad/label antes de retirar. No sustituir
servicio ajeno si puerto ocupado. Un fallo de setup/cleanup no mata mutante.
Usar copia de build TMP y todos los inputs read-only. No usar logs/casos del banco.

Schema canónico: migraciones0001..0004 aceptadas; adoptar migraciones pipeline
sólo por principal. public.jobs.input_ref es text, attempts.finished_at,
dead_letters.reason, checkpoints.checkpoint JSONB. No inventar actor_id en jobs,
ended_at ni error_code en dead_letters. pipeline.delegations liga actor/version.
F01 no se amplía en este encargo; si falta puerto reutilizable, informar necesidad.

## F02-02 — admisión, Storage y atomicidad

| Caso | Estímulo real | Oráculo externo | Mutante preciso |
|---|---|---|---|
| D02-01 | Dos POST concurrentes A/misma clave/bytes/mapping | Mismos import/job IDs; count imports=1, outbox=1, jobs=1; replay no cambia ledger | Quitar unique/idempotencia |
| D02-02 | Misma clave cambiando bytes o mapping |409 y originales intactos; nuevo mapping requiere clave nueva | Fingerprint omite mapping |
| D02-03 | Sesiones Auth owner/analyst/operator/viewer, sesión revocada | owner/analyst importan; operator/viewer403; revocada denegada; cero objetos/filas nuevos | Confiar rol del body/cache |
| D02-04 | A reserva/confirmación con objeto/import de B; bucket/key arbitrario | Denegación sin filtrar metadata; Storage GET/list/download A no ve B | Quitar scope de Storage |
| D02-05 | Token expirado, hash/tamaño real distinto al declarado | Denegación antes de encolar; outbox sin incremento | Omitir verificación del objeto |
| D02-06 | Fallo SQL inyectado antes INSERT outbox, después INSERT import | Tras rollback no import/job/outbox parcial; reintento sano sí crea exactamente uno | Separar commits |
| D02-07 | Revocar sesión después del upload, antes de confirmar/polling | Confirmación y lectura futura denegadas con mismos tokens | Validar sólo al iniciar |

No basta un mock de RawStorage ni error HTTP sin inspección DB/Storage. Objetos
huérfanos tras fallo deben quedar identificados/reconciliables, nunca confirmar
job por objeto ajeno. Binding reserva/confirmación está pendiente: no se inventa
una ruta /confirm ni se exige un nombre arbitrario antes de revisión de interfaz.

## F02-04 — complemento durable obligatorio

10K filas SYNTHETIC:8000 identidades nuevas válidas,1000 duplicados exactos,
1000 rechazos tipados. accepted8000 + duplicates1000 + rejected1000 + pending0
= total10000; consultar conteos DB completos, no primera página ni retorno JSON.
Repetir y permutar con nuevas claves no cambia conjunto de IDs ni ledger.
Dos procesos/conexiones SQL independientes ingresan misma revisión simultánea:
una revisión persistida. A/B mismos IDs remotos jamás comparten entidad.
Mismo id/revision con hash distinto: cuarentena durable, original inmutable,
resto del lote continúa. Revisión nueva conserva historial y no duplica importe.
Mismo texto/email con IDs distintos sigue siendo dos entidades; no alias automático.
Mutantes: unique retirada, check-then-insert, scope incompleto, UPDATE destructivo,
revisión usada como identidad nueva, rechazo no persistido, conteos paginados.
Banco limita enqueueCSV a500 registros: rojo de volumen es una brecha observable;
no reducir el caso10K ni sumar20 simulaciones sin durable checkpoint/import común.

## F02-05 — consumidor, fencing y recuperación

| Caso | Sincronización independiente | Resultado obligatorio |
|---|---|---|
| D05-01 | Dos procesos runNext bloqueados por barrera SQL | Un claim/fence por intento, aislamiento tenant/scope, otro consumidor no publica |
| D05-02 | Bloquear proveedor SYNTHETIC, vencer lease de W1 en DB propia, reclamar W2, liberar W1 | W1 no cambia snapshot/checkpoint/outbox/ack; W2 finaliza una vez |
| D05-03 | SIGKILL real tras checkpoint/efectos COMMIT y antes ACK | Reiniciar proceso; mismos efectos, checkpoint reanudado, sin duplicados ni análisis recobrado |
| D05-04 |401/403 de transporte SYNTHETIC | Terminal/reparación de acceso, sin reintento de proveedor |
| D05-05 |429 con Retry-After mayor que backoff | next_attempt_at respeta Retry-After; no solicitud anticipada ni sobre deadline |
| D05-06 | Fallos transitorios consecutivos | Máximo4 intentos, backoff ensayo1/2/4s; dead_letters.reason persistido, payload sólo refs |
| D05-07 | Cancelar/revocar membership o conexión durante chunk | Fence/publicación denegada, último checkpoint bueno intacto |
| D05-08 | Tenant B/scopeEUR junto A/scopeUSD | Payload, referencia, cache, checkpoint y efectos separados |

Tiempo inyectable sólo si ya existe puerto; en su ausencia sincronizar por estado
SQL con límite de espera explícito, no sleep que casualmente da verde. La ventana
commit-before-ACK debe ser alcanzada y observada; si producto hace ambos en una
transacción se revisa esa frontera y se mata antes/después del COMMIT, nunca afirmar
que se probó una ventana inexistente. Gateway usa transporte sintético, cero API.
No contar JSON succeeded: consultar tablas desde conexión independiente.
Mutantes: fence ignorado, ACK adelantado, checkpoint omitido,401 reintentado,
Retry-After ignorado,5to intento, cancelación ignorada, dead-letter ausente.

## F02-06 — proceso vivo, alarma y estado consultable

Iniciar consumidor separado del servidor HTTP usando binding canónico revisado;
no llamar runNext dentro de POST. POST202 debe dejar queued antes de liberar
consumidor. Observar queued→running→terminal en DB y UI/polling. Matar consumidor,
encolar otro import y comprobar oldest_queued_age>120s / lease>60s / heartbeat
faltante según configuración piloto; jamás convertirlo a completed. Heartbeat
actualizado con checkpoint inmóvil sigue alarmando por last_progress.
Reiniciar consumidor recupera backlog y sólo después permite admisión sana.
A consulta job/import B:404; revocación impide polling y downloads ya conocidos.
Mutantes:202/completed inmediato, heartbeat usado como progreso, alarma siempre
healthy, worker dentro del request, GET sin scope, reinicio duplica efectos.

No hay binding de health/alarma/daemon alojado comprobado en este paquete.
Ubicación/configuración del consumidor alojado y stack MCP/cloud quedan pendientes
al principal; sin cloudwrites, Actions, deploy, inferencia, gasto ni envíos.
