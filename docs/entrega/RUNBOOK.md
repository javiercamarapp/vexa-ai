# Operación y recuperación

Procedimientos del código integrado, preparados para revisión y ensayo. Este documento no acredita operación gestionada ni autoriza producción. Antes de actuar, el operador registra responsable nominal, suplente, entorno, proyecto, tenant, ventana y referencia de autorización existentes. Si falta una decisión necesaria, conserva el estado pendiente; no la sustituye por un nombre o aprobación de ejemplo.

Registrar incidente, SHA, trace/job ID, condición observada, comando, salida, hora UTC y evidencia minimizada. No registrar tokens, cookies, contraseñas, cuerpos de clientes ni `cron.job.command`. Conservar los intentos fallidos junto a la corrección y al nuevo resultado.

## 1. Preparación y condiciones de parada

1. Identificar el checkout y su SHA con `git status --porcelain` y `git rev-parse HEAD`. La preparación de release requiere un checkout limpio, sin flags del índice que oculten cambios; el generador de manifiesto lo verifica.
2. Confirmar cuenta/proyecto/entorno con el registro de accesos del operador. Distinguir local SYN, preview autorizado y producción. Usar [ACCESOS-SIN-SECRETOS.md](ACCESOS-SIN-SECRETOS.md) y el contrato de variables de [F08-deploy](../../support/F08-deploy/README.md).
3. Para operaciones autenticadas, entrar por el origen autorizado, seleccionar organización y comprobar el rol. Las rutas privadas derivan tenant/usuario de sesión; un ID en un cuerpo no concede autoridad.
4. Detener la operación si hay proyecto equivocado, fuente sucia, scope no autorizado, 401/403, firma/hash discrepante, revisión crítica pendiente o restore fallido. Un 503 es indisponibilidad, no ausencia de datos. Conservar backups y checkpoints; no editar estados para aparentar recuperación.

Las instalaciones y builds de ensayo se hacen en copias temporales con Node 22, conservando el lock. No instalar `node_modules` ni `.next` en el candidato congelado. No ejecutar comandos de prueba sobre recursos compartidos sin coordinación.

## 2. Identidad delegada y consumidores

### Configurar o revocar autoridad

1. El administrador prepara un usuario Auth dedicado, con membership **analyst activa** por cada tenant autorizado. Instala sus credenciales en el gestor de secretos del runtime; no reutiliza la cuenta owner.
2. El owner entra en `/jobs/setup`, pega únicamente el UUID de esa cuenta y selecciona «Habilitar worker». El contrato existente es `POST /api/jobs/worker` con JSON `{ "user_id": "<UUID real>", "enabled": true }`, sesión owner, organización seleccionada y Origin válido. La UI hace esa petición; no es necesario exportar cookies al shell.
3. Configurar los nombres siguientes por el canal privado del entorno. Las identidades deben pertenecer al mismo proyecto. El login SQL no puede ser superuser, BYPASSRLS ni propietario de tablas públicas y debe poder usar `vexa_backend`.

| Nombre exacto | Uso |
|---|---|
| `VEXA_DATABASE_URL`, opcional `VEXA_DATABASE_CA_PEM` | Conexión SQL del servidor y certificado CA cuando corresponde. |
| `VEXA_SUPABASE_URL`, `VEXA_SUPABASE_ANON_KEY` | Proyecto Auth/Storage; la anon key no sustituye el JWT del usuario. |
| `VEXA_WORKER_EMAIL`, `VEXA_WORKER_PASSWORD`, `VEXA_WORKER_USER_ID` | Credenciales Auth y UUID concordante de la cuenta dedicada. |
| `VEXA_WORKER_DISPATCHER=enabled` | Reserva de tenant autorizado para cada consumidor. Alternativa fija: `VEXA_WORKER_TENANT`; escoger una estrategia explícita. |
| `VEXA_WORKER_TRIGGER_SECRET` | Bearer del disparador, al menos 32 caracteres; compartido actualmente por las seis rutas. |
| `VEXA_DURABLE_CONSUMER=enabled` | Admisión de imports condicionada a salud del consumidor. No deshabilitarla para esconder una alarma. |
| `VEXA_WORKER_PLATFORM_TIMEOUT_MS=60000`, `VEXA_WORKER_SOURCE_TIMEOUT_MS=20000` | Límites del consumidor HTTP existente. |
| `VEXA_WORKER_CHUNK_SIZE=100` | Tamaño configurado del chunk de imports. |
| `VEXA_WORKER_INTERVAL_MS=30000` | Intervalo del scheduler CLI y validación del consumidor HTTP de imports; no configura por sí mismo pg_cron. |

