# F01-03 / import_uploads — propuesta CONTROL-PLANE

20-sep-2026. Autoría local completada; pendiente revisión independiente. No freeze,
registro, prepare, accept, push, cloud, gastos ni invocaciones adicionales de modelos.
Sin delegación. Continúa siendo 12/60; no se acepta F02-02 con este informe.

- Baseline/control: `7be51ea785e03e0bb5196fed96e11a718cf0e63b`.
- Producto revisado, sólo lectura: `38a8c503cf691413fde27d385a47ade53273843e`.
- Runtime conductual: Node26.7.0, Docker local con `--pull never`.
- Artefactos: `/tmp/vexa-f0202-extension.0ftHXL` (fuera de fuentes).

## Resultados reales

| Ejecución | Pruebas | Exit | Fallos/skips |
|---|---:|---:|---:|
| Baseline0001–0004, gate completo |168|0|0/0|
| Producto0001–0005, gate completo |172|0|0/0|
| Mutaciones |10 (9 subtests + envolvente)|0|0/0|
| Producto, primera ejecución exploratoria |172|0|0/0|

Ambos gates completos emitieron `REAL_AUTH_STORAGE_RETRIEVAL_COMPLETE` y
`REAL_OLD_SESSION_REVOCATION_COMPLETE`. Los168tests core se conservan; producto
suma autorización uploads y sus3FKs. Catálogo global:97FKs core,100con extensión.
No se redujeron aserciones ni se ajustaron conteos de fixtures core.

## Cobertura añadida

Activación sólo por catálogo/presencia de `public.import_uploads`; una tabla
pública distinta continúa rechazándose. F02-02 conserva su examen obligatorio
de existencia: no fue modificado ni reejecutado aquí.

Schema: PKUUIDimport_id, tenant/user obligatorios, columnas/tipos/nullability,
RLS/FORCE y privilegios efectivos anon/authenticated/service_role/vexa_backend.
Se exigen exactamente las3FKs compuestas validadas y sus mappings. Todas lasFKs
nuevas descubiertas se ejecutan por routing propio, además de la clasificación
global existente. Matrix/harness/services/oracles.test anteriores permanecen
byte a byte; `core-preserved.json` contiene sus hashes.

Fixtures A/B con usuarios dueños y parents del seed existente; no se inventa id.
Lectura autenticada: dueñoA/B positivo, dual/otro miembro/analyst/operator/viewer/
outsider vacío comprobado con SQLSTATE00000; anon denegado. INSERT/UPDATE/DELETE
directos propios y ajenos denegados; fixtures deINSERT evitan colisión dePK.
Backend ejecuta como `vexa_backend` real, con tenant/action/identidad: read/import,
A/B, tenant ajeno/ausente, dual/analyst positivos, viewer/operator/outsider negativos,
INSERT/UPDATE, DELETEsin grant y revocación. Revocación propia se restaura y compara
contra snapshot antes del core. Un error SQL no se interpreta como cero filas.

Cada FK tiene positivo y negativo23503 con nombre exacto deconstraint:
imports mantieneimport_idA contenantB/userB/jobB; memberships cambia sólo userB;
jobs cambia sólo jobB. La reservaA se elimina dentro del probe revertido para
no obtener23505. Sólo se desactivan triggersUSER, nuncaRI; SETCONSTRAINTSALLIMMEDIATE
fuerza chequeos diferidos. job_idNULL permitido; modos de triggers restaurados.
Autorización/RLS se prueba con triggers normales y rol producto.

## Mutantes: controles 0 → aserción → 0

Cada mutación se revierte en finally; positivos antes/después. Ningún timeout,
error desetup o SQL genérico cuenta como kill. Los nueve subtests son:

- RLS disabled: 0 -> ERR_ASSERTION:UPLOAD_RLS_DISABLED -> 0
- owner omitted: 0 -> ERR_ASSERTION:UPLOAD_OWNER_ONLY:dual -> 0
- physical FK dropped imports: 0 -> ERR_ASSERTION:UPLOAD_FK_CROSS:imports -> 0
- catalog FK dropped imports: 0 -> ERR_ASSERTION:UPLOAD_FK_COUNT -> 0
- physical FK dropped memberships: 0 -> ERR_ASSERTION:UPLOAD_FK_CROSS:memberships -> 0
- catalog FK dropped memberships: 0 -> ERR_ASSERTION:UPLOAD_FK_COUNT -> 0
- physical FK dropped jobs: 0 -> ERR_ASSERTION:UPLOAD_FK_CROSS:jobs -> 0
- catalog FK dropped jobs: 0 -> ERR_ASSERTION:UPLOAD_FK_COUNT -> 0
- unknown public table: 0 -> ERR_ASSERTION:MATRIX: unclassified public table -> 0

Las3retiradas físicas usan la FK descubierta antes de mutar, de modo que el fallo
es aceptar el cruce (00000 frente a23503), no simplemente desaparecer delcatálogo.
Tres controles adicionales demuestran también rechazo por catálogo al faltarFK.
No hubo hallazgos reales de producto en este alcance; no se modificó el candidato.

## Comandos y evidencia

Desde el worktree de autoría:

