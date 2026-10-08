# Estado vigente del plan — 8 de octubre de 2026

**Corte posterior del 8-oct: 29/60 aceptadas (48,3 %).** HubSpot F03-01 completó verificación y aceptación limpia;31pendientes. Fases4–6 y producción siguen abiertas. [Evidencia de aceptación](docs/entrega/HUBSPOT-S01-ACEPTADO-2026-10-08.json). Los cortes anteriores conservan sus cifras históricas.

El plan activo está en [cierre por fases](docs/ejecucion/cierre-2026-10-07/PLAN.md) y el estado en [ESTADO-VIGENTE](docs/ESTADO-VIGENTE.md). F07-01 tiene cierre técnico local comprobado; la restricción documental histórica fue retirada por Javier y no hay un bloqueo activo de plataforma comprobado. Hay 60 fichas con trabajo técnico integrado y 28 aceptadas formalmente. Recuperación gestionada, conexiones y validaciones externas conservan sus requisitos específicos. Se sigue el encargo de completar todas las fases, con una suite pesada a la vez y sin inventar aceptaciones.

Los cortes anteriores que siguen son históricos; no reemplazan este estado ni el plan activo.

# VEXA — construcción completa por grafo y agentes

## Estado actual — 2 de octubre de 2026 (UTC)

El destino temporal de recuperación ya fue autorizado y creado. La preparación administrativa corrigió la espera de RPC y el sexto ensayo comprobó los positivos Auth/RPC/Storage. Falló la denegación de una URL firmada tras cerrar las conexiones: devolvió los bytes sintéticos. Se corrigió y verificó la limpieza posterior; el destino quedó vacío y cerrado. El aislamiento de archivos durante la restauración sigue pendiente. Capacidad conserva cero ventanas nuevas: el quinto intento se detuvo antes de crear infraestructura por presión de memoria. Una comprobación posterior volvió a fallar por CPU insuficiente mientras otros proyectos ejecutaban pruebas. [Evidencia y pendientes](docs/entrega/RECUPERACION-GESTIONADA-PREPARACION-2026-10-01.md). Se mantienen **59/60 fichas implementadas y 28 aceptadas**; restauración y producción no aprobadas.

El ensayo gestionado de imports pasó: dos invocaciones cron→pg_net→Vercel con HTTP 200, dos filas sintéticas aceptadas y cero pendientes; retirada de programación y delegación comprobada por MCP. Acredita ese recorrido acotado, no operación permanente. [Evidencia y límites](docs/entrega/OPERACION-GESTIONADA-2026-10-01.md).

Las extensiones `pg_cron` y `pg_net` ya están instaladas en Supabase VEXA mediante una migración explícita revisada. Siete comprobaciones posteriores de Auth/Data API pasaron; las dos observaciones conservaron cero tareas programadas, ejecuciones y solicitudes HTTP. La instalación por sí sola no acredita consumidores activos; el ensayo acotado documentado arriba completa la primera comprobación gestionada. La operación permanente sigue pendiente.

La plantilla faltante de notificaciones quedó publicada en `e80b122`, junto con su regresión SQL local 8/8 y guía de los seis consumidores. La propuesta de persistencia 442 pasó 23 pruebas canónicas y 16 casos focales; sigue experimental. Sus calentamientos comprobaron 2194→1900 consultas por bloque, pero la comparación de tiempos se difirió por host no preparado: cero ventanas medidas. No hay nueva validación 50K/150K ni cambio del contador.

**59/60 tareas técnicas, 28 aceptadas formalmente; producción pendiente.** El objetivo de dejar sólo cuentas, APIs y datos por conectar sigue abierto: faltan verificaciones técnicas de capacidad y cierre global.

Verificación remota anterior, producto `dbb834c`: Equipo corregido según acceso, 16 escenarios locales Chromium/WebKit aprobados y versión/fuentes remotas verificadas. El último smoke remoto SYN integral conserva su versión `f893851`, 8/8 y ocho vistas; recuperación local 5/5 con retorno de versión y regreso comprobados. Última carga 10K revisada: 9.800 aceptadas, 100 rechazos esperados, 100 duplicadas y cero pendientes. La carga 50K falló al plazo y 150K actual no se ejecutó. El observador publicado en `66a25c1` añade tiempos UTC/monotónicos, CPU y resultado por bloque; sus pruebas son de instrumentación y no heredan las mediciones del worker anterior.

