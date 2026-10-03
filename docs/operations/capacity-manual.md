# Serie manual de ingesta sintética 10K → 50K → 150K

`capacity-manual.yml` ejecuta una serie fija del benchmark público `packages/jobs/load`: 10.000, 50.000 y 150.000 filas. Reutiliza el bucle de `run.mjs`, el generador y la composición del mismo checkout, con un consumidor y bloques de 100 filas. **El primer fallo detiene la serie**: si 50K falla, no se inicia 150K. No se fabrican informes previos ni se adjuntan recibos de otra corrida. La evidencia de 10K de una versión anterior no sustituye el primer paso de esta serie.

Es un ensayo técnico sintético. Su preparación no acredita 50K/150K ni una ejecución del workflow. Tampoco constituye aceptación F07, capacidad comercial, SLO, IA, entrenamiento, pipeline completo o aprobación de producción. La ejecución cloud y publicación requieren la autorización externa concreta y revisión del caller; no se ejecuta por push, pull request ni cron.

## Identidad y entorno

El único input es `correlation`, un UUID nuevo aportado por el caller revisado. No hay selector de escala ni entrada de comandos, host, URLs, credenciales o informes previos. El recibo usa `capacity-manual-series-v1`; el job `capacity-series` y el título `Capacity series · <UUID>` identifican la serie. Sólo se permite `workflow_dispatch` en main y primer intento; rerun se rechaza antes del bootstrap. Un nuevo intento requiere otro dispatch autorizado.

Se conserva `ubuntu-24.04-arm` estándar GitHub-hosted, Node22 y Python3.12. Los checkouts control/candidate deben tener exactamente `github.sha` y estar limpios, con `persist-credentials:false`. Permisos contents:read, concurrencia por repositorio y cancel-in-progress:false. Las acciones están fijadas por SHA. No se usan upload-artifact, cache persistente, secretos productivos, modelos ni suites globales.

El entorno del benchmark conserva sólo PATH/HOME/locale y constantes propias: `VEXA_LOAD_SCALES=10000,50000,150000`, puertos62820..62825 y TMPDIR exclusivo. No hereda GITHUB_TOKEN, variables de proveedores, informes previos ni journal/broker externos. Bootstrap conserva los dos npm primers, `npm ci --ignore-scripts --no-audit --no-fund`, exclusión de `.env*` y cuatro imágenes ARM por digest (PostgreSQL, GoTrue, Storage API y PostgREST). No usa Mailpit ni navegador. Los fallos de registro, instalación, disco o build se conservan; no hay cambio automático de runner ni prune. Se exigen al menos3GiB libres después de bootstrap; esa guarda no garantiza todo el espacio futuro.

## Presupuesto de tiempo

Hay cinco trabajos: un archivo en 10K, uno en 50K y tres de 50K en 150K. Cada trabajo conserva su deadline de **900.000 ms**, sin ampliación. La escala150K es tres trabajos secuenciales del mismo consumidor, no un trabajo de150K. El tiempo del ejecutor incluye build, preparación, cargas, API y limpieza; no equivale al tiempo de un trabajo.

El wrapper permite5.400s para el ejecutor:5×900s de trabajos más900s de margen conjunto para setup/build, upload/API y cleanup. El workflow permite110min (6.600s): los1.200s exteriores cubren bootstrap hasta360s, pre/postflight60s cada uno, cierre de grupos, inspecciones y emisión de evidencia. Estos máximos son presupuestos de aborto, no promesas de duración ni ampliaciones de deadlines del producto. Si GitHub termina la VM antes del cierre puede faltar el recibo; eso nunca es PASS.

## Validación y fallo

Antes y después se verifican inventario y hashes, y el recibo vincula eventSha, manifiesto e implementación del benchmark. `baselineSha` dentro del informe es metadato histórico del inventario, no el commit de esta ejecución. Producto, harness, worker, generador, deadlines e inventario permanecen sin cambios en esta preparación.

El éxito `MEASURED_10K_50K_150K_COUNTS_AND_CLEANUP_VERIFIED` exige exactamente tres escalas `pass` en orden y cinco archivos1/1/3 con particiones, semillas, manifiestos SHA256 y hashes de bytes vinculados. Cada escala y archivo debe conciliar contadores SQL/API98% aceptados,1% rechazados,1% duplicados y cero pendientes:9.800/100/100,49.000/500/500 y147.000/1.500/1.500. Se verifican identidad de jobs/imports,100/500/1.500 bloques confirmados con offsets ordenados y cierre final, un proceso consumidor por escala, configuración1/chunk100/deadline900000, tiempos finitos y trabajos dentro de su deadline.

Los bloques son observaciones del worker; no se presentan como un snapshot independiente del checkpoint persistido en una corrida exitosa. Se conservan los contadores SQL/API, manifest/hash y controles del ejecutor. Un exit0 o un marcador aislado no bastan. El informe rojo y los logs disponibles se transportan al fallar; el wrapper no relanza escalas ni convierte una escala parcial en serie aprobada.

Se reutiliza Lifecycle para señales y grupos. Sólo se admite un marcador `LOAD308_RUNNING` bajo el TMPDIR nuevo, directorio0700 del mismo UID y journal0600 sin symlinks/hardlinks. Se inspeccionan únicamente los nombres propios registrados con brokerUUID y labels exactos. PASS requiere limpieza interna y ausencia externa de los mismos cuatro contenedores y una red. Error de Docker no significa ausencia. La inspección no borra recursos ni presenta el descarte del runner como limpieza probada.

## Evidencia acotada

Mientras conserva control, el wrapper emite un bundle gzip+base64 con recibo, informe completo, fuentes, cleanup, journal y logs superiores. Los CSV sintéticos se reproducen mediante el generador, semillas y hashes del informe; no se adjuntan ni se sustituye un reporte por un resumen. Sólo se redactan tokens JWT/GitHub, conservando hash original y flag de redacción.

Los límites siguen siendo8MiB por archivo/log,16MiB de JSON y2MiB de gzip; chunks base64 de3.000caracteres. Un fixture offline representativo de la serie máxima contiene5jobs,2.100bloques duplicados en escalas/procesos y1.081muestras (inicio más5.400/5s); comprueba estos límites sin medir capacidad. El tamaño real puede variar: exceder un límite falla explícitamente, sin truncar evidencia para aprobar.

El receptor exige exactamente un bloque `VEXA_CAPACITY_EVIDENCE_BEGIN`, índices contiguos únicos de `VEXA_CAPACITY_EVIDENCE_CHUNK` y cierre `VEXA_CAPACITY_EVIDENCE_END`. Verifica base64, tamaños, hashes gzip/JSON, descompresión acotada16MiB y hash final. Debe cotejar correlation, repository, runId, runAttempt1, eventSha y rutas con la corrida seleccionada. Ausencia, duplicación, truncamiento, corrupción o tamaño excesivo fallan. `VEXA_CAPACITY_EVIDENCE_UNAVAILABLE` y `VEXA_CAPACITY_LAUNCH_REJECTED` mantienen rojo. Los logs de GitHub tienen retención; el caller conserva localmente el bloque verificado.
