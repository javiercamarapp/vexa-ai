## Control v5 adoptado — 8 de octubre de 2026

Integrado después de revisión independiente sin bloqueantes: snapshot externo `acb3faf8a1554f918126b86994c36c741270d7b94d889149d638c627a9c6e653`, revisión `3687435f061dd552e5460f31d0632a4b7ca3770b06fffcdd5d3bda7b2a943204`. Composición sintética29/29; calibración de adopción2/2 independiente. Sin modificar el adaptador ni conceder aceptación. El contrato vigente está en [S01v5](../F03-HubSpot-v5/LIVE-v5-proposed.md); el entry usa el bootstrap v5 y conserva los controles locales del adaptador. Las secciones v4 siguientes son históricas y no describen el entry vigente.

# F03-01: local disponible, S01 remoto bloqueado

El examen local usa HTTP real en 127.0.0.1 con fetch inyectado: valida host HTTPS del proveedor, método GET, redirect manual y señal Abort antes de redirigir al stub. Todos los cuerpos son SYNTHETIC, CC0-1.0. No contiene credenciales ni usa datos cliente. `local.test.mjs` nunca acredita una cuenta HubSpot.

```sh
VEXA_CANDIDATE=/ruta/propuesta node --test tests/acceptance/support/F03-HubSpot/local.test.mjs
VEXA_CANDIDATE=/ruta/propuesta node tests/acceptance/support/F03-HubSpot/mutants.mjs
python3 orchestration/runner.py verify --task F03-01 --approval-note "referencia REAL de aprobación del titular" --max-minutes 5
```

El último comando ejecuta `live.mjs` y falla con `S01_LIVE_BLOCKED` si falta configuración legítima. No admite bandera offline, variable de éxito ni recibo de éxito como sustituto de llamadas reales. El ejecutor está implementado, pero no se ha ejecutado contra HubSpot: faltan cuenta/app, autorización y export independiente. Preparar este código no acepta la tarea.

## Contrato documentado y conflicto abierto

