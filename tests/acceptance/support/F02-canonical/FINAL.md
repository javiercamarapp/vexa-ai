# Examen F02-04 existente — cierre bloqueado por P1

Base informada: `da5406b89a48b94a65a6e43bbc981cf4d4e834cc`.
FIX36 inmutable: `/Users/javiercamaraportepetit/vexa/.runtime/f02-data-durable-1789924838176941000/canonical-fix`.
Sesión esperada F02#40/global184 según encargo; no se altera ni se afirma haber
reconciliado el registro autoritativo, que está fuera del alcance permitido.
Sin delegación, modelos adicionales, gasto, cloud, envíos, push, accept o freeze.
Estado oficial13/60 conservado. Revisión independiente Root **pendiente**.

## Corrección del oráculo34

`REVISION_NOT_ADDITIVE` exigía el importe de revisión2 sin autoridad para ordenar
revisiones opacas. ADR-001/INTERFACES de FIX36 exigen ambigüedad: historia2,
proyección1, importe SQL NULL y ninguna revisión seleccionada. El oráculo ahora
exige esas condiciones; luego el owner elige explícitamente revisión1 mediante
CAS y se exige **9007199254740993 exacto**, auditoría con actor real y un solo
éxito entre dos selecciones concurrentes. Una nueva revisión invalida selección
e importe. No se reduce precisión, dedup ni unknown≠zero. La corrección del
oráculo está implementada y ejecutada; requiere revisión independiente antes
congelar. RESULTADO.md, SHA256SUMS y evidencia34 se conservan como históricos.

## P1 reproducido

El backend con identidad analyst real y acción import puede ejecutar UPDATE
sobre source_heads para fijar state='selected', selected_revision_id y version,
sin owner, expectedVersion ni auditoría. Las APIs sí rechazan analyst/viewer/
operator/read/otro tenant, pero la política backend_update sólo verifica import.
El examen directo falla con `P1_OWNER_SELECTION_BYPASS_ANALYST_DIRECT_SQL`;
la matriz lo reproduce por separado con
`P1_OWNER_SELECTION_BYPASS_ANALYST_DIRECT_HEAD_UPDATE` (SQL00000/1fila).
La tabla permite el camino alterno que el contrato exige cerrar. Producto intacto.
No se trata un error de setup como este hallazgo ni se declara el gate verde.

## Cobertura incorporada

Cinco entidades con snapshots, ID lógico estable y revisiones; fechas nulas
legítimas; CSV con relaciones conocidas; importes bigint exactos y nulos;
replay/reorder/counters; conflicto sin sobrescritura; dos procesos deduplicando;
dos conexiones/cuentas e imports, hash/mapping; owner CAS y revocación real;
normalización real con código/campo/fila/hash exactos, sin persistir mensaje/raw
PII sintético; errores SQL dentro de persistencia y adaptadores, rollback.
Matriz explícita de tres tablas y19FK nuevas, historia append-only, acciones,
roles, tenant, revocación y selección. No whitelist de tablas desconocidas.

GATE_INCOMPLETE deja de ser una aserción incondicional: los faltantes concretos34
se ejecutan. Esto no concede aceptación ni cobertura universal; el P1 queda rojo.
La entrada directa siempre ejecuta la suite completa en infraestructura TMP.
La marca interna sólo evita recursión, no omite casos. Padre e hijo eliminan
NODE_TEST_CONTEXT; el hijo usa TAP explícito y exige marcador F02_04_COMPLETO,
exit0 y skipped0 para considerar verde. El marcador solo nunca basta.

## Evidencia y límites

Evidencia de esta sesión: `evidence/close36/`. Se conservan intentos iniciales,
incluido el error de fixture sourceColumn undefined en FK de organizaciones
(corregido con acceso opcional), y el rechazo conservador del reporte spec de
Node26 por ausencia de marcador TAP (corregido forzando reporter=tap).
No se presentan esos intentos como verdes finales.

