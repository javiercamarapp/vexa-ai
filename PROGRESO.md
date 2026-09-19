# Progreso verificable
Actualizado: 2026-09-19 local. Los apartados anteriores conservados abajo son cortes históricos, no inventario vigente.

## Créditos renovados, propuestas preservadas y SQL real — último corte19-sep
- Al aproximarse el límite horario se detuvieron sólo procesos Codex propios y se preservaron siete propuestas con commits LOCALES no aceptados: ingesta60a16eab,análisisc336258b,webe56eaeaa,notificaciones5eebdd07,schema83118a7a,superadmin290e3853,backofficec4b93ed1. No publicaciones/aceptaciones ficticias. El usuario renovó créditos después y autorizó continuidad normal; nueva tanda120min/máximo6, no reset de consumo.
- Principal reprodujo **39ingesta/jobs +61análisis +32notificaciones =132tests Node verdes** en checkpoint. Son unitarios/puertos; no acreditan todo el producto ni resuelven revisiones abiertas de notificaciones.
- Principal reprodujo ahora **13tests PostgreSQL reales de ingesta/jobs**, incluyendo SIGKILL/replay, dos consumidores, rollback/revocación/fencing; copia temporal y entorno propio. Fallo anterior de username provenía de entorno de prueba sanitizado sin USER, corregido en el comando, no en producto.
- Principal corrigió el harness SQL de métricas: pg_ctl restart heredaba pipe capturado; añadió logfile/timeout sin cambiar aserciones. **6tests SQL reales pasan**, incluidos CAS/atomicidad/inmutabilidad y lectura tras restart. Commit local de ensayo d2c7e1d; persistencia es aún propuesta genérica, no schema canónico/API integrada.
- Examen F01-03 corregido: principal ajustó expect del mutanteStorage a200/206 (ambos fallos por exposición, no denegaciones permitidas). Suite completa **38/38verde,0skipped,147s** con SQL/Auth/Storage/RPC reales propios y cleanup. Se conserva fallo anterior. Revisión independiente final en curso; no congelación/aceptación de producto aún.
- Reanudados con código existente: schema, notificaciones, superadmin y backoffice; nuevo módulo de templates enterprise en scope separado. No repetir investigación ni rehacer propuestas. Manifiestos/recibos privados `renewed-active-manifests.json`; PID en recibo no acredita vida perpetua.
- Estado aceptado sigue8/60; ampliación superadmin fuera de esosIDs por añadir/revisar. Faltan integración de módulos, acciones HTTP reales, regresiones/E2E y servicios externos. No llamar producción a estos avances.

## Última hora y scope ampliado — corte posterior 19-sep
- Usuario fijó una hora restante/cuota semanal25%y pidió superadmin/cerebro/prospectos/backoffice/control gastos IA por rubro, además de correos enterprise. Es ampliación explícita, no funcionalidad que ya estuviera aceptada dentro de60IDs. Contrato en `construccion/AMPLIACION-SUPERADMIN.md`; hasta8agentes con archivos disjuntos, integración serial.
- Primera construcción de ingesta/jobs, decisiones y ocho vistas produjo código y pruebas; revisores independientes rechazaron los tres por defectos concretos (revocación/retries/lease; dinero/medición/idempotencia; hash/ruta/measurement_ref). Correcciones focalizadas lanzadas, originales/recibos conservados. No se incorporaron fallos al baseline.
- Nuevo examen F01-03 también rechazado por mutantes supervivientes: contenido B bajo ID A en retrieval, roles propios y FKs adicionales. Corrección externa en curso; constructor de schema trabaja propuesta separada, no aceptación adelantada.
- Notificaciones SQL/recibos/inbox revisadas:32tests de dominio pero errores de capacidad transaccional/huérfanos/frecuencia; corrección en curso. Otros agentes construyen superadmin y costes/backoffice. No envíos ni llamadas pagadas.
- Principal reprodujo servicios aislados Auth/Storage/PostgREST con sesión Auth real y cleanup; baseline F01-03 sigue rojo por implementación ausente; suite controller108OK repetida. SQL análisis en copia:5tests reales pasaron, sexto quedó detenido en restart y alcanzó timeout; cluster propio detenido por operador. SQL jobs en primera copia falló por ausencia de username PG en entorno sanitizado, no por contrato. Estos fallos no se convierten en PASS ni acreditan persistencia completa.
- Continúan8/60tareas aceptadas. Código aislado/revisado parcialmente no es producto completo ni producción validada. Recibos privados contienen paths/PIDs/estado vivo y deadline de la hora; no inferir que un proceso sigue activo de este corte.

