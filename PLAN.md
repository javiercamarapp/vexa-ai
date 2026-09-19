# VEXA — construcción completa por grafo y agentes

Actualizado: 2026-09-19. Este plan reemplaza los bloques históricos de investigación/preparación conservados en Git. El usuario pidió construir y confirmó **UN MES, no una semana**. Referencia de calendario: 19-oct-2026 si se cuenta desde este encargo; objetivo, no entrega garantizada ni estado alcanzado.

## Objetivo y cierre
Producto completo del PRD y ampliaciones confirmadas: Next.js, Auth/organizaciones/roles, tablas/migraciones/RLS/Storage, importaciones y conectores HubSpot/Zendesk, trabajos durables, OpenRouter multimodelo/evidencia, dinero/prioridad, ocho vistas, intervenciones/medición/brief, notificaciones internas/push/correos para USUARIOS DE VEXA, seguridad/observabilidad/recuperación y entrega operable.

Distinguir dos hitos:
1. **Connection-ready:** código y migraciones integrados, flujo sintético completo probado, configuración y onboarding que permiten aportar credenciales/scopes/mapeos/datos sin programar de nuevo los conectores soportados; configuración ausente produce estado accionable, no éxito ficticio. Tests de fallos, aislamiento y recuperación pasan.
2. **Producción validada:** proyectos propios configurados, dominio/OAuth/remitente verificados, proveedores reales autorizados, smoke remoto con SHA/recibos y prueba de restore. No acreditar esto con mocks o Mailpit. Conectar una API no sustituye permisos legales, DNS o disponibilidad de campos financieros.

El usuario indicó que los datos del cliente llegarán después. No frenar la construcción independiente por eso: usar fixtures rotulados, contratos canónicos y mapeos configurables. No inventar resultados de Senix, probabilidades calibradas, ahorros ni validación comercial.

## Fuentes y APIs permitidas
- `construccion/ALCANCE-CONFIRMADO.md`: relectura completa; `docs/blueprint/02-TRAZABILIDAD-PRD.md`:35secciones.
- `docs/blueprint/01-CONTRATOS-Y-DATOS.md`:SourceEnvelope/interfaces/tablas; `construccion/03-CONTRATOS.md`:API/RBAC/SQL/pipeline.
- `packages/economics/index.mjs`:kernel económico existente; no duplicar fórmulas en UI/LLM.
- `apps/web/`:scaffold aceptado; `supabase/config.toml`:proyecto LOCAL `vexa-local`,5632x.
- `docs/investigacion/integraciones/01-hubspot-zendesk-migracion.md` y `04-openrouter-modelos-privacidad.md`:contratos/proveedores.
- GitHub privado `javiercamarapp/vexa-ai`, Vercel proyecto vacío `vexa-ai`. Acceso CLI observado no equivale a conexión productiva completa. Nunca usar proyectos/secretos de Likida/Atiende/Moni.

## Ejecución: grafo con propuestas paralelas, integración serial
El DAG `orchestration/graph.json` v4 conserva los55IDs anteriores y añade5 explícitos para notificaciones (F06-08..12):60tareas. No se reinicia ni se falsifican recibos. F04-07 construye el harness, no certifica gold ausente; F07-05 mantiene validación humana. Runbooks ya no esperan datos humanos, pero release sí depende de ambos. Dependencias determinan integración, no impiden preparar módulos independientes.

Cambio operativo autorizado por la petición de agentes: construir **propuestas aisladas** de módulos independientes en paralelo, con unit tests propios y reportes acotados. No son candidatos oficiales aceptados. Control-plane prepara/revisa/congela el examen externo desde requisitos; después `prepare`, adopción de código permitido, `verify`, revisión y `accept` con materialización limpia. Nadie escribe/modifica su propio gate de aceptación. No bajar pruebas para integrar rápido.

Un escritor por área; máximo4agentes concurrentes. El principal integra interfaces y dependencias, reproduce pruebas y decide keep/revert; no integra por declaración de un agente. No se cambia grafo ni baseline durante una etapa con snapshot congelado. El supervisor serial quedó pausado en checkpoint para esta transición; propuestas trabajan sin modificar raíz.

