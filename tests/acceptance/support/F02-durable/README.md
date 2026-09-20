# Renovación gate02 — estado vigente

Leer primero [RESULTADO.md](RESULTADO.md), [INTERFACES.md](INTERFACES.md) y [PRINCIPAL-PENDING.md](PRINCIPAL-PENDING.md). El texto histórico debajo describe el prototipo anterior; sus pendientes de SqlPool y reinicio ya tienen evidencia renovada, pero Next autenticado/contrato final siguen pendientes. GATE_INCOMPLETE se conserva.

Comandos actuales (todos con PYTHONDONTWRITEBYTECODE=1 y python3 -B):
- `run.py node --test tests/acceptance/support/F02-durable/probe.test.mjs`: oráculo SYNTHETIC.
- `mutation-processes.py`: nueve mutantes sintéticos, procesos/recursos reales.
- Con VEXA_CANDIDATE explícito: `product-mutations.py hash` / `product-mutations.py atomic`: copias TMP, fuente original intacta.
- Con VEXA_CANDIDATE: `run.py node --test tests/acceptance/support/F02-durable/product-expiry.test.mjs`.
- Con VEXA_CANDIDATE: `run.py node tests/acceptance/support/F02-durable/next-smoke.mjs`.

El prefijo de los scripts es `tests/acceptance/support/F02-durable/`. sources.json y results.json fijan hashes de fuentes en los runs recientes. Build y transpilation en TMP; no instalación en candidato. Journals0600 UUID owner y cleanup verificado en cada recibo; sin DB publicada.

---

# F02 durable — examen en autoría; NO congelado

Base 8340d26e1c6463ed6ccd158ee2a6ed4d202bc987, 11/60. Prioridad F02-02.
Sólo fixtures SYNTHETIC. `reference.mjs` es servidor positivo de oráculo,
NO implementación de producto. PostgreSQL/Auth/Storage reales propios, broker y
lifecycle F01; ninguna DB host publicada, pull never. Los receipts preservan fallos.

## Propuesta explícita de interfaz, pendiente de revisión

El banco exporta `createCanonicalJobRepository` desde `packages/jobs/index.mjs`.
Se conserva ese nombre/export y su SQL; no se exige renombrarlo ni traer pipeline/F06.
La carga directa todavía no existe. Este examen propone UN export adicional
`createImportHandler(ports): (Request) => Promise<Response>` en el MISMO index.
No hay fallback a legacy, declaración TS ni verdict JSON. Ausencia falla
IMPLEMENTATION_MISSING antes de infraestructura. Este binding requiere review antes
de congelar; no afirma equivalencia con las rutas Next existentes.

Ports actuales del prototipo: `sql(statement): Promise<string>` (psql real con
ON_ERROR_STOP y transacción explícita), `auth(token): Promise<user|null>` (GoTrue
real), `storage(route,token,options): Promise<{status,data,text}>` (Storage real),
`now(): epoch milliseconds`. **Pendiente sustituir el puerto SQL administrativo del
prototipo por SqlPool/createDatabase existente, con actor/tenant y rol vexa_backend.**
No considerar esa parte lista para congelar ni entregar este SQL port a navegador.
El gate observa efectos por conexión SQL administrativa INDEPENDIENTE.

## Único contrato HTTP propuesto para conectar F02-03

Respuestas `{contract_version:'f02-durable-v1',data}`; errores
`{error:{code,retryable}}`. La adaptación final debe reconciliar `meta.trace_id`
con ADR04; no es aún aceptación de cambio de contrato global.

- `POST /api/imports`: JSON `{connection_id,mapping_version,content_type,size,sha256}`,
  header `Idempotency-Key`. Devuelve201 `{import_id,state:'reserved',object_path,
  upload_url,upload_token,expires_at}`. `upload_url` es capacidad Storage para PUT
  directo; `upload_token` es capacidad de confirmación separada. No aceptar bucket,
  key ni tenant arbitrarios. Selector `x-vexa-organization` sólo selecciona membership
  vigente del usuario validado por Auth. Token Bearer es adaptador local; SSR pendiente.
