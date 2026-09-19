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

## Modo vigente — cerrar una fase antes de abrir otra

Petición más reciente del usuario (19-sep, 15:54): completar producción/60IDs por fases, terminar e integrar antes de avanzar; después pide múltiples agentes para acelerar. Se concilian ambas instrucciones: **máximo tres agentes dentro de la misma fase**, no tres módulos nuevos. Un escritor por área; examen, regresiones y QA pueden correr en copias propias, integración/promoción sólo por el principal.

Fase activa: **F01-04**. Reutilizar `layout-fixed` y el examen corregido, no reconstruir. Correctivo UI refresh/reset aprobado independientemente; revisión del examen terminó por timeout900s sin veredicto. Cerrar esa revisión, congelar gate, preparar/adoptar candidato, verificar, repetir todos los gates aceptados y controlador, aceptar materialización limpia y publicar mediante publisher. Sólo entonces elegir F01-05 u otra tarea elegible según dependencias; no saltear bloqueos para inflar60/60.

Fuente de estado: runner para aceptación; recibos privados para trabajo/procesos. **9/60** al iniciar esta fase. Laboratorio integrado `5fbf223` conserva CSV→recomendación→intervención→brief→inbox y assign/dismiss revisados, sin convertirlos en tareas aceptadas. No perder ese trabajo ni mezclarlo de golpe con F01-04.

Tanda supervisada120min, hasta24invocaciones,128consumidas previamente bajo techo220; consultar reconciliación real antes de lanzar. No reset de presupuesto/rechazos/STOP. Conserva cero gasto incremental, sin envíos ni cloud no autorizado. Los límites6/8 y prioridades paralelas siguientes son **históricos, sustituidos por este modo**.

## Historial: grafo con propuestas paralelas, integración serial
El DAG `orchestration/graph.json` v4 conserva los55IDs anteriores y añade5 explícitos para notificaciones (F06-08..12):60tareas. No se reinicia ni se falsifican recibos. F04-07 construye el harness, no certifica gold ausente; F07-05 mantiene validación humana. Runbooks ya no esperan datos humanos, pero release sí depende de ambos. Dependencias determinan integración, no impiden preparar módulos independientes.

Cambio operativo autorizado por la petición de agentes: construir **propuestas aisladas** de módulos independientes en paralelo, con unit tests propios y reportes acotados. No son candidatos oficiales aceptados. Control-plane prepara/revisa/congela el examen externo desde requisitos; después `prepare`, adopción de código permitido, `verify`, revisión y `accept` con materialización limpia. Nadie escribe/modifica su propio gate de aceptación. No bajar pruebas para integrar rápido.

Un escritor por área; máximo6agentes concurrentes en la tanda renovada vigente (los límites de4/8 que siguen son históricos). El principal integra interfaces y dependencias, reproduce pruebas y decide keep/revert; no integra por declaración de un agente. No se cambia grafo ni baseline durante una etapa con snapshot congelado. El supervisor serial quedó pausado en checkpoint para esta transición; propuestas trabajan sin modificar raíz.

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

## Renovación posterior de créditos — continuar sin reiniciar
El usuario renovó créditos y pidió continuar normalmente hasta el software completo enterprise y listo para producción, con todas las features/acciones/notificaciones. Se conserva el checkpoint de la hora anterior: siete propuestas en commits locales, no aceptadas ni publicadas como producto. Nueva tanda acotada120min y hasta6agentes, mismo techo acumulado220y cero gasto incremental/cloud/envíos no autorizado. No borrar consumo, rechazos ni límites de verificación. Cuenta, Google real, proveedores y producción siguen requiriendo configuración/actos verificables.

Prioridad operativa:1)cerrar examen y schema F01-03;2)adoptar/matchear contratos canónicos de datos/jobs/métricas/web;3)conectar acciones reales e integración end-to-end;4)superadmin/backoffice/costes y correos enterprise en paralelo disjunto;5)regresiones/revisión/aceptación y publicación del SHA. No seguir multiplicando piezas sin integrarlas. Mantener oráculos independientes y nunca sustituir operación pendiente con HTTP200/arrayvacío.

### Integración y presupuesto reconciliados — corte posterior
Servicio SQL canónico de workspace y laboratorio de integración HTTP/SSR en scopes nuevos aislados; no sustituir tablas núcleo por stores genéricos. Admin UI/backend siguen `construccion/CONTRATO-ADMIN-INTEGRACION.md`. Copias de inputs quedan fijadas por commit antes de modificar otra etapa; si gate/revisor lee un árbol, la corrección se hace en otro, no durante su lectura.

88invocaciones Codex contabilizadas mediante33previas+55recibos; máximo132adicionales bajo220, presupuesto compartido manual/serial. Actualizar desde recibos antes de lanzar: este número es un corte, no una cuota inmutable ni una medida de tokens. F01-03 aún no congelado/aceptado; quedan revisiones de aprobación y fixtures, no resetear por ello toda la construcción.

Preflight de sólo lectura: Vercel `vexa-ai` accesible, aún frameworkOther/root./Node24; ningún proyecto con nombreVEXA visible en la cuentaCLI Supabase y repo sin project-ref cloud. Variables runtime relevantes ausentes en este proceso/archivos habituales; no demuestra ausencia en otros almacenes. No se crearon recursos ni modificó cloud. Configurar proyecto propio/OAuth/presupuestoIA/remitente y verificar despliegue sigue siendo requisito separado.