## Ola2 en ejecución — corte posterior 19-sep
- Usuario reiteró alcance completo guía/PRD/audios,60/60, paralelismo y commits a su historial. Principal releyó519líneas de transcripciones,296DOCX y1672PRD; sin enviar originales privados a agentes ni afirmar nueva escucha humana.
- Autoría corregida F01-03 terminó; supervisor paró por STOP propio antes de congelar. Nuevo harness crea recursos Docker exclusivamente propios sin resetear Supabase compartido. **Principal reprodujo9/9controles SQL/mutantes en PostgreSQL real,88s**:36tablas,28relaciones,políticas permisivas y FKs ausentes. Log `private/logs/wave2-F01-03-oracles-principal.log`. No acredita aún producto F01-03 ni sus políticas Storage/RPC; falta revisión del examen y candidato.
- Cuatro constructores aislados lanzados: ingesta/jobs, análisis/decisiones, ocho vistas y notificaciones. Semillas revisadas copiadas selectivamente. Recibos en `private/parallel-wave-2.json`; propuestas NO aceptadas ni equivalentes a producto integrado. Plan/propietarios/presupuesto en PLAN.md.
-33llamadas consumidas antes de ola2;20reservadas para módulos/revisiones y167restantes para supervisor. No relanzar serial mientras se integra/revisa fuera de él; mantener un escritor y reconciliar recibos.
- Commit real de recuperación `a309259` publicado a main; publisher verificó SHA remoto. API GitHub confirmó los24commits de main asociados a javiercamarapp (16noreply,8correo anterior). No se modificó historia ni preferencia de contribuciones privadas del perfil.
- Producto aceptado sigue8/60. SaaS integrado, proveedores/CI/deploy, gold humano y piloto continúan pendientes; no confundir propuestas en ejecución con aceptación.

## Recuperación de sesión — 19-sep, después de la parada F01-03
- Sesión original recuperada: `2026-09-19T01-22-25-033Z_01a0b741-e889-77b6-a5cc-7d519d34649c`. El último mensaje decía loop activo; el recibo posterior demuestra que terminó por rechazo del examen F01-03. No quedó ningún supervisor vivo al recuperar.
- Baseline `dc59d31`, checkout limpio, 8/60 aceptadas. `runner status` confirma F01-03 pending, sin candidato; `autoloop status` conserva el rechazo de revisión. No se reinició el producto ni se aceptó software nuevo.
- Principal leyó el examen rechazado, su harness y los tres hallazgos: cobertura funcional limitada a dos tablas, FKs ausentes invisibles al examen y falta de positivos/mutantes ejecutados. Instrucciones de corrección en `construccion/correcciones/F01-03-gate.md`.
- Detectado además setup no ejecutable con la infraestructura existente: exigía stack vacío y etiqueta inexistente. Se exige launcher repetible y seguro, sin resetear el VEXA compartido.
- Docker no estaba disponible; arrancado por operador, contenedores VEXA locales observados activos. `guide.py audit` → 60 tareas/fichas, cero errores, 9 gates disponibles y 51 faltantes. Esto no prueba servicios ni esquema de producto.
- Presupuesto reconciliado: 30 previas +2 del intento rechazado =32 consumidas; política reducida a188 restantes del techo220. Tanda de120min,54ciclos, dos intentos por tarea, sin gasto incremental. Renovación explícita F01-03 bajo STOP; lanzamiento/avance se acredita sólo con recibo/PID vivos.

