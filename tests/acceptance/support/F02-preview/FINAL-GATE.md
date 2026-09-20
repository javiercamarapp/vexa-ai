# F02-03 — examen externo, llamada F02 30 / global 174

Estado: **GATE_INCOMPLETE**. No freeze, aceptación, promoción ni modificación de producto. Formal: 12/60; F02-02 lo verifica Root por separado.

Artefacto examinado: `/Users/javiercamaraportepetit/vexa/.runtime/f0203-proposals-1789919771280838000/product`, propuesta inicial inmutable. HEAD del árbol autor del examen: `7be51ea785e03e0bb5196fed96e11a718cf0e63b`. Contrato prospectivo privado F02-03 leído; interfaces reconciliadas contra `mapping.d.ts` e `index.d.ts`: Money con decimal-string, timestamp `occurred_at`, errores `{line,field,code}`, field nullable. No se copiaron tests del producto como oráculo.

## Comandos y evidencia ejecutada

Prefijo común, desde este worktree:

```sh
export VEXA_CANDIDATE=/Users/javiercamaraportepetit/vexa/.runtime/f0203-proposals-1789919771280838000/product
export PATH=/tmp/vexa-xml-interop-renewed/node-v22.22.0-darwin-arm64/bin:$PATH
python3 -B tests/acceptance/support/F02-preview/run.py node --test tests/acceptance/support/F02-preview/pure.test.mjs
python3 -B tests/acceptance/support/F02-preview/run.py node tests/acceptance/support/F02-preview/ssr.mjs
python3 -B tests/acceptance/support/F02-preview/mutations.py
```

- Puro+HTTP inicial: `F02_PREVIEW_REAL=1 ... run.py node --test tests/acceptance/F02-03.test.mjs`, 26 puros + 1 HTTP pasan; exit1 exclusivamente por GATE_INCOMPLETE. Recibo `f0203-gate-ikj4whix`.
- Puro ampliado: **28 subcasos + padre, exit0, 0 skips**, recibo `f0203-gate-6cxy7opy`. Incluye 10000 filas reales, 9990 aceptadas/10 rechazadas fuera de muestra, Money exacto/null/JPY, DST, ambigüedad, XLSX mult hoja, serial numérico rechazado, referencia y texto literal, export RFC4180 y neutralización.
- HTTP real: identidad Auth, SqlPool/createDatabase canónicos, Pg/Storage: reserva/subida/preview sin aprobación, versión y token nuevos, CAS stale sin efectos, idempotencia, tenant B404, selector forjado403, body forjado400, ownership mismo tenant404, viewer/operator403, analyst positivo, export privado/no-store/attachment, revocación403 y recuperación, queued inmutable, confirm replay con un job/outbox. El mutante CAS reejecutó la suite verde antes y después.
- Mutaciones sobre **copias TMP de producto real**: `f0203-mutants-acazgs2q/result.json`. Fecha ambigua `[0,1,0]` por `DATE_EXPLICIT_ambiguous missing format`; CSV fórmula `[0,1,0]` por `CSV_FORMULA`; CAS `[0,1,0]` por `CAS_STALE`. Los tres fallan por ERR_ASSERTION objetivo; fuente restaurada por SHA, copias de producto retiradas. No sustituyen estos resultados los ocho metacontroles anteriores.
- Next SSR: build offline real, Auth cookie real, Origin ajeno/null403, concurrencia CAS `[200,409]`, historia dos versiones, restart de proceso con estado durable idéntico, B404, fallas de transporte Pg/Storage503 y recuperación200. Marcadores reales en `f0203-gate-pjz02z9i`, `f0203-gate-16bv0cj7`, `f0203-gate-gf7tl5z7`, `f0203-gate-oucxmgfk`.
- M10 real: **43 chunks / 14 respuestas** sin canario servidor ni JWT service_role. Canario único suministrado durante build y ejecución; datos de sesión se mantienen sólo en memoria. M10 de respuestas posteriores al recorrido UI se vuelve a ejecutar al finalizar ese recorrido.

