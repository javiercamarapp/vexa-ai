# Resultado renovado gate02 — GATE_INCOMPLETE, no aceptación

19-sep-2026, rol acotado900s. Base declarada por principal71bd4bf3c26c16f37fa8be98ae6765316e329a03; no se consultó ni modificó Git/HEAD. Banco5fbf223 leído como referencia, sin adoptar F06/DDLlegacy. SHA256 del entrypoint actual: `c460435f459f8d8ab7f48ff5bf9501baf7c25448f5c8acfadc23976cb9870c48`. Hashes de fuentes y recibos: SHA256-RENEWED, RENEWED-RUNS.json y sources.json de cada run reciente.

## Evidencia fresca

| Prueba | Comando (prefijo support/F02-durable/) | Exit / resultado | Artefacto evidence/ |
|---|---|---|---|
| Positivo SYNTHETIC con createDatabase/pg/Auth/Storage reales | `python3 -B run.py node --test .../probe.test.mjs` |0;18funcionales,19tests,0skip|run-5455fa81-839f-4acd-b832-3236cf98678a|
| Nueve mutantes SYNTHETIC |`python3 -B mutation-processes.py`|0;9ciclos OS0→1→0|mutations-60e1b9d4-22b4-47a0-99b5-f5095cacd163|
| Hash omitido en copia TMP del producto |`python3 -B product-mutations.py hash`|0;OS0→1→0,PRODUCT_HASH_MISMATCH|product-mutations-e512f190-a0b5-487e-b975-e9868f062fe0|
| Escritura fuera de transacción en copia TMP del producto |`python3 -B product-mutations.py atomic`|0;OS0→1→0,ATOMIC_CONFIRM_ROLLBACK|product-mutations-5b6c26dc-2483-4225-807e-26cbd000f9c9|
| Expiry reloj real y owner inmutable |`python3 -B run.py node --test .../product-expiry.test.mjs`|0;2funcionales,3tests|run-afc71bbb-efe6-46f1-ab8d-2c3456352281|
| BuildTMP y ruta real Next |`python3 -B run.py node .../next-smoke.mjs`|0;ci offline0,build0,HTTP503/auth_not_configured|run-3b003fa7-4969-4038-9af9-eb5207d3fa6b|
| Producto ausente en esta copia |`python3 -B run.py node --test tests/acceptance/F02-02.test.mjs`|1;IMPLEMENTATION_MISSING esperado|run-b9a67dec-bfae-40aa-b7f7-34e35fb9e5a1|

Todos con PYTHONDONTWRITEBYTECODE=1; producto con VEXA_CANDIDATE explícito a copia imports del mismo lanzamiento. Comandos completos/exits exactos en result.json/results.json. Todos los 58 recibos renovados indexados verifican cleanup=true; esto no prueba cleanup universal ni convierte recuperación manual anterior en automática.

## Qué queda probado

SqlPool usa pg real dentro del contenedor propio; createDatabase original limita transacción y SET LOCAL ROLE. Login y backend sinSU/BYPASSRLS, login no dueño y sin acceso directo a imports; RLS oculta B sin filtro de repositorio; membership revocado vuelve a rechazarse aunque IdentityPort reporte caché activa. Observador SQL separado, triggers jobs/outbox con secuencia no transaccional acreditan alcanzar fallo y snapshot acredita rollback.

Reserva/carga/confirm/replay/concurrencia HTTP y uniqueSQL, mapping conflictivo, hash/tamaño independientes en referencia, owner de reserva, tenant/selector/viewer/revocación, capacidades Storage firmadas expiradas y control positivo, SQL de reserva fallido, SIGKILL/reinicio de HTTP conservando DB+Storage/secreto e IDs. Mismos bytes con claves distintas conservan vínculos import/job/outbox.

Producto real: mutantes hash y atomicidad válidos; expiry con DEFAULT SQL2s de fixture ANTES de firmar, espera real,409reservation_expired, reserva/bytes intactos y sinjob, luego control positivo. Trigger de producto rechaza alterar owner_id con42501, owner intacto y confirmación autorizada202. No se deshabilitó trigger para fabricar fixture. Next real compila pero smoke sólo fail-closed sin configuración; flujo durable principal probado por Node, NO SSR autenticado.

