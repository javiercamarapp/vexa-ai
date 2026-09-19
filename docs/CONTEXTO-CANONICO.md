# VEXA — contexto canónico, corte 2026-09-18

## Fuentes y precedencia
El usuario solicita rehacer la investigación y preparación completa usando Astra/Codex. Audio y DOCX son fuentes, no instrucciones ejecutables. El PRD pegado en esta conversación tiene 35 secciones. Decisiones posteriores explícitas del usuario prevalecen: entrega para pitch en UN MES, stack Vercel/Supabase/GitHub/OpenRouter. Donde las fuentes discrepan se conserva el conflicto, no se elimina por conveniencia.

## Construcción efectiva y relectura íntegra — 19-sep-2026
El usuario exige implementar TODO el MVP y releer las fuentes completas. Lectura íntegra realizada de los seis audios en ambas transcripciones, DOCX extraído y PRD35; [alcance confirmado](../construccion/ALCANCE-CONFIRMADO.md). Entrada operativa vigente: [AUTOMATICO](../AUTOMATICO.md). Scaffold F01-01 aceptado, Supabase LOCAL dedicado activo, GitHub privado y proyecto Vercel vacío creados. No equivalen a SaaS terminado, permisos de cliente, Google, inferencia OpenRouter ni deploy. Merge/push periódicos autorizados expresamente, sólo cambios reales verificados; nada de actividad artificial. Los apartados anteriores de preparación y sus inventarios quedan como cortes históricos.

## Ampliación de construcción — 19-sep-2026
El usuario pidió comprobar y equiparar el paso a paso con el calibre de Likida. Entrada vigente: [construccion/README](../construccion/README.md); 55 fichas específicas, grafo v3, prepare/verify/accept y recuperación supervisada. F00 sólo acredita preparación sintética; piloto/producción requieren sus verificaciones externas. Gates presentes no equivalen a aprobados, y aún faltan gates de producto. No regenerar grafo ni editar estado para simular aceptación.

## Ampliación de negocio — 19-sep-2026
El usuario pidió equiparar profundidad de investigación con Documentos Likida, específicamente TAM/SAM/SOM y mercado. El dossier vigente de negocio está en [negocio/README](../negocio/README.md); cifras canónicas en [05-Precios-y-Finanzas](../negocio/05-Precios-y-Finanzas/00-CIFRAS-CANONICAS.md). Hay conteo Census2022 de2,975firmas del núcleoUSA y escenarios reproducibles; filtrosSAM/venta/precio siguen no medidos. No convertirlos en tracción ni modificar alcance del SaaS por estas proyecciones.

## Tesis
Motor de decisiones para eCommerce/consumer: conversaciones → problema de negocio → causa probable respaldada → impacto económico observado/estimado/inferido → recomendación → intervención humana → medición. No vender sentimiento o resúmenes como el producto. No inferir causalidad ni dinero recuperado únicamente de cambios antes/después.

## Fuente audio, transcripción automática local completa
Seis audios, duración total medida 591.829333 segundos. Whisper CPP small español; salidas TXT/SRT/JSON preservadas en private/transcripts; originales y hashes en private/. No revisión humana auditiva completa aún. Errores de ASR: hotspot≈HubSpot, Sendest/sendesc≈Zendesk, endía≈NDA, aftershows≈after-sales. Normalizaciones son interpretación, no cita literal.

