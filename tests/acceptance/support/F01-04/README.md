# F01-04 — examen corregido y aprobado para congelación

**Actualización del principal19-sep:** revisión independiente final aprobó el examen, reproduciendo probe7/7 y role-probe1/1 y auditando Auth/layout/identity/capturas/hashes previos. Producto no aceptado todavía. Ver `construccion/correcciones/F01-04-gate.md`. Los apartados siguientes conservan cronológicamente el recibo del autor y sus estados anteriores; no reescriben rechazos ni el timeout de una revisión posterior.

Sólo se editan `tests/acceptance/F01-04.test.mjs` y `tests/acceptance/support/F01-04/`. Sin edición de producto, control plane, Git, fuente integrated, privados ni servicios compartidos. No aceptación de F01-04 ni revisión independiente por el autor.

## Rechazos conservados

`rejection-preserved.md` contiene los cuatro hallazgos recibidos. `README-rejected-original.md`, `absence-result.txt`, `probe-result.txt` y `evidence/` conservan el estado anterior. `correction-auth-failed-{1,2,3,4,5}.txt` conservan los fallos de ensayo: conexión rechazada por redirect a localhost del contenedor (dos corridas) y origen host.docker.internal rechazado por configuración Auth (tercera); sesión incompleta con refresh_token vacío (cuarta), corregida transportando la sesión real completa de signup; quinta corrida: binding del código de dependencia, pool.ts:9 emite database_not_configured al faltar VEXA_DATABASE_URL. Se añadió ese código explícito manteniendo shell, acción y ausencia de ready. Ninguno cuenta como mutante detectado.

## Correcciones y alcance

- Fixture Auth sintético permanece 0600; después de docker cp se asigna a node:node sólo en contenedor propio. Se comprueba lectura como usuario por defecto; se elimina en host/contenedor al cerrar. Capturas copian sólo PNG, nunca fixture/cookies. Credenciales no se imprimen.
- Chromium accede a localhost57560 mediante puente TCP interno del contenedor hacia host.docker.internal57560. Auth mantiene el origen localhost permitido; no se sustituye ni altera código Auth. Next se reinicia esperando la salida del proceso anterior.
- Seis destinos del menú, ocho rutas protegidas incluyendo detalles directos. No exige links de registros producidos por F06. Positivos admiten 200/503 únicamente con shell autorizado: organización seleccionada exacta, nombre SYN_AUTHORIZED y rol owner; el proxy cuenta validaciones reales del token emitido por Auth. Un error de identidad/organizaciones no es dependencia posterior. En este circuito sin VEXA_DATABASE_URL se exige alerta posterior incluso si el HTTP es200: un ready sin alerta falla. Error posterior exige código de dependencia específico, instrucciones para configurar PostgreSQL/workspace y ausencia de ready/vacío inventado.
- Negativos: ocho rutas anónimas, ocho con cookie de organización ajena, ocho con query tenant_id forjada y ocho con sesión inválida. Query ajena debe ser rechazo HTTP o alerta específica unsupported_filter, nunca datos; esto es denegación visible de alcance, no aceptación por cualquier 503. Positivo posterior a selector ajeno comprueba recuperación.
- Reintento: Tab, foco visible, Enter, nueva petición de navegación y nuevo identificador de render generado en el montaje externo; se vuelve a alcanzar el control con foco visible tras render. Hash-only y tabIndex=-1 fallan por aserciones distintas.
- URL inválida exige código específico (invalid_date, invalid_currency, invalid_date_window, duplicate_filter, invalid_source, timezone_not_supported) y acción visible. Se prueba en rutas con backend posterior sin configurar y en montaje sin DB que importa parseScope real, sin reimplementarlo. Mutante elimina validación del puerto real y debe fallar VALIDATION_SPECIFIC.
- Montaje externo usa DataState/Navigation reales, seis estados y dos viewports. El marcador de render es instrumentación del montaje, no una implementación de UI/backend. Los mutantes sólo modifican copias temporales y se restauran.

## Comandos reproducibles y evidencia

Desde raíz del examen:

```sh
VEXA_CANDIDATE="$PWD" node --test tests/acceptance/support/F01-04/probe.test.mjs
VEXA_CANDIDATE="/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/vexa-f01-04-authlab-52kqno4s" node --test tests/acceptance/F01-04.test.mjs
```

