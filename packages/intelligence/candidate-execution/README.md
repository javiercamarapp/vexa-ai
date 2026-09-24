# Ejecutor externo de candidatos de extracción

Herramienta del custodio/evaluador externo, Node22.23.2 o26.7.0. Produce `predictions.json` compatible con la CLI original `../evaluation/cli.mjs`. Reutiliza `createGateway`, prompt canónico, validadores de extracción y `validateInputs`. No modifica gateway/evaluador/SQL/app, no entrena, no selecciona ni promueve modelos. Sólo se ha ejercitado con transporte SYN local, sin llamadas pagadas. Una medición humana exige gold auténtico y revisión independiente; los tests permanecen `not_measured`.

## Custodia y autorización

Todos los inputs, el ledger SQLite y las predicciones permanecen en carpeta externa privada del evaluador, fuera del worker/app/checkout. Directorios0700, archivos0600, propietario actual; sin symlinks en ningún componente del path. En macOS use rutas físicas (`realpath`), no alias `/tmp` si es un symlink. Máximo50MB por JSON,500casos holdout,500mensajes/caso; gateway aplica además maxInputBytes/maxResponseBytes. No hay truncamiento. Textos ya redactados/minimizados y autorizados: este bloque offline no consulta revocaciones remotas ni crea legitimidad de acceso.

El custodio administra un solo ledger de ejecución por alcance presupuestario y el ledger del evaluador original. No cambiar directorios, identidades o restaurar backups antiguos para eludir exposición/presupuesto. No hay defensa contra el administrador del filesystem que suplanta o borra toda la custodia. Estado ausente/corrupto dentro de un ledger existente falla cerrado: nunca se inicializa automáticamente ni expira reservas. Un disco con fsync/locking correctos es requisito; no usar almacenamiento de red sin esas garantías.

`scope.json` tiene exactamente los valores autorizados fuera del worker: `{tenantId,window,limitMinor,authorizationHash,evaluationLedger}`. `limitMinor` es límite externo fijo en microUSD (USD,exponente6), string entero positivo. `authorizationHash` SHA256 refiere a la aprobación real del alcance conservada por el custodio; no es una firma ni una aprobación fabricada por este programa. `evaluationLedger` es ruta absoluta privada del ledger que usará la CLI ORIGINAL. El ejecutor lo consulta antes del primer envío y nunca lo reemplaza. initialize reserva además el ancla exclusiva0600 `<evaluationLedger>.execution-owner.json`, vinculada a identidad, scope y directorioSQLite: otro init contra el mismo ledger autoritativo se rechaza antes de poder enviar. Ausencia o discrepancia del ancla bloquea run; la CLI original conserva su archivo y contrato intactos. La evaluación posterior sigue siendo responsabilidad de la CLI original.

`config.json`: `{id,tuningStartedAt,tenantId,authorizationHash,policy,modelsByRole,catalog}`. Los últimos tres objetos usan los contratos gateway existentes, con un único `modelsByRole.extraction` y `policy.maxAttempts:1`; sin fallback ni routing adicional. Tarifas, privacidad, residencia, catálogo, modelo y política deben estar autorizados/vigentes. No incluir secretos. Clave sólo `OPENROUTER_API_KEY` en entorno servidor. El default no envía: `run` exige `--authorize-provider confirmed` además de política gateway autorizada. Usar ese flag frente a un proveedor real requiere autorización legítima aparte; las pruebas lo usan con fetch SYN controlado.

`roles.json`: `{dataset_hash,custodian_id,confirmed:true,bindings:[{case_id,message_id,revision_id,hash,role,evidence_ref}]}`. Exactamente una entrada por mensaje holdout, ninguna adicional. `hash` coincide con los bytes redactados del dataset; `revision_id` es la revisión real vinculada por evidencia de custodia; `role` debe ser customer/agent/internal y `evidence_ref` identifica su procedencia. No inventar IDs o roles. El código valida vínculo, unicidad y hash; la autenticidad de la evidencia pertenece al custodio. El export actual sin roles requiere este mapping explícito antes de congelar.

## Operación

