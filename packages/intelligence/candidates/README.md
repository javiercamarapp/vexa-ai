# Registro y selección humana de configuraciones de extracción

Ruta owner `/evaluation/candidates`, API privada `/api/candidates`. Gestión revisable de candidatos: reutiliza gateway, prompt, evaluador original y runtime existentes. No entrena ni autopromueve. No incorpora holdout, mensajes, citas ni claves privadas en DB/UI. La navegación de gestión abre esta pantalla.

## Configuración del servidor

- `VEXA_EXTRACTION_CONFIG_JSON`: configuración predeterminada existente. Sin selección se conserva su hash y comportamiento. También identifica la configuración inicial conocida para rollback0.
- `VEXA_EXTRACTION_CANDIDATES_JSON`: array `{tenantId,candidateId,config:{taxonomy,redactionPolicy,gateway}}`. IDs alfanuméricos/guion de1..80. El servidor normaliza con `createExtractionConfigResolver` actual; UI nunca acepta política, catálogo de proveedor, prompt ni config arbitraria. Mantenga todas las versiones que necesiten rollback. Cambiar contenido bajo un ID cambia hash y bloquea selección/ejecución anterior.
- `VEXA_EVALUATION_CUSTODIANS_JSON`: array `{tenantId,keyId,active:true,publicKey}` con clave pública PEM Ed25519. Revocar `active` o retirar clave bloquea nuevas selecciones y ejecución de la selección vigente; registro histórico se conserva. Reiniciar procesos después de actualizar entorno, como en las otras configuraciones.
- `VEXA_EVALUATION_SIGNING_KEY`: clave privada PEM Ed25519 sólo en el entorno del CLI del custodio EXTERNO. Nunca instalarla en la app, worker, catálogo o navegador. Custodia y autorización reales son responsabilidad externa; fixtures generan claves efímerasSYN.

Sin catálogo/clave válida no se puede registrar ni seleccionar una evaluación. La configuración default sigue disponible sin selección. Runtime conserva autorización, límites y presupuesto originales: elegir candidato no habilita `VEXA_AI_RUNTIME`, no crea presupuesto ni rebaja tarifas/atestaciones. El operador autoriza esos elementos aparte.

## Firma del custodio

La CLI sólo admite inputs privados0600, sin symlinks, máximo50MB por archivo; salida nueva0600 en padre0700. Use rutas físicas absolutas. Fuera del checkout/worker, el custodio mantiene protocolo/dataset/predicciones/candidato congelado339 y resultado/receipt ORIGINAL del evaluador:

```
node packages/intelligence/candidates/cli.mjs sign-summary --result /private/eval/result/result.json --receipt /private/eval/result/receipt.json --protocol /private/eval/protocol.json --dataset /private/eval/dataset.json --predictions /private/eval/reviewed-predictions.json --candidate /private/eval/candidate.json --catalog-entry /private/eval/catalog-entry.json --scope /private/eval/sign-scope.json --out /private/eval/signed-summary.json
```

`catalog-entry.json` contiene la entrada server-owned descrita arriba. `sign-scope.json`: `{tenantId,candidateId,keyId,evidenceHash,confirmed:true}`; hashSHA256 refiere a la evidencia real revisada por el custodio, sin texto libre. Debe verificar la procedencia de los roles/revisiones y de la redacción aplicada, además del resultado evaluativo. La CLI comprueba hashes de bytes leídos del receipt, módulos originales, reconstruye evaluate y liga tenant/candidato/config/prompt/código/protocolo/taxonomía/resultado. Predicciones revisadas pueden añadir la revisión humana de utilidad requerida por el evaluador, sin inventarla. La firma contiene únicamente resumen permitido, nunca mensajes, citas, anotaciones completas o holdout.

El servidor verifica firma Ed25519 y clave activa por tenant en importación, selección, consulta y resolución runtime. La firma autentica al custodio y la integridad del resumen: NO demuestra por código que el gold o las personas sean auténticos. Eso requiere custodia/auditoría humana externa. Un owner sin clave privada no puede convertir un JSON arbitrario en evaluación válida.

## Criterios y versiones

Importar un recibo no selecciona un modelo. Producción requiere `measured`, `human_gold`, atestación y doble anotación completas, mínimo30casos, cobertura1, citas válidas1, cero fallos/casos faltantes/citas inválidas, utilidad>0.85 revisada por completo y coste total conocido. Synthetic/silver/not_measured siempre bloquean selección. No hay flag o rama de bypass para promover fixtures.

El owner confirma explícitamente evidencia y envía reason estructurada+evidenceHash. SQL0037 mantiene resultados/selecciones append-only, tenant/RLS y actor actual; cada mutación revalida owner. CASversion impide sobrescrituras o replay de selección. Registro con UUIDrequest idéntico admite replay idéntico, nunca reemplaza otro sobre ese ID. Rollback crea una nueva versión que apunta sólo a una versión previa existente, o0(default inicial cuyo hash debe seguir igual); revalida firma/config actuales del destino. No se borra historia.

