# Recuperación y retención — propuesta F07-06

La biblioteca `index.mjs` recibe la transacción canónica autorizada, un adaptador Storage con `remove/exists` y una clave de ledger de al menos 32 bytes. Exige owner activo, tenant seleccionado y acción `retain`; no acepta destinos CRM. Primero `policy({expectedVersion:0,backupTtlSeconds})`; luego `preview` y `erase({connectionId,entityType,externalId,requestId,confirmed:true})`. Tipos: message, conversation, customer. La confirmación incluye borrar el archivo completo que contenía la fila, con posibles otras filas; el preview lo declara. Nunca modifica fuentes privadas del repositorio.

El borrado conserva identidades/tombstones y el registro financiero autorizado, pero elimina texto, snapshots fuente, redaction maps y vectores. Cancela trabajos activos afectados. Reingesta y selección de revisiones de esa identidad fallan `SOURCE_TOMBSTONED`. `purgeArtifacts()` elimina objetos registrados y verifica su ausencia; un fallo conserva estado pending. Caches/exports sólo se purgan si están registrados con `registerArtifact`; copias externas permanecen `not_verified`. No se afirma borrado de artefactos desconocidos.

`exportLedger()` produce un documento firmado. Guardar documento, clave y hash esperado fuera del backup y actualizar el corte requerido tras cada borrado. `reapplyLedger(document,{expectedHash,notBefore})` verifica integridad, tenant y frescura antes de reaplicar. Cada tenant del backup necesita su propio ledger, incluso vacío. El operador debe proporcionar el hash y corte actuales desde un canal independiente confiable; el programa no puede deducir si existe un ledger externo más reciente.

El CLI `node packages/recovery/cli.mjs <backup|restore|erase|export-ledger|purge-artifacts> plan.json` es exclusivamente sintético/local. Requiere contenedores `vexa-recovery-*`, etiqueta `vexa.recovery=synthetic`, puertos loopback 61820–61825 y marcador Storage `.vexa-recovery-owned`. La biblioteca no cambia la autenticación canónica; sólo el CLI de ensayo usa una identidad local owner validada en la DB. Dependencia `pg` debe estar instalada en el entorno que lo ejecute. No usa credenciales reales ni endpoints remotos.

Backup usa pg_dump real de datos public/auth/storage, preserva el archivo original e inventaría bytes Storage. Excluye únicamente datos bootstrap de storage.buckets/auth.schema_migrations ya presentes, cuyos hashes deben coincidir. Restore exige esquema completo idéntico (DDL incluyendo constraints, funciones, triggers, policies y versiones), destino vacío y hashes. Antes de cargar, crea RESTORE_BLOCKED, fija CONNECTION LIMIT 0, revoca CONNECT, termina las sesiones existentes no-superuser y verifica que no queda ninguna. Valida la firma, hash, tenant, frescura y todos los eventos de TODOS los ledgers antes de pg_restore. Un permiso CONNECT explícito tampoco permite una sesión nueva con límite cero. Sólo el superuser local de recuperación, confiable y fuera del carril de aplicación, puede reconciliar. Reaplica todos los ledgers y purga Storage antes de quitar el marcador. Las conexiones públicas siguen revocadas y CONNECTION LIMIT 0 permanece: no publica ni abre un servicio. Un error conserva el bloqueo. pg_restore desactiva triggers sólo dentro de la transacción de este destino vacío y sintético; no existe un comando remoto ni un down migration destructivo.

La política exige caducidad acotada para backups registrados. `purgeArtifacts` puede eliminar copias registradas caducadas; los originales de evidencia de este ensayo permanecen intactos hasta autorización explícita. Un backup histórico puede contener datos borrados: jamás servirlo antes de reconciliar el ledger. Las medidas observadas RPO/RTO son de esta fixture, no SLA. La compatibilidad de rollback probada corresponde a consultas SQL autorizadas del último snapshot financiero; no constituye un despliegue ni prueba completa de un binario web anterior.

Pruebas de autor: `python3 packages/recovery/tests/setup.py` y `node --test packages/recovery/tests/drill.mjs`; guardas: setup `--incompatible-only` y `node packages/recovery/tests/guards.mjs`. Ejecutar sólo con nombres libres en recursos propios; conservar backups y logs. Evaluación independiente de seguridad/aceptación y Storage cloud quedan pendientes.

Reparación314: el rojo independiente312 mostró que REVOKE CONNECT no expulsaba sesiones existentes y que la firma se verificaba después de cargar. La prueba `node packages/recovery/tests/quarantine.mjs` comprueba rechazo antes de cargar con firma corrupta y cierre sostenido ante un fallo posterior a cargar, con cliente de aplicación real ya conectado. Conserva los backups y el fallo312. No modifica SQL0033 ni la persistencia canónica.

## Corrección319: identidad tipada y compatibilidad