[Auditoría vigente de 20 rubros](docs/entrega/AUDITORIA-20-RUBROS-2026-10-01.md) · [Backlog verificable](docs/entrega/BACKLOG.md) · [Cuentas, datos y configuración que solicitar](docs/entrega/PENDIENTES-PARA-CONECTAR.md) · [Estado estructurado](construccion/ESTADO-CONSTRUCCION.json)

La revisión global F07-01 continúa bloqueada por rechazo automático de la plataforma; no produjo dictamen. La matriz integral conserva 114 PASS y dos cancelaciones. También quedan operación permanente, recuperación gestionada, proveedores y validaciones humanas reales. No se cambian el grafo, los contadores ni los plazos para declarar cierre.

## Secuencia pendiente de cierre

1. Obtener una condición verificable para la medición de capacidad; ejecutar una nueva serie con el observador publicado, empezando por 10K. Revisar el resultado antes de 50K/150K; conservar los fallos y los plazos.
2. Resolver el bloqueo de plataforma antes de retomar el encargo global F07-01. No transferir ni repetir el encargo rechazado por otra vía.
3. Configurar y probar proveedores, histórico e incremental, programación de consumidores, identidad delegada, alertas y recuperación gestionada con los accesos y decisiones reales.
4. Completar las aceptaciones del grafo cuando existan sus dependencias y evidencias, y emitir la auditoría final por rubro y versión.

El estado de procesos se verifica mediante PIDs y recibos; esta secuencia no afirma que exista un loop activo. El límite acumulado vigente registrado es 458, sin reiniciar contadores: 144 anteriores a la fase y un máximo de 314 en ella. Las asignaciones 456–458 cubren capacidad, recuperación y revisión independiente; también se concilió la corrección acotada de credenciales. La autorización de tiempo ampliado no renueva esos contadores ni acredita aceptación.

<details>
<summary>Historial de cortes anteriores; no es el estado vigente</summary>

## Recuperación local comprobada — estado vigente

**59/60 técnicas y 28 aceptadas formalmente; producción pendiente.** El gate de restauración y retorno de versión pasó completo: restauración 5/5, continuidad financiera con el binario anterior, regreso a la versión actual y limpieza de ocho recursos. Se corrigieron tres incompatibilidades de los controles locales sin relajar las guardas del producto. [Evidencia y límites](docs/entrega/RECUPERACION-2026-10-01.md).

El producto desplegado conserva su smoke remoto SYN 8/8. F07-01, capacidad 50K/150K y validaciones externas siguen pendientes; este resultado no significa que sólo falten API. Los cortes anteriores conservan su fecha y alcance.

## Validación remota actual — estado vigente

**59/60 técnicas y28 aceptadas formalmente; producción pendiente.** El release desplegado `f893851` pasó8/8 fases remotas y ocho vistas con datos SYN propios: importación, cifras/exportación, interrupción/recuperación y revocación. Limpieza comprobada por MCP. [Evidencia y límites](docs/entrega/SMOKE-REMOTO-2026-10-01.md).

Controles formales, inventario y documentación publicados en `178d55c`, cuatro commits reales sin nuevo build de Vercel. Restan F07-01/revisión global rechazada automáticamente, matriz global incompleta: 114 PASS/2 canceladas, carga 50K fallida al plazo/150K no iniciada y las validaciones externas/operativas identificadas en la [auditoría de 20 rubros](docs/entrega/AUDITORIA-20-RUBROS-2026-10-01.md). No basta pegar APIs. Los bloques siguientes conservan cortes anteriores.

## Interfaz integrada — estado vigente

**59/60 técnicas y 28 aceptadas formalmente; producción pendiente.** F06-07 completa la composición local con 68/68 revisiones de pantalla, ocho acciones persistidas y revisión independiente 433. Lint, compilación y limpieza comprobados. [Evidencia y límites](construccion/F06-07-CIERRE-TECNICO.md).