4. Con un trabajo SYN permitido, comprobar avance real y checkpoint. El dispatcher sin trabajo puede responder IDLE; eso no prueba procesamiento. Conservar ID, estado terminal, conteos y scope observado.
5. Para revocar delegación, el mismo owner usa «Revocar worker» (`enabled:false`). Verificar denegación de nuevo trabajo/commit según su familia y que otros tenants autorizados conservan su alcance. Revocar membership, cuenta Auth o credencial son acciones distintas. No cambiar el UUID de una delegación: SQL mantiene su identidad inmutable.

Contratos: [API de jobs](../../packages/jobs/durable/api.mjs), [runtime](../../packages/jobs/durable/runtime.mjs), [RLS de delegación](../../supabase/migrations/0007_job_leases.sql). Las familias CRM, extracción, problemas, histórico y notificaciones necesitan además sus configuraciones y autoridad propias; la delegación común no habilita proveedores ni gasto.

### Programar, comprobar y detener

Las seis plantillas y sus endpoints están en [F08-deploy](../../support/F08-deploy/README.md): `worker-cron.sql`, `crm-cron.sql`, `extraction-cron.sql`, `problems-cron.sql`, `history-cron.sql` y `notifications-cron.sql`, dentro de `supabase/operations/`.

1. Verificar extensiones y frontera SQL/Data API mediante `supabase/operations/verify-extensions.sql` por el canal aprobado. Si se necesita instalación, usar el procedimiento separado `bootstrap-extensions.sql`, guardar OIDs/versiones y sus condiciones de rollback; no tratar una migración de app como autorización para instalar extensiones.
2. Cada plantilla requiere settings de sesión `vexa.<nombre>_bootstrap_approved=yes`, `vexa.<nombre>_endpoint` y `vexa.<nombre>_secret`; para imports `<nombre>` es `worker`. El operador suministra valores mediante el canal seguro aprobado, sin literales versionados ni argumentos visibles. La aprobación debe corresponder a la operación real.
3. Después de aplicar la plantilla, revisar sólo columnas no secretas `jobid,jobname,schedule,active` de `cron.job`. Exigir un job por nombre y `30 seconds`. Correlacionar ejecución de cron, respuesta HTTP y progreso durable: cron exitoso sólo acredita que encoló HTTP.
4. Para detener un schedule, aplicar su misma plantilla con la aprobación real y `vexa.<nombre>_revoke=yes`. Verificar ausencia de ese job y conservación de los demás. No cancela solicitudes en vuelo ni borra secretos. Revisar leases/reservas antes de revocar identidad o rotar el trigger. Al detener histórico, conservar extracción/problemas cuando deban reconciliar hijos ya admitidos bajo autoridad vigente.
5. Rotar el trigger coordinadamente entre servidor y las seis entradas Vault. Si Deployment Protection impide llegar a Next, resolver la excepción autorizada según el procedimiento de despliegue; un 401 del perímetro no es un tick de consumidor.

Alternativa existente desde un host autorizado, con entorno configurado de forma privada:

```sh
node packages/jobs/durable/scheduler.mjs --once
```

`VEXA_WORKER_ENDPOINT` es la URL del worker; esta variable sólo la necesita el CLI. `--once` termina 0 ante HTTP exitoso y 1 ante error HTTP/transporte. Ese 0 aún requiere comprobar el job. El modo sin `--once` depende de un supervisor y del host activo: no constituye un servicio 24/7. No ampliar plazos ni cuotas para ocultar fallos.

## 3. Cola, cancelación, replay y alertas