Todos los IDs de recibos anteriores viven bajo `/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/`. Cada `run.py` guarda `sources-before.json`, `sources-after.json`, `result.json`, `cleanup.json`, output y journal propio. Las corridas citadas verificaron fuente byte/modo intacta y cleanup verdadero. Los logs anteriores no se sobrescribieron.

## Diagnóstico de infraestructura conservado

1. `f0203-gate-i7scg_hy`: revocar pertenencia del rol Pg devolvió403. Esta inyección mide permisos, **no caída de DB**; no se llama P1 de disponibilidad. Se sustituyó por corte de sockets del transporte PostgreSQL propio, que sí produjo503 y recuperación200.
2. `f0203-gate-pjz02z9i`: Chromium macOS abortó SIGABRT antes de crear página. Bloqueo de infraestructura, no fallo de producto ni mutante muerto. Se pasó a la imagen local de Chromium ya disponible.
3. `f0203-gate-gf7tl5z7`: PUT Storage respondió200, Chromium emitió literalmente ausencia de Access-Control-Allow-Origin. Causa comprobada en este harness: API gateway local sin CORS en respuesta Storage. Se corrigió sólo el gateway externo con allowlist del origen Next exacto y métodos/headers, rechazo403 del origen ajeno. No wildcard, disable-web-security, route.fulfill ni datos stub. Storage sigue verificando/guardando bytes reales.
4. `f0203-gate-oucxmgfk`: tras CORS, PUT200 y GET detalle200; selector accesible anclado exacto de columna no encontrado. Se investiga binding del selector, conservando los oráculos del producto.

## Setup y límites operativos

Node22.22.0; npm ci offline/ignore-scripts/no-audit/no-fund y build en TMP con configuraciones npm vacías. Playwright-core1.63.0 local en `/tmp/vexa-ui-review-llPAzp/node_modules/playwright-core/index.mjs`, configurable mediante F02_PLAYWRIGHT_MODULE. Chromium1226 de imagen fijada `mcp/playwright@sha256:8771dc4666e7c11440bfc6a0c6b00480e9a15b8891b45f29a52d7d995f8d1492`; Docker --pull never. Broker/lifecycle heredados read-only en copias temporales, UUID, journal0600 y limpieza comprobada por identidad. PostgreSQL sin puertos publicados; túnel Unix hacia contenedor propio. Puertos host57950–57989, elegidos libres. Next y gateway escuchan0.0.0.0 para puente Docker; orígenes del navegador siguen127.0.0.1 y seguridad estándar. CDP publicado sólo127.0.0.1 en puerto propio. No uso de vexa-local compartido.

No LLM extra, delegación, cloud, gasto, Git mutación, push, aceptación, fuentes vivas de otro agente ni escritura fuera de allowlist (salvo TMP/deps permitidos). El pointer preview-fix se consultó sólo como metadato; no se leyó su producto sin receipt completed.

## Continuación del diagnóstico UI

`f0203-gate-enzs98k1` registró etiquetas reales: el texto de opciones queda concatenado a `Columna id` sin espacio; se corrigió selector a prefijo inequívoco. `f0203-gate-rwt58z4m` alcanzó preview200, mapping200 y descarga real, pero Playwright reportó descarga cancelada. Se prueba directorio de descargas TMP compartido con Chromium/CDP; no se confunde un evento download con bytes descargados. Los aborts de prefetch de rutas Next al navegar se registran sin contarlos como fallos de importación.

## Positiva UI acreditada

`f0203-gate-93xpr52z`: **PASS BROWSER POSITIVE**, con /imports autenticada, navegación workspace, subida directa Storage200, configuración explícita, preview200, mapping200, descarga CSV completada, confirm202/queued, reload sin nueva confirmación, texto literal sin HTML, teclado/foco y sin overflow a390/1440. Directorio TMP compartido y Browser.setDownloadBehavior resolvieron la cancelación CDP; seguridad web sin desactivar. Después se observó **PASS UI LOADING**, pero el callback de demora del examen hizo route.continue después de retirar el route y abortó el proceso: fallo del harness, corregido esperando la continuación antes de quitarlo. Cleanup del broker verificado pese a ese aborto; no se cuenta como fallo de producto.