Toda escritura nueva de borrado vive en `retention_ledger` con tenant, conexión, tipo y external_id. No genera aliases genéricos en tombstones. Las tombstones anteriores permanecen inmutables y sus consumidores conservan el bloqueo legado, que puede ser ambiguo entre tipos; no se intenta adivinar ni migrar su alcance. Los lectores de extracción, evidencia y detalle de cliente verifican además el ledger tipado. No se construyen identityKey ni hashes en SQL.

Los artefactos nuevos exigen tipo explícito: `registerArtifact({connectionId,entityType:'message',sourceKey:externalId,class:'export',objectPath:tenantId+'/exports/file.json',expiresAt})`. `entityType` admite message/conversation/customer; omitirlo falla. Un borrado de message no marca artefactos customer/conversation de igual externalId. Los archivos raw que contienen filas afectadas siguen siendo eliminaciones completas declaradas en preview; no se promete separar físicamente filas de un mismo archivo.

Desplegar el esquema expand0033 antes de los lectores y escritor de artefactos compatibles. Esta propuesta0033 aún no publicada crea la columna requerida entity_type desde el inicio; no es una migración incremental para una instalación que ya hubiese aplicado otra versión experimental0033. En ese caso se requiere una migración revisada separada, nunca editar SQL histórico aplicado ni inferir tipos de filas existentes. Una app anterior a estos nuevos consumidores no debe habilitarse contra datos borrados mediante el ledger nuevo sin verificar su compatibilidad.

`node packages/recovery/tests/namespaces.mjs` prueba PostgreSQL real: mismo ID entre tres tipos y otra conexión; eliminación/registro/purga por tipo; reingesta prohibida sólo del objetivo; tres consumidores con markers tipados y bloqueo legado. La lectura fuente de extracción es un puerto sintético del test, no un proveedor. Se reutiliza evidencia de aislamiento de restore314/317 por hash idéntico de local.mjs; el examen319 no vuelve a afirmar una restauración completa del nuevo esquema.

## Corrección324: materializaciones de texto y recibos de redacción

El borrado también redacta las citas de `extraction_runs.provenance.result`, los valores de entidades respaldados por esas citas y las citas de `weekly_briefs.document`/`canonical_document`. El vínculo es el identificador canónico de revisión, nunca una coincidencia de texto. La redacción sustituye exclusivamente quote/value afectados por null; conserva IDs, offsets, hashes originales, estado, usage, importes y demás campos. El hash original de contenido de un brief sigue siendo evidencia histórica del documento anterior; no se presenta como hash del documento redactado. El recibo registra por separado el hash actual. No se declara vigente un brief cuyo origen fue borrado.

`retention_redactions` es privada y append-only: almacena tenant, evento de borrado, tabla/ID y hashes de la fila completa antes/después, sin guardar una copia del texto eliminado. Las guardas originales de extracción y brief permanecen; sólo admiten, bajo owner/tenant/acción retain, la transición exacta ya registrada por el procedimiento de borrado. Un caller no puede escribir recibos ni aprovechar esa excepción para cambiar importes, identidad o resultados. No se deshabilitan triggers durante erase.

Pruebas324: control323 inmutable reproduce primero la cita persistente; tras el fix su aserción de purga pasa, pero otro assert del control espera EXTRACTION_TOMBSTONED cuando el job ya cancelado da EXTRACTION_JOB_UNAVAILABLE. Se conserva este resultado y no se afirma PASS completo323. El focal autor prueba extracción managed real, entidades, materializaciones de brief legacy, hashes de filas no afectadas/finanzas, recibos inmutables y denegación de falsificación. No prueba generación completa de un brief-v1 con citas; es un límite explícito de este ensayo. Restore vuelve a ejecutarse con el esquema324 y reaplica el ledger sobre un backup previo que contiene citas, sin resucitarlas. RPO/RTO observados son de fixtures locales, no un SLA. SQL0033 sigue siendo propuesta no aplicada; cualquier instalación con SQL33 experimental anterior necesita una migración incremental revisada separada.

## Integración revisada —24-sep

La revisión independiente326 cerró los defectos de aislamiento de restauración,
identidad tipada y purga de citas derivadas. Verificó extracción y brief managed
mediante Auth/API locales, denegaciones exactas, fallos de Storage y cancelación
real del CLI después de cargar el backup. No acredita Storage cloud.

La composición sobre la rama publicada, sin propuestas de notificaciones, pasó
las cinco comprobaciones de backup/restauración con PostgreSQL real. Mantiene
los16 archivos revisados salvo este texto de estado; los recibos previos de
autor describen sus respectivos cortes. El driver privado que enlaza al examen
independiente no forma parte del paquete público.

Continúan pendientes la API/interfaz operativa de retención, el adaptador de
Storage gestionado, el rollback de un binario web anterior y la validación
remota autorizada. Por ello esta integración no cierra F07-06 ni acredita
producción. No usar el CLI sintético con datos reales.