Probe: `correction-probe-result.txt`, exit0, 7 tests, 0 fallos/skips, 71.39s. Positivo antes/después; seis mutantes muertos: hash-only, salto Tab del retry, omitir validación, error→vacío, perder alcance, menú fuera de Tab. No se atribuye aceptación de producto al probe.

El laboratorio contiene copia read-only de apps/packages/package*.json de integrated y sólo 0001..0004.sql de raíz canónica; no añade implementaciones. SHA fuente `56f051b4a35c3fa8ed1b01c147a968c8c2897a8d`; SHA checkout examen `53828e0d74667213bf478e4b808bd9ff482bd0ec`. F01-03 aceptado por principal en009fd73 según encargo; este examen no reacepta SQL/RLS. `correction-immutability.json` captura hashes de728 archivos fuente y364 archivos del laboratorio. Comprobación posterior documentada en correction-invariants.txt. Git sólo consultas read-only, sin commit/push/config/HEAD.

npm ci offline/ignore-scripts sólo en copias temporales. Docker --pull never, imagen Chromium8771dc4666e7, servicios UUID propios, puertos57560..57564, DB sin puertos publicados. No conexión a vexa-local. Teardown elimina únicamente recursos propios. Sin GHA/providers/gastos/envíos/delegación.

## No ejecutado / límites

No revisión independiente del correctivo, promoción, aceptación ni congelación. No Google OAuth/PKCE remoto, SQL/RLS exhaustivo F01-03, productores/backend F06, build de producción, suites generales npm/controller/graph, lector de pantalla, contraste completo ni SaaS terminado. Las capturas de montaje con datos SYN prueban componentes; las de rutas con dependencia posterior no prueban datos ready. Ningún PASS del laboratorio acepta producto.

Circuito Auth: `correction-auth-result.txt`, exit0, 3/3tests, 0fallos/skips, 52.22s; `correction-routes-result.txt` contiene ocho positivos y positivo posterior al ataque, todos HTTP200 con dependencia visible. 54 peticiones del token real a /auth/v1/user observadas por proxy. `correction-evidence/` contiene28PNG (12estados,16rutas); inspección visual del autor de390-overview.png confirma shell/organización/rol y error database_not_configured accionable. No inspección visual independiente.

Repetición de componentes preservada en `correction-probe-failed-1.txt`: el anunciador interno de Next (`#__next-route-announcer__`) aparecía durante hidratación entre count e innerText y duplicaba el selector global de alert. Se excluye únicamente ese elemento de framework; se siguen exigiendo una alerta de producto y código específico. Se repiten probe y circuito tras ese ajuste. `correction-auth-first-pass.txt` conserva la corrida Auth verde anterior al endurecimiento explícito contra ready sin alerta.

Preparación efectivamente ejecutada: `python3 /tmp/f01-lab.py`; contenido exacto archivado en `correction-lab-preparation.txt`. Salida: `/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/vexa-f01-04-authlab-52kqno4s`. No copia .git, .env*, privados, node_modules ni .runtime; 0001..4 provienen de raíz canónica, no de migraciones F06 del laboratorio integrado.

## Cierre final observado

- Mismos comandos, revisión final: `correction-probe-final-result.txt` exit0, **7/7**, 0fallos/skips, 68.98s; `correction-auth-result.txt` exit0, **3/3**, 0fallos/skips, 58.92s. Ambos ejecutados tras los últimos cambios de oráculo.
- `correction-routes-final-result.txt`: ocho rutas y recuperación autorizadas, HTTP200 con dependencia visible; 54validaciones del token real. Negativas y seis queries inválidas completadas dentro de PASS routes.
- `correction-evidence-final/`:28PNG adicionales de la corrida final. `correction-invariants-final.txt`: fuente728/laboratorio364,0cambios; fixture eliminado y no incluido en capturas; git diff exit0; únicos paths untracked pertenecen al examen; docker ps de recursos F01-04 vacío.
- Sigue pendiente revisión independiente. Ningún resultado de laboratorio acepta F01-04 producto.

## Correctivo posterior: rechazo independiente por elevación de rol

Los resultados owner-only de arriba son históricos y no acreditan el correctivo de roles. `role-rejection-*` conserva el nuevo rechazo P1 y su mutante superviviente 3/3. No se modificó el laboratorio del revisor.

