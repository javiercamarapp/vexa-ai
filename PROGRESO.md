# Progreso verificable
Actualizado: 2026-09-18 local / 2026-09-19 UTC.

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
