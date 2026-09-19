# Trazabilidad integral del PRD y fuentes

El PRD íntegro original está en `private/PRD-Y-ENCARGO-ORIGINAL.md`; DOCX en `private/blueprint-original.txt`; los audios completos en `private/TRANSCRIPCIONES-COMPLETAS.md`. Paths privados no se versionan/publican. Esta matriz mapea todas las secciones a decisiones y evidencia futura; no indica implementación terminada.

| PRD § | Requisito/tesis | Destino y prueba |
|---:|---|---|
| 1 | Qué pasa/cuánto cuesta/qué hacer/si funcionó | Blueprint maestro F04–08; E2E cinco preguntas y medición humana |
| 2 | Business Problem como entidad | Contratos problems/version/memberships/evidence; persistencia estable ante nuevos lotes |
| 3 | ICP $10M–100M, volumen y verticales | Investigación tesis y GTM: hipótesis por validar, no TAM confirmado |
| 4 | Senix primer design partner | Audio + plan piloto; NDA/DPA/acceso y sponsor pendientes |
| 5 | Top 10 problemas, CEO <5 min | F05/06 y rúbrica cronometrada humana; no latencia de backend |
| 6 | Conversaciones y datos negocio | Contrato nullable SKU/customer; calidad/cobertura, rejects por fila |
| 7 | CSV/Excel + integración | F02/03; audio obliga soportar transición HubSpot/Zendesk; otras fuentes roadmap |
| 8 | Customer/conversation/product/problem/intervention | Esquema expandido con tenant, revisiones, ledger, jobs, snapshots y evidencias |
| 9 | Understand | F04 extracción con schema, pruebas gold y citas |
| 10 | Root cause | Hipótesis de causa no causalidad confirmada; clustering revisable y etiquetas humanas |
| 11 | Economic impact | Contrato financiero separa familias; no sumar revenue at risk y futuro dos veces |
| 12 | Revenue at Risk fórmula | Kernel scenario con supuestos/horizonte; sin histórico no probabilidad calibrada |
| 13 | Confidence | Vector de cobertura/evals/calibración; no porcentaje autogenerado LLM |
| 14 | Priorización ejecutiva | F05/06 ranking y desglose; crítica física aparte, sin inventar carrier/SKU |
| 15 | Priority 0–100 | Modelo versionado, razones y sensibilidad; no usar multiplicador que silencie riesgos críticos |
| 16 | Ocho pantallas | F06 + calidad/04 acepta todas y setup imprescindible; estados vacíos/errores reales |
| 17 | Aha monetario | Guion demo con cifras reales o fixture rotulado; no usar $312K como resultado Senix |
| 18 | Recomendaciones problema→evidencia→acción | F06 precondiciones + referencias + esfuerzo/humano; no acciones externas implícitas |
| 19 | Nada genérico | Rúbrica: ubicación/dato real, mecanismo, actor, condición y métrica; abstenerse si faltan |
| 20 | JSON clasificación | Validación schema+refs; churn/refund_probability del ejemplo no se aceptan como calibradas |
| 21 | Arquitectura recomendada | ADR TS/Next.js + stack pedido Vercel/Supabase/GitHub/OpenRouter; FastAPI sólo si necesario |
| 22 | Flujo data→acción→medición | Diagrama maestro y jobs/checkpoints por etapa |
| 23 | Seis semanas | Sustituido por horizonte usuario de 30 días; F00–08 y go/no-go semanal |
| 24 | No agentes/MCP/50 integrations | Distinguir agentes de construcción vs autonomía del SaaS. Exclusiones conservadas |
| 25 | Pricing | Hipótesis 299/799/1499; medir consumo/margen y willingness to pay |
| 26 | Venta por valor | Evidencia financiera conciliable, no inflar riesgo para justificar factura |
| 27 | Convexia identifica/implementa/mide | Acuerdos separados y permisos IP/datos; no alianza jurídica asumida |
| 28 | Modelo comercial servicios | Software, implementación y BPO con márgenes/acuerdos separados |
| 29 | Moat histórico/económico/intervenciones | Versiones, datos autorizados y aprendizaje por tenant; cross-tenant fuera sin consentimiento |
| 30 | Ask anything futuro | Explorer restringido al alcance actual; no prometer explicar causalmente toda caída de revenue |
| 31 | Success metrics | Calidad/02, denominadores/holdout/intervalos; métricas comerciales exigen humanos |
| 32 | Primera demo Senix | F08 con permiso; si no hay datos, demo sintética no validación de cliente |
| 33 | Revenue Risk Resolved | Calidad/05 distingue riesgo reducido, expirado y ahorro causal; no equivalente a cash |
| 34 | Posicionamiento | Ajustar exclusividad por competencia observada; mantener promesa con límites visibles |
| 35 | Loop de producto | Automatizar procesamiento; recomendaciones e intervenciones bajo dueño humano; medición no inventada |

## Adiciones exigidas por audios y petición actual
A01 HubSpot→Zendesk con continuidad: F03 y S01/S02. A02 acuerdo societario 70/30 y separación Convexia: dossier CTO. A03 documentos firmados/NDA pendientes: checklist de acceso. A04 pitch un mes y visita octubre: hitos relativos hasta fecha confirmada. U01 Astra/Codex para construir: runner comprueba login ChatGPT y no hereda API keys. U02 investigación nivel Likida: dossier por dominio con fuentes/pendientes; no equivalencia por número de archivos. U03 loop graph: PROGRAMA, graph, prompts, controlador y tests; gate faltante bloquea por diseño.

## Discrepancias que NO se resuelven inventando
DOCX tiene 5 screens, customer deseable/SKU obligatorio y <10 min desde upload; PRD 8 screens, customer mínimo/SKU recomendado y <5 min ejecutivo. Se preservan ambas lecturas en contexto canónico y se elige nullable+coverage y dos cronómetros por razones técnicas. Validar estos cambios con sponsor antes de vender scope cerrado.
