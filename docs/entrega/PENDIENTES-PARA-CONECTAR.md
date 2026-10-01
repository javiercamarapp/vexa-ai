# Lo que falta para conectar y validar

Corte 1-oct:59/60 técnicas y28 aceptadas formalmente tras el cierre de interfaz. Producción pendiente. Correo, Push, outbox y eventos ya están implementados, revisados y publicados; las antiguas referencias a bloqueo de revisión de F06-09 quedaron superadas por sus cierres posteriores. No falta escribir esos adaptadores.

Todavía falta cerrar seguridad global F07-01 y su matriz integral, capacidad actual de 50K/150K y los actos externos/formales de la auditoría de 20 rubros. El inventario actual de 2.156 fuentes está conciliado, una nueva prueba de 10K pasó revisión independiente, el smoke remoto SYN actual pasó 8/8 y la recuperación/rollback locales pasaron; cada resultado conserva sus límites. Por tanto, **aún no se afirma que sólo baste pegar APIs**. El estado verificable está en [ESTADO-CONSTRUCCION](../../construccion/ESTADO-CONSTRUCCION.json).

## Trabajo técnico y operativo que sigue abierto

- Capacidad: 50K/150K pendientes; las nuevas observaciones de `66a25c1` requieren una serie desde 10K. No basta una clave para resolver una medición incompleta.
- Cierre global: F07-01 y matriz integral pendientes; revisión automática rechazada, sin dictamen de seguridad.
- Operación: elegir y configurar la ejecución programada, identidad delegada, destino de alertas y responsables; ensayar recuperación gestionada y entrega real.

El [backlog](BACKLOG.md) asigna responsable y condición de cierre. Recuperación local y smoke remoto SYN ya están comprobados; sus límites no se trasladan a producción.

## Aportes que se pueden reunir ahora

| Qué solicitar | Dónde lo tiene el titular | Para qué lo usa VEXA y cómo se verificará |
| --- | --- | --- |
| Cliente OAuth Google y acceso al proyecto de autenticación | Administrador del proyecto Google y del Supabase propio de VEXA | Inicio con Google, redirects de producción, consentimiento, sesión y revocación reales. |
| Proveedor de correo, dominio/remitente verificado, credenciales SMTP y acceso DNS | Responsable del dominio y cuenta de correo transaccional | Aplicar las 13 plantillas Auth con membrete y entregar mensajes de acceso y avisos autorizados; verificar recepción, rebotes y supresiones. |
| Configuración Web Push/VAPID, contacto operativo y dispositivos con consentimiento | Operador VEXA; cada usuario permite avisos en su navegador | Registrar dispositivos, enviar avisos autorizados y validar entrega/lectura/revocación reales. Las claves VAPID se pueden generar paraVEXA; no son una API que el cliente deba comprar. |
| Cuenta/app HubSpot con lectura autorizada y sus scopes | Administrador HubSpot, configuración de integración/app | Importar conversaciones/mensajes y continuidad histórica; reconciliar20 referencias contra export/UI independiente. |
| Subdominio Zendesk, credencial y acceso incremental autorizado | Administrador Zendesk, centro de administración/API | Leer tickets/comentarios/usuarios y cambios; comprobar cobertura, cursores y20 referencias independientes. |
| Registro de webhooks y secretos por cuenta cuando aplique | Administradores CRM | Vincular eventos firmados a la cuenta autorizada, deduplicar y reanudar sincronización. Receptor ya implementado; activación real pendiente. |
| Ventana histórica, equivalencias HubSpot→Zendesk y export de órdenes/productos/refunds/costos | Responsable de datos/operaciones/finanzas | Cargar lo disponible, comprobar faltantes y duplicados, calcular importes con procedencia y mostrar lo desconocido sin inventarlo. |
| Cuenta OpenRouter, modelos permitidos, política de datos y presupuesto de inferencia | Titular IA/infraestructura y responsable de privacidad | Activar extracción/embeddings con límites de gasto, citas y abstención; comprobar calidad/costos con proveedor real. La suscripciónCodex no paga estas llamadas. |
| Usuarios, roles, responsables, programación y política de backup/retención | Javier y operador VEXA con responsable del cliente | Delegar consumidores, programarlos y ensayar recuperación y revocación. El frontend abierto no mantiene un worker activo. |
| Datos autorizados, gold/holdout, dos anotadores y sponsor | Responsable del cliente/evaluación | Medir calidad y comparar configuraciones con evidencia independiente; resolver identidades ambiguas y revisar recomendaciones. |
| Logo VEXA definitivo, permisos de materiales y participantes del piloto | Javier y titulares de derechos/datos | Completar marca y ensayo humano de comprensión, uso y pitch; no presentar fixtures como resultados reales. |

Usar OAuth, gestor de secretos o la configuración del proveedor. No entregar contraseñas/claves en documentos públicos ni commits. Los nombres de variables y límites están en [Entorno](../../apps/web/ENVIRONMENT.md), [Eventos](../../packages/notifications/EVENTS.md), [Correo](../../packages/notifications/EMAIL.md) y [Push](../../packages/notifications/PUSH.md). No se necesita acceso a cuentas Likida/Atiende para operarVEXA.

## Histórico y mejora supervisada

Los conectores recuperan lo que permita la cuenta y conservan checkpoints, revisiones y deduplicación. HubSpot no puede proporcionar una historia que su API no exponga. Se debe reconciliar una muestra y los conteos/cobertura antes de dar por completa la carga y pasar a incremental.

El histórico autorizado recorre redacción, extracción, problemas, métricas y evaluación. La mejora consiste en comparar y seleccionar configuraciones con holdout independiente y posibilidad de rollback. Feedback automático no se convierte en gold humano, y resultados sintéticos no prueban calidad del LLM. VEXA no modifica autónomamente el código ni ejecuta acciones sobre el CRM del cliente.

El último smoke remoto SYN completo corresponde al producto desplegado `f893851`: 8/8 fases, ocho vistas y limpieza comprobada por MCP. [Evidencia remota y límites](SMOKE-REMOTO-2026-10-01.md). Los commits posteriores de controles y documentación no representan un nuevo despliegue de producto. [Estado de los 20 rubros](AUDITORIA-20-RUBROS-2026-10-01.md): ninguna API sustituye la capacidad pendiente, la revisión global ni los actos humanos requeridos.