Resta F07-01 (seguridad global), conciliación de inventario/carga y controles formales, validación del release y auditoría final de 20 rubros. El juicio visual humano, las cuentas y la validación con datos históricos siguen separados. Publicado y desplegado `f893851`: SHA servido, fuente CSS y endpoints protegidos verificados. Los apartados siguientes son históricos.

## Eventos integrados — estado vigente

**58/60 técnicas y28aceptadas formalmente; producción pendiente.** F06-12 integrada en `b0bb17c`: gate Git limpio23/23,16contratos internos,12lectores y8estados UI, revisión independiente428 aprobada. Migración0032 aplicada por MCP y permisos remotos comprobados. [Cierre y límites](construccion/F06-12-CIERRE-TECNICO.md).

Quedan F06-07(interfaz global), F07-01(seguridad global) y la validación/auditoría final. La aceptación formal12 conserva sus dependencias05/06; las cuentas, proveedores y validaciones humanas siguen separados. Publicado y desplegado `a01b50b`: SHA servido,19fuentes y protección de endpoints verificados. Los apartados siguientes son históricos.

## Push aceptado — estado vigente

**57/60 técnicas y 28 aceptadas formalmente; producción pendiente.** F06-11 integrada en `2165849`: verificación51/51 y aceptación limpia51/51, ambas con3/3pruebas HTTP hijas. Migración0031 aplicada por MCP y permisos remotos comprobados. [Cierre y límites](construccion/F06-11-CIERRE.md).

Quedan F06-12, F06-07 y F07-01, más validación integrada y auditoría final. Push publicado y desplegado en `3a2e34d`: READY, SHA servido, fuentes y protección del endpoint comprobados. Las cuentas y la entrega con proveedores/dispositivos reales siguen pendientes. Los apartados siguientes son históricos.

## Correo aceptado — estado vigente

**56/60 técnicas y 27 aceptadas formalmente; producción pendiente.** F06-10 integrada en `1457036`: verificación39/39 y aceptación limpia39/39, ambas con25/25pruebas hijas. Migración0030 aplicada por MCP y permisos remotos comprobados. Publicado y desplegado `cd6c17f`: READY, SHA servido, fuentes y endpoint comprobados. [Cierre y límites](construccion/F06-10-CIERRE.md).

Quedan F06-11, F06-12, F06-07 y F07-01, más la validación integrada final. Proveedor/dominio de correo, cuentas y datos reales siguen pendientes. El total técnico no acredita entrega externa ni aprobación de producción. Los apartados siguientes conservan cortes históricos.

## Outbox aceptado y publicado — 30-sep, estado vigente

**55/60 técnicas y 26 aceptadas formalmente; producción pendiente.** F06-09 está integrada en `c1212af`: verificación38/38, aceptación limpia38/38 y matriz SQL432/432. GitHub confirma el SHA y seis commits reales con autoría asociada. [Cierre y límites](construccion/F06-09-CIERRE.md).

La incompatibilidad de0029 con PostgreSQL gestionado está corregida con revisión independiente y nueva regresión38/38. Migración aplicada por MCP: seis tablas con RLS forzado, permisos exactos y helper privado comprobados; no se enviaron avisos externos. Vercel conserva `d39e9a3`, sin despliegue nuevo por este cierre. Faltan F06-07, F06-10, F06-11, F06-12 y F07-01, más la comprobación integrada de la versión final. Los apartados siguientes son históricos; no significan que el servicio ya esté listo sólo para pegar APIs.

## Botones de correo y confirmación desplegados — 30-sep

Los botones verdes de los correos Auth están centrados y revisados. Cambiar nombre o responsable de una organización ahora exige confirmar de nuevo; `d39e9a3` publicado y desplegado, READY/SHA/fuente verificados. Pruebas locales Chromium/WebKit y comprobación remota móvil/escritorio aprobadas, sin crear organizaciones. [Evidencia de la tanda406–408](docs/entrega/CORREOS-CONFIRMACION-2026-09-30.md).

**54/60 técnicas, 25 formales; producción pendiente.** Los tres agentes terminaron. Push todavía necesita integración técnica y gate; no basta VAPID. Las plantillas de correo remoto y SMTP propio siguen pendientes. Acumulado408 conservado; los apartados siguientes son históricos.

