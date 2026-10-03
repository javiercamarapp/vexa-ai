# Medición manual de ingesta sintética 10K

`capacity-manual.yml` prepara una única medición de10000filas del benchmark público `packages/jobs/load`, con revisión humana del resultado antes de proponer50K/150K. No es un gate F07 ni una aceptación comercial, de producción, IA, entrenamiento o pipeline completo. No se ejecuta por push, pull request ni cron.

## Ejecución y límites

El caller autorizado despacha desde main con un input `correlation` UUID nuevo. Ese identificador aparece en run-name y en el recibo. No hay input de escala, comandos, host, URLs, credenciales o reportes previos. Rerun de GitHub (`run_attempt>1`) se rechaza antes del bootstrap; un nuevo intento exige revisión y un nuevo dispatch explícito, no un retry automático.

Un job usa `ubuntu-24.04-arm` estándar GitHub-hosted, Node22 y Python3.12. Checkout/control y checkout/candidate usan el mismo `github.sha` y `persist-credentials:false`. Antes de bootstrap y de medición se verifica HEAD exacto y ausencia de cambios. Permisos contents:read, concurrency por repositorio con cancel-in-progress:false. No upload-artifact, acciones cache, caché automática del package manager, secretos de producción ni modelos. Las acciones checkout/setup-node/setup-python reutilizan los SHA del workflow existente.

La autorización de ejecución cloud/publicación es externa a este código. Este documento y pruebas sintéticas no demuestran una ejecución del workflow. El job está acotado a40min (margen revisado para bootstrap, medición y evidencia). Bootstrap6min, preflight60s, medición1320s, postflight60s; el límite exterior no cambia el deadline de jobs del producto. Stop del grupo e inspecciones exactas de recursos tienen sus propios plazos. Si GitHub mata todo el job/VM antes del cierre, puede faltar el recibo: nunca se interpreta eso como PASS.

Se reutiliza `tests/acceptance/support/ci/bootstrap.py` sin modificar: instala dependencias ignorando scripts en temporales, prima cache npm local del runner y descarga las seis imágenes ARM por digest existentes. No hay persistencia de cache entre corridas. El benchmark en sí levanta cuatro servicios Docker propios, Next y un consumidor; no activa el navegador. El bootstrap aún incluye Mailpit/Playwright porque es el bootstrap existente compartido. No ejecuta otras suites de aceptación.

Riesgo operativo pendiente: esas seis imágenes, dependencias, copias y build pueden agotar el disco del runner estándar (14GB anunciados). Después del bootstrap se exige al menos3GiB libres; no es garantía de que el máximo futuro quepa. Un bootstrap por falta de disco o un build que agote espacio es fallo, con evidencia si sigue siendo posible emitirla; no autoriza prune, borrar herramientas ajenas ni cambiar de runner automáticamente. El bootstrap queda capturado aun cuando falle. No se han descargado imágenes, compilado Next ni arrancado Docker localmente para preparar este workflow.

## Fuentes, proceso y ownership

`capacity-ci.py` prepara entorno por whitelist: PATH/HOME/locale, TMPDIR propio, flags sin telemetría y constantes escala10000/puertos62820..62825. No pasa GITHUB_TOKEN, secretos, variables de proveedores, variables de carga anteriores ni VEXA_CI_JOURNAL/BROKER heredadas al benchmark. El bootstrap usa el mismo HOME sólo para cache efímera de paquetes.

El inventario `packages/jobs/load/dependencies.json` y las fuentes permanecen intactos. El benchmark verifica inventario/hashes antes y después; el wrapper exige también pre/postflight válidos, hash de manifiesto y de los cinco archivos de implementación registrados en el reporte. El commit efectivo es eventSha del recibo; baselineSha del benchmark es metadato histórico de su manifiesto y no debe confundirse con el SHA de esta corrida.

Se reutiliza Lifecycle.install/stop para señales y grupo de procesos. El benchmark conserva su propio broker/journal, como en ejecución local: heredar el journal externo sería incompatible con la lectura temprana `resources.jsonl` del benchmark, pues el harness sólo copia el heredado al cerrar. No se modifica el harness ni se crea un symlink/mirror de journals.

Sólo se acepta un marcador `LOAD308_RUNNING` dentro del TMPDIR nuevo del wrapper y un directorio materializado0700 del mismo UID. Tras parar el grupo, el wrapper verifica journal0600, sin symlinks/hardlinks, brokerUUID único y nombres/tipos admitidos; hace Docker inspect sólo de esos cinco nombres. Comprueba ausencia inequívoca; error del daemon no significa ausencia. Si quedan recursos, verifica sus IDs/ownership y registra fallo. No los borra, no adopta recursos ajenos y no usa prune. El descarte posterior del runner efímero no se presenta como limpieza probada. Journal faltante/vacío no acredita ausencia de recursos.

PASS exige informe `measured`/`synthetic:true`, una única escala10000/pass, total10000/accepted9800/rejected100/duplicates100/pending0, SQL/API coincidentes, un consumidor/chunks100, fuentes vinculadas y cleanup interno ownResourcesRemoved+temporaryPathsRemoved con los mismos cuatro contenedores y una red que la inspección externa confirma ausentes. No basta exit0 ni el marcador del benchmark.

## Evidencia sin artifacts

Siempre que el wrapper conserva control, emite un bloque gzip+base64 con recibo y los archivos superiores del directorio de evidencia: reporte completo, hashes de fuentes, cleanup, journal, owned paths y logs de comandos/procesos. Los CSV sintéticos generados no se adjuntan: su manifest/semilla/hash están en el reporte y se reproducen con el generador publicado. No se sustituye un reporte rojo por resumen verde. La evidencia conserva datos/errores tal como están, salvo tokens JWT/GitHub que se redactan; cada archivo incluye hash original y flag redacted. No se imprimen entorno ni cuerpos/credenciales reales.

Límites:8MiB por archivo/log,16MiB JSON del bundle,2MiB gzip; chunks base64 de3000caracteres. Exceder un límite falla explícitamente, no trunca silenciosamente ni certifica evidencia completa. El envoltorio incluye tamaños y SHA256 de JSON y gzip, cantidad de chunks y marcador final con hash JSON.

Marcadores:

- `VEXA_CAPACITY_EVIDENCE_BEGIN {metadata}`
- `VEXA_CAPACITY_EVIDENCE_CHUNK <index> <base64>`
- `VEXA_CAPACITY_EVIDENCE_END <rawSha256>`

Obtener el log autorizado con `gh run view RUN_ID --log`. El receptor debe extraer exactamente un bloque, exigir índices contiguos únicos/cantidad exacta, validar base64/tamaños/SHAgzip antes de descomprimir con límite16MiB, comprobar SHAJSON/final y parsear JSON. Debe cotejar correlation, repository, runId/runAttempt1, eventSha y ruta candidate/control del recibo con la corrida seleccionada. Bloque ausente, duplicado, parcial, sobredimensionado o hash incorrecto falla. Los logs tienen retención de GitHub: no son almacenamiento permanente; el caller puede guardar una copia local del bloque verificado.

Si no se puede preservar completo, `VEXA_CAPACITY_EVIDENCE_UNAVAILABLE` mantiene rojo y explica el límite. `VEXA_CAPACITY_LAUNCH_REJECTED` significa precondiciones incumplidas, no medición. Un resultado funcional no habilita50K/150K automáticamente ni demuestra SLO, coste monetario o capacidad de cloud/producción.