| Situación | Procedimiento real | Condición de recuperación |
|---|---|---|
| Import sin avance | Abrir `/jobs/<job-id>` y consultar `GET /api/jobs/<job-id>` con sesión autorizada. Registrar estado, checkpoint, counters, último progreso y error. Reparar consumidor/configuración sobre el mismo import. | Nuevo fence válido, checkpoint conservado y aceptadas + rechazadas + duplicadas + pendientes = entrada. |
| Cancelación de import | Botón «Cancelar ingestión» o `POST /api/jobs/<job-id>/cancel`, con Origin y sesión válidos. Volver a leer hasta observar el estado durable. | No se publican nuevos resultados del trabajo cancelado. Cancelar una petición no revierte un efecto externo ya enviado. |
| Replay de import | Owner usa «Reintentar ingestión» o `POST /api/jobs/<job-id>/replay` cuando el contrato lo permite, después de corregir la causa. | Mismo origen y deduplicación, sin duplicar publicación ni resucitar contenido borrado. No es un replay genérico para las otras familias. |
| CRM 401/403 o 429 | Seguir [CRM-RUNTIME](../../packages/connectors/CRM-RUNTIME.md): reconexión autorizada en 401/403; respetar espera/cursor en 429. | Lectura nueva del proveedor, permisos comprobados y avance desde checkpoint. Un permiso desconocido no se convierte en available. |
| Inferencia incierta | Conservar reserva y conciliar con evidencia del proveedor bajo autoridad vigente. | Costo real o uncertain explícito; conciliar no fabrica respuesta ni reejecuta el modelo. |
| Notificación incierta | Conservar outbox/attempt; seguir [OUTBOX](../../packages/notifications/OUTBOX.md). El verificador independiente registra evidencia antes de reconciliar. | No reenviar por mero timeout; distinguir accepted/delivered/rejected. No fabricar un receipt de conciliación desde el cliente. |
| DB/Storage caídos | Conservar error visible, detener admisión cuando salud lo exija y recuperar el servicio antes del consumo. | Jobs/checkpoints consistentes, último snapshot válido preservado y flujo SYN verificado. |

`GET /api/jobs/health`, autenticado y ligado al tenant seleccionado, devuelve 200 si `data.healthy` y 503 en caso contrario. Sus razones son `NO_HEARTBEAT` (ausente o >60 s), `OLDEST_QUEUE` (>120 s), `NO_PROGRESS` (>120 s) y `EXPIRED_LEASE`. Son los valores por defecto de [createJobRepository](../../packages/jobs/durable/repository.mjs), no SLO comerciales. Un 401/403/503 de configuración o transporte se registra como fallo de monitorización; no se interpreta como cola vacía. `/api/health/version` sólo identifica el build y no sustituye esta lectura.

`packages/notifications/outbox.mjs::health()` expone estados blocked/uncertain/dead a callers autorizados; no es una ruta pública nueva. Ninguna de estas lecturas ni el log del scheduler envía por sí sola una alarma operativa externa.

Antes de afirmar vigilancia activa, el operador debe registrar receptor y suplente, canal autorizado, frecuencia de sondeo, criterio de escalado/acuse y evidencia de entrega. Propuesta para ensayar: sondeo de imports cada 30 s, evento ante fallo de consulta o salud negativa, agrupación por tenant/razón sin contenido privado y cierre sólo tras salud recuperada **y** avance observado del job. El intervalo propuesto no es un monitor instalado. Probar una parada controlada del consumidor, recepción/acuse y recuperación; guardar horas y resultado. Las otras cinco familias requieren su señal específica, sin atribuirles el heartbeat de imports.

## 4. Retención y borrado por owner

Requisitos: migraciones compatibles, Auth/DB/Storage del mismo proyecto y `VEXA_RETENTION_LEDGER_KEY` de al menos 32 bytes, sólo servidor. Conservar por custodia privada las claves que verifican ledgers todavía vigentes. No instalar claves de producción en fixtures.

1. Owner abre `/settings/retention`, revisa tenant y guarda TTL de backups con la versión CAS actual. Rango implementado: 1–31.536.000 segundos. El TTL exige una decisión real; no elegir un valor del ensayo como política del cliente. No modifica la expiración de copias ya registradas.
2. Seleccionar conexión, tipo (`message`, `conversation`, `customer`) e identidad canónica. Recorrer páginas cuando corresponda. Previsualizar alcance y revisar archivos RAW completos, incluidos posibles datos de otras filas del mismo archivo.
3. Confirmar sólo el preview revisado. El token dura cinco minutos y vincula usuario, tenant, identidad, política y alcance. Un conflicto/caducidad requiere nueva previsualización; no reconstruir el token.
4. Ejecutar purga por lotes de hasta 25 y leer `remaining`/`complete`. Mientras exista pending o un error, el borrado físico no está completo. No cambiar el estado SQL manualmente. Verificar ausencia del objeto mediante el adaptador autorizado.
5. Exportar el ledger firmado y guardar documento, hash y corte temporal actual fuera del backup mediante el canal privado de custodia. Actualizar ese corte después de cada borrado; conservar el ledger de todos los tenants, incluso si está vacío.