## Auth aceptado y grafo ampliado — corte anterior 19-sep
- **F01-02 accepted, commit8f85ee7**. Migración0001 aplicada una vez a Supabase LOCAL VEXA56322, sin tocar otros proyectos. PKCE/callback válido, selección A/B, redirects externos, cookies/firma/expiración, revocación y logout/back probados en Auth/DB/Chrome reales:7tests (6subcasos+envolvente), luego reejecutados en materialización limpia por accept. Google remoto sigue sin configurar.
- 22archivos de Auth transferidos con hashes idénticos a propuesta revisada; P1 de Referrer-Policy corregido sin admitir Origin:null. Revisor reprodujo29tests HTTP y build; principal20tests session y SQL/RLS en PostgreSQL17 desechable. Fallo de locale reproducido y diagnosticado antes del verde LANG=C/LC_ALL=C.
- Guard rechazó metadata ignorada que el operador creó al ejecutar CLI Supabase en candidato; recuperación conservó evidencia y abrió copia limpia. Gate real detectó después un falso positivo del observador: reload reenviaba el POST original. Traza/rojo específico, GET de lectura, revisión independiente y nueva congelación; ninguna aserción de tenant/estado/DB se eliminó.
- Regresiones de7gates previos:18/18 verdes contra candidato. Una corrida tuvo timeout de npm no reproducido; se conserva, sin atribuir causa ni aumentar límites. Repetición de etapas ci/lint/typecheck/build y repetición del gate original verdes. Suite controlador108verde antes de ampliación.
- Propuestas corregidas de ingesta/conectores21, gateway/intelligence34 y notificaciones27: **82tests reproducidos**, revisiones independientes aprobadas; commits locales en PROPUESTAS-PARA-INTEGRAR. No son todavía tareas integradas/aceptadas.
- Grafo v4 conserva55IDs y añade5notificaciones, total60. Auth/scaffold+preparación:8aceptadas;9gates presentes,51faltantes. Harness de evaluación no inventa gold; validación humana sigue bloqueando release, no redacción de runbooks. Ampliación revisada independientemente y aprobada: audit/graph check sin errores,55IDs y entradas previas preservados,64derivados reproducidos,108controller+24npm verdes. Principal reprodujo también108+24 y5oráculos Auth. No son pruebas del producto faltante.
- Consumo30llamadas incluida revisión del grafo;190restantes del techo220. Sin APIs pagadas de inferencia, correos/push a personas ni producción. Copia de Escritorio aún no sincronizada con estos cambios.

## Agentes en paralelo — 19-sep (corte anterior)
- Plazo corregido por usuario: UN MES, no una semana; destinatarios notificaciones confirmados: usuarios VEXA. PLAN.md sustituye investigación histórica por construcción real, manteniendo gates externos y aceptación serial.
- Segunda autoría de gate Auth terminó; supervisor paró por STOP de checkpoint antes de revisión, preservando propuesta. Revisor encontró2P2 adicionales (normalización de redirect con backslash y revocación que aceptaba cualquier redirect local). No se aprobaron ni se marcó Auth implementado. Ensayo Docker del revisor bloqueado por sandbox, no prueba de fallo de Auth.
- Se lanzaron constructores aislados de conectores/ingesta, gateway/evidencia y notificaciones; tres propuestas entregadas. Principal abrió reportes y reprodujo sus tests: **18/18 +24/24 +22/22, exit0, cero skipped**. Son64tests unitarios con fixtures/transporte simulado, no gates externos ni conexión real.
- Las tres revisiones independientes rechazaron las propuestas pese al verde:2P2 en ingesta/transporte,1P2 en caducidad de política de modelos y2P1 por mutabilidad posterior a autorización/validación en notificaciones. Se archivaron las fuentes v1 y lanzaron correcciones focalizadas con regresiones; NO se ocultaron los hallazgos. Cuarto constructor trabaja Auth/identidad mínima en otro worktree; puede proponer manifests raíz porque es único dueño en esa copia. Ninguna propuesta está integrada ni aceptada: siguen7/55 hitos incluyendo preparación.
- Parche acotado del gate Auth en worktree separado:2rojos por aserción reproducidos,4tests puros verdes; principal ejecutó probe LOCAL Auth real,1verde con positivo+mutante. Sin app todavía, no prueba callback/revocación del producto. Parche pendiente de revisión externa.
- Manifiesto/recibos privados: `private/parallel-batch-1.json`, `.runtime/team-*/`. Logs principal `private/logs/principal-{connectors,gateway,notifications}-tests.log`. Estado/PIDs son dinámicos; consultar recibos, no asumir que siguen vivos por leer este corte.