No probado: revisión independiente Root, aceptación/controlador, integración
consumer/UI/HTTP05, producción/proveedores, retención completa frente a las
nuevas restricciones, SIGKILL, cargas sostenidas/deadlocks, corpus cliente,
ni todas las mutaciones posibles. Los tres mutantes existentes cubren dedup,
conflicto y tenant; no constituyen mutation coverage universal de nuevos casos.

## Comandos reproducibles de esta sesión

Desde el gate, con `VEXA_CANDIDATE` apuntando a FIX36:

```sh
EXAM_PORT_BASE=58022 /tmp/vexa-xml-interop-renewed/node-v22.22.0-darwin-arm64/bin/node --test --test-reporter=tap tests/acceptance/F02-04.test.mjs
EXAM_PORT_BASE=58022 node --test --test-reporter=tap tests/acceptance/F02-04.test.mjs
EXAM_PORT_BASE=58016 EXAM_NODE=/tmp/vexa-xml-interop-renewed/node-v22.22.0-darwin-arm64/bin/node python3 -B tests/acceptance/support/F02-canonical/run.py F01-03.test.mjs
EXAM_PORT_BASE=58028 python3 -B tests/acceptance/support/F02-canonical/run.py F01-03.test.mjs
EXAM_PORT_BASE=58022 EXAM_NODE=/tmp/vexa-xml-interop-renewed/node-v22.22.0-darwin-arm64/bin/node python3 -B tests/acceptance/support/F02-canonical/run.py support/F02-canonical/mutations.test.mjs
EXAM_PORT_BASE=58022 python3 -B tests/acceptance/support/F02-canonical/run.py support/F02-canonical/mutations.test.mjs
```

Baseline4/5 se materializaron sólo en TMP copiando config/platform y migraciones
0001–0004 o0001–0005 del gate, sin retirar archivos de ninguna fuente.
Rutas exactas: `evidence/close36/baselines.json`. Ejecutar el mismo comando
F01-03 con esas rutas y Node26. La ausencia ejecuta el entrypoint directo con
VEXA_CANDIDATE apuntando al gate baseline5, sin persistencia04.

| Ejecución final | Resultado |
|---|---|
| F02-04 directo Node22.22.0 | exit1;21pass,1caso P1 + padre fallidos;0skips |
| F02-04 directo Node26.7.0 | exit1;21pass,1caso P1 + padre fallidos;0skips |
| Baseline4 Node26 | exit0;168/168 |
| Baseline5 Node26 | exit0;172/172 |
| Mutantes Node22 y Node26 | exit0;4/4 cada uno;3ciclos0→1assert→0 |
| Ausencia baseline5 Node26 | exit1;IMPLEMENTATION_MISSING:F02-04;0recursos |

El entrypoint padre añade su propio fallo al propagar el hijo rojo; no representa
otro defecto de producto. `final-commands.json` conserva argv/Node/candidate/exit
para entradas directas y mutantes. `summary.json` y `receipts/` conservan salidas,
cleanup por IDs y hashes/modos antes/después. `executed-tests.json` identifica
los archivos del examen materializado en cada ensayo. Los scripts del ejecutor
fueron propios en TMP; no ejecutaron autores que reescribieran evidencia ajena.

Matriz FIX36 final Node22: **193tests,191pass,2fail (P1 y padre),0skips**, exit1,
Auth/Storage/revocación completos y cleanup true. Las19FK nuevas se ejecutaron;
ningún error de fixture en esta repetición. Archivo `matrix6-final22.log`.

Integridad final: **1806 archivos de FIX36 idénticos en SHA256 y modo** respecto
al snapshot inicial; **cero cambios fuera de la allowlist** en el gate.
`before.json`, `after.json`, `integrity.json` y `FINAL-SHA256SUMS` documentan el
alcance. No se reescribieron los SHA256SUMS ni los ensayos históricos34.
Los manifiestos excluyen .git/private/node_modules/.runtime; no se afirma un
escaneo de privados o historial Git. Ningún comando cambió HEAD/config/historial.
