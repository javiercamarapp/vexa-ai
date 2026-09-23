# VEXA — construcción completa por grafo y agentes

Actualizado: 2026-09-20. Este plan reemplaza los bloques históricos de investigación/preparación conservados en Git. El usuario pidió construir y confirmó **UN MES, no una semana**. Referencia de calendario: 19-oct-2026 si se cuenta desde este encargo; objetivo, no entrega garantizada ni estado alcanzado.

## Checkpoint vigente —43/60 técnicamente listas; 25 aceptadas en el grafo

F06-08 integra el centro de notificaciones, preferencias propias con control de versiones, lectura idempotente y enlaces a recursos autorizados. API/navegador15/15, gate oficial y aceptación Git limpia22/22, matriz SQL381/381. Tipos, lint, compilación, autenticación, navegación y controlador125/125 verificados. Alcance: construccion/F06-08-CIERRE-TECNICO.md. Siguiente cierre:F06-09, outbox y consumidor de notificaciones.

El total suma25 aceptadas por el runner y dieciocho técnicamente listas con dependencia/validación externa pendiente: seis F03, seis F05 y F06-01..06. Restan17 tareas de construcción y la auditoría integral de20 rubros. El cierre solicitado exige todo el software técnico de punta a punta, incluida ingesta histórica CRM y evaluación de agentes; sólo cuentas, datos, credenciales y aprobaciones externas pueden quedar pendientes. No acredita producción. Registro: construccion/ESTADO-CONSTRUCCION.json.

Tiempo sin límite autorizado; presupuesto conservado al corte de este checkpoint:323/360 invocaciones acumuladas, máximo3 agentes y cero gasto externo nuevo. Caffeinate mantiene pantalla y sistema despiertos con tapa abierta; no garantiza supervivencia de la sesión. Publicación mediante publisher autorizado, Actions desactivadas y SHA remoto verificado. Los apartados siguientes son históricos.

## Historial — F02 completa,17/60

F02 en6/6, compilada y probada. F02-05 (`9e738b9`) y standalone06 (comportamiento existente en `63b9725`) pasaron27grupos cada verifyNode22/acceptGitlimpioNode26; cuatro regresiones y cuatro jobs CI verdes, producto intacto y cleanup verificado. Publicar cierre06 antes de abrirF03. IncidenciaCSV anterior no reproducida sigue documentada, sin causa demostrada; examen reforzado y seguimiento en auditoría integral. No producción remota ni Actions habilitado. Presupuesto acumulado200/220; deadline vigente00:00 del21-sep UTC−06, sin reset ni gasto nuevo.

## Historial — F02-05 aceptado,16/60

F02 en5/6. Producto `9e738b9`: revisión independiente, verifyNode22 y acceptGitlimpioNode26 con27grupos cada uno; regresiones01–04 y cuatro jobs CI verdes, fuentes/control intactos y limpieza verificada. Publicar mediante publisher autorizado antes del cierre06. IncidenciaCSV anterior no reproducida: causa desconocida preservada, examen reforzado con recibo/precondiciones y seguimiento en auditoría final. Sólo después de aceptar/probar/publicar06 se anunciará17/60. Sin producción remota ni Actions habilitado.

## Historial — F02-04 aceptado,15/60

F02 en4/6. Producto `26a0d9f`: revisión independiente, verify04, regresiones01/02/03 y cuatro jobs CI pass; huellas intactas y limpieza verificada. Padre interrumpido reconciliado mediante evidencia original en recibo nuevo; accept limpio exit0. Publicar mediante publisher autorizado antes de integrar05. Faltan05/06 y pruebas remotas; no anunciar17/60 hasta aceptar, compilar, probar y publicar toda F02.

## Historial — F02-03 aceptado,14/60

F02-03 aceptado en `f0eb856`: nuevo verify y accept limpio, F02-01/02 y cuatro jobs CI pasaron; fuentes/control intactos, cleanup verificado. F02 está3/6; faltan04–06. Publicar este cierre real antes de la siguiente integración. El rechazo y las correcciones relatados a continuación se conservan como historia, no como bloqueo vigente de03.

### Historial del cierre03