## Acceso y administración publicados — 30-sep, actualización vigente

Producto `c7a30ac` publicado y desplegado: READY y SHA servido comprobados. El enlace original de Supabase ya retorna a VEXA; seis comprobaciones remotas de sesión, plataforma, permisos, móvil, revocación y logout aprobadas. Administración de plataforma integrada con revisión independiente y migración aplicada. Google real y configuración de correos remotos siguen pendientes. Las 13 plantillas Auth tienen membrete: 52 presentaciones previas y 20 comprobaciones posteriores de botones centrados, sin acreditar entrega real. [Evidencia y límites](docs/entrega/ACCESO-PLATAFORMA-CORREOS-2026-09-30.md).

Se mantienen **54/60 técnicas, 25 formales y producción pendiente**. Agentes Auth 403–405 recogidos; nueva tanda F06 406–408 autorizada sin reiniciar contadores. Los apartados siguientes conservan cortes históricos.

Actualizado: 2026-09-20. Este plan reemplaza los bloques históricos de investigación/preparación conservados en Git. El usuario pidió construir y confirmó **UN MES, no una semana**. Referencia de calendario: 19-oct-2026 si se cuenta desde este encargo; objetivo, no entrega garantizada ni estado alcanzado.

## Botones y confirmaciones publicados — 30-sep

La revisión402 aprobó dos archivos de presentación, con ocho controles nuevos deCSS enChromium/WebKit y evidencia previa conservada. Publicado y desplegado `ccf546b`: READY, SHA servido y dos fuentes revisadas verificados; foco, Escape, cancelación sinPOST, movimiento reducido y navegación lateral comprobados en escritorio/móvil. [Evidencia y límites](docs/entrega/UNIFICACION-UI-2026-09-30.md). Se mantienen54/60 técnicas,25formales y producciónfalse; no se cierra todaF06-07 por un ajuste visual.402/402invocaciones conservadas; ninguna revisión queda ejecutándose.

## Checkpoint vigente —54/60 técnicas;25 aceptadas en el grafo

Webhooks CRM publicados y desplegados `ad37369` tras revisión401; migración0040 aplicada por MCP y comprobada. [Evidencia del30-sep](docs/entrega/WEBHOOKS-CRM-2026-09-30.md). Activación y cuentas reales pendientes; el total54/60 permanece igual.

F07-05 integra el evaluador offline del piloto y su guía operativa:25controles del principal,21independientes y procedimiento documentado comprobados con Node22. Autor399 y revisor400 recogidos; código integrado exactamente desde fuentes congeladas. Sólo en esta ficha quedan aportes humanos y aceptación formal: consentimiento, gold/holdout, participantes, cronometraje, sponsor y respuestas reales. El piloto sigue `not_run`; no equivale a producción. [Cierre técnico y evidencia](construccion/F07-05-CIERRE-TECNICO.md).

El total suma25aceptadas por runner,26con validación externa pendiente y3con dependencias formales. Restan seis fichas técnicas: F06-07, F06-09..12 y F07-01. La revisión bloqueada de entrega y sus dependencias permanecen pendientes; no basta conectar cuentas para cerrar todo. [Estado actual y límites](docs/entrega/PILOTO-TECNICO-2026-09-29.md).

La web sirve `ad37369`: receptorCRM desactivado hasta configurar cuentas, ocho fuentes ejecutables y SHA remoto comprobados. El consentimiento económico conserva su corrección y revisión anterior. Último smoke completo8/8 en `b9ed3db`; sus resultados conservan ese SHA. El cambio del piloto es una herramienta offline y no requiere desplegar la web. [Evidencia de la web](docs/entrega/CONSENTIMIENTO-ECONOMICO-2026-09-29.md).

Tiempo sin límite autorizado; presupuesto conservado401/401invocaciones acumuladas, máximo3agentes. No nuevas compras ni inferencia pagada. Publicación mediante publisher autorizado, Actions desactivadas y SHA remoto verificado por recibo; estos documentos no acreditan un servicio autónomo después de cerrar la sesión. Caffeinate no garantiza supervivencia de la sesión. Los apartados siguientes son históricos.

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

</details>

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