## Checkpoint histórico: última hora y ampliación superadmin
El usuario indica una hora restante y25%de cuota semanal, pide máximo avance paralelo y añade superadmin tipo Likida/Atiende, cerebro, prospectos, backoffice automatizado y control de gastos IA por rubro. Contrato: `construccion/AMPLIACION-SUPERADMIN.md`. No estaban todos dentro de60IDs: conservarlos y ampliar bajo revisión en checkpoint, nunca cambiar el denominador silenciosamente ni autoaceptar.

**Corte histórico, sustituido por la renovación de120min/máximo6:** hasta8agentes simultáneos en24GiB RAM observados, propiedad disjunta, no DB compartida. Integración sigue serial.36llamadas reservadas para cuatro módulos, examen, schema y ampliaciones/revisiones;151seriales como máximo bajo techo220después de33consumidas al inicio de ola2. Reconciliar consumo real y plazo ANTES de relanzar; límite operativo de la hora guardado en recibo privado y aplicado a nuevas invocaciones. No reiniciar ni cambiar proveedor ante cuota agotada.

Nuevos propietarios: schema sólo0002/0003/0004y platform/db; UI superadmin sólo grupo(superadmin),api/admin,lib/components/tests/superadmin; backend sólo packages/admin y backoffice; templates de correo en paquete separado cuando haya slot. Referencias Likida/Atiende selectivas read-only, sin datos/secretos/marca. Principal verificó autoría GitHub y conserva commits reales periódicos; no sacrificar permisos/dinero/aceptación por agotar quota.

## Ola 2 — ejecución completa solicitada nuevamente el 19-sep
El usuario reiteró todas las60tareas, guía/PRD/audios completos, varios agentes y commits reales atribuidos a su GitHub. No se reduce el objetivo ni se convierten requisitos humanos en resultados automáticos. Principal releyó las transcripciones completas de los seis audios (ambas pasadas), DOCX extraído y PRD35; no nueva escucha ni certificación ASR.

Máximo4agentes concurrentes, worktrees disjuntos, modelo gpt-6-astra por ChatGPT,15min por llamada. Un build y una corrección como máximo por módulo, cada uno con revisión independiente. Presupuesto reservado20llamadas:16para cuatro módulos (build/review/fix/recheck) y4para seguimiento del gate;167seriales restantes después de33consumidas. Cero gasto incremental. Los recibos pueden devolver presupuesto NO consumido tras reconciliar, nunca borran gasto anterior.

| Agente | Propiedad exclusiva | Entrega verificable / reporte |
|---|---|---|
| Ingesta/jobs | packages/ingestion,connectors,jobs | Adoptar983e007; CSV→persistencia→consumidor/checkpoint, PostgreSQL real y fallos. packages/jobs/IMPLEMENTATION.md |
| Análisis/decisiones | packages/gateway,intelligence,problems,metrics,recommendations,interventions,briefs | Adoptar733c47e; evidencia→problemas→métricas→intervención→brief sin duplicar kernel. packages/metrics/IMPLEMENTATION.md |
| Web | Rutas workspace/APIs explícitas, componentes/CSS y lib/workspace en apps/web | Ocho vistas, estados, filtros y servidor autorizado. NO modificar Auth aceptado. apps/web/IMPLEMENTATION-WORKSPACE.md |
| Notificaciones | packages/notifications | Adoptar1a0df4e; SQL durable, preferencias/inbox, recibos y dispositivos. packages/notifications/IMPLEMENTATION-PERSISTENCE.md |

SQL de propuestas reside dentro de cada paquete; nadie aplica migraciones a la DB compartida. Principal resuelve bindings/esquema y promueve serialmente, nunca por un unit test aislado. La autoría corregida F01-03 terminó antes de lanzar el cuarto constructor; no se superó concurrencia4. Supervisor pausado bajo STOP propio en checkpoint: conservar propuesta de examen y ejecutar/revisar antes de congelar, no gastar otro intento rehaciendo lo mismo.

Reductor: principal abre artefactos, reproduce comandos, contrasta interfaces/requisitos, conserva rechazos, exige gate independiente por ID y revalidación de commit limpio. Componentes con limitaciones no cierran requisitos dependientes. Recibos privados `private/parallel-wave-2.json` y `.runtime/wave2-*/`, no publicar. No reescribir estados/recibos para aparentar60/60.

Commits por cambios reales verificados; autor/committer Javier, email noreply asociado a javiercamarapp, publicación determinista del SHA a main privado. No commits vacíos, retrofechas, force-push o dividir cambios artificialmente. Visibilidad de contribuciones privadas del perfil es configuración aparte, no se declara comprobada.

## Secuencia de integración
- [x] Kernel económico limitado y scaffold F01-01 aceptados; preparar infraestructura LOCAL y GitHub privado.
- [x] Auth/membership/callback/selector/logout aceptado con Supabase local y Chrome reales; Google remoto sigue pendiente.
- [x] Schema tenant-aware/RLS/Storage F01-03 aceptado009fd73 con gate real y materialización limpia.
- [ ] Cerrar F01-04 diseño/navegación/estados y después F01-05 CI, sin confundir CI local con ejecución remota.
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
