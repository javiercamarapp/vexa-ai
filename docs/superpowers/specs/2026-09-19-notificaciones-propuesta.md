# Notificaciones, push y correos VEXA — ampliación solicitada

**Estado:** funcionalidades solicitadas explícitamente; propuesta de diseño pendiente de confirmar destinatarios. NO implementado ni añadido al grafo activo. No confundir este documento con un envío realizado.

## Confirmado por el usuario
- Producto completo con tablas, conexiones, APIs e integraciones/MCP pertinentes.
- Notificaciones push de punta a punta.
- Correos con plantillas bien hechas.
- Calidad de ingeniería y producto comparable a Likida y Atiende, no sólo una maqueta.

## Decisión que cambia alcance y privacidad
¿Avisos sólo a usuarios autorizados de VEXA dentro de cada empresa, o también a clientes finales de esas empresas?

**Recomendación:** usuarios del panel; no contactar automáticamente consumidores, titulares de conversaciones o contactos importados. Cualquier comunicación a clientes finales requiere otro contrato de consentimiento, destinatarios y permisos. El producto original prohíbe acciones externas autónomas.

## Propuesta técnica para aprobar
### Canales
- Centro de notificaciones dentro de VEXA: leído/no leído, filtros, enlaces y estados reales.
- Web Push navegador/PWA: service worker, VAPID, permiso explícito, suscripción por dispositivo/usuario, cancelación, compatibilidad documentada. No significa app nativa iOS/Android ni entrega garantizada en todos los navegadores.
- Correo transaccional: adaptador de proveedor; propuesto Resend con credenciales y dominio PROPIOS de VEXA. Desarrollo contra Mailpit local, sin envío externo. El proveedor final y presupuesto se configuran antes de producción.

### Eventos propuestos
Invitación y acceso, brief semanal disponible, intervención asignada/próxima a vencer, integración revocada, procesamiento detenido y riesgo que cruza un umbral configurado. No habilitar un interruptor sin emisor real. Un evento técnico completado no genera spam por defecto. Los correos de Auth sólo se habilitan si el correspondiente método de acceso existe; no ofrecer recuperación de contraseña para una cuenta sólo Google.

### Persistencia y API
Entidades propuestas: preferencias, eventos, notificaciones de usuario, suscripciones push, outbox y tentativas/recibos del proveedor. Tenant y destinatario derivados de identidad/membership, RLS e índices/uniques para deduplicar; APIs de preferencias, leído, registro/revocación de dispositivo y webhook firmado del proveedor. No endpoints de envío arbitrario a direcciones suministradas por el navegador.

### Despacho durable
Outbox transaccional, reclamación con lease/fencing, idempotencia por evento/destinatario/canal, timeout/backoff acotado, dead-letter y reconciliación. Revalidar permisos/preferencias antes de enviar. Registrar estados diferentes: encolado, aceptado por proveedor, entregado cuando exista recibo verificable, fallido/rebotado/suprimido. No llamar entregado a un HTTP202 ni leído a una apertura inferida. Un timeout de envío queda incierto hasta reconciliar; no garantizar exactamente una entrega por Internet.

### Plantillas
Marca propia VEXA, tipografía de sistema, asunto/preheader, jerarquía y CTA útil, HTML responsive con CSS compatible y alternativa de texto. Escape de variables/URLs, valores monetarios desde snapshots versionados, desconocidos explícitos. Preferencias y motivo del aviso visibles; baja para avisos opcionales, sin confundirlos con mensajes indispensables de seguridad. Sin tracking de aperturas por defecto.

### Seguridad y anti-ruido
Destinatarios activos con permiso para abrir el recurso; revocación antes de dispatch y al abrir el enlace. Sin PII/importes sensibles en pantalla bloqueada por defecto. No se puede retirar un correo/push ya entregado: minimizar payload y reautorizar al hacer clic. Validar endpoints push, bloquear SSRF/redirects internos; claves VAPID privadas sólo servidor. Webhooks con firma, protección de replay y asociación al tenant correcto. Umbrales/digest/horarios configurables; recuperación de incidentes no reinicia límites de frecuencia de forma que genere spam.

## Verificación obligatoria
1. Migraciones y RLS A/B reales; usuario revocado no recibe nuevos despachos.
2. Emisor de negocio → outbox → worker → proveedor/dispositivo → CTA autorizado, no sólo plantilla renderizada.
3. Duplicado, dos workers concurrentes, caída tras aceptación del proveedor,429,5xx, suscripción410, webhook repetido/falso y cola agotada.
4. Preview móvil/escritorio, HTML escapado, contraste, textos alternativos, enlaces y versión de texto. Compatibilidad Gmail/Outlook/Apple Mail no se afirma sin prueba correspondiente.
5. Push opt-in/denegado/revocado, logout/cambio de tenant en el mismo dispositivo y payload minimizado.
6. Smoke real en destinatario/dispositivo de ensayo autorizado y dominio verificado. Mailpit/local no equivale a entregabilidad de producción. SPF/DKIM/DMARC y comprobación de dominio pendientes del titular.

## Referencias revisadas selectivamente, read-only
- Likida `src/lib/likida/agentes/notificaciones.ts`, líneas1–1077: emisores realmente conectados, destinatarios/roles, preferencias, anti-ruido y reclamación. No revisión integral de1178líneas ni de producción.
- Atiende `packages/domain-restaurantes/src/email-dispatch.ts`: outbox, clave idempotente, reintentos y fallo explícito sin credenciales.
- Atiende `packages/domain-restaurantes/src/emails/order-templates.ts`: escape, plantilla estructurada y versión de texto.

Se estudian patrones, no se copian claves, bases, marcas o código. No asumir que toda referencia carece de defectos ni reutilizar sus números/estados sin definir el contrato VEXA. Integrar tareas y gates propios después de aprobar el diseño y en checkpoint del controlador; no modificar un DAG durante una ejecución activa.