## Primera parada y ampliaciones — 19-sep
- Supervisor terminó su primera tanda porque el revisor rechazó el gate F01-02: no probaba redirect exitoso, confundía posible CSRF con autorización y sólo había ejercitado ausencia de archivo. Estado:7/55 aceptadas, Auth sin implementar. Informe original conservado; correcciones públicas en construccion/correcciones/F01-02-gate.md.
- Se corrigió y reprodujo una limitación de recuperación: tarea cuyo gate falla antes de prepare aún no tiene fila de estado. Renovar explícitamente su presupuesto ahora reconoce pending por defecto, sin crear fila falsa ni permitir recuperar accepted/prepared/verified. **108tests generales OK**, revisión independiente22tests del supervisor OK. No se redujeron oráculos de Auth.
- Usuario añadió push y correos profesionales. Referencias Likida/Atiende inspeccionadas selectivamente read-only; propuesta en docs/superpowers/specs/2026-09-19-notificaciones-propuesta.md. Destinatarios pendientes de confirmar; sin proveedor contratado ni envío externo.
- Política de reanudación:120min,54ciclos,212llamadas adicionales;8ya usadas. El estado real se consulta en el recibo, no se infiere de esta planificación.

## Construcción efectiva y automatización — 19-sep
- Relectura íntegra solicitada: seis audios en ambas transcripciones, DOCX extraído completo y PRD de35secciones; [alcance confirmado](construccion/ALCANCE-CONFIRMADO.md). No reconocimiento auditivo humano palabra por palabra.
- F01-01 implementado por Astra/Codex, revisado independientemente y aceptado (`9e0010a`): Next.js/TS/npm workspace, página honesta y health/version. Instalación offline, lint/typecheck/build reales. Primer intento falló por filtro absoluto del gate; se corrigió externamente y verificó de nuevo sin cambiar fuentes del candidato. **7/55 aceptadas al arrancar supervisor.**
- Supabase local `vexa-local` activo en5632x con configuración propia. GitHub privado `javiercamarapp/vexa-ai` creado; identidad noreply configurada para commits futuros sin reescribir historia. Vercel `vexa-ai` creado en cuenta existente, sin deploy. Actions temporalmente desactivadas: sin gasto adicional aprobado.
- Nuevo supervisor con autor/revisor de gates, constructor/revisor de implementación, regresiones previas, materialización limpia y publicación del SHA verificado. Cinco invocaciones bootstrap/revisión; informes adversos y correctivos conservan hallazgos y correcciones, no aprobaciones ficticias.
- Bugs reproducidos/corregidos: auth ChatGPT persistida, lock común, presupuesto de intentos que sobrevivía mal a relanzamientos y main adelantada publicada indebidamente. Última revisión independiente del publisher:6tests OK, sin P0/P1/P2 en ese alcance.
- Verificación canónica: **107tests controlador/supervisor/publicador OK** (`private/logs/canonical-automation-107.log`); `npm test`24, copia/entorno scaffold3. Se reprodujo además EALLOWSCRIPTS al heredar configuración del npm padre; whitelist de entorno y configuración npm vacía lo corrigen sin retirar lint/typecheck/build. Estos tests usan Git real, CLI modelado y remotos bare; no prueban cloud ni autonomía prolongada.
- Programa operativo en [AUTOMATICO.md](AUTOMATICO.md). Política:42IDs locales,150min en esta tanda,215llamadas restantes como máximo, dos intentos persistentes por ID. Estado/PID reales en `.runtime/autoloop-state.json`; no inferir ejecución por existir el código.
- Pendiente: Auth/RLS/ingesta/IA/ocho vistas, integración real Google/OpenRouter/CRMs, Supabase cloud/deploy/CI remoto, permisos/gold/piloto. El encargo completo sigue abierto.