- `PUT <upload_url>`: bytes originales a Storage real; mismo objeto inmutable.
- `POST /api/imports/:id/confirm`: `{upload_token,sha256,mapping_version}`.
  Verifica objeto real, tamaño/hash, dueño/scope y expiración.202
  `{import_id,job_id,state:'queued'}`. Confirmaciones repetidas/concurrentes no duplican.
  La reserva durable `imports.state=reserved` antecede a la carga; confirmar hace
  transición+job+outbox en UNA transacción. Una reserva fallida sigue identificable,
  no se interpreta como import queued/completed ni huérfano oculto.
- `GET /api/imports/:id`: `{import}` con estado/contadores. Extensión F02-03:
  mismo GET devuelve `preview:{mapping_version,timezone,sample_rows,rows,errors}`
  mientras state=mapping. Confirm lleva el mapping aprobado/versionado; no inventar
  una segunda ruta preview. UI, guardado de mapping y descarga autorizada pendientes.
- A→B404; sin identidad401; membership/rol inválido403; idempotency conflict409;
  hash/tamaño/objeto inválido422; fallo DB/Storage503. Error nunca equivale a ausencia.

## Casos ejecutables F02-02

D02-01 reserva/carga real/confirm/concurrencia/replay; D02-02 bytes hash y tamaño;
D02-03 objeto ausente/confirm expirado; D02-04 dos fallos SQL con trigger y secuencia
no transaccional que acredita alcanzar el defecto, rollback y reintento; D02-05
B/selector/conexión/capacidad/Storage; D02-06 revocación de sesión existente;
D02-07 anonymous/viewer/bucket arbitrario; D02-08 token Storage expirado con firma
válida y control positivo del MISMO firmante. Lecturas SQL independientes en todos
los efectos durables. No equivalen a soporte cloud/worker alojado.

`isolated-infra.mjs` extrae infraestructura F01-03; fuente/hash/cambios en
infra-provenance.json. Ninguna aserción de producto copiada. `run.py` reutiliza
lifecycle original y escribe journal0600/cleanup/argv/exit. Ejecución:

```
PYTHONDONTWRITEBYTECODE=1 python3 tests/acceptance/support/F02-durable/run.py node --test tests/acceptance/support/F02-durable/probe.test.mjs
VEXA_CANDIDATE=/ruta/candidato node --test tests/acceptance/F02-02.test.mjs
```

Usar run.py también para candidato con infraestructura. Firma sólo sintética local,
no credenciales reales. Los artefactos no guardan tokens ni contraseñas.

## Pendientes por ID (sin cifra global mezclada)

F02-02: oráculo positivo ejecutado (11 casos funcionales; 12 con contenedor node:test); mutantes internos hash/atomicidad 0→aserción→0. Revisión, puerto SQL canónico, ruta Next/SSR,
confirmación mapping conflictiva, reinicio/proceso muerto (tamaño aislado de hash sí probado),
reserva HTTP concurrente (unique SQL concurrente sí probado), compensación/retención de reservas expiradas.
URL de carga alterada a B y expiración Storage firmada sí probadas. Los casos escritos no son
cobertura acreditada hasta ejecución. No congelar por presencia de archivos.
F02-04: no tocado; pendiente DB unique concurrente/cuarentena/historia/10K durables.
F02-05: no tocado; pendiente leases/fence/checkpoint/crash ACK/429/deadletters4.
F02-06: no tocado; pendiente proceso/heartbeat≠avance/alarmas120/60/polling/UI.

El entrypoint candidato conserva GATE_INCOMPLETE después de los casos: evita un
PASS de producto prematuro aunque una implementación satisfaga el prototipo.
La ausencia de producto falla primero como IMPLEMENTATION_MISSING, esperado.
