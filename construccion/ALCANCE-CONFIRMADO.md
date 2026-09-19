# Alcance completo confirmado desde las fuentes — 19-sep-2026

## Lectura solicitada y realizada
El usuario pidió releer TODO y construir de punta a punta, no quedarse en investigación ni en un dashboard. Se leyeron íntegros: la recopilación de los seis audios (ambas pasadas, incluyendo fragmentos dudosos), los 149 párrafos extraídos del DOCX y el PRD original de 35 secciones con su encargo final. Originales privados intactos; no se publican las transcripciones ni se confunden errores ASR con requisitos.

La matriz existente [02-TRAZABILIDAD-PRD](../docs/blueprint/02-TRAZABILIDAD-PRD.md) cubre las 35 secciones. Esta confirmación no reemplaza sus contratos, no reinicia el grafo y no marca funcionalidades como construidas.

## Resultado exigido, sin recortar el producto
| Obligación | Implementación y evidencia exigidas |
|---|---|
| Acceso y organizaciones | Next.js, Google vía Supabase Auth, usuarios/roles, cierre y renovación de sesión; pruebas de permisos y aislamiento A/B en DB, API, Storage, jobs y retrieval. F01/F07/F08. |
| Conversaciones y negocio | CSV y Excel, validación/rechazos por fila, órdenes, productos/SKU, clientes, refunds/returns/replacements, cobertura y procedencia. F02/F03. |
| HubSpot → Zendesk | Ambos adaptadores de lectura, paginación/reintentos, aliases y continuidad histórica/deduplicación. Debe demostrarse el mismo análisis antes y después; no ejecutar unilateralmente la migración del CRM del cliente. F03/F08. |
| Procesamiento durable | Ingestión y trabajos en segundo plano con estados persistidos, idempotencia, reanudación, leases/fencing, fallos visibles y borrado/reprocesamiento controlados. F02/F04/F07. |
| Comprensión y problemas | JSON validado, intención/sentimiento/urgencia/severidad/entidades/resolución, evidencia, embeddings/clusters estables y revisables, tendencias y causas probables diferenciadas de síntomas. F04. |
| Dinero y prioridad | Exposición/revenue at risk/refunds/replacements/soporte, horizonte, moneda, fuentes/supuestos, deduplicación y confianza explicable; observado/modelado/inferido separados, desconocido no es cero. Score 0–100 versionado y top10/top5. F05. |
| Ocho pantallas | Executive Overview, Business Problems, Problem Detail, AI Recommendation, Issue Explorer, Customer Explorer, Interventions y CEO Weekly Brief. F06: no sustituirlas por cinco vistas ni por tarjetas estáticas. |
| Acciones y resultados | Recomendaciones concretas ligadas a evidencia, esfuerzo/prioridad/oportunidad, asignar/dismiss/crear intervención, responsable/fechas/estado y comparación antes/después. No llamar ahorro causal a una reducción estimada. F06/F07. |
| Brief y exploración | Brief semanal con prioridades/decisiones/variación; preguntas y respuestas con filtros y citas del tenant, abstención ante falta de evidencia. Programación y errores verificables, no un texto de ejemplo. F06/F08. |
| Plataformas y operación | GitHub privado y CI real, Vercel/Supabase propios de VEXA, OpenRouter multimodelo con presupuesto y telemetría, Google OAuth ida/vuelta, versión/health/smoke remoto, backup/restore, runbooks y entrega. F01/F07/F08. |
| Piloto y pitch | Recorrido completo con datos autorizados; si sólo hay sintéticos, rotularlo y NO llamarlo piloto Senix. Medir calidad humana, comprensión CEO, acción y resultado; preparar pitch de un mes sin inventar validación comercial. F07/F08. |

## Qué significa seguir TODO sin contradecir las fuentes
- El PRD excluye del MVP 50 integraciones, acciones autónomas sobre cuentas, voice AI, MCP como función del SaaS, entrevistas IA, social listening, móvil y forecasting sofisticado. Se mantienen como futuro, no se pierden por olvido. Los agentes que CONSTRUYEN el producto sí pertenecen al encargo vigente.
- DOCX propone cinco vistas; PRD exige ocho: se implementan ocho. El stack solicitado posteriormente (Next/TypeScript, Vercel, Supabase, GitHub, OpenRouter) prevalece sobre FastAPI y AWS/GCP/Azure recomendados, no se duplican backends sin necesidad.
- Seis semanas en las fuentes frente a un mes pedido por el usuario: horizonte de entrega condicionado a accesos, no garantía temporal ficticia.
- Conflicto customer/SKU obligatorio frente a deseable: conservar datos incompletos con cobertura visible y limitar las métricas que no puedan calcularse. Decisión registrada, a confirmar con sponsor antes de vender alcance cerrado.
- Ejemplos de dinero, confianza y probabilidades son ilustraciones, no resultados ni parámetros calibrados. No sumar dos veces exposición y pérdida futura.

## Obligaciones de personas y accesos, no efectos que pueda inventar el código
1. Fundador/Javier: carta/acuerdo societario 70/30, acta, vesting/control/IP y separación de Convexia; no están formalizados por un audio.
2. Sponsor/cliente: NDA/DPA, autorización de uso y demo Senix, acceso HubSpot/Zendesk, export de órdenes/refunds, responsable y fecha efectiva de migración.
3. Titular de cuentas: cliente OAuth Google y consentimiento/redirects, proyecto cloud Supabase y presupuesto de infraestructura/OpenRouter. No reutilizar secretos o bases de Likida/Atiende/Moni.
4. Sponsor/evaluadores: gold humano, entrevistas/WTP, utilidad CEO, métricas y evidencia de intervenciones. No fabricar entrevistas, clientes de pago ni resultados.
5. Coordinación: plan previo a visita a Monterrey, intros USA/China y acuerdos de viaje/documentos. Son compromisos humanos propuestos, no features ni autorizaciones para reservas/firma/envíos.

## Criterio de cierre
No basta compilar. Usuario autorizado → conectar/importar → procesamiento durable → problemas/evidencias/importes → ocho vistas → intervención → medición/brief debe funcionar con permisos correctos y pruebas adversarias, además de integración remota verificada. Cada pendiente externo permanece explícito. El estado vivo se consulta con `python3 orchestration/runner.py status`; este documento NO acredita producto terminado.