## Fallos preservados y límites

Primer run renovado falló reconciliador sintético por acciónretain; corregido aimport sin modificar RLS. Mutante expiry='completed' no alcanzó aserción porque DB rechaza estado inválido: NO contabilizado; sustituido por defecto válido queued. Diagnóstico inicial producto tenía clase AccessError duplicada al transpilar: adaptación ahora reexporta session.ts original; aquellos503 no son defectos acreditados del producto. Error de sintaxis al escribir script de mutación guardado en evidence/setup-*/result.json, NO mutante.

Primer build falló ruta relativa del autor; su nueva fuente corrigió el import y se repitió build. Dos fixtures de owner corrupto fallaron por trigger inmutable y el intento de tamaño falló durante carga por validación Storage: no son mutantes muertos. Logs antiguos y nuevos fallidos intactos.

**Pendiente:** contrato HTTP de códigos/error de bytes y expiración; fixture de tamaño compatible con rechazo anticipado de Storage; SSR autenticado real con SQL/Storage; política productiva de reservas expiradas/reconciliación; snapshot final del autor, revisión independiente y congelación. No se exige exportinventado de mantenimiento ni se elimina GATE_INCOMPLETE. No probado Node22, TTL15min completo, cloud, producción, proveedores ni limpieza ante todas las cancelaciones. Cero aceptación/publicación/Git/configexterna/gasto. Historial20/24F02 y164/220global no se resetea, sin nuevos agentes/model calls.

Ver INTERFACES.md y PRINCIPAL-PENDING.md para integración. No correr el diagnóstico completo con h.advance sintético contra reloj productivo y contar ese fallo como bug; usar prueba de reloj real descrita.

---

## Informe histórico preservado (no estado vigente)

# Resultado parcial durable F02 — no congelable

Base/HEAD comprobado: **8340d26e1c6463ed6ccd158ee2a6ed4d202bc987**.
Banco read-only: **5fbf2230b76d24e19cad966f97a136b661d03aaa** (SHA del encargo/mapa).
Estado oficial sin cambios: **11/60**. No producto editado, no Git/config/registry/
guide/orchestration, no delegación/model calls/cloud/deploy/gasto ni datos reales.

## F02-02

Entregado examen ejecutable **parcial**, harness Auth/Storage/SQL reales propios,
servidor positivo SYNTHETIC separado, contrato HTTP único propuesto y controles
negativos. Sólo routes autorizadas nuevas. No se arrastró pipeline/F06.

Comando positivo:
`PYTHONDONTWRITEBYTECODE=1 python3 tests/acceptance/support/F02-durable/run.py node --test tests/acceptance/support/F02-durable/probe.test.mjs`

Resultado completo anterior a añadir diagnóstico de fixtures: **exit0, 11 casos
funcionales / 12 tests contando contenedor, 0 skipped**.
Recibo: `evidence/run-1789867275593459000/`.

Cobertura ejecutada: reserva previa y carga directa Storage; confirm/hash y tamaño
independientes; token confirm expirado; token Storage expirado correctamente firmado
con control positivo del mismo firmante; alteración de URL firmada hacia B;
confirmaciones HTTP concurrentes/replay; dos conexiones SQL simultáneas con único
commit y SQLSTATE23505 (tenant B sí inserta misma clave); tenant/conexión B,
selector forjado, viewer, anónimo, revocación; triggers reales en jobs/outbox con
rollback leído por otra conexión; error de reserva sin objeto huérfano.
La secuencia SQL no transaccional acredita alcanzar cada trigger de fallo antes
de interpretar el503 como prueba de rollback. Restaurado el trigger, reintento202.

Mutaciones con procesos reales:
`PYTHONDONTWRITEBYTECODE=1 python3 tests/acceptance/support/F02-durable/mutation-processes.py`

**exit0 del verificador; dos ciclos OS exit0→exit1→exit0**:
- Hash omitido: `HASH_MISMATCH` / `ERR_ASSERTION`.
- Update de import fuera de transacción: `ATOMIC_CONFIRM_ROLLBACK` / `ERR_ASSERTION`.