```sh
VEXA_CANDIDATE=/Users/javiercamaraportepetit/vexa/.runtime/F02-02-1-1789881690497641000 node --test tests/acceptance/F01-03.test.mjs > /tmp/vexa-f0202-extension.0ftHXL/product-first.log 2>&1
node tests/acceptance/support/F01-03/import-uploads/run.mjs /Users/javiercamaraportepetit/vexa /Users/javiercamaraportepetit/vexa/.runtime/F02-02-1-1789881690497641000 /tmp/vexa-f0202-extension.0ftHXL > /tmp/vexa-f0202-extension.0ftHXL/runner.log 2>&1
python3 -B /tmp/vexa-f0202-extension.0ftHXL/audit.py
git diff --check
/tmp/vexa-xml-interop-renewed/node-v22.22.0-darwin-arm64/bin/node --check tests/acceptance/support/F01-03/import-uploads/oracles.mjs
/tmp/vexa-xml-interop-renewed/node-v22.22.0-darwin-arm64/bin/node --check tests/acceptance/support/F01-03/import-uploads/mutations.test.mjs
node --check tests/acceptance/support/F01-03/import-uploads/run.mjs
```

Todos exit0. `results.json` contiene comandos de cada proceso hijo, entorno
candidate, brokerUUID, log, journal, exit y recursos restantes. El runner genera
VEXA_CI_BROKER propio y VEXA_CI_JOURNAL0600 por ejecución; repetir requiere otroTMP.
La primera ejecución usó el broker en memoria del harness sin journal persistente;
sus5nombresUUID se conservaron en audit.py y se comprobaron ausentes al cierre.
Durante el runner se endureció sólo su chequeo deausencia para rechazar errores de
Docker distintos de«no existe»; los tests ejecutados no cambiaron. La auditoría
estricta final repitió esa comprobación sobre todos los20recursos.

Salida auditoría: `{"allowlist_only": true, "migration_hashes_unchanged": true,
"resources_absent": 20}`. Son16contenedores y4redes propios; DBsin puertos publicados.
Auth/Storage/PostgREST usaron exclusivamente los puertos locales autorizados del
harness. Journals activos0600 comprobados, sin secretos/JWT en este reporte.
No node_modules, .next o __pycache__ creados en fuentes. Git/HEAD/config intactos.

## Hashes SHA256

Fuentes finales (RESULTADO.md excluido para evitar autorreferencia):

- `tests/acceptance/F01-03.test.mjs`: `a1cfbc16afa4dd741bb79ff175915e215f93715c8580f6fe9127b89ca0d38ad9`
- `tests/acceptance/support/F01-03/oracles.mjs`: `46543df60eb16d2a9c14941d9fbf98ca1bd541017396e7c7090370884a3516fa`
- `tests/acceptance/support/F01-03/README.md`: `bac7f75f44a62d8e5e1179eeaffe1b748ea4e009515212595ef065ecb6d7b0d3`
- `tests/acceptance/support/F01-03/import-uploads/mutations.test.mjs`: `4ec6a13d349b9a11a2057925ff32be78a0cf4e581194e3950441cc4d6fdf52ec`
- `tests/acceptance/support/F01-03/import-uploads/oracles.mjs`: `b177b11d258914272aa1bf013c940d0dfdd42052d1ed9b37268a30950cb20083`
- `tests/acceptance/support/F01-03/import-uploads/run.mjs`: `1cae699a40bbdba63753457fdee95fbc0a814bc44d90c56dbbc6099a88c5e3e6`

Logs de ejecución:

- `/tmp/vexa-f0202-extension.0ftHXL/baseline.log`: `7ee57456f08132c2edb1ec2df94db1541c5d8bbc42a098853db27b57dfccf5f8`
- `/tmp/vexa-f0202-extension.0ftHXL/product.log`: `0ed724f347917792879c522b6f641d99fa8d8dc06f09237a49cc8b961c53b16e`
- `/tmp/vexa-f0202-extension.0ftHXL/mutations.log`: `4daaddc2de850d7c5b7c0c1a0874c736827acecf222c2fc1fe08858f98e9d469`

Migración canónica sólo lectura:

- `supabase/migrations/0005_import_outbox.sql`: `af99f51bdd2101b56d1793463004c8f2259b764ad367fadf7322f78107c5afcf`

`inputs.json` conserva SHAdeHEAD y hashes de todas las migraciones de los3árboles;
`final-audit.json` acredita que permanecen iguales y detalla limpieza/allowlist;
`core-preserved.json` conserva hashes del core inalterado.

## No cubierto / pendiente

Revisión independiente de esta propuesta, freeze/registro y ciclo oficial posterior
corresponden al principal. No se reejecutaron F02-02, los73controles históricos de
oracles.test, controlador, build, todos los demás gates ni runtime conductualNode22
(sólo sintaxis22 comprobada). No cloud, producción, datos declientes, conexiones
externas ni SaaS terminado. El runner no se presenta como controlador certificado
frente a SIGKILL del proceso completo. Los ensayos ejecutados cerraron sin recursos
remanentes. No se amplió el catálogo a futuras tablas ni se adoptó producto.