## Construcción guiada — ampliación del 19-sep-2026 UTC
- Contraste de nueve referencias/rangos de construcción, reanudación, QA y automejora de Likida, preservadas read-only. No auditoría de toda Likida ni equivalencia de producción.
- `construccion/`: 55 fichas autoradas, contratos DB/API/jobs/UI, setup, QA, recovery, release y guía HTML/PDF. Grafo v3: mismos 55 IDs; ocho gates presentes y 47 pendientes de implementación JIT externa al candidato.
- Controlador con prepare/verify/accept/recover y reject supervisado. Revisión independiente encontró H1/H2 P1 y H3 P2: ruta de corrección ausente, ignorados promovidos falsamente y logs sobrescritos. Los tres reproducidos en rojo y corregidos; informe inicial preservado.
- Suite posterior: **80 tests controlador OK**, más 12 kernel, 12 preparación/negativos y 12 negocio. Cinco mutantes aritméticos fallan por aserción. Scaffold/all-gates siguen rojos; readiness sale2. No prueba software completo.
- La revisión correctiva confirmó H1/H3 resueltos y encontró H2b (permisos no transportados por Git). Se reprodujo en rojo y se corrigió: accept verifica una materialización limpia del commit, incluso por auto-accept. Cuatro regresiones adicionales pasan; este último parche no tuvo otra revisión independiente.
- Recorrido real y entrega final: ver [construccion/EVIDENCIA.md](construccion/EVIDENCIA.md). Los apartados siguientes conservan cortes históricos, no sustituyen este inventario actual.

## ✓ Ampliación de negocio solicitada después — 19-sep-2026 UTC
- Se contrastó la estructura con índice/TAM/estudio de Documentos Likida y se agregó negocio/: mercado, ICP, competencia/precios/capital, TAM/SAM/SOM, unit economics, forecast36meses, GTM, validación, inversionistas, riesgos y diez marcas semilla NO calificadas.
- Fuente primaria: XLSX Census SUSB2022, 140 filas seleccionadas, nueve bandas de receipts $10M–<$100M y **2,975 firmas** NAICS454110. No se suman NAICS como cuentas únicas; bandas ausentes no son cero.
- **TAM núcleo precio base supuesto $53.5M/año; SAM base escenario $10.6M; SOM base A3 ~$989K ARR.** No demanda o ingresos observados. Modelos/inputs en negocio/05-Precios-y-Finanzas/.
- Registro:48capturas/intentos,35fuentes usadas (incluye páginas de10marcas), sin ocultar403/404/contenido escaso. Firecrawl402 por saldo agotado; fallback fuentes públicas directas + búsqueda nativa Codex, sin compra de créditos o inferencia OpenRouter.
- `npm run test:business` → **12 tests OK**. Revisor independiente comprobó filas oficiales y cálculos en memoria: sin P0/P1/P2 en su alcance, límites de filtros/demanda/caja explícitos. Informe privado REVISION-MERCADO-Y-MODELO.md, salida0.
- **Informe HTML offline y PDF de35páginas/16capítulos**, Excel y108filas mensuales CSV. `python3 scripts/verify_business_delivery.py` → integrityPASS; SHA Census coincide,120links locales en ese corte,35páginas y montos esenciales presentes. Portada y páginas10/21inspeccionadas visualmente.
- Primer Chrome imprimió el PDF pero no cerró y alcanzó timeout; se implementó generación acotada por validación del artefacto y limpieza del grupo. `python3 scripts/render_business_pdf.py` → salida0,16marcadores/importe presentes y grupo de navegador limpiado. No se ocultó el fallo inicial.
- Lo que sigue sin validar: entrevistas, censo nominal deduplicado, filtros SAM empíricos, cotizaciones homogéneas, contratos/pagos/piloto, cohortes/costos reales; USA es núcleo cuantificado, no mercado global completo.