Contrato [API](../../apps/web/src/lib/recovery/server.ts): `POST /api/recovery` admite `operation: policy|preview|erase|purge|export`; las primeras tres llevan los campos validados en [web.mjs](../../packages/recovery/web.mjs). `erase` recibe `token,requestId,confirmed:true`, no el payload del CLI local. `purge` y `export` no reciben campos adicionales. Usar la interfaz evita copiar tokens de confirmación al shell. JSON máximo 16 KiB; una selección que exceda límites exige una entidad menor.

`registerArtifact()` de [index.mjs](../../packages/recovery/index.mjs) registra raw/cache/export/backup con identidad tipada y caducidad; no existe botón que descubra automáticamente todas las copias. La purga sólo cubre artefactos registrados. No hay scheduler de backup o retención entre los seis consumidores descritos. Copias externas siguen `not_verified`; el borrado no elimina el CRM de origen. Se conserva historial financiero/auditoría autorizados.

## 5. Backup y restore local SYN

El CLI de [recuperación](../../packages/recovery/OPERATIONS.md) sólo admite recursos propios sintéticos: contenedores `vexa-recovery-*`, etiqueta `vexa.recovery=synthetic`, PostgreSQL en loopback 61820–61825 y Storage local con marcador `.vexa-recovery-owned` cuyo contenido es `synthetic-vexa-recovery-v1`. Requiere Docker y `pg` instalado en la copia de ejecución. No usarlo con clientes ni servidores remotos.

Antes de ejecutar, preparar dos bases de ensayo con el mismo esquema completo revisado, destino vacío y directorios Storage propios. Reservar nombres/puertos sin colisión. El CLI no provisiona esas bases; el harness del ensayo aprobado debe crearlas. No ejecutar un setup histórico sobre recursos ya existentes para intentar repararlos.

Los siguientes JSON son **plantillas de contrato**, no archivos listos para correr. Sustituir cada marcador con datos observados del ensayo, guardar planes privados 0600 fuera del candidato y validar que el origen y destino son distintos.

Backup (`backup-plan.json`):

```json
{
  "mode": "synthetic-local",
  "sourceContainer": "vexa-recovery-<ensayo>-source",
  "storageRoot": "/ruta/privada/SYN/source-storage",
  "archive": "/ruta/privada/SYN/backup-original-nuevo"
}
```

```sh
node packages/recovery/cli.mjs backup "$VEXA_RECOVERY_BACKUP_PLAN"
```

`VEXA_RECOVERY_BACKUP_PLAN` es una variable de shell del operador con la ruta del plan, no configuración del producto. El directorio `archive` debe ser nuevo. Conservar el recibo `archive,manifestHash,capturedAt,durationMs`, `manifest.json`, dump y objetos. El manifiesto liga esquema, bootstrap Auth/Storage, bytes y tenants. `manifestHash` es el digest del objeto JSON calculado por el programa; no reemplazarlo por el SHA de los bytes con indentación del archivo.

Después de los borrados, exportar el ledger de cada tenant desde su autoridad vigente. Para el CLI local, el plan de exportación contiene `mode,sourceContainer,storageRoot,actorId,tenantId,ledgerKeyFile,ledgerFile`; el owner debe existir y estar activo en la fixture y `ledgerFile` debe ser nuevo:

```sh
node packages/recovery/cli.mjs export-ledger "$VEXA_RECOVERY_LEDGER_PLAN"
```

Conservar el hash que devuelve. `ledgerKeyFile` contiene la clave privada del ensayo, con custodia separada del backup. Obtener el corte temporal y hash exigidos desde el registro independiente más reciente: el programa no sabe si falta un ledger posterior.

Restore (`restore-plan.json`; repetir la entrada de `ledgers` para **cada** tenant del manifiesto):

