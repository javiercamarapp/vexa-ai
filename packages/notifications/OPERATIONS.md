# Centro de notificaciones y preferencias

El centro usa la sesión y `createDatabase` canónicos. Sólo usuarios VEXA con membership activa pueden leer sus avisos o guardar sus preferencias. Los contactos CRM no son destinatarios. Las tres tablas tienen RLS forzada; su acceso se realiza por API de servidor, sin SELECT browser directo.

- `GET /api/notifications`: `status=all|unread`, `limit=1..100`, `cursor` opcional. Orden estable por fecha y UUID descendentes; el cursor vincula organización, usuario, rol, versión de permisos, filtro y tamaño. No se omiten avisos autorizados por cortar una página antes de comprobar acceso.
- `GET /api/notifications/preferences`: catálogo y todas las combinaciones de canal/evento. Ausencia significa `enabled:false,version:0`, no consentimiento.
- `POST /api/notifications/preferences`: `{channel,eventType,enabled,expectedVersion}`. Todos los roles sólo pueden cambiar sus preferencias. CAS devuelve409 si la versión cambió; actualizar y revisar antes de reintentar.
- `POST /api/notifications/[id]/read`: cuerpo `{}`. Conserva la primera fecha de lectura en reintentos. Aviso ajeno o recurso retirado devuelve404.

La acción DB `notify` permite únicamente la escritura propia en preferencias y estado leído. No permite insertar eventos ni inbox, ni operar finanzas, jobs, conexiones o CRM. La función privada de autorización de recursos fija `vexa.action=read` únicamente durante su ejecución y restaura el valor al retornar, incluso si falla; su wrapper comprueba previamente acción original, usuario, organización y membership. No se expone la función privada al backend.

Cada lectura y cambio leído comprueba el recurso actual. Briefs usan las fuentes y referencias autorizadas del brief publicado; intervenciones requieren asignación vigente y evidencia financiera, incluido mapping de resultados. Los links de intervención conservan el alcance capturado y apuntan a su tarjeta. Atención de conexiones es para owner; procesamiento con import existente, para owner/analyst. Invitaciones no se insertan en inbox: requieren el futuro flujo explícito de owner y destinatario reservado.

Los seis eventos del catálogo del banco revisado permanecen `connected:false`. El centro puede mostrar filas legítimas existentes, pero esta entrega no instala emisores de negocio. Email y push no están conectados. Guardar una preferencia no envía mensajes, registra dispositivos, concede permiso push ni activa un emisor. No hay endpoint de emisión, despachador, outbox o URLs aportadas por cliente. Las pruebas insertan eventos sintéticos mediante propietario SQL, pasando triggers/FK sin desactivarlos; no equivalen a emisores productivos.

La propuesta reutiliza catálogo, mensajes mínimos, eligibilidad por membership/recurso y política de preferencias explícitas del banco5fbf223. No copia el pool/auth antiguos ni migraciones de laboratorio. F06-09..12 integrarán sus propios flujos bajo revisión, sin afirmar que están implementados aquí.

## Lectura y contador

La bandeja abre en avisos sin leer. Abrir un detalle nuevo confirma su lectura antes de navegar; marcar como leído también retira el aviso del filtro pendiente. El filtro de todos conserva el historial. El contador viene de SQL bajo el mismo tenant, usuario y RLS del recurso, sin aproximarlo al tamaño de página; un error no se convierte en cero. Se actualiza tras lectura, navegación y recuperación del foco, sin polling continuo. Revocar el recurso lo retira también del conteo. Estos cambios no activan productores de eventos ni entrega email/push.
