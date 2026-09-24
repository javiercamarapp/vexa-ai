# Accesos y responsabilidades

No contiene valores de credenciales. Los responsables nominales y destinos están pendientes; no se inventan cuentas o consentimientos. La autorización pública de GitHub no autoriza SQL remoto, gasto de modelos, mensajes ni despliegues productivos.

| Área | Aporte del operador/cliente | Condición de salida |
|---|---|---|
| Supabase VEXA | Project ref/destino, acceso legítimo y aprobación SQL/extensiones/cron; custodio DB. | Migraciones aprobadas, roles mínimos, Auth/Storage y restore comprobados. |
| Hosting | Proyecto/URL/entorno y permiso de despliegue/costo; responsable rollback. | SHA servido y smoke completo, sin confundir READY con aceptación. |
| Auth | Métodos OAuth o correo del proyecto, redirects propios, usuarios/organizaciones/membresías autorizadas. | Login, renovación, selección A/B y revocación reales. |
| HubSpot/Zendesk | Cuenta, scopes, histórico autorizado y credenciales en gestor de secretos. | Conexión real; muestra reconciliada, límites/cobertura y backfill→incremental observados. |
| IA | Proveedor/modelos/política de privacidad/tarifas vigentes y presupuesto aprobado. | Inferencia real con redacción, trazabilidad de intentos/costo y evaluación; precisión no inferida del fixture. |
| Email | Remitente/dominio autorizado, key y webhook en servidor. | Firma/receipts y entrega autorizada; accepted separado de delivered. |
| Push | VAPID legítimo, HTTPS y consentimiento por navegador/dispositivo. | Suscripción, revocación y recepción real autorizadas. |
| Evaluación | Dos anotadores, adjudicador, gold y sponsor reales; custodio de firma, catálogo y claves públicas por tenant; entrevistas consentidas. | Holdout externo y métricas humanas con denominadores; no labels sintéticos como gold. |
| Caso/pitch | Permiso de nombre/logo/datos/citas/métricas, alcance y caducidad. | Sin permiso, únicamente VEXA y SYN, nunca material identificable. |

Usar OAuth o gestor de secretos del entorno con accesos revocables. Verificar primero proyecto/cuenta/tenant; no compartir .env por correo ni pegar claves en documentación. Rotar en origen y consumidores; comprobar que la clave/sesión anterior dejó de funcionar. Mantener registro privado de custodio, fecha, alcance y vencimiento, sin publicar valores.

Estos aportes no ocultan programación pendiente: la revisión bloqueada de notificaciones, la aceptación final de robustez/restore y carga/caos, el smoke remoto y la auditoría integral conservan su estado separado. API/interfaz de retención y evaluación histórica ya están integradas; eso no acredita recuperación cloud ni calidad humana.