```json
{
  "mode": "synthetic-local",
  "sourceContainer": "vexa-recovery-<ensayo>-source",
  "targetContainer": "vexa-recovery-<ensayo>-target",
  "storageRoot": "/ruta/privada/SYN/target-storage",
  "archive": "/ruta/privada/SYN/backup-original-nuevo",
  "expectedManifestHash": "<manifestHash del recibo de backup>",
  "confirmEmptyTarget": true,
  "recoveryCutoff": "<sustituir por número entero Unix en milisegundos>",
  "ledgers": [{
    "tenantId": "<UUID del tenant>",
    "actorId": "<UUID owner de ese tenant en el backup>",
    "ledgerFile": "/ruta/privada/ledger-tenant.json",
    "ledgerKeyFile": "/ruta/privada/clave-del-ledger",
    "expectedLedgerHash": "<hash confiable del ledger actual>",
    "recoveryCutoff": "<sustituir por número entero, al menos el corte global>"
  }]
}
```

```sh
node packages/recovery/cli.mjs restore "$VEXA_RECOVERY_RESTORE_PLAN"
```

El restore verifica destino vacío, esquema y hashes; crea `RESTORE_BLOCKED`, fija CONNECTION LIMIT 0, revoca CONNECT y termina sesiones de aplicación. Verifica todos los ledgers antes de cargar, restaura y reaplica borrados/purgas de todos los tenants. Resultado esperado: `state=reconciled-synthetic-only`, todas las conciliaciones completas y `backupOriginalHashUnchanged=true`. Aunque quite el marcador, conserva la base cerrada; el CLI no habilita servicio.

Ante `RECOVERY_FAILED_CLOSED`, conservar destino, marcador, backup y log. Diagnosticar la causa y repetir en una **base nueva**, sin resetear producción ni reutilizar como vacío un destino parcialmente cargado. No quitar el bloqueo a mano para dar acceso.

El ensayo debe comprobar conteos/hashes, acceso A/B, contenido borrado ausente en fuentes/vectores/citas/raw/cache/export, historial financiero conservado y rechazo de reingesta tombstoned. Registrar RPO/RTO con su definición, reloj, volumen y entorno: `recoveryPointAgeObservedMs` es edad del backup al inicio de restore, no prueba por sí sola cuántos datos se perdieron. Mantener originales hasta su caducidad y descarte explícitamente autorizados.

## 6. Recuperación gestionada y apertura de acceso

La restauración gestionada de DB, Auth y Storage necesita un procedimiento del proveedor para el destino concreto, acceso autorizado y ensayo revisado. El CLI SYN no implementa ese carril. Antes de operar, completar responsable/custodio, frecuencia real de backups, cobertura de objetos, retención, ubicación cifrada, verificación de copia y alarma de backup ausente/fallido. Ninguna frecuencia escrita aquí instala un backup.

Mantener el destino cerrado hasta comprobar esquema y artefacto compatible, integridad DB/objetos, ledgers vigentes de todos los tenants, purga de derivados y permisos actuales. Reconciliar también **revocaciones de membresías, credenciales, delegaciones y sesiones posteriores al backup** desde su fuente vigente; el ledger de retención sólo cubre borrados. No abrir acceso usando la autoridad antigua restaurada.

Una restauración que revive texto, embeddings, exports o cachés borrados falla aunque SQL termine. El ensayo de cuarentena debe incluir un objeto canario SYN y un enlace firmado emitido legítimamente antes del cierre, con lectura positiva previa. Durante la cuarentena, comprobar que ese mismo enlace **todavía vigente y con firma válida** no devuelve los bytes del canario; registrar el corte temporal, caducidad, objeto y resultado sin guardar el token en logs públicos. Una firma vencida/inválida, una ruta inexistente o un objeto nunca accesible no demuestra que la cuarentena impida acceso. Si los bytes siguen disponibles, mantener el destino cerrado y corregir el mecanismo de aislamiento; no esperar al TTL para convertir ese ensayo en PASS. Este requisito es del ensayo gestionado y no está cubierto por el adaptador de archivos del CLI SYN.