`f0203-gate-8nfpb9jg`: integrada con28puros+HTTP PASS, positiva UI completa y loading PASS; M10 final43chunks/34respuestas PASS e identidad JWT Auth ausente del HTML SSR. El selector global `[role=alert]` incluyó el anunciador Next y se hizo ambiguo: binding del examen corregido al section de imports. No se retiró la aserción de error ni se consideró una alerta genérica suficiente para revocación.

## Resultado final de la llamada

Comando integrado: `VEXA_CANDIDATE=<artefacto inicial> F02_PREVIEW_REAL=1 PATH=<Node22>/bin:$PATH python3 -B tests/acceptance/support/F02-preview/run.py <Node22>/bin/node --test tests/acceptance/F02-03.test.mjs`.

**30subtests PASS (28puros+HTTP+Next/Chromium), 0skips; exit1 sólo por el candado GATE_INCOMPLETE.** Recibo `f0203-gate-sggu880z`, duración41.66s. Copia preservada en `evidence-call30/` junto con cleanup y manifests. UI confirmó loading, error con request abortado, retry con nueva GET200, empty sin conexiones, revocación403 visible y recuperación, XLSX SYN_B exacto456minorUSD y una fila rechazada, CSV descargado leído/validado RFC4180, 10000filas exactas9990/10 y muestra20. M10final43chunks/43respuestas PASS; JWTAuth no aparece en HTMLSSR. No validación remota/productiva.

**Ningún P1/P2 de producto confirmado en los comportamientos ejecutados.** Los fallos previos documentados fueron setup/transportes/selectores del examen; no se reinterpretan como PASS histórico ni como muerte de mutante. Los faltantes siguientes son brechas concretas del examen, no excusas para retirar aserciones.

Pendientes antes de freeze/retiro de GATE_INCOMPLETE:

1. Configuración ausente: ejecutar Next sin configuración requerida, comprobar503/API y explicación UI. El build sin config no sustituye esa prueba runtime.
2. Límite20MiB en navegador real (frontera exacta y exceso), caducidad de reserva/capability y reinicio explícito del flujo. No acreditados por las fixtures pequeñas ni por10K.
3. Conflicto CAS visible en UI con dos editores y recarga explícita; backend concurrente `[200,409]`, historia y restart sí probados.
4. Expiración/revocación cruzada de descarga directamente contra Storage, matriz exhaustiva de headers Origin ausente/múltiple y payloads de todos los endpoints03. HTTP ya acredita B, roles, ownership, forja y revocación; no llamar exhaustiva a esa cobertura parcial.
5. Estilos/representaciones Excel adicionales: serial numérico no soportado se probó; no toda matriz de estilos/fechas Excel. Revisión independiente del nuevo harness, sus controles de sensibilidad y hardening de cleanup ante cada excepción (el broker verifica Docker; el SIGABRT intermedio no acreditó eliminación de scratch/build por finally).
6. Reejecutar contra artefacto preview-fix sólo tras receipt completed y copia TMP; no se examinó fuente viva. Regresión global/F02-02 formal y aceptación pertenecen a Root y siguen fuera de este encargo.

`node --check` SSR/UIstates y `git diff --check`: exit0. Git status sólo dos rutas allowlisted. HEAD intacto. `HASHES-call30.json` registra SHA256/modo de cada archivo ejecutable del gate; digestmanifest código **cf3a94059e0000bf19fa08605f6ae3b65ddd61d53642ec58c6c04632878b48c1**, digestmanifest fuenteproducto **db6be62c78340a35b7de2862ed3e6a146a5ebf709778dc51329b15747940b718**. Manifests producto antes/después idénticos. Journal0600 y cleanup Docker final verificado; Next/túnel/sockets y buildTMP cerrados/retirados por finally en corrida final. No se borró ninguna evidencia previa.