### Ola inicial (modelo gpt-6-astra por petición del usuario, ChatGPT OAuth)
| Agente | Propiedad exclusiva | Entrega/reporte |
|---|---|---|
| Ingesta/conectores | packages/ingestion/**, packages/connectors/** | Código normalización/CSV y HTTP read-only; packages/connectors/IMPLEMENTATION.md |
| Gateway/evidencia | packages/gateway/**, packages/intelligence/** | Reserva/políticas/structured output/citas; packages/gateway/IMPLEMENTATION.md |
| Notificaciones | packages/notifications/** | Política, templates, despacho/adaptadores; packages/notifications/IMPLEMENTATION.md |
| Revisor Auth | Sólo revisión del gate corregido F01-02 y temporales de ensayo | Correcciones revisadas; gate congelado y Auth aceptado tras prueba real |
| Constructor Auth (tras terminar revisor) | apps/web/**, packages/platform/**, supabase/migrations/**, package.json y lock raíz de SU worktree | Identidad mínima, SSR/selector/login/logout; packages/platform/IMPLEMENTATION.md |

Ola completada: tres módulos corrigieron5hallazgos y pasaron82tests reproducidos por principal + revisión independiente, conservados en commits locales (ver PROPUESTAS-PARA-INTEGRAR). No son tareas aceptadas. Auth corrigió P1 de Referrer-Policy, pasó gate real local y materialización limpia, y fue aceptado en8f85ee7. Su allowlist de manifests raíz se congeló antes de preparar, no se amplió desde el candidato.

Worktrees/PIDs y recibos de esta ola: `private/parallel-batch-1.json` y `.runtime/team-*/`. No copiar esos archivos ni fuentes privadas a GitHub. Cada propuesta parte de un SHA fijo y no modifica archivos de otro agente. SQL compartido sólo por responsable autorizado, nunca varios resets simultáneos.

## Secuencia de integración
- [x] Kernel económico limitado y scaffold F01-01 aceptados; preparar infraestructura LOCAL y GitHub privado.
- [x] Auth/membership/callback/selector/logout aceptado con Supabase local y Chrome reales; Google remoto sigue pendiente.
- [ ] Completar schema tenant-aware, RLS/Storage, diseño/navigation y CI.
- [ ] Adoptar módulos de ingesta/conectores, implementar persistencia/jobs/consumer y continuidad CRM.
- [ ] Adoptar gateway/evidencia; completar extracción/clustering/snapshots/ranking.
- [ ] Ocho vistas con estados/errores/acciones reales; intervención, medición y brief.
- [x] Incorporar5tareas propias de notificaciones al DAG en checkpoint; no se oculta ampliación ni se aceptan por existir.
- [ ] Implementar/integrar esas5tareas: centro in-app, Web Push, correos, preferencias y outbox durable, sólo usuarios VEXA.
- [ ] QA adversarial, carga, accesibilidad, seguridad, restore, release/onboarding y smoke con conexiones autorizadas.

## Presupuesto, continuidad y paradas
Ola inicial y revisiones/correcciones cerradas:29llamadas acumuladas del programa (8previas +1autor reanudado +20equipo/revisiones). La ampliación de revisiones fue explícita en recibos privados; no se reinició el conteo. Presupuesto próximo:1revisión del cambio de grafo y hasta190llamadas del supervisor, techo total220,120min/54ciclos por tanda. Máximo4propuestas concurrentes; integración/promoción serial. No prometer un daemon de un mes: trabajo continuo por tandas/checkpoints y estado durable.

Construcción sólo suscripción ChatGPT; cero inferencia API pagada para desarrollar. Sin gasto incremental nuevo, contratación, emails/push a personas o datos reales a terceros sin autorización. Mantener límites globales y descontar llamadas/tandas ya usadas antes de reanudar supervisor. STOP/cuota/credencial/seguridad obligan a parar la parte afectada, no a fingir avance; continuar propuestas independientes seguras.

Merge/push periódicos autorizados: únicamente SHA revisado, ramas no divergentes, repo privado, paths/historia sin privados y confirmación SHA remoto. Sin commits vacíos, fechas falsas ni force-push. Actions no se llaman CI verde mientras estén desactivadas/sin ejecución.

## Qué significa calidad enterprise aquí
Aislamiento multi-tenant probado, permisos y auditoría, gestión de secretos, minimización/retención, idempotencia, cuotas, observabilidad, retries/dead-letter, backup/restore, despliegue/rollback y pruebas de flujos reales. No equivale a certificación SOC2/ISO, SLA contractual, SSO/SCIM implementado por mencionar enterprise ni garantía de ausencia total de bugs.
