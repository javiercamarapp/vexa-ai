# Webhooks entrantes de CRM — propuesta de activación

Esta ruta solicita una sincronización durable de una conexión existente. No incorpora el JSON del webhook al modelo de negocio: el importador obtiene los datos desde el CRM, conserva checkpoints y aplica sus reglas de permisos, deduplicación y cuarentena. No envía correos ni notificaciones.

La implementación permanece desactivada por defecto. Este documento no acredita aprobación independiente, migración remota, suscripciones reales ni producción. El polling existente continúa siendo necesario para recuperar eventos perdidos y cambios históricos.

## Configuración del operador

1. Aprobar y aplicar `supabase/migrations/0040_crm_webhook_receipts.sql` en el proyecto autorizado, después de revisar el cambio. No habilitar el receptor ni el consumidor con señales antes de aplicar la migración. Ninguna ruta ejecuta DDL.
2. Configurar una conexión HubSpot/Zendesk mediante la pantalla existente, con histórico habilitado por su propietario y credenciales de lectura. Verificar que la cuenta del proveedor corresponde a `connections.account_id`; no se acepta el tenant del cuerpo entrante.
3. Conservar la identidad del worker existente y su delegación explícita por tenant. Requiere `VEXA_DATABASE_URL`, `VEXA_SUPABASE_URL`, `VEXA_SUPABASE_ANON_KEY`, `VEXA_WORKER_EMAIL`, `VEXA_WORKER_PASSWORD` y `VEXA_WORKER_USER_ID`. La DB usa el rol restringido; no una conexión administrativa ni service role. El receptor resuelve de nuevo identidad, membresía, delegación y propietario al admitir cada solicitud.
4. Fijar `NEXT_PUBLIC_SITE_URL` al origen HTTPS público exacto, sin barra final, path ni query. La ruta de cada binding es `/api/webhooks/crm/<id>`. No se admiten querystrings ni URLs de callback alternativas. HTTP sólo está permitido para loopback en pruebas. En Next.js local configurar `http://localhost:<puerto>`: su `NextRequest` normaliza `127.0.0.1` y `[::1]` a `localhost`; usar el mismo origen en la URL firmada.
5. Guardar `VEXA_CRM_WEBHOOK_BINDINGS_JSON` como variable secreta exclusivamente del servidor. Es una lista de objetos como los ejemplos sintéticos de abajo, nunca un archivo público con credenciales reales. `id` debe contener de16a80 caracteres alfanuméricos, guion o guion bajo; se recomienda generar un identificador aleatorio. Un binding por conexión, hasta1000 por configuración.
6. Configurar la suscripción y firma en la cuenta legítima del proveedor. HubSpot requiere firma v3 y que `portalId` y `appId` de cada evento coincidan con el binding; versiones v1/v2 no tienen fallback. Zendesk requiere un secreto de firma distinto por binding, porque su firma no incluye la URL. No usar un secreto de prueba compartido de proveedor en producción. Elegir eventos relevantes para la conexión y verificar el callback con eventos reales autorizados.
7. Activar `VEXA_CRM_WEBHOOKS_ENABLED=true` tanto en el receptor como en el consumidor CRM. El consumidor continúa usando sus credenciales `VEXA_CRM_CREDENTIALS_JSON` y su disparador autorizado existente. **El webhook no arranca un cron ni ejecuta el importador.** Sin ese disparador no se procesan los hints persistidos. No activar un worker continuo ni pagar proveedores sin autorización.
8. Verificar una entrega202, la fila durable, el siguiente tick del consumidor, su checkpoint y los datos importados. Repetir la misma entrega firmada debe devolver200 y conservar una sola fila. Conectar una API no sustituye esta comprobación real.

Ejemplo sintético — reemplazar todos los valores en el gestor de secretos:

```json
[
  {
    "id": "SYN_hubspot_callback_0001",
    "tenantId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "connectionId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "source": "hubspot",
    "accountId": "123456",
    "appId": "654321",
    "secret": "SYNTHETIC-REPLACE-WITH-PROVIDER-SECRET"
  },
  {
    "id": "SYN_zendesk_callback_0002",
    "tenantId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "connectionId": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    "source": "zendesk",
    "accountId": "SYN-account-configured-in-connection",
    "secret": "SYNTHETIC-REPLACE-WITH-UNIQUE-ZENDESK-SECRET"
  }
]
```

## Contrato, límites y recuperación

- POST con `application/json`, cuerpo crudo sin compresión, máximo1MiB y5segundos para leerlo. HubSpot admite lotes de1a100 eventos; Zendesk un objeto JSON. La firma se valida antes de Auth/SQL. No se registran cuerpo, secreto ni errores del proveedor.
- Firma HMAC-SHA256 y comparación constante; timestamp hasta5minutos antiguo y60segundos futuro. Se rechazan formato inválido, URL distinta y cuenta HubSpot ajena. No se usan encabezados de tenant, cuenta o host aportados por el remitente para seleccionar una conexión.
- El recibo sólo conserva tenant, conexión, secuencia, hora de recepción y SHA256 de timestamp firmado + separador + cuerpo. El timestamp permite que una entrega nueva con cuerpo idéntico solicite otra sincronización. Un reintento exacto devuelve200; un reintento firmado con timestamp nuevo puede generar otro hint, pero la importación conserva su deduplicación propia.
- Admisión y programación se confirman en una transacción y se serializan por conexión. Máximo60 recibos nuevos por minuto; cuota excedida429 con `Retry-After:60`. En cada admisión se podan recibos de esa conexión mayores de10minutos. Es poda por actividad, no borrado automático a los10minutos de una conexión inactiva. No hay datos CRM crudos en esa tabla.
- Se respetan pausa, desconexión, revocación, reconexión requerida y backoff. Un hint no repara una cuenta inválida ni reinicia sus fallos. Un chunk activo conserva su reserva; si ingresa un evento durante el chunk, el consumidor vuelve a dejar trabajo pendiente al terminar.
- Respuestas202/200 significan hint durable aceptado/duplicado, no datos importados ni histórico completo. Firma inválida401; cuenta HubSpot distinta403; JSON/URL inválido400; tamaño413; tipo415; lectura agotada408; configuración/delegación/servicio no disponibles503. Todas incluyen `private, no-store`.
- Para desactivar, retirar el flag del receptor y consumidor. Conservar la tabla mientras se investiga; el polling existente funciona con el flag apagado. Para rotar un secreto, actualizar coordinadamente proveedor y configuración, sin aceptar dos secretos por adivinación ni reducir validaciones. Los reintentos siguen las políticas del proveedor; revisar entregas fallidas desde su consola autorizada.

Fuentes del contrato: [HubSpot, validación de solicitudes v3](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/request-validation) y [Zendesk, verificación de webhooks](https://developer.zendesk.com/documentation/webhooks/verifying/). Las pruebas sintéticas no acreditan que una cuenta concreta emita esa versión de firma ni que tenga la suscripción configurada.