## ✓ Fuentes e investigación
- Siete originales preservados con SHA256: seis M4A + DOCX. Audio total medido **591.829333 segundos**.
- Dos pasadas completas Whisper CPP small, TXT/SRT/JSON: **36 salidas**, transcripción reunida en private/TRANSCRIPCIONES-COMPLETAS.md. ASR con errores señalados, sin auditoría humana palabra por palabra. Medium no se descargó por timeout; no se utilizó.
- DOCX completo extraído (149 párrafos); PRD de 35 secciones conservado desde el mensaje original de la sesión.
- Investigación pública de competencia, integraciones y catálogo de modelos; tesis, diligencia CTO, referencia Likida/Atiende y costos. Repos revisados selectivamente/read-only, no auditoría exhaustiva de todos sus archivos.
- Blueprint F00–F08/30 días, contratos, matriz de 35 secciones, riesgos, gold, seguridad, aceptación E2E, medición e intervención, pitch y runbooks.
- El primer download del catálogo OpenRouter se truncó; reintento comprimido válido: 446 modelos. Sólo GET público, **sin inferencia pagada**.

## ✓ Código probado localmente
- `npm test` → **12 passed, 0 failed**: kernel económico limitado, moneda/dedup/null/refunds/reversals/exposición/escenarios.
- `npm run test:controller` → **23 tests, OK**: helpers + Git worktrees/commits/accept real con CLI Codex simulado; falla de worker, controles protegidos, revalidación, presupuesto y status read-only.
- `npm run graph:check` → **55 tareas**, grafo sin ciclos; E00 con gate y **54 gates faltantes**, no disfrazados de PASS.
- `python3 scripts/verify_delivery.py` → 7 hashes, 36 salidas, 32 dossiers/archivos autorados revisados, 83 links locales; integrity passed.
- `codex login status` → Logged in using ChatGPT; entorno de sesión openai-codex/gpt-6-astra.
- Ejecución **real** `python3 orchestration/runner.py run --max-rounds 1 --max-minutes 3` → E00 verified, worker_exit=0, gate_exit=0. Astra revisó el kernel, 12 tests pasaron y no produjo patch innecesario. `accept --task E00 --max-minutes 1` → accepted. Siguiente run → detenido antes del worker por gate F00-01 faltante. Logs live-controller-*.log y .runtime/E00-1-*.log.
- Git local: base de preparación d9f48d0; corrección de controlador b1a81f3. Sin remote, push ni deploy.

Logs: private/logs/economics-final.log, controller-tests.log, graph-final.log, delivery-integrity.log. El controlador guarda ejecución/reanudación en .runtime/ (privado, no versionado).

## Revisión independiente y corrección
Un Codex/Astra con contexto limpio revisó kernel/controlador: no confirmó P0/P1, halló P2 sobre autenticación sin timeout y accept ignorando --max-minutes. Se reprodujeron ambos y status con efecto de escritura mediante tests rojos, luego se corrigieron; suite local 22/22 verde. Recibos controller-review-red.log y controller-tests.log. Primera revisión ocurrió sobre archivos en evolución y sandbox read-only impedía temporales; no se presenta como aprobación de snapshot final. Informe privado REVISION-INDEPENDIENTE.md.