Una sola tarea en cierre:03. La revisión inicial aprobó su examen/producto, pero la regresión global rechazó el candidato por lint React y siete enlaces dentro del menú principal que exige seis. Corregir producto sin cambiar esos oráculos: carga inicial asíncrona cancelable y enlace de importaciones en navegación de gestión. El smoke offline además encontró un503 esperado de Auth ausente en la API descubierta desde el bundle; su excepción exacta requiere revisión externa, mantiene escaneo de secretos y no permite5xx arbitrarios. Se conserva también un aborto intermitente de navegación F01-04 para investigar, no esconder.

No abrir más módulos mientras haya una aprobación pendiente de integrar. Cada resultado termina en una decisión concreta; después de aceptar, publicar y verificar SHA remoto. Reusar pruebas inmutables, revisar deltas y ejecutar primero lint/regresiones afectadas. F02 completa son6/6 y17/60 global, todavía no alcanzados.

## Último cierre aceptado — F02-02

**13/60 aceptadas**, F02-02 `791c854`: carga directa Storage y confirmación atómica import/job/outbox. La regresión de matriz se corrigió mediante extensión externa independiente, sin cambiar producto ni quitar controles. Nuevos verify/accept limpios y regresiones de las12tareas anteriores+controlador110 pasaron. Historial de rechazo conservado. F02-03/04 siguen como propuestas; tres agentes separan producto03, examen03 y canonicalización04. Se conserva todo el banco y el alcance completo.

Últimas órdenes: continuar loop, integrar blueprint+audios de punta a punta y dejar sólo credenciales/autorizaciones externas; el hito inmediato es **connection-ready completo**, no maqueta ni integraciones pendientes de programar. Producción validada sigue siendo un hito distinto. Verceldeploy propio autorizado; gastos adicionales/inferencia no. Supabasecreado con autorización10USD/mes; SQLremoto requiere aprobacióninteractiva, no eludirla.

Renovación explícita de todo el día del20-sep: hasta00:00 del21-sep (UTC−06), techo acumulado220, base144+asignaciónF02 de76; máximo3agentes concurrentes y cero gasto nuevo. Registro privado atómico de llamadas, sin reset ni renovación automática;191 llamadas acumuladas iniciadas al redactar este corte. Caffeinate no garantiza ejecución desatendida. La prórroga histórica vinculada erróneamente al permiso económico fue corregida y cancelada; no reutilizarla. Cifras y ventanas anteriores abajo son históricas.

## Objetivo y cierre
Producto completo del PRD y ampliaciones confirmadas: Next.js, Auth/organizaciones/roles, tablas/migraciones/RLS/Storage, importaciones y conectores HubSpot/Zendesk, trabajos durables, OpenRouter multimodelo/evidencia, dinero/prioridad, ocho vistas, intervenciones/medición/brief, notificaciones internas/push/correos para USUARIOS DE VEXA, seguridad/observabilidad/recuperación y entrega operable.

Distinguir dos hitos:
1. **Connection-ready:** código y migraciones integrados, flujo sintético completo probado, configuración y onboarding que permiten aportar credenciales/scopes/mapeos/datos sin programar de nuevo los conectores soportados; configuración ausente produce estado accionable, no éxito ficticio. Tests de fallos, aislamiento y recuperación pasan.
2. **Producción validada:** proyectos propios configurados, dominio/OAuth/remitente verificados, proveedores reales autorizados, smoke remoto con SHA/recibos y prueba de restore. No acreditar esto con mocks o Mailpit. Conectar una API no sustituye permisos legales, DNS o disponibilidad de campos financieros.

**Compuerta final adicional solicitada el20-sep:** después de60/60, auditoría integral y reauditoría de correcciones con testers especializados. Inventariar y probar botones/rutas/estados, flujos completos UI→API→DB/Storage→jobs→agentes→resultado, roles/tenants, OAuth/conectores, errores/reintentos/reinicio, privacidad/dinero y configuración ausente. Cada rubro requiere evidencia reproducible y no probados explícitos; no certificar enterprise con checks de presencia ni mocks de negocio. Mantener hasta3agentes aislados; integración/publicación sólo por principal.