Separadamente, antes del despliegue que prometa revocación inmediata, comprobar que los enlaces de descarga antiguos hayan expirado o se hayan invalidado mediante el procedimiento autorizado y verificado. SQL0041 impide nuevas firmas de descarga privada, pero no invalida enlaces ya emitidos. Esa transición por expiración o invalidación es una condición de despliegue, no sustituto del ensayo de cuarentena con firma válida. No habilitar temporalmente firmas en producción para fabricar el canario: prepararlo en el entorno de ensayo autorizado, preservando la política de producto. Abrir acceso sólo tras revisión y autorización del destino, con smoke y evidencia. RPO/RTO SYN no son SLA gestionados.

## 7. Preparación de release, publicación y rollback

### Manifiesto y fuente

Desde la raíz del checkout de operación, usando rutas absolutas, un directorio privado existente y un nombre de salida nuevo:

```sh
node packages/release/manifest.mjs \
  --root "$VEXA_RELEASE_SOURCE" \
  --out "$VEXA_RELEASE_MANIFEST"
```

`VEXA_RELEASE_SOURCE` es una variable de shell con el checkout limpio; `VEXA_RELEASE_MANIFEST` es la ruta del archivo privado generado 0600 fuera del candidato. El comando sólo inventaría fuente. Completar responsables, destino, revisión de variables y los siete artefactos de evidencia conforme a [F08-release](../../support/F08-release/README.md). Conservar bloqueos mientras falten; no llenar `entireRelease:true` con una revisión parcial.

El supervisor prepara/verifica F08-01 mediante los comandos de su [ficha](../../construccion/tareas/F08-01.md), con `VEXA_RELEASE_MANIFEST`, `VEXA_RELEASE_VERIFICATION_AUTHORIZATION` y una `--approval-note` real. No repetir `prepare` sobre una tarea ya preparada/aceptada ni fabricar una nota para avanzar el estado.

Para el build, `VEXA_BUILD_REVISION` debe ser el SHA completo real. `VEXA_COMPILED_REVISION` y `VEXA_COMPILED_EXTRACTION_CODE` son derivados, no valores manuales para renombrar artefactos. Los valores `NEXT_PUBLIC_*` son públicos y se incorporan al build; revisar por separado configuración de cada entorno. Exportar exclusivamente fuentes públicas del SHA limpio a una copia de despliegue; no subir el directorio canónico completo. Verificar bundle/traces según [F08-deploy](../../support/F08-deploy/README.md).

### Publicación GitHub y protección de main

La autorización pública previa de VEXA se conserva. El único carril admitido es `orchestration.publisher.publish_vexa(root,allow_public=True,allow_actions=False)`, invocado por el supervisor después de la aceptación/revisión que corresponda. No usar `git push` directo como sustituto. Ejemplo del punto de entrada, **sólo cuando sus condiciones están cumplidas**:

```python
from pathlib import Path
from orchestration.publisher import publish_vexa
receipt = publish_vexa(Path("/ruta/absoluta/checkout-revisado"),
                       allow_public=True, allow_actions=False)
```

El [publisher](../../orchestration/publisher.py) exige fuente limpia en rama de trabajo, inspecciona historial alcanzable, avanza main por fast-forward y fija/verifica el SHA remoto. Rechaza Actions habilitado sin autorización específica; no desactivar Actions automáticamente para sortear ese rechazo. Antes de invocarlo, el supervisor debe comprobar workflows, reglas/protecciones y conexiones de despliegue externas. `.github/workflows/ci.yml` contiene push a main; los workflows manuales no convierten todos los pushes en operaciones sin costo. El publisher no inspecciona por sí solo las integraciones de Vercel ni configura protección de rama.

Propuesta concreta de protección, pendiente de revisión y aplicación autorizada: main sin force-push ni borrado; conservar historial lineal compatible con fast-forward y verificar controles sobre el SHA propuesto antes de publicar. Documentar quién puede publicar y registrar revisión independiente. Examinar primero las protecciones/rulesets efectivos y sus excepciones, sin afirmar que la propuesta está instalada.

Exigir PR aprobado y checks obligatorios antes de integración es el siguiente carril propuesto, pero el publisher actual **hace push directo a main**. Antes de exigir PR, adaptar y revisar el publisher para crear/usar el PR y comprobar sus checks/merge; conservar commits individuales y SHA verificable. No configurar una regla incompatible y después desactivarla o añadir un bypass para continuar. La adaptación del publisher y la configuración remota no se implementan por escribir este runbook.

### Propuesta de configuración lista para revisar, no aplicada