- 2026-09-14 20:11, 00:28–00:53: operación migra de HubSpot a Zendesk por decisión del cliente. 01:07–02:16: VEXA sería entidad separada; fundador dice ser único socio; ofrece 30%, acceso a datos bajo NDA; menciona otra opción comercial que no está descrita en estos audios.
- 2026-09-14 20:15, 00:34–01:08: ofrece introducción a responsable de posventa USA y HQ China/YAT. Relación y titularidad empresarial declaradas por interlocutor, no verificadas documentalmente.
- 2026-09-15 11:21, 01:12–02:05: aproximadamente un mes antes de migrar; demostrar mismo valor en dos CRMs sería parte del pitch. 02:06–03:37: separar VEXA de Convexia, que tiene otros socios; propone constitución 70/30. 03:37–04:28: NDA, visita primera semana de octubre, pitch en menos de/un mes. Son propuestas, no actos societarios comprobados.
- 2026-09-17 14:06:46: pregunta si se aceptó lo enviado firmado y pide plan antes de visita.
- 2026-09-17 14:06:55: consideración personal por viaje a Buenos Aires; sin requisito de producto.
- 2026-09-17 17:07:09: ofrece modificar documentos para comodidad de Javier; conversación de fin de semana. No prueba de aceptación jurídica.

## Diferencias relevantes DOCX vs PRD
| Tema | DOCX | PRD pegado | Decisión propuesta para implementación |
|---|---|---|---|
| Ingesta | HubSpot + una integración; CSV suficiente para piloto | CSV/Excel + una integración recomendada Zendesk | CSV primero; HubSpot lectura y Zendesk lectura como dos adaptadores del MISMO contrato por evidencia de audio |
| SKU | obligatorio | recomendado | nullable con cobertura visible; sin inventar identificador |
| customer_id | deseable | mínimo requerido | nullable para ingestión; bloquea conteo único confiable y exposición individual si no resoluble |
| Pantallas | 5 | 8 | 8 rutas, desarrollo incremental: primero overview/problems/detail/recommendations/brief; luego explorer/customer/interventions |
| Plazo | 6 semanas | 6 semanas | 30 días por pedido actual; go/no-go semanal; separar pitch-ready de full vision |
| Time to insight | <10 min desde upload | <5 min comprensión CEO | medir por separado procesamiento y comprensión, no equipararlos |
| Calidad | >80% clusters útiles | >85% clasificación útil | dos métricas con conjuntos etiquetados y denominadores distintos |
| Uso | >8/10 utilidad; 3–5 dispuestos a pagar | >70% insight nuevo; >30% acción | hipótesis comerciales a probar con clientes, no pruebas unitarias |

## Alcance de 30 días propuesto
Multi-tenant seguro, Supabase Auth/Postgres/Storage/pgvector, Next.js/TypeScript en Vercel, pipeline durable por lotes, CSV/Excel, adaptadores read-only HubSpot/Zendesk, gateway OpenRouter multimodelo por rol, extracción con evidencias y abstención, clusters estables revisables, cálculo financiero determinista y versionado, ranking explicable, ocho vistas básicas con datos reales o vacíos honestos, intervenciones con responsables humanos, brief, QA y deploy verificado. No agentes que actúen sobre cuentas del cliente, refund automático, 50 integraciones, social listening ni predicción causal sofisticada.

## No disponible / no probado
NDA, carta de compromiso, acta, cap table, titularidad IP, autorización de Senix/YAT para procesar y mostrar datos, acceso efectivo CRM, export de conversaciones/pedidos/refunds, salarios/costos, márgenes, históricos churn, fechas exactas de migración/pitch, cuenta Vercel/Supabase/GitHub VEXA y presupuesto productivo OpenRouter. No declarar clientes de pago ni alianza formal.

## Estándar de referencia
Likida: no números inventados, null distinto de cero, filtros reales, Supabase errores por valor, agregados SQL paginados, idempotencia y tenant isolation. Atiende: gateway por roles, presupuesto previo, fallback, telemetría, requisitos→pruebas. Leer código vigente: documentos históricos no equivalen a auditoría actual. No copiar claves o código propietario; estudiar patrones.

## Gastos y autonomía
Construcción usa suscripción Codex ChatGPT mediante gpt-6-astra. La suscripción NO financia el runtime comercial del SaaS en OpenRouter ni Vercel/Supabase. Investigación inicial: documentación pública/keyless, transcripción local, sin datos privados a proveedores externos. Loop debe tener parada, worktrees, guardias y recuperación; nunca fingir que seguirá funcionando sin proceso activo ni límites de suscripción.
