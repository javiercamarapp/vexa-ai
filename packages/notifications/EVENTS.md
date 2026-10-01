# Eventos y operación de notificaciones

Propuesta F06-12. Se compone sobre F06-09/10 y la implementación validada de F06-11; su aceptación se registra por separado. No acredita aceptación del grafo, revisión independiente de seguridad ni entrega externa.

Los emisores se ejecutan dentro de la transacción SQL de la operación de negocio. Publicar un brief, cambiar la persona responsable de una intervención, finalizar una comprobación de conexión con atención pendiente, finalizar un procesamiento importado con error o activar una membresía produce una referencia interna. No se incorporan texto CRM, importes, emails ni claves al evento. No existe una API pública de emisión ni un destinatario elegido en una petición.

La clave del hecho usa el ID y la versión o intento de la operación. Los replays de la misma operación no crean otro evento lógico. Las preferencias y el acceso actual se comprueban antes de crear destinatarios; el consumidor vuelve a comprobarlos antes del efecto. Un cambio posterior de permisos también afecta al enlace del aviso. No se emiten fallos de la propia cola de notificaciones para evitar una cadena recursiva.

La política más reciente del canal debe estar habilitada y su propietario debe conservar esa autoridad. La invocación privada desde el trigger usa esa política para autorizar el envío, conservando el principal y la transacción de negocio al volver. Este mecanismo requiere su propia revisión SQL independiente; las pruebas funcionales no la sustituyen.

## Configuración

1. Una persona propietaria entra en `/settings/notification-delivery`, autoriza los canales y guarda intervalo, agrupación, máximo de intentos y vigencia. La pantalla comprueba la versión guardada. No autoriza por sí sola mensajes a nadie.
2. Cada persona activa el canal y los eventos deseados en `/settings/notifications`. Web Push requiere además el registro explícito del dispositivo en `/notifications/push`.
3. El operador configura los servicios descritos en `EMAIL.md` y `PUSH.md` y ejecuta el consumidor con las credenciales/delegación de VEXA. El módulo integrado `transports.mjs` carga email y push automáticamente: no hay que escribir un módulo de integración para conectar cuentas.
4. `node OUT/packages/notifications/daemon.mjs --once` procesa un ciclo; sin `--once` procesa hasta recibir SIGTERM/SIGINT. Usa el build durable existente. Cierra los recursos de ambos transportes al terminar. El override privado `VEXA_NOTIFICATION_TRANSPORT_MODULE` sigue reservado a configuración de servidor.

La pantalla distingue configuración local de entrega confirmada. No llama al proveedor para mostrar preferencias. Un canal sin configurar queda bloqueado, y ningún dato ausente se sustituye por una entrega exitosa. Activar una política o preferencia no manda avisos históricos retroactivamente. Un brief nuevo sobre información histórica sí puede generar su aviso normal.

`membership.invited` continúa sin emisor: el flujo de invitaciones del equipo conserva su canal y autorización propios, fuera de estos emisores. La activación de una membresía sólo genera bienvenida si en ese momento ya hay política, preferencias y acceso. El flujo de invitaciones no se simula con una dirección CRM.

Pendientes externos: migraciones cloud con aprobación legítima, credenciales y rol de servicio de email, remitente/dominio verificado, VAPID/configuración, consumidor desplegado y activo, consentimiento real de cada dispositivo, y pruebas autorizadas con los proveedores. Cualquier revisión técnica pendiente se conserva aparte de esos accesos.

## Un ciclo HTTP en el despliegue web

`POST /api/internal/notifications` ejecuta un único ciclo del consumidor durable en el runtime Node del despliegue web (`maxDuration=60`). Es una alternativa al daemon CLI para un operador o programador externo autorizado. No instala ni activa cron, no mantiene un bucle después de la petición y no configura servicios de pago.