Segunda revisión sobre snapshot d9f48d0 ejecutó 12+22 tests y halló otro P2: un hijo que ignora SIGTERM sobrevivía al timeout si el líder ya había terminado. Se reprodujo con test rojo (controller-descendant-red.log), se corrigió SIGKILL a miembros supervivientes del grupo y cierre explícito de lock; **23 tests verdes** con ResourceWarning convertido en error. Patch b1a81f3. Informe REVISION-FINAL-CONGELADA.md. Revisión independiente final sobre b1a81f3 confirmó el P2 corregido en la reproducción: prueba del hijo superviviente 1/1, controlador 23/23 sin ResourceWarning, kernel 12/12 y grafo con 54 gates pendientes. Informe privado REVISION-PARCHE-FINAL.md, exit 0. Los archivos revisados coinciden byte por byte con ese commit. Límite explícito: no prueba plazo global estricto de toda operación/IO ni terminación de procesos deliberadamente desligados del grupo.

Dos agentes de redacción anteriores alcanzaron timeout tras dejar documentos parciales; el agente principal completó/revisó los faltantes. No se registran como ejecuciones completas exitosas.

## ? Inferencias que necesitan validación
- Diferencial recomendado: inteligencia económica verificable de posventa de producto físico por orden/SKU, portable entre CRMs. Competidores ya ofrecen feedback→dinero→acción; no prueba que el wedge propuesto vaya a vender.
- Oferta 70/30 y separación de Convexia aparecen en audio; contrato, cap table, vesting, IP y cartas no verificados.
- 30 días es horizonte condicionado; no estimación cerrada ni garantía.

## ✗ No construido / no verificado
- SaaS Next.js, Auth/RLS/DB/Storage, ingesta/job durable, conectores reales, pipeline IA, ocho vistas, deploy y CI remoto.
- Accesos Senix/HubSpot/Zendesk, autorizaciones/DPA/NDA y confirmación del cliente.
- Gold humano, precisión/recall y utilidad ejecutiva, ahorros o voluntad de pago real.
- Pruebas automatizadas para las 54 tareas posteriores a E00; deben escribirse/revisarse antes de habilitar cada paso.
- Producción Vercel/Supabase/GitHub de VEXA y presupuesto OpenRouter. Existencia de CLIs no prueba acceso.
- Autonomía prolongada y seguridad contra código hostil; worktree/sandbox no equivale a VM aislada.

## Qué NO prueban los tests
Prueban kernel/control de ejecución en casos observados, no producto completo, integraciones cloud, éxito comercial ni reconocimiento perfecto de audio. Los tests de integración del runner simulan el CLI Codex. La vuelta E00 adicional sí usó Astra/Codex real, pero fue una verificación sin patch del kernel, no una demostración de que el grafo pueda construir todo el SaaS sin intervención.

## Reanudación de sesión
Traspaso temporal sin secretos: `/tmp/vexa-handoff-b1a81f3.md`. Los documentos canónicos de esta carpeta bastan si el temporal desaparece. Las ejecuciones acotadas de revisión/E00 concluyeron; no se deja un proceso indefinido en segundo plano.

## Siguiente bloque
1. Revisar dossier CTO y confirmar piloto/datos/derechos con sponsor; se puede avanzar localmente con fixtures mientras tanto.
2. F00: preparar/revisar gates externos por tarea y entorno de ensayo.
3. F01: scaffold/auth/RLS/CI y pruebas dos tenants; luego F02 importación/job durable.
4. Sólo entonces seguir grafo con candidatos pequeños y aceptación explícita. No forzar estados ni omitir gates faltantes.
