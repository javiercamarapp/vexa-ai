# Hallazgos

## Construcción efectiva y paralelismo — 19-sep-2026
- Usuario exige producto completo connection-ready; confirmó UN MES después de mencionar una semana. Datos reales se aportarán después; no bloquear módulos independientes por su ausencia.
- Primer gate Auth rechazado por oráculos insuficientes; no hubo aceptación de producto. Nueva propuesta conserva probe Auth local positivo/mutante y callbacks/selección/revocación: requiere revisión antes de adoptar. STOP en checkpoint conservó trabajo, no se mató el autor.
- Secuencializar toda preparación de módulos detrás de Auth estaba limitando avance. Nueva estrategia: propuestas disjuntas en paralelo y promoción serial por DAG/gates; no confundir propuesta escrita con tarea aceptada.
- Recuperación antes de prepare tenía default de estado inconsistente: arreglado, rojo observado y108tests verdes; revisión independiente22tests OK. No se inventó fila de producto.
- Usuario confirmó notificaciones exclusivamente para usuarios VEXA. Referencias Likida/Atiende muestran permisos/anti-ruido/outbox/plantillas, pero no se copia su código ni se toma aceptación del proveedor como prueba de entrega.
- PLAN.md anterior seguía describiendo investigación cerrada: se reemplazó por plan de construcción vigente; historial anterior queda en Git.

## Construcción guiada — corte nuevo 19-sep-2026
- La comparación útil con Likida es por requisitos/efectos/oráculos/reanudación, no por páginas. Se especificaron 55 encargos y el programa hasta release; no se construyó el SaaS.
- Las 54 pruebas ausentes del corte inicial pasaron a 47. Escribir/revisar el gate justo antes del incremento permite construir sin entregar todo el examen futuro al worker ni falsificar PASS.
- La suite de 66 tests no detectó un verified sin salida tras rechazo, aceptación desde un artefacto ignorado ni sobreescritura de logs al recuperar. Revisión externa los reprodujo; se corrigieron y añadieron diez regresiones, total76. Una segunda revisión halló permisos no transportables por Git: se corrigió validando una materialización limpia antes de promover, con cuatro regresiones más (80 tests). Este último parche sólo tiene comprobación del principal, no nueva aprobación independiente.
- F00 representa preparación sintética, no permisos o cloud listos. Cuentas, gold humano, piloto y publicación siguen como actos externos. Evidencia actual y veredictos en construccion/; cifras inferiores son cortes anteriores.

## 2026-09-18/19 — fuentes, investigación y verificación
- Audio: la transición HubSpot→Zendesk es central para el pitch. Adaptadores read-only comparten modelo canónico y preservan aliases/historia; mock no acredita conexión real.
- La separación VEXA/Convexia y propuesta 70/30 son declaraciones del audio; documentos firmados/IP/vesting/control siguen pendientes.
- El DOCX y PRD discrepan en pantallas, campos obligatorios y cronómetros. Decisión propuesta: ocho vistas, campos de enlace nullable con coverage, latencia de procesamiento distinta de comprensión ejecutiva.
- Competidores Thematic/Chattermill/unitQ/SentiSum/Enterpret ya presentan prioridades/economía/acciones. Veredicto CAMBIAR posicionamiento; no declarar categoría sin competencia.
- Dinero requiere evitar sumas no aditivas y distinguir observado/modelado/inferido. No convertir refunds alegados o probabilidades LLM en dinero observado.
- Supabase Queues vs Vercel Workflow sigue spike abierto. Cola durable sin consumidor verificado no procesa nada por sí sola.
- OpenRouter data_collection deny no equivale a ZDR/residencia. Catálogo público no acredita política del endpoint.
- Catálogo consultado incluye Astra $10/$50 por millón entrada/salida: no conviene inferir cada ticket con modelo premium sin medir COGS. Construcción Codex y consumo SaaS son economías diferentes.
- Kernel: 12 tests pasan. Controlador: 23 tests pasan, incluyendo Git real con CLI Codex simulado. Revisiones independientes encontraron P2 de límites temporales y de hijos supervivientes al timeout: ambos reproducidos con tests rojos y corregidos. Una vuelta real Astra/Codex verificó E00 sin patch; se aceptó tras recheck y el siguiente gate faltante detuvo el grafo.
- Grafo: 55 tareas, 54 gates no escritos. Esta carencia bloquea construcción automática; no equivale a software entregado.

## 2026-09-18 — reinicio desde fuentes
- La exploración anterior no produjo transcripciones ni software. No constituye una investigación finalizada.
- ~/likida tiene commit 47db3c29 (2026-09-16); ~/likida.ai es una copia anterior en da535834 (2026-09-02). Priorizar likida para patrones vigentes.
- ~/atiende-fusion commit 75632c9; ~/atiende-landing commit 92872bc. No asumir que landing es producto completo.
- Whisper CPP tiene modelos locales ~/.cache/whisper-cpp/ggml-small.bin y ggml-tiny.bin. Evitar búsqueda global de / que anteriormente fue interrumpida.
- No se requiere ElevenLabs para estas notas: transcripción local protege contenido y evita API pagada.
