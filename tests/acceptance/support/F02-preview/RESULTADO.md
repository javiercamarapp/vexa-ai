# F02-03 — propuesta de examen externo: GATE_INCOMPLETE

20-sep-2026. Autoría independiente en fase F02; sin revisión/freeze/accept/promoción.
Baseline del checkout: `7be51ea785e03e0bb5196fed96e11a718cf0e63b`.
Dependencia permitida F02-02: `.runtime/F02-02-1-1789881690497641000`, commit declarado por contrato `38a8c503cf691413fde27d385a47ade53273843e`, todavía no aceptada. No se inspeccionó el worktree product03 ni sus tests.

## Precedencia y detalles de binding pendientes

Se leyó completo el contrato prospectivo privado. Se sigue su `packages/ingestion/mapping.mjs`, que concreta la salida TS histórica de la ficha. El README histórico F02-durable dice no crear ruta preview, pero el contrato prospectivo exige POST preview y mapping: se sigue el contrato explícito del encargo, sin editar normas ni harness. No se encontró corrección F02-03-gate.md.

El contrato no fija nombres internos de la fila normalizada ni códigos concretos de rechazo. Este examen propone `row.money` (Money|null) y `row.occurred_at` o `row.envelope.occurred_at`, compatible con CSVRecord existente; debe reconciliarse contra el artefacto contratado antes de congelar, sin bajar oráculos. No impone SHA256 como formato del mapping_version: exige versión no vacía, estabilidad canónica y cambio al cambiar configuración. Los timestamps esperados usan UTC ISO con milisegundos. Los selectors accesibles del browser son prospectivos, no fueron extraídos de product03.

## Cubierto por autoría

- Entry falla cerrado por IMPLEMENTATION_MISSING antes de Docker si falta mapping. Invoca funciones del candidato por la ruta contractual. Aunque todas pasen, termina GATE_INCOMPLETE; ningún JSON ni variable retira ese candado.
- `pure.mjs`: USD exacto, entero superior a precisión Number, JPY fraccional rechazado, null/0, moneda constante/por fila/ausente; fecha ambigua dmy/mdy, timezone, calendario, DST gap/fold y offsets; headers duplicados/ausentes; hash canónico; 10000 filas con errores fuera de muestra y suma completa; errores sin PII; RFC4180 y prefijos de fórmula con espacios/controles; XLSX mult hoja con selección explícita.
- `http.mjs`: Requests sobre socket HTTP propio, handler de candidato, createDatabase/SqlPool/identity canónicos y Pg/Auth/Storage reales del harness F02-durable; reserva/subida/preview sin efectos/aprobación/CAS/idempotencia/export/roles/A-B/forja/revocación/queued inmutable/replay. SQL administrativo sólo para fixtures, revocación y observación; nunca como puerto del producto. `AccessError` sigue siendo el mismo módulo del candidato mediante el runtime heredado.
- `browser.mjs`: oráculos de recorrido sobre Page real autenticada y Next /imports: navegación, archivo, columnas, preview, guardar, confirmar explícitamente, estado queued, reload, teclado/foco, no HTML activo, subida directa, responsive, fallo de red y revocación. No monta UI falsa ni responde con mocks.
- `client-boundary.mjs`: oráculo M10 sobre chunks reales y respuestas públicas con canario servidor.
- `run.py`: copias TMP del harness, puertos libres 57950–57989, lifecycle/journal0600 UUID/cleanup heredado, Docker pull-never y DB no publicada heredados, hash/modo antes/después, outputs exclusivamente TMP. No ejecuta scripts históricos que escriben evidencia dentro de sus fuentes. No descarga/instala nada.

## Ejecutado y observado

1. `PYTHONDONTWRITEBYTECODE=1 python3 -B tests/acceptance/support/F02-preview/run.py node --test tests/acceptance/F02-03.test.mjs`
   - exit **1**, aserción **IMPLEMENTATION_MISSING: packages/ingestion/mapping.mjs**; 1 fallo, 0 skips. No fallo de setup ni prueba de producto positiva.
   - evidencia TMP: `/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/f0203-gate-l5famhqx/`.
2. `PYTHONDONTWRITEBYTECODE=1 python3 -B tests/acceptance/support/F02-preview/run.py node --test tests/acceptance/support/F02-preview/meta.test.mjs`
   - exit **0**, **8/8** metacontroles; cada uno ejecuta procesos 0→1 por AssertionError objetivo→0, sin errores de setup aceptados.
   - inferir fecha ambigua, nulo→0, redondear JPY, CSV formula, ignorar CAS, tenant header forjado, tenant body forjado, queued→completed.
   - evidencia TMP: `/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/f0203-gate-1meianv3/`.
   - **Son controles de sensibilidad de aserciones, no mutaciones de implementación ni PASS de producto.** No hay referencia fake enchufada al entrypoint.
3. Fixture XLSX propio validado por parseXLSX aceptado: 2 filas y monto literal10.01, exit0. Sólo comprueba el writer del examen.
4. `node --check` browser/http: exit0. No acredita ejecución de navegador ni backend.

