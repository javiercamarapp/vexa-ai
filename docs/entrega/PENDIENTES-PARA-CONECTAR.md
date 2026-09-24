# Lo que falta para conectar y validar

Todavía existen bloqueos técnicos/de revisión, por lo que no se afirma que baste pegar APIs para todo el producto. El estado técnico y formal está en construccion/ESTADO-CONSTRUCCION.json; producción sigue sin validar.

## Bloqueos que no son credenciales

- F06-09: un filtro automático de posible riesgo de ciberseguridad interrumpió la revisión; no hay dictamen final. El examen no se reintenta ni transfiere. Sus propuestas de entrega por correo/push y eventos no están publicadas ni aceptadas. No se corrige este bloqueo pegando una API.
- ReleaseF08-01: inventario y control integrados/revisados; destino y evidencias completas pendientes. F08-02: smoke y control revisados, integración del supervisor pendiente. Incompatibilidad de migración0028 con PostgreSQL gestionado en reparación. Son pendientes técnicos explícitos.
- Carga, caos y recuperación ya tienen ejecutores/control portables revisados. Sus mediciones son locales y conservan sus límites.
- F06-07 y cadena final: revisión visual humana, aceptación formal y cierre global conservan sus requisitos. El ensayo de un agente no se llama ensayo humano.

## Aportes externos y trabajo ejecutable posterior

| Aporte | Titular | Después de aportarlo |
|---|---|---|
| Acceso/aprobación legítima SQL del proyecto VEXA, destino y política de backup | Operador Supabase/Javier | Aplicar migraciones revisadas, roles/Storage/Auth, programaciones y prueba de restore; nunca evadir la aprobación por otro canal. |
| Entorno/URL y autorización de despliegue/costo | Operador hosting | Generar manifiesto del SHA final, configurar secretos, compilar/desplegar y ejecutar smoke real completo. |
| Métodos de login, remitente SMTP/redirects, usuarios y organizaciones | Titular Auth | Conectar correo/OAuth, permisos, renovación y revocación reales. |
| Cuentas HubSpot/Zendesk, scopes e histórico autorizado | Titular CRM/responsable de datos | Configurar conexión y fecha inicial, importar histórico disponible y reconciliar muestra contra export independiente antes de pasar a incremental. |
| Cuenta/modelos, privacidad, tarifas y presupuesto de inferencia | Titular IA | Habilitar extracción con presupuesto durable; comprobar respuestas/citas/costos reales y todos los estados de error. |
| Gold legítimo, dos anotadores/adjudicación y custodio externo | Cliente/responsable de evaluación | Evaluar candidatos con holdout externo, firma y revisión; seleccionar o revertir una configuración autorizada desde la UI. |
| Permisos de caso/logo/citas/métricas y participantes del piloto | Cliente/presentador | Ensayo humano, estudio de comprensión/acción y pitch. Sin permiso, sólo VEXA y datosSYN. |

Las variables por nombre están en [Entorno](../../apps/web/ENVIRONMENT.md). Usar gestor de secretos, OAuth o las configuraciones legítimas del proveedor; no enviar claves por documentos ni commit. El worker necesita identidad/delegación y programación; el frontend por sí solo no mantiene un consumidor activo.

## Histórico y mejora de agentes

Los conectores recuperan lo que permita la cuenta y conservan checkpoints, revisiones y deduplicación. HubSpot no inventa un snapshot histórico que su API no exponga; Zendesk conserva cursor/ventanas. El histórico autorizado puede pasar por redacción, extracción, problemas/métricas, cohortes de desarrollo y feedback. Las fuentes retiradas no reaparecen en los exports de desarrollo.

La selección de candidatos exige evaluación independiente firmada ligada al tenant, configuración y código compilado. El feedback silver no se convierte en gold por renombrarlo; un resultadoSYN no prueba calidad de un LLM. La mejora consiste en evaluar y seleccionar versiones verificadas, con rollback y supervisión; no en reescribir o entrenar automáticamente el sistema sin autorización.
