# Conexión y validación externa pendientes — Rovaq AI

Actualización8-oct:60/60 alcances técnicos integrados y28/60 aceptaciones formales. HubSpot ya tiene acceso y sincronización autorizados; no volver a pedir API, scopes de correo/archivos, Tracker, febrero ni los20casos. Sigue pendiente la referencia independiente para F03-01 y su ejecución formal. Ver [estado vigente](../ESTADO-VIGENTE.md) y [faltantes concretos para David](PERMISOS-PARA-DAVID.md). El histórico disponible localmente requiere integración y aprobación específica de cada carga; no una nueva petición al cliente.

## Trabajo técnico y operativo que sigue abierto

- Auditoría final: controles Auth/UI/SQL en fase6 y nueva serie completa de capacidad tras consolidación;10K/50K sobre aff0517 ya pasaron.
- Seguridad global: cierre local F07-01 de17/17 componentes verificado; no existe el antiguo bloqueo documental de revisión. Aceptación formal sigue detrás de las dependencias reales del grafo.
- Recuperación y operación: restore local actual PASS; barrera Storage administrada, ensayo gestionado, consumidores permanentes, alertas y responsables pendientes.
- Validación humana y entrega: participantes reales, guía, pitch, gold independiente y recepción; no sustituibles con pruebas sintéticas.

## Aportes que se pueden reunir ahora

| Qué solicitar | Dónde lo tiene el titular | Para qué lo usa VEXA y cómo se verificará |
| --- | --- | --- |
| Cliente OAuth Google y acceso al proyecto de autenticación | Administrador del proyecto Google y del Supabase propio de VEXA | Inicio con Google, redirects de producción, consentimiento, sesión y revocación reales. |
| Proveedor de correo, dominio/remitente verificado, credenciales SMTP y acceso DNS | Responsable del dominio y cuenta de correo transaccional | Aplicar las 13 plantillas Auth con membrete y entregar mensajes de acceso y avisos autorizados; verificar recepción, rebotes y supresiones. |
| Configuración Web Push/VAPID, contacto operativo y dispositivos con consentimiento | Operador VEXA; cada usuario permite avisos en su navegador | Registrar dispositivos, enviar avisos autorizados y validar entrega/lectura/revocación reales. Las claves VAPID se pueden generar paraVEXA; no son una API que el cliente deba comprar. |
| Referencia independiente HubSpot, sin volver a pedir credenciales | Titular autorizado y revisor del ensayo | La cuenta/app y el continuo ya existen. Cotejar el conjunto del gate contra UI/export de origen independiente y conservar evidencia de roles, visibilidad y asociaciones. |
| Subdominio Zendesk, credencial y acceso incremental autorizado | Administrador Zendesk, centro de administración/API | Leer tickets/comentarios/usuarios y cambios; comprobar cobertura, cursores y20 referencias independientes. |
| Registro de webhooks y secretos por cuenta cuando aplique | Administradores CRM | Vincular eventos firmados a la cuenta autorizada, deduplicar y reanudar sincronización. Receptor ya implementado; activación real pendiente. |
| Ventana histórica, equivalencias HubSpot→Zendesk y export de órdenes/productos/refunds/costos | Responsable de datos/operaciones/finanzas | Cargar lo disponible, comprobar faltantes y duplicados, calcular importes con procedencia y mostrar lo desconocido sin inventarlo. |
| Cuenta OpenRouter, modelos permitidos, política de datos y presupuesto de inferencia | Titular IA/infraestructura y responsable de privacidad | Activar extracción/embeddings con límites de gasto, citas y abstención; comprobar calidad/costos con proveedor real. La suscripciónCodex no paga estas llamadas. |
| Usuarios, roles, responsables, programación y política de backup/retención | Javier y operador VEXA con responsable del cliente | Delegar consumidores, programarlos y ensayar recuperación y revocación. El frontend abierto no mantiene un worker activo. |
| Datos autorizados, gold/holdout, dos anotadores y sponsor | Responsable del cliente/evaluación | Medir calidad y comparar configuraciones con evidencia independiente; resolver identidades ambiguas y revisar recomendaciones. |
| Permisos de materiales finales y participantes del piloto | Javier y titulares de derechos/datos | Rovaq AI es la marca de la interfaz actual; verificar derechos del material final y realizar ensayo humano de comprensión, uso y pitch. |

Usar OAuth, gestor de secretos o la configuración del proveedor. No entregar contraseñas/claves en documentos públicos ni commits. Los nombres de variables y límites están en [Entorno](../../apps/web/ENVIRONMENT.md), [Eventos](../../packages/notifications/EVENTS.md), [Correo](../../packages/notifications/EMAIL.md) y [Push](../../packages/notifications/PUSH.md). No se necesita acceso a cuentas Likida/Atiende para operarVEXA.

## Histórico y mejora supervisada

Los conectores recuperan lo que permita la cuenta y conservan checkpoints, revisiones y deduplicación. HubSpot no puede proporcionar una historia que su API no exponga. Se debe reconciliar una muestra y los conteos/cobertura antes de dar por completa la carga y pasar a incremental.

El histórico autorizado recorre redacción, extracción, problemas, métricas y evaluación. La mejora consiste en comparar y seleccionar configuraciones con holdout independiente y posibilidad de rollback. Feedback automático no se convierte en gold humano, y resultados sintéticos no prueban calidad del LLM. VEXA no modifica autónomamente el código ni ejecuta acciones sobre el CRM del cliente.

El último smoke remoto SYN completo corresponde al producto desplegado `f893851`: 8/8 fases, ocho vistas y limpieza comprobada por MCP. [Evidencia remota y límites](SMOKE-REMOTO-2026-10-01.md). La lectura anónima del8-oct observa `b0be6df`, sin smoke autenticado completo; la composición local `6e8b2b4` no está desplegada. [Estado actual de los20rubros](AUDITORIA-20-RUBROS-2026-10-08.md): capacidad final y actos humanos siguen pendientes; la revisión global F07-01 ya pasó localmente.