Ambas corridas registraron fuentes inalteradas y cleanup verificado; cero contenedores creados en estas pruebas puras. No JWT, cookies ni secretos en evidencia.

## No cubierto / necesario antes de freeze

- **Backend no ejecutado**: producto03 ausente en esta copia. La prueba HTTP es propuesta; confirmar shapes de respuestas/URL Storage sin flexibilizar aislamiento ni importar oráculos del builder.
- **Next/SSR/browser todavía no conectado a un launcher propio**: el módulo browser tiene aserciones, pero faltan build TMP, arranque Next con proxy/túnel Pg/cookies Auth reales y ejecución Chromium con lifecycle propio. Leer F02-durable/ssr-exam y F01-04/routes/harness read-only; NO correr directamente sus scripts con puertos originales.
- Falta cerrar autoría/ejecución de loading, empty, stale/CAS visible, retry con nueva solicitud, revocación estricta por código, descarga UI real, expiración/reinicio explícito, boundary20MiB, configuración ausente503, XLSX serial/style date no soportado, row_ref y texto exacto. El chequeo UI de revocación actual es preliminar y debe endurecerse: una alerta genérica no prueba denegación.
- Falta Origin403 en Next real, caída Pg/Storage503 con recuperación, concurrencia CAS (sólo stale secuencial escrito), historia de dos versiones completa, proceso Next restart real (recrear handler NO es restart), M10 con canario ejecutado y ausencia de claves service_role en cliente/respuestas.
- Mutantes sobre producto real pendientes, incluidos CAS/forja/queued. Repetir 0→1 por aserción correcta→0 sobre copias TMP, no editar fuentes.
- No suites globales, regresión F02-02, CI, cloud, F06 ni producción. No commits, cambios Git, llamadas LLM extra, delegación, gasto, push ni accept.

## Siguientes comandos

Desde esta raíz, con un artefacto combinado F02-02+03 autorizado e inmutable en CANDIDATE:

```sh
VEXA_CANDIDATE="$CANDIDATE" PYTHONDONTWRITEBYTECODE=1 python3 -B tests/acceptance/support/F02-preview/run.py node --test tests/acceptance/F02-03.test.mjs
VEXA_CANDIDATE="$CANDIDATE" F02_PREVIEW_REAL=1 PYTHONDONTWRITEBYTECODE=1 python3 -B tests/acceptance/support/F02-preview/run.py node --test tests/acceptance/F02-03.test.mjs
```

El segundo habilita HTTP real y requiere imágenes locales ya disponibles; ambos conservarán GATE_INCOMPLETE aun si sus subpruebas pasan. Completar/adaptar launcher Next y negativos pendientes, ejecutar, revisar independientemente y sólo después solicitar freeze. No quitar candado por presupuesto o porque exista el archivo.

## Comprobación final de autoría

Tras endurecer rechazo de errores de setup y transporte HTTP, se repitieron los metacontroles: **8/8, exit0**, cero skips; evidencia `/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/f0203-gate-73toc8h2/`, fuentes intactas y cleanup verificado. `node --check` entry/http/client-boundary exit0. `git diff --check` exit0; `git status --short` muestra únicamente las dos rutas allowlisted sin seguimiento. SHA de HEAD sigue `7be51ea785e03e0bb5196fed96e11a718cf0e63b`.

Los resultados preservan la distinción: el código de M10 ahora detecta también JWT con role service_role en chunks/respuestas, pero **no se ejecutó M10 sobre una aplicación**. No se afirma que el examen esté completo ni congelable.


# Continuación llamada F02 30 / global174 — resultado actual

El texto anterior se conserva como historial. Resultado actual en [FINAL-GATE.md](FINAL-GATE.md), hashes/modos en [HASHES-call30.json](HASHES-call30.json), salida final real en [evidence-call30/output.txt](evidence-call30/output.txt).

**30subtests PASS (28puros+HTTP+SSR/Chromium), exit1 únicamente GATE_INCOMPLETE; 3mutantes de producto0→1aserción→0.** CORS del gateway local diagnosticado/resuelto con allowlist exacta; ningún stub de datos ni desactivación de seguridad. Positiva UI, loading/empty/error/retry, revocación403, XLSX/CSV descargado,10K exactas, CASconcurrente/historia/restart, caídaPg/Storage y M10real43chunks/43respuestas ejecutados. Fuente intacta y cleanupfinal verificado. Sin accept/push/Gitmutación.

Pendientes concretos: runtime sin config503; frontera20MiB y expiración/reinicio explícito; CASconflicto visible con dos editores UI; matriz adicional Origin/Storagedescarga revocada/expirada y endpoints; más representacionesExcel; revisión independiente del harness/cleanupadversarial; examen de fix tras receiptcompleted; regresión/aceptación formal de Root. No se declara cero pendientes ni producto listo. GATE_INCOMPLETE permanece.