Lectura del 7-oct-2026: GitHub devolvió `Branch not protected` para main, cero rulesets y Actions `enabled:false`. La app `github-actions` tiene ID15368, comprobado por API. [Cuerpo propuesto](main-protection.proposed.json): un PR aprobado por otra persona, descartar aprobaciones anteriores a cambios, cuatro checks de la app GitHub Actions, historial lineal, conversaciones resueltas, sin force-push ni borrado.

**Prerrequisitos:** adaptar/revisar el publisher al carril PR; acordar revisor real; preparar CI para PR y verificarlo sobre el SHA propuesto; autorizar sus builds/cuotas e integraciones Vercel. El workflow actual sólo corre en main y sus jobs también están condicionados a main: habilitar Actions sin ese delta no genera los checks requeridos de un PR. Mientras no se cumpla, este cuerpo no debe aplicarse; bloquearía el flujo vigente.

Comprobaciones de lectura:

```sh
gh api repos/javiercamarapp/vexa-ai/actions/permissions
gh api repos/javiercamarapp/vexa-ai/branches/main/protection
gh api repos/javiercamarapp/vexa-ai/rulesets
gh api apps/github-actions --jq '{id,slug}'
```

Comando de cambio preparado para cuando se satisfagan esas condiciones y se autorice la acción; **no ejecutado**:

```sh
gh api --method PUT repos/javiercamarapp/vexa-ai/branches/main/protection \
  --input docs/entrega/main-protection.proposed.json
```

Después comparar GET con la propuesta y probar que una rama sin checks/revisión no puede integrarse. El PUT reemplaza campos; antes de aplicarlo conservar el GET vigente y reconciliar cualquier regla nueva. No usar `DELETE` como rollback automático ni eludir la protección. [Contrato oficial del endpoint](https://docs.github.com/en/rest/branches/branch-protection#update-branch-protection).

### Despliegue y reversión

1. Registrar artefacto actual y anterior, SHA, lock, migraciones y destino aprobado. Aplicar expansiones SQL revisadas antes de la app compatible. No editar una migración ya instalada.
2. Desplegar al entorno autorizado mediante el procedimiento de F08-deploy; comprobar SHA servido en `/api/health/version`. READY o un 200 genérico no sustituyen el SHA ni el smoke.
3. Ejecutar smoke de login A/B, import/job terminal, evidencia, dinero/UI/export, revocación y señal de consumidor detenido/recuperado. Conservar fallo, trazas y resultado por paso.
4. Si falla, mantener admisión/consumidores pausados cuando corresponda y volver al artefacto anterior **cuya compatibilidad con el esquema y ledger actuales esté demostrada**. No ejecutar down migrations destructivas ni restaurar la DB sólo para revertir frontend.
5. Verificar SHA anterior servido y repetir smoke/regresión afectados. Si el binario anterior ignora borrados o rompe el esquema, conservar acceso cerrado y reparar hacia delante. Registrar versión finalmente activa y decisión del operador.

## 8. Cambios de configuración evaluada e histórico

Antes de seleccionar otra configuración, revisar el recibo firmado y el trabajo pendiente. La selección no reescribe un job admitido: un hash distinto lo rechaza y pausa el lote histórico. El rollback añade una versión; mantener catálogo y claves públicas de destino válidos. Revocar la clave comprometida, detener consumo afectado y comprobar que el resolver la rechaza antes de autorizar otra evaluación. Conservar un recibo no permite ejecutar código distinto al evaluado.

El feedback histórico exportado es desarrollo silver. Una fuente borrada o revocada queda excluida en lecturas posteriores; un export antiguo requiere volver a comprobar procedencia. El custodio externo decide si gold y evaluación son válidos para otra selección. El software no sustituye esa decisión humana.

## 9. Recibo de cierre del incidente o ensayo

Guardar `entorno, responsable, autorización, SHA, inicio/fin UTC, tenant/job/trace, comando, exit_code, esperado, observado, artefactos/hash, revisión, pendientes`. Para recuperación: añadir backup/ledger originales, corte, conteos, RPO/RTO definidos y estado de acceso. Para operación: añadir acuse de alarma, checkpoint antes/después y comprobación de ausencia de duplicación. Para release: añadir SHA remoto/servido y destino, sin elevar un PASS local a aceptación formal o producción.