`routes.mjs` crea cuatro usuarios distintos mediante Auth local real y memberships SQL activas owner/analyst/operator/viewer, verifica el rol persistido y cuenta validaciones Auth por usuario. Chromium recorre las ocho rutas y dos tamaños con cada sesión, comprueba el rol real exacto en shell y repite recuperación, selector ajeno, query ajena, URLs inválidas y sesión inválida por rol. Los ocho negativos anónimos se mantienen antes de iniciar sesiones. Los oráculos anteriores de reintento/query y seis mutantes del probe permanecen intactos.

Si existe `/api/interventions/[id]/transition` con POST en el candidato, analyst/operator/viewer intentan `approved` con origen válido y JSON: se exige **403 y role_forbidden** con DB de workspace sin configurar. 503 nunca cuenta como denegación. No se exige endpoint inexistente, productores ni backend F06; la ausencia del endpoint sólo omite este control condicional, nunca la matriz de roles. Auth y memberships sí usan servicios reales. No se realizan acciones productoras.

`role-probe.test.mjs` aplica la mutación exacta únicamente a la copia temporal creada por el harness, ejecuta componentes y rutas reales y exige fallo `AUTHORIZED_ROLE_PRESERVED expected=analyst`; errores de infraestructura no satisfacen la prueba. Restaura la copia y elimina recursos propios al terminar. El candidato, integrated y el laboratorio canónico permanecen inmutables.

Comandos nuevos (desde raíz del examen; el lab es copia de integrated56f051b más SQL0001..4 canónico):

```sh
VEXA_CANDIDATE="$PWD" node --test tests/acceptance/support/F01-04/probe.test.mjs
VEXA_CANDIDATE="$(cat /tmp/f01-role-lab-path)" node --test tests/acceptance/F01-04.test.mjs
VEXA_CANDIDATE="$(cat /tmp/f01-role-lab-path)" node --test tests/acceptance/support/F01-04/role-probe.test.mjs
```

Preparación reproduce `correction-lab-preparation.txt` cambiando sólo los destinos de manifiesto a `role-immutability.json` y puntero a `/tmp/f01-role-lab-path`. Fixture sólo 0600, stat600/node y lectura comprobados dentro del contenedor propio; se elimina en ambos lados en finally. Los recibos no incluyen sesiones ni cookies. Puertos57560..57564 propios, DB sin publicación.

### Resultados observados del correctivo de roles

- `role-correction-probe.txt`: exit0, **7/7**, 0skips, 69.87s; seis mutantes previos muertos por sus aserciones originales.
- `role-correction-auth.txt`: exit0, **3/3**, 0skips, 139.28s. `role-correction-routes.txt`: **32 positivos** (8×4roles), cuatro recuperaciones; todos HTTP200, rol conservado y dependencia honesta. Tres POST de aprobación rechazados403/role_forbidden antes de DB. Validaciones de usuario real observadas: owner54, analyst55, operator55, viewer55. Negativos/query se repiten por rol.
- `role-correction-mutant.txt`: exit0 del metatest, **1/1**, 52.35s; el navegador mutado sale1 por **AUTHORIZED_ROLE_PRESERVED expected=analyst**. No confundir exit0 del metatest que exige rechazo con PASS del producto mutado. `role-correction-mutant-assertion.txt` conserva el fallo real y el cuerpo que muestra `Rol: owner` para la sesión analyst.
- `role-evidence/`:76PNG (12 estados +64 rutas/roles/viewports). Autor inspeccionó390-analyst-overview.png: organización autorizada, Rol:analyst, database_not_configured accionable, sin ready/vacío fabricado.
- `role-invariants-final.txt`: fuente728/lab364 sin cambios; recibos anteriores preservados; DB PortBindings{}; fixtures eliminadas; contenedores/redes/puertos propios libres; scan sin JWT/cookies; Git/producto sin cambios.

SHA fuente: `56f051b4a35c3fa8ed1b01c147a968c8c2897a8d`. SHA checkout examen: `53828e0d74667213bf478e4b808bd9ff482bd0ec`. No commits nuevos. Laboratorio: `/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/vexa-f01-04-authlab-yti3iqz4`; hashes de fuente/lab en `role-immutability.json`. SQL0001..4 canónico, sin backend F06.

**Revisión independiente pendiente.** No congelación/aceptación/publicación. No probado: acciones productoras/F06, backend de workspace listo, SaaS completo, producción/cloud/OAuth remoto, SQL/RLS exhaustivo, build de producción, suites generales npm/controller/graph, contraste completo/lector de pantalla. No delegación ni servicios externos.