UI muestra hashes, estado, criterios y versiones; carga inicial/refresco visible, aria-busy, cancelación de GET previo, descarte de respuestas antiguas, errores controlados en español, recuperación sólo tras GET confirmado. No se renderiza error como lista vacía. Listados acotados100: exceso produce413 explícito, no truncamiento silencioso.

Comparación es descriptiva. Resultados de holdouts distintos se indican como no comparables directamente; regla339 exige otro holdout por candidato. No se presenta diferencia como mejora estadística ni se evade el ledger original. Feedback de desarrollo histórico338 no es gold independiente.

## Runtime e histórico

Resolver efectivo async consulta selección autorizada. El histórico pasa su scope ya abierto para evitar adquirir otra transacción/pool y conserva tenant del contexto autenticado. Worker yAPI de extracción resuelven el mismo hash efectivo. Jobs y batches conservan hash capturado; si cambia la selección, job anterior se rechaza por `configuration_changed` y batch se pausa. Restaurar el hash original permite reanudar el batch con consentimiento owner; no cambia retrospectivamente la configuración de un job ni reenvía intentos ambiguos.

La app importa sólo catálogo/verificador/repositorio/resolver. SignerCLI conFS y custodia es módulo separado; no importa candidate-execution/SQLite en rutas de servidor. SQL09/29, gateway, evaluator y ejecutor339 originales permanecen intactos.

## Pruebas y límites

El control de autor archivado `packages/intelligence/candidates/tests/author.mjs` usa Auth/PG/Storage/browser locales propios62820..25, build enTMP, transporteSYN que exige URLoficial y no abre red. Reutiliza339freeze2 por lectura; `VEXA_EXECUTOR_FROZEN` permite indicar su ruta. Fixtures de CONTRATO fabrican estructuras de anotación/atestación para ejercer la rama measured: NO son gold auténtico, firmas de personas reales ni medición de precisión. ClavesSYN efímeras; producción no recibe esta información de prueba.

Cubre firmaCLI/evaluateoriginal, ownerA/B/viewer/tamper, rechazo synthetic/silver, CAS/rollback, keyrevocada, loading/abort/retry/UI, extracción real PG/gateway con config seleccionada, jobviejo rechazado y batchhistórico pausado/reanudado. Pruebas autor no sustituyen revisión independiente. No se ejecutan inferencias pagadas, no se promueve configuración real. El delta pasó revisión independiente344 y regresión integrada de7/7. Pendientes externos: catálogo/keys/custodia/gold/proveedor legítimos. Criterios conservadores no son aprobación estadística ni comercial.

## Identidad del código evaluado

El resumen firmado conserva `codeHash` completo del freeze del ejecutor y proyecta `evaluatedCode`: hashes de gateway/index, gateway/budget, gateway/catalog e intelligence/index, los módulos compartidos que ejecutan esas predicciones. La selección y el resolver exigen coincidencia con los archivos compilados. Next calcula la identidad en el build; modificar el entorno al arrancar no permite relabelar ese artefacto. Sin identidad coincidente, un resultado sigue registrado pero no es elegible ni ejecutable.

Para consumidores Node sin compilar, importar `readRuntimeCode` desde `runtime-code-files.mjs` al arrancar y pasar su resultado como `runtimeCode` a repositorio/resolver, runtime/handler de extracción o tercer argumento de `historyConfig`. El daemon histórico lo calcula directamente. No suministrar un mapa inventado ni reutilizar el de otro checkout. El verificador web es puro y no importa ese lector, el ledger SQLite ni el holdout. La custodia sigue debiendo validar redacción y datos del dataset antes de firmar; el executor evalúa contenido ya preparado y no mide por sí mismo el redactor.

## Historial que crece

GET /api/candidates devuelve páginas de hasta100 evaluaciones y100 versiones. `next.results` es el UUID que se envía como `resultsBefore`; `next.history` es la versión que se envía como `historyBefore`. Los cursores se validan dentro del tenant autorizado; no son una credencial. Los registros son inmutables y el orden de resultados usa fecha e ID completos de PostgreSQL. La versión activa global y el CAS se conservan al recorrer páginas antiguas.

La interfaz permite cargar más evaluaciones o versiones y alcanzar rollback anteriores a la primera página. Una revocación, error o cambio de versión invalida la vista hasta recargar. El caso101 antes devolvía413 y bloqueaba la interfaz; revisión independiente357 comprobó201recibos,102versiones,rollback1→103,CAS,cursores ajenos,botones y revocación. El fixture firmado es sintético para probar contratos, no gold humano ni inferencia real.