Consultado el20-sep2026, sin API autenticada. La [guía legacy oficial](https://developers.hubspot.com/docs/api-reference/legacy/conversations/guide) documenta conversations.read para GET, threads/mensajes v3, cursores after, association=TICKET y actores A-/V-. Respalda el contrato local v3; no prueba disponibilidad/scopes efectivos de una cuenta. La [guía latest](https://developers.hubspot.com/docs/api-reference/latest/conversations/conversations/guide) presenta `/conversations/2026-09/conversations/...`, mientras la spec citada por el dossier usa `/conversations/conversations/2026-09/...`. Mantener rechazo de versión no comprobada: no probar rutas por tanteo ni fallback silencioso.

El [cambio oficial Help Desk](https://developers.hubspot.com/changelog/upcoming-breaking-change-conversations-api-help-desk-and-comments) anuncia la transición de comentarios a notas. Leer mensajes no demuestra por sí solo cobertura total de notas CRM. El conector debe señalar lo no leído, no presentarlo como cero notas ni conversación completa universal.

## Ensayo live pendiente: autorización primero, evidencia independiente después

1. El titular identifica app/cuenta, relación con tenant, inboxes, fechas, veinte threads permitidos y permiso explícito de leer cuerpos/notas. Scopes mínimos: conversations.read; tickets sólo si se aprueba leer sus propiedades. No solicitar escritura. Datos Senix requieren autorización propia, no se deduce del permiso de publicar GitHub.
2. Principal revisa el transporte separado `live.mjs` con otro agente antes de ejecutar. Host fijo api.hubapi.com, HTTPS validado, GET allowlist exacta para conversaciones y una introspección de metadata elegida explícitamente; token leído dentro del proceso desde almacén autorizado, sin imprimir ni enviarlo al modelo. No usar headers/body en shell, logs o artefactos públicos. El mismo adaptador y hash de fuentes que el candidato se ejecuta sin fetch sintético; fecha límite, tamaño, páginas y presupuesto de requests explícitos. No guardar tokens, IDs, texto ni hashes simples de contenido sensible en recibos públicos.
3. Registrar dentro de directorio privado0600: comandos sin secretos, GitSHA y hash de control, runtime, aprobación referenciada, versión/rutas sin IDs, status, latencia, contadores por página/rol/cuerpo, truncación, errores, cobertura, límites efectivos y salida. Identificadores pueden sustituirse por HMAC con clave privada por ensayo; respuestas originales sólo si están autorizadas y con retención acordada. Nada de logs automáticos de URLs con IDs ni payloads.
4. Revisor independiente presencia la ejecución o la repite con el mismo código congelado; coteja20threads con UI/export autorizado (no scraping silencioso). Compara cantidad, páginas, roles/notas, cuerpo truncado/original, asociaciones, archivados y huecos. Verifica app/scopes efectivos en evidencia del proveedor y relación cuenta↔tenant, sin tratar `scopes:[...]` suministrado a código como prueba remota. Contrasta logs de requests reales con export; un JSON autoafirmado no basta. Conserva disconformidades y ausencia de scopes como BLOCKED.
5. El gate usa fetch nativo capturado antes de cargar producto; no acepta inyección de transporte en el modo live. Introspección explícita verifica cuenta, app_id y conversations.read directamente (hubId/appId en private_app; hub_id/app_id en oauth); luego exige lectura real de20threads y compara todos sus mensajes por HMAC contra la muestra independiente. Cero diferencias, cuerpos completos y muestras presentes son necesarios. La referencia de autorización del config sólo apunta a la decisión real: el supervisor la coteja antes de ejecutar, no considera que crear un archivo conceda permisos. Revisión, freeze y verify/accept limpio siguen obligatorios; no editar status del runner.

## Configuración exacta del ejecutor ya implementado

Después de autorización explícita y revisión independiente: `VEXA_HUBSPOT_S01_CONFIG` apunta a JSON absoluto0600 fuera del candidato, sin symlink. Campos: version `v4`, authentication `private_app` u `oauth` obligatorio (sin valor por defecto), authorization_ref de la decisión real, account_id y app_id esperados (strings decimales positivos canónicos), tenant_id/connection_id autorizados, reviewer e implementer distintos, expires_at vigente menos de24h, reconciliation_file, reconciliation_sha256; opcionales inbox_id y archived. Token y claveHMAC sólo en VEXA_HUBSPOT_TOKEN y VEXA_HUBSPOT_RECONCILIATION_KEY del proceso autorizado. Nunca escribirlos en comandos/logs.

El supervisor compara la referencia con la aprobación real. En verify/accept, el runner proporciona `VEXA_HUBSPOT_APPROVAL_REFERENCE` desde `approval_note`; el live exige igualdad exacta con `authorization_ref` antes de cualquier petición, incluida introspección. Un archivo o una variable creada a mano no concede aprobación. La tarea requiere aprobación explícita y los workers no reciben secretos.

El archivo reconciliation_file privado0600 contiene origin `authorized-ui-or-export`, account_id, reviewer, threads (20–1000IDs únicos de texto, seleccionados y autorizados explícitamente), messages [{id,thread,digest}]. El revisor obtiene la muestra de UI/export independientemente del adaptador; cada digest es HMAC-SHA256 con la clave privada sobre JSON `[message_id,thread_id,role,visibility,text,associations]`, asociaciones ordenadas como pares `[entity_type,external_id]`. Texto NFC, notas internas y cuerpo original completo. `reconciliationDigest` publica la forma exacta sin escribir contenido. Guardar el SHA256 del archivo en config preserva integridad; no convierte un archivo inventado en evidencia. La comparación se ejecuta contra respuestas reales cada vez, nunca contra un receipt passed.

Límites conservados:240s,250 solicitudes GET de conversaciones,max(20,número de hilos autorizados)páginas/recurso,10k registros,10s/request,1retry. HTTPS yapi.hubapi.com fijos, sin redirects. Sólo se añade una solicitud de metadata, sin retry ni fallback:

- `authentication: private_app`: POST exacto `https://api.hubapi.com/oauth/v2/private-apps/get/access-token-info`, JSON `{tokenKey: token}` y Content-Type application/json. Es consulta de metadata documentada, no escritura CRM ni generación/rotación de tokens. Valida `hubId`/`appId` y scopes de la respuesta.
- `authentication: oauth`: GET exacto `/oauth/v1/access-tokens/{token}`. Valida `hub_id`/`app_id`, `token_type: access` y scopes. El token en URL existe sólo en RAM; nunca se conserva ni se incluye en errores/recibos. No se llama a grant, refresh, revoke ni endpoints OAuth de escritura.

Ambos modos exigen IDs de respuesta numéricos enteros seguros positivos, igualdad exacta con IDs esperados y conversations.read. No convierten strings/objetos a IDs ni aceptan app_id ausente. Una única fecha límite de10s cubre headers y cuerpo de metadata, con máximo1MiB; fallo, redirección o respuesta inválida no habilita otro modo. El POST no está disponible para el adaptador: su guardia sigue permitiendo exclusivamente GET sobre threads autorizados. Recibo público conserva únicamente contadores/status.

Fuentes oficiales consultadas el4-oct-2026: [metadata private app](https://developers.hubspot.com/docs/apps/legacy-apps/private-apps/overview#view-private-app-access-token-information) y [metadata OAuth](https://developers.hubspot.com/docs/api-reference/legacy/authentication/oauth-tokens/v1/guide#retrieve-access-token-metadata). El Client ID usado para instalar/autorizar OAuth no es el App ID numérico que devuelve la introspección.

Migración deliberada: configuraciones `v3` se rechazan antes de red. No se reinterpretan automáticamente y `client_id` se rechaza en `v4`. Se requiere nueva configuración privada revisada con identidad esperada app_id y modo explícito; el archivo no concede autorización. Mantener v3 habría conservado una comprobación basada en un campo no documentado; reinterpretarlo como App ID debilitaría el vínculo de identidad. `version:v4` es la versión del config del gate; el adaptador sigue usando conversations API `v3`.

El runner sólo pasa las tres variables privadas del ensayo para F03-01 con requires_approval=true y approval_note real no vacío; el referencebinding procede de ese registro, nunca de una variable heredada. Verify/accept limpio ejecutan el gate real con estas guardas. No sustituir por recibos JSON ni autorizar mediante banderas offline.

## Corrección acotada review203 — no lectura fuera de muestra

El driver anterior recorría la lista general de threads y filtraba después de leer cuerpos; la reproducción sintética autorizaba20 y observaba21. Ese recibo y rechazo se conservan. El driver corregido pasa `threadIds` al mismo adaptador y solicita cada thread directamente: GET `/conversations/v3/conversations/threads/{threadId}?archived=…&association=TICKET`, documentado en la guía legacy oficial (consultada20-sep-2026, sección Retrieve threads). No pide listar inboxes ni hilos fuera de la muestra. Si inbox_id se configura, se coteja con la metadata devuelta antes de leer mensajes.

La guardia externa también exige que cada GET de thread, messages y original-content pertenezca al conjunto exacto autorizado. Bloquea la ruta de listado general y cualquier ID exterior antes del transporte nativo. La allowlist copiada queda ligada al checkpoint y no puede ampliarse mutando el array del caller. Cada página directa comprende sólo un hilo autorizado con todas sus páginas de mensajes. El scope mínimo de veinte hilos no se transforma en permiso de leer otros cuerpos que aparezcan en una página de cuenta. Los tests de la regresión usan fixtures rotulados en un proceso aislado; su resultado passed sintético jamás sustituye S01.



Pendiente: revisión independiente del ejecutor y ensayo live autorizado, escoger versión según evidencia real, verificar cobertura de notas Help Desk según permiso, reconciliar muestra/export y validar integración durable en fichas posteriores. Esta nota es un procedimiento pendiente, no evidencia de ensayo ejecutado.