La petición debe llevar `Authorization: Bearer <VEXA_WORKER_TRIGGER_SECRET>` y cuerpo vacío o exactamente `{}`. Reutiliza el secreto de operador existente (mínimo 32 caracteres); no se crea otra clave. No admite query, cabecera Origin, cookies como autorización ni campos de tenant, destinatario, canal, módulo o credenciales en el cuerpo. No exponer ese secreto en JavaScript del navegador ni variables NEXT_PUBLIC. La comparación del bearer usa hashes de longitud fija y timingSafeEqual.

El servidor necesita la misma configuración del worker: `VEXA_DATABASE_URL`, opcionalmente `VEXA_DATABASE_CA_PEM`, `VEXA_SUPABASE_URL`, `VEXA_SUPABASE_ANON_KEY`, `VEXA_WORKER_EMAIL`, `VEXA_WORKER_PASSWORD` y `VEXA_WORKER_USER_ID`. Para elegir la organización desde delegaciones autorizadas, configurar `VEXA_WORKER_DISPATCHER=enabled`; la alternativa operativa existente es `VEXA_WORKER_TENANT` fijado en servidor. El usuario dedicado y las delegaciones/migraciones deben existir: poner estas variables no concede permisos. La entrada HTTP importa explícitamente el adaptador de base de datos de Next y lo propaga a los scopes Push; no depende de archivos compilados por el comando CLI.

Para email y Push se usan exactamente las configuraciones documentadas en `EMAIL.md` y `PUSH.md`, con las factorías integradas. Esta ruta ignora `VEXA_NOTIFICATION_TRANSPORT_MODULE`; no carga módulos personalizados. El timeout por operación de transporte es 5 segundos y el plazo del ciclo es 40 segundos, además de un máximo de 5 segundos para el cuerpo. Al vencer el plazo o desconectarse el cliente se cancelan las señales de envío y se impiden nuevos pasos de base de datos del consumidor. Antes de responder por cancelación o timeout se reservan hasta 10 segundos adicionales para drenar el trabajo y su cierre (máximo propio de 55 segundos incluyendo cuerpo, bajo los 60 de la plataforma). Si una factoría ya iniciada termina durante ese margen, su resultado se cierra sin empezar consumo; el bloqueo local sigue ocupado hasta recogerlo. Una dependencia que no responda ni durante ese margen recibe 503, sin certificar su cierre: no se depende de que Vercel ejecute trabajo después de responder. La señal no garantiza cancelar SQL que el servidor ya hubiera recibido; sus timeouts/leases y la recuperación de uncertain siguen siendo necesarios. El handler siempre intenta cerrar el runtime adquirido y los recursos propios de los transportes. El pool compartido de la aplicación mantiene su ciclo de vida existente.

Respuestas sin datos de negocio: `200 {"code":"IDLE"}` cuando no se adquirió trabajo; `200 {"code":"CYCLE_COMPLETED"}` cuando terminó un ciclo. **CYCLE_COMPLETED no significa entregado**: puede haber persistido una decisión blocked, retry o uncertain; el outbox y los recibos siguen siendo la autoridad. `401` rechaza credenciales, `400/408` rechaza entradas/plazo del cuerpo, `409` indica otro ciclo local pendiente y `503` indica fallo/cancelación/configuración o cierre fallido. No se devuelven errores SQL, endpoints ni cuentas. Una nueva invocación vuelve a pasar por la cola, sus leases, permisos y recuperación de uncertain; no fuerza un reenvío.

Operación manual con un secreto ya cargado en el entorno del operador, sin escribir su valor en el comando:

```sh
curl --request POST --fail-with-body \
  --header "Authorization: Bearer $VEXA_WORKER_TRIGGER_SECRET" \
  "$VEXA_APP_ORIGIN/api/internal/notifications"
```

Configurar la URL y el header en un programador externo requiere autorización de operación/costos independiente. Esta propuesta no lo activa. Una prueba local del handler no acredita que Vercel haya desplegado la ruta ni entrega real de proveedor.
