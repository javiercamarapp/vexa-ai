# Registro de decisiones técnicas y spikes

Estado: decisiones de diseño propuestas, no infraestructura provisionada. Responsable final: CTO. Referencias detalladas en 01–05 de esta carpeta.

| ID | Decisión que cierra | Ensayo y evidencia | Criterio de salida | Fallback honesto |
|---|---|---|---|---|
| S01 | API/versión HubSpot y acceso a cuerpo completo | 20 threads autorizados con mensajes/asociaciones, paginación y scopes | Reconciliar UI/export con API; documentar huecos | CSV exportado autorizado; no scraping de CRM autenticado como solución silenciosa |
| S02 | Zendesk cursor/comments/migración | Muestra con ticket id, comments, updates/deletes y mapa desde HubSpot | Mismos registros canónicos sin doble conteo | CSV postmigración y discrepancias visibles |
| S03 | Aislamiento Supabase | Dos tenants, roles, RLS tablas/vectores/storage/jobs, FK compuestas | 0 acceso cruzado incluso ID conocido o búsqueda semántica | Bloquear datos reales |
| S04 | Límites efectivos Vercel/plan | Versiones runtime, región, carga directa storage, función y timeout | Job aceptado durable; límite no pierde trabajo | Reducir chunk medido; nunca extender HTTP indefinidamente |
| S05 | Queue+workers vs Workflow | 100 unidades sintéticas, crash/lease/deploy y recuperación | 0 efectos perdidos/duplicados; operación y costo explicables | Escalar decisión humana; no operar dos runtimes equivalentes |
| S06 | Modelos/rutas OpenRouter por rol | Catálogo vigente, schema/citas, gold humano y costos | Candidato gana calidad/costo/latencia y cumple política | Modelo alterno compatible; abstención si ninguno |
| S07 | Política de privacidad | Synthetic request con allowlist/ZDR y endpoint incompatible | Fallo cerrado sin relajar residencia/retención | No inferencia sobre datos reales |
| S08 | Viabilidad capa financiera | 100 casos autorizados, joins orden/refund/producto y reconciliación | Cobertura y supuestos aceptados por sponsor | Costos observados y problemas; no churn probabilístico falso |
| S09 | Diseño piloto comercial | 3 fichas de problema ante sponsor | Acción concreta/owner y criterio de seguimiento | Entrevistar/reducir promesa, no más features |

## ADR-001: Next.js/TypeScript + Supabase
Un solo lenguaje de producto reduce fricción de agentes y pruebas de contratos en 30 días. No añadir FastAPI por inercia: sólo si clustering/evaluación demuestra necesidad que no cubre el runtime TS. PostgreSQL calcula/agrega; cliente no descarga medio millón de registros para sumar.

## ADR-002: Ingesta portable
CSV/Excel, HubSpot y Zendesk producen el mismo contrato. Cuenta e ID remoto no son ID universal; aliases conservan procedencia. No mezclar emails ni remapear históricos por igualdad de texto.

## ADR-003: Orquestación durable
Preferencia candidata por Supabase Queues y jobs SQL con workers cortos; se decide en S05 antes de depender de SDK Workflow. Un scheduler o cola no basta: probar consumidor y recuperación real.

## ADR-004: LLM sin autoridad financiera/operativa
Extrae señales/citas, sugiere etiquetas y acciones. No escribe dinero libre, no modifica modelos contables, no envía mensajes/refunds. Todo insight deriva de snapshot inmutable y permisos.

## ADR-005: IDs concretos de modelos tras evaluación
No usar latest como garantía de comportamiento. Catálogo, modelo, endpoint, política, prompt/schema y dataset versionados. Modelo de construcción Astra es independiente de modelo producto; más caro no prueba mayor valor por ticket.

## ADR-006: Release con compuertas
Preview, integración real, gold humano, seguridad SQL/E2E y autorización de datos antes de piloto. Fecha de pitch no autoriza omitir RLS ni fabricar métricas. Si falta acceso real, demo sintética se etiqueta como tal y no se presenta como validación Senix.

## Riesgos de arquitectura
Mayor riesgo de datos: duplicación durante migración. Mayor riesgo de inferencia: causa aparente tratada como hecho. Mayor riesgo financiero: sumas con solapamiento/horizontes distintos. Mayor riesgo de operación: consumidor dormido. Mayor riesgo del loop: aceptar pruebas que el mismo candidato debilitó. Cada uno tiene suite/guardia y dueño en blueprint.