Logs exactos de cada proceso y env no secreto en
`evidence/mutations-1789867311475485000/results.json` y seis logs contiguos.
Mutantes sólo del servidor de referencia; NO revisión de producto.
Prueba adicional interna: `mutations.test.mjs`, exit0, dos ciclos de aserciones.
No se contó infraestructura como mutante muerto.

Candidato baseline:
`node --test tests/acceptance/F02-02.test.mjs` → **exit1**,
`IMPLEMENTATION_MISSING: packages/jobs/index.mjs`, esperado.
Recibo `evidence/run-1789867163521069000/`.

Banco con VEXA_CANDIDATE explícito → **exit1**, export propuesto
`createImportHandler` ausente; **no prueba fallo del código canónico existente**.
Recibo `evidence/run-1789867339793534000/`. No se usó fallback legacy.

Fallos anteriores íntegros: primer ensayo Storage no ready (infra, cleanup true);
segundo replay en referencia; tercero mensaje de expiración de Storage era
`"exp" claim timestamp check failed`, no la palabra expired. Se corrigió sólo el
clasificador a ese mensaje real y se mantuvo positivo firmado. No se rebajó rechazo.
Cada run tiene argv, exit, journal0600 y cleanup verificado. No DB host ports;
UUIDs/owner broker propios, --pull never. Core0001–0004 hasheado y verificado intacto.

### Lo que impide congelar02

El puerto SQL del prototipo usa administrador de DB propia. Falta reemplazarlo por
**SqlPool/createDatabase existente** y demostrar el backend RLS, no sólo los efectos
observados por admin. Falta cablear la ruta Next/SSR existente (el HTTP listener de
prueba ejecuta el nuevo export propuesto), revisar contrato/metadatos ADR04,
reinicio de servicio conservando tokens/reservas, crash real y reconciliación/
retención de reservas expiradas, mapping conflictivo y mismo contenido con claves
distintas. La concurrencia SQL unique sí se probó; la reserva HTTP concurrente
completa todavía no. Ningún control positivo sustituye estas obligaciones.

Por eso el entrypoint termina en **GATE_INCOMPLETE** si llega a superar los casos.
No puede dar PASS de producto ni congelarse en este estado. La prioridad02 se
mantuvo; no se abrieron cuatro esqueletos.

## Otros IDs

- **F02-04:** no escrito aquí. Pendientes unique DB de revisiones, cuarentena/
  historia y 10K accepted+rejected+duplicates. Los puros anteriores siguen read-only.
- **F02-05:** no escrito aquí. Pendientes leases/fence/checkpoint/crashACK/429/
  Retry-After/deadletters máximo4.
- **F02-06:** no escrito aquí. Pendientes consumidor proceso, heartbeat≠avance,
  alarmas120/60, reinicio, polling/UI y ubicación workerhost.

No probado: producto02 real, 04/05/06 durables, buildNext, producción, cloud,
Google, proveedores ni consumer host. Sin aceptación/revisión independiente.
No se repitió controller110 ni MCP preflight ajenos a este cambio.

## Última repetición y conservación

Después de añadir bytes sintéticos reproducibles y SHA256 por fixture, la suite
completa volvió a **exit0, 11 casos / 12 tests, sin skipped**. Recibo final
`evidence/run-1789867380023579000/`; `output.txt` contiene los hashes y bytes base64
SYNTHETIC. Cleanup verificado. No cambios de aserciones tras esa repetición.


## Cierre posterior —20-sep, sin reescribir el checkpoint anterior

Consultar FINAL-GATE.md: entrypoint total exit0 contra snapshot exacto, SSR autenticado real +24/24 Node; controles SSR Origin/SHA/atomicidad0→1→0; ausente IMPLEMENTATION_MISSING. GATE_INCOMPLETE retirado tras esos resultados. Hashes antes/después idénticos. Pendientes revisión independiente y freezeprincipal; NO aceptación, F02-04/05/06 no aprobados. Ensayos fallidos conservados.
