# F03-02 — propuesta de examen externo,20-sep

No aceptada ni ejecutada contra cuenta real. La propuesta permite preparar código dentro de F03 mientras falta autorización. No cambia DAG ni contador17/60; F03-01 continúa en cierre oficial.

- HTTP loopback real con transporte inyectado: incremental externo, subpáginas de comentarios, roles customer/agent/internal/unknown, revisiones, tombstones, final checkpoint, cuarentena, límites,401/403/429/404/500, timeout de body, redirects y host/ruta ajenos. Adjuntos no se descargan.
- Implementación ausente ejecutada: rojo `ZENDESK_ADAPTER_REQUIRED` (`/tmp/vexa-f0302-absent.log`). No error de setup contado como mutante.
- Mutantes de outputs copiados en TMP, sin modificar candidato: internal→customer, deletedfalse, source_revision constante y cursor final erróneo; cada uno0→1→0 por oráculo identificable.
- Primera corrida frente a producto detectó dos expectativas incorrectas del examen: deleted_at ya se normaliza a ISO con milisegundos por createEnvelope; label localhost genera localhost.zendesk.com y no un hostloopback. Se corrigió ISO y se reemplazó negativo por localhost:80; el rojo original permanece `/tmp/vexa-f0302-product-external-first.log`. No atribuir estos fallos al producto ni contarlos como mutantes matados.
- Primera entrada completa mostró herencia NODE_TEST_CONTEXT en subprocesos; bloque local podía omitir pruebas y mutantes no acreditaban rojos. Se eliminó únicamente esa variable del entorno de hijos; repetición del gate exige ambas partes locales verdes y S02 real bloqueado. Log previo `/tmp/vexa-f0302-gate-live-blocked.log`; corregido `/tmp/vexa-f0302-gate-live-blocked-corrected.log`.
- Driver S02 ejecutable y testeado mediante HTTP sintético, claramente distinto de S02 real. Approval derivada/control-plane debe coincidir con config antes de red. HMAC/hash de referencia independiente, permiso de ventana incremental completa, identidad admin y scopes efectivos, reconciliación real de20tickets y20mensajes, nota interna/delete/update. Ausencia de credenciales bloquea con0requests. Flags passed/config por sí solos no aceptan.

Pruebas locales y deltas del controlador requieren revisión independiente antes de congelar/controlar una aceptación. Nada de clientes privados, secretos o producción fue leído. Ver support/F03-Zendesk/LIVE.md para protocolo y límites.


## Revisión208 y correcciones posteriores

El revisor independiente reprodujo dos defectos: (1) plain_body corto podía ocultar una variante body/html_body de64KiB y figurar como completo; (2) IDs de comentarios repetidos en la referencia podían ocultar un comentario real distinto por comparar cantidad y find sin unicidad. Los originales y sus rojos se conservan.

La corrección del producto mide las tres variantes recibidas antes de normalizar, conserva la preferencia por texto plano y marca cobertura incompleta si cualquiera alcanza el límite. No ejecuta HTML ni promete recuperar texto truncado. Tres casos nuevos (body/html_body grandes y control corto) reprodujeron dos fallos antes; las diez pruebas Zendesk pertinentes pasaron en Node22/26 después.

El gate exige IDs únicos por ticket tanto en referencia como en respuestas. Referencia duplicada se rechaza antes de cualquier request; respuesta duplicada también falla. Tres controles HTTP sintéticos derivados de la reproducción independiente verifican ambos rechazos y el caso válido. El entry los ejecuta explícitamente.32/32 controles externos pasaron en Node22/26; cuatro mutantes anteriores conservan su evidencia inmutable.

El controlador entrega solamente las variables Zendesk explícitas al gate F03-02, con aprobación referenciada y requires_approval=true. La referencia la deriva de approval_note, no de una variable ambiental no confiable. Ocho pruebas de entorno (tres Zendesk y cinco HubSpot) pasan, incluidos verify/accept en repositorios desechables y exclusión cruzada de credenciales. No constituyen autorización de datos ni aceptación real.

Las pruebas live simuladas son sólo del ejecutor, no del proveedor. S01 y S02 siguen pendientes de accesos legítimos y reconciliación independiente; contador17/60, ninguna llamada remota autenticada. El control queda separado del producto y la aceptación sigue el orden del grafo.