El usuario indicó que los datos del cliente llegarán después. No frenar la construcción independiente por eso: usar fixtures rotulados, contratos canónicos y mapeos configurables. No inventar resultados de Senix, probabilidades calibradas, ahorros ni validación comercial.

## Fuentes y APIs permitidas
- `construccion/ALCANCE-CONFIRMADO.md`: relectura completa; `docs/blueprint/02-TRAZABILIDAD-PRD.md`:35secciones.
- `docs/blueprint/01-CONTRATOS-Y-DATOS.md`:SourceEnvelope/interfaces/tablas; `construccion/03-CONTRATOS.md`:API/RBAC/SQL/pipeline.
- `packages/economics/index.mjs`:kernel económico existente; no duplicar fórmulas en UI/LLM.
- `apps/web/`:scaffold aceptado; `supabase/config.toml`:proyecto LOCAL `vexa-local`,5632x.
- `docs/investigacion/integraciones/01-hubspot-zendesk-migracion.md` y `04-openrouter-modelos-privacidad.md`:contratos/proveedores.
- GitHub **público**, autorizado explícitamente el20-sep: `javiercamarapp/vexa-ai`; publicar con opt-in revisado y escaneo de historial, Actions desactivado. Vercel proyecto vacío `vexa-ai`. Acceso CLI observado no equivale a conexión productiva completa. Nunca usar proyectos/secretos de Likida/Atiende/Moni.

## Modo vigente — cerrar una fase antes de abrir otra

Petición más reciente del usuario (19-sep, 15:54): completar producción/60IDs por fases, terminar e integrar antes de avanzar; después pide múltiples agentes para acelerar. Se concilian ambas instrucciones: **máximo tres agentes dentro de la misma fase**, no tres módulos nuevos. Un escritor por área; examen, regresiones y QA pueden correr en copias propias, integración/promoción sólo por el principal.

**F01-04 aceptado50674a4**, con193regresiones y110controlador; rechazo por registro stale preservado y corregido mediante nuevo candidato. Publicado y SHA remoto verificado84219b0, con Actions apagadas. **F01-05 aceptado17263dc**: cuatrojobs reales en verify/accept limpio, sin activarActions. Publicado8340d26 y SHA/autoría remotos verificados. BloqueF02 activo: gates por ID, reutilización/integración existente y preflight de infraestructura en tres worktrees disjuntos. Nueva petición: acelerar con hasta3agentes especializados sobre un bloque de fase, reusando propuestas; no rehacer módulos por cadaID. Integración/aceptación individual según DAG y alcance, no recortar pruebas. No saltear bloqueos para inflar60/60. Para cada tarea: examen externo aprobado/congelado, prepare/adopción permitida, verify, revisión, todos los gates aceptados/controlador, accept limpio y publicación.

Fuente de estado: runner para aceptación; recibos privados para trabajo/procesos. **11/60** después del cierre F01-05 (9/60 al iniciar ventana anterior). Laboratorio integrado `5fbf223` conserva CSV→recomendación→intervención→brief→inbox y assign/dismiss revisados, sin convertirlos en tareas aceptadas. No perder ese trabajo ni mezclarlo de golpe con F01-04.

Nueva orden de acelerar workflows y completar stack/MCP. F01-05 cerrado antes del límite; ventana F02 hasta20:46, máximo24invocaciones,144previas+3iniciadas=147acumuladas al abrir, techo220 compartido. Ventana anterior archivada, no borrada; consultar recibos antes de lanzar. Infra preflight read-only; cambios remotos requieren proyecto/permisos/coste definidos. Actions sigue desactivado; cero gasto/inferencia pagada sin presupuesto aprobado. No reset de presupuesto/rechazos/STOP. Conserva cero gasto incremental, sin envíos ni cloud no autorizado. Los límites6/8 y prioridades paralelas siguientes son **históricos, sustituidos por este modo**.

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
- [x] F01-04 diseño/navegación/estados aceptado50674a4; no equivale a backendF06.
- [x] F01-05 CI local aceptado17263dc; CI remoto no ejecutado, Actions desactivado.
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