Todos los padres ya existen. Cree un directorio ledger VACÍO0700 dedicado. Rutas absolutas privadas:

```sh
node packages/intelligence/candidate-execution/cli.mjs init-ledger --directory /private/eval/execution --scope /private/eval/scope.json
node packages/intelligence/candidate-execution/cli.mjs freeze --protocol /private/eval/protocol.json --dataset /private/eval/dataset.json --roles /private/eval/roles.json --config /private/eval/config.json --out /private/eval/candidate.json
node packages/intelligence/candidate-execution/cli.mjs run --protocol /private/eval/protocol.json --dataset /private/eval/dataset.json --roles /private/eval/roles.json --candidate /private/eval/candidate.json --ledger /private/eval/execution --out /private/eval/predictions.json --authorize-provider confirmed
node packages/intelligence/evaluation/cli.mjs evaluate --protocol /private/eval/protocol.json --dataset /private/eval/dataset.json --predictions /private/eval/predictions.json --out /private/eval/result-001 --ledger /private/eval/holdout-exposure.json
```

La última ruta ledger debe coincidir con `scope.evaluationLedger`. Protocolo/dataset se preparan con la CLI original, antes de tuning. Freeze liga config, prompt real,10módulos relevantes (incluido CLI original y ejecutor), protocolo/dataset/roles y tiempo. Ninguna inferencia se ejecuta durante freeze. Código o datos cambiados obligan a nuevo candidato y nuevo holdout cuando ya hubo exposición.

SQLite nativo usa DELETE journal, synchronous FULL y BEGIN IMMEDIATE; no requiere npm. Identidad externa+DB deben coincidir. La exposición se compromete antes de cualquier inferencia; reserve/started/received/finalize son durables. Presupuesto es común a todas las reservas del ledger; incertidumbre retiene capacidad y costo null. La reserva conserva fingerprint y dueño de ejecución; no permite escrituras desde otro dueño. Timeout no provoca retry. `started` registra intención anterior al envío: tras caída se considera ambiguo conservadoramente.

Una caída deja la exposición `running`, bloquea concurrentes y reinicios con `AMBIGUOUS_EXECUTION_NO_RESEND`. No existe reset/retry automático: el custodio investiga y conserva ledger, sin reenviar ese holdout. Un resultado completo sólo admite replay idéntico de artefacto ya escrito; ausencia/alteración del archivo falla cerrado. Si cae entre escribir archivo y completar ledger, se bloquea igualmente. No se garantiza recuperar una corrida incompleta; sí se evita reenvío automático ambiguo.

Las predicciones mantienen citas por ID/hash/offset Unicode reales, estado, latencia observada y cada intento con costo conocido o null. Los eventos íntegros y reservas están en SQLite privado. LogsCLI sólo estado/hash/conteo/código sanitizado, sin texto, claves ni body. En timeout puede faltar respuesta/usage para siempre; no se inventa cero. No se exporta holdout a UI ni worker.

## Pruebas del autor y pendientes

`node --test packages/intelligence/candidate-execution/tests/*.test.mjs`: gateway real con transporte local validando endpoint oficial, cita Unicode→CLI original `not_measured`; replay, modificación de datos/roles/candidato, timeout, proceso SIGKILL tras envío, concurrente/restart, pérdida/corrupción de estado, symlink/permisos y entrypoint por alias realpath. Fixtures rotuladasSYN; no anotadores humanos, firmas o API keys reales. Temporales propios se eliminan en finally.

Revisión independiente340:7/7 en Node22 y26, incluido control de costo desconocido, pérdida de estado y SIGKILL antes/después del transporte. El fallo de doble inicialización contra el mismo ledger quedó cerrado con el mismo oráculo, conservando el rojo original. No valida calidad humana ni proveedor real.

Pendientes: registro y selección de candidatos en UI; promoción humana; integración de custodia institucional/credenciales/políticas reales; ejecución autorizada con proveedor y gold auténtico. El puente histórico338 exporta desarrollo y no constituye holdout independiente. Este ejecutor no completa por sí solo el circuito de mejora.
