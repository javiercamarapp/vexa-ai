# F03-02: examen local y spike S02 real

El gate ejecuta el adaptador contra HTTP loopback real y cuatro mutantes de comportamiento, y después exige S02 real. Los resultados sintéticos no aceptan la ficha. Sin acceso el gate termina con `S02_LIVE_BLOCKED_ACCESS_AND_AUTHORIZATION`; no registra success ni salta el test.

## Protocolo autorizado

El supervisor debe derivar `VEXA_ZENDESK_APPROVAL_REFERENCE` de una aprobación legítima de F03-02 y suministrar sólo estas entradas específicas:

- `VEXA_ZENDESK_S02_CONFIG`: ruta absoluta del JSON privado regular0600.
- `VEXA_ZENDESK_TOKEN`: OAuth Bearer existente; nunca publicarlo ni pasarlo como argumento CLI.
- `VEXA_ZENDESK_RECONCILIATION_KEY`: secreto de al menos32bytes que firma el export independiente, no token Zendesk.
- `VEXA_ZENDESK_APPROVAL_REFERENCE`: referencia derivada por control-plane; debe coincidir exactamente con config.authorizationRef antes de cualquier red.

Un archivo, un flag o una referencia textual no crean permiso. El operador conserva el acto de autorización real y verifica su alcance. No ejecutar contra una cuenta mientras eso falte. No incluir secretos/clientes en Git.

Config versión1: `authorizationRef`, `subdomain` (sólo labelDNS), `context` (tenant_id/connection_id/source=zendesk/source_account_id=subdomain), `accountConfirmed:true`, `providerContractConfirmed:true`, `authorizedReadScope:"account-wide-incremental-tickets-comments-authors"`, `startTime` (epoch anterior a un minuto), `expiresAt` (epochms, futuro y máximo24h), `expectedAdminUserId` (string), `maxPages` (1..100), `maxRecords` (20..100000), `referenceFile` (relativo al directorio privado), `referenceSha256` (SHA256 del archivo completo).

La autorización amplia es intencional: incremental puede devolver cualquier ticket modificado desde startTime, y el adaptador recupera todos sus comentarios/autores antes de emitir la página. Tener permiso únicamente para20IDs NO autoriza esta lectura. En ese caso este examen se bloquea hasta obtener permiso de esa ventana, sin filtrar después de haber descargado datos ajenos. Límites de páginas/bytes/tiempo son recursos, no sustituyen los límites legales del acceso.

## Referencia independiente

Debe provenir de UI/export autorizado independiente del adaptador examinado. JSON versión1 con subdomain, startTime, `origin:"ui-export"` o `"authorized-export"`, independentExportRef y tickets (mínimo20IDs únicos). Cada ticket contiene id string, updated_at, deleted boolean, updated_since_previous_export cuando el export previo prueba actualización, comments completos. Cada comment contiene id string, role, visibility y text_sha256 de texto Unicode NFC. Incluir nota interna, ticket eliminado y actualización documentada; mínimo20mensajes reales comparados.

La autoridad que prepara el export añade `signature = HMAC-SHA256(key, JSON.stringify(referenceSinSignature))`, en hexadecimal. Mantener orden JSON usado para firmar; el gate elimina sólo signature antes de serializar. Guardar el JSON0600 y su SHA256 en config. La firma evita sustituir la referencia: no prueba por sí sola origen independiente, derechos ni veracidad. Eso forma parte de la aprobación y revisión humanas.

El código verifica identidad admin vía users/me y scopes efectivos vía OAuth current, lee incremental completo hasta end_of_stream, exige checkpoint final, y compara IDs/updated_at/deletes, número exacto de comentarios y hash/rol/visibilidad de cada comentario esperado. 401/403/errores/rechazos/cobertura insuficiente no son vacío ni éxito. No modifica tickets, concede OAuth, revoca tokens, descarga adjuntos ni crea datos de prueba remotos. Recibo sólo contadores y hash de referencia; nunca cuerpos, IDs cliente, tokens o respuesta OAuth.

## Fuentes oficiales consultadas20-sep-2026

- [Incremental exports](https://developer.zendesk.com/api-reference/ticketing/ticket-management/incremental_exports/): inicio start_time, after_cursor, end_of_stream; mantener eliminados. [Guía incremental](https://developer.zendesk.com/documentation/api-basics/working-with-data/using-the-incremental-export-api/): cursores al reanudar.
- [Ticket comments](https://developer.zendesk.com/api-reference/ticketing/tickets/ticket_comments/): comments públicos/internos, cursor page[size]/page[after], máximo100porpágina, acceso Agents, cuerpos64KB y adjuntos externos.
- [Users](https://developer.zendesk.com/api-reference/ticketing/users/users/): roles de autor consultados, desconocido conservado.
- [OAuth Tokens](https://developer.zendesk.com/api-reference/ticketing/oauth/oauth_tokens/): GET current devuelve propiedades/scopes del token; el driver no usa operaciones de escritura.

La documentación no prueba el plan, las restricciones del rol ni datos de esta cuenta. La identidad efectiva, lectura y reconciliación reales siguen pendientes hasta contar con acceso autorizado.
