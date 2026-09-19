# 01 · Contrato del motor financiero

Estado: especificación propuesta, no implementación ni resultado de cliente. Corte documental: 2026-09-18. Responsable de implementar: ingeniería de datos; aceptación: QA y responsable financiero humano. Todos los importes y registros de ejemplo son **SINTÉTICOS**.

## 1. Alcance y fuentes

[Contexto canónico](../../CONTEXTO-CANONICO.md): SKU y customer_id pueden faltar; no hay márgenes, costos, históricos ni pedidos de cliente comprobados. No convertir texto de tickets en asiento contable. [Fuente Shopify](../../investigacion/fuentes/shopify.md) orienta posibles entidades de órdenes/refunds, pero sus extractos no prueban acceso ni un contrato de integración vigente. [HubSpot](../../investigacion/fuentes/hubspot.md) y [Zendesk](../../investigacion/fuentes/zendesk.md) respaldan la necesidad de paginación y asociaciones; sus identificadores no se consideran equivalentes entre CRMs.

El motor es una función determinista `calculate(snapshot, scope, policy_version) -> metric_bundle`. El LLM propone categorías, evidencia e hipótesis; no calcula dinero, decide tipos de cambio, completa costos ni modifica el ledger. La misma entrada canónica produce el mismo resultado y hash, independientemente del orden de llegada o número de reintentos.

## 2. Contrato de entrada y salida

| Entidad | Campos obligatorios y restricciones |
|---|---|
| Snapshot | tenant_id, snapshot_id, as_of UTC, watermark por fuente, content_hash, schema_version, integridad/completitud por fuente |
| Orden | tenant_id, canonical_order_id, source_account, external_id, occurred_at, currency, amount_minor nullable, amount_basis; customer_id/SKU nullable |
| Evento financiero | tenant_id, canonical_event_id, source_account, external_event_id, kind, status, occurred_at, recorded_at, currency, amount_minor nullable, evidence_ref; order_id nullable, reversal_of nullable |
| Relación problema | tenant_id, problem_id, entity_type, entity_id, relation_version, evidence_ref, attribution_weight nullable |
| Costo de soporte | activity_id único, duración observada nullable, tarifa aprobada nullable, moneda, versión de tarifa, procedencia; no imputar duración a partir de longitud de texto |
| Hipótesis futura | forecast_id, unidad/cohorte, horizonte, basis, p_event, loss_given_event, evidence/calibration_version, supuestos, método de intervalo |
| Resultado por métrica | metric_id, tenant_id, snapshot_id, policy_version, scope_hash, basis, grain, currency, window, amount_minor nullable, lower/upper nullable, interval_kind, status, known_subtotal, eligible_n, known_n, missing_reasons, evidence_refs, calculated_at |

`status ∈ {complete, partial, unavailable, not_applicable}`. `null` significa desconocido/no calculable y requiere motivo; `0` requiere observación suficiente para afirmar ausencia. `not_applicable` no se agrega como cero. Una suma de dos importes conocidos y uno desconocido devuelve `amount=null`, `known_subtotal=sum(conocidos)`, `status=partial`; la UI no presenta el subtotal como total. Colección vacía con ingesta incompleta tampoco prueba cero.

Dinero: enteros en unidades menores más exponente monetario versionado, o decimal exacto en cálculos intermedios; prohibido float binario. Redondear una vez al límite de salida según política explícita. Fechas: persistir UTC; ventanas semiabiertas `[inicio, fin)`, zona de negocio visible. Mantener `occurred_at` y `recorded_at`: un dato tardío crea nueva versión, no reescribe silenciosamente un reporte ya emitido.

## 3. Cuatro familias que nunca se suman por defecto

| Familia | Definición y unidad | Condiciones / etiqueta pública |
|---|---|---|
| Exposición de ingresos | Suma de `order_amount_basis` de órdenes únicas vinculadas a un problema en una ventana | «Ingresos de órdenes vinculadas», no pérdida, churn ni ingreso recuperable. Fijar tratamiento de descuentos, impuestos, envío y devoluciones en amount_basis |
| Expected future loss (EFL) | `Σ_u P(evento en H | evidencia) × E[pérdida incremental | evento,H]` para unidades sin solapamiento | Separar `future_revenue_loss` de `future_contribution_loss`; sin calibración/histórico mostrar escenario hipotético, no forecast confiable |
| Refunds observados | Suma neta de eventos liquidados de devolución y sus reversals válidos | Una solicitud de devolución no es refund pagado. El importe observado no demuestra que un problema lo causó |
| Replacements / soporte | Replacements: costo incremental documentado de producto/logística, descontando recuperaciones no duplicadas. Soporte: gasto registrado o duración × tarifa aprobada | Mostrar componentes por separado. Duración × tarifa es costo modelado con entradas observadas, no egreso bancario observado |

Ingresos ≠ margen. Sin COGS, costos variables y política contable aprobados, `contribution_margin=null`. No aplicar un margen de industria inventado. Un total de «costos de servicio asociados» solo se permite cuando las categorías son mutuamente excluyentes, tienen misma moneda/ventana/base y están conciliadas. Refund puede ser contraingreso; no llamarlo gasto contable sin validación financiera. Nunca sumar exposición + EFL + refunds como «impacto total».

Si una orden tiene varios line items, elegir una base: exposición de orden completa una vez, o líneas afectadas identificadas. No mezclar ambas dentro de una métrica. Si falta línea/SKU, declarar exposición a nivel orden; no repartir entre SKUs inventados. Si solo se conoce ingreso histórico de un cliente, no tratarlo como LTV futuro.

## 4. Identidad, deduplicación y atribución

1. Clave de ingesta única: `(tenant_id, source_account, entity_type, external_id, source_revision)`; las revisiones actualizan estado canónico sin sumar copias. La clave económica estable del evento excluye `source_revision`.
2. Alias de migración HubSpot→Zendesk requiere tabla explícita, procedencia y revisión. Coincidir email/texto no basta para fusionar clientes u órdenes. Ambigüedad va a cuarentena; el reporte muestra cobertura y posible duplicación.
3. Eventos distintos de una misma orden sí pueden sumar (dos refunds parciales); mensajes distintos que mencionan el mismo refund no. No deduplicar por importe/fecha exclusivamente.
4. Por problema se muestra el conjunto de órdenes/clientes relacionados. El total global usa la unión de IDs, no la suma de filas de problemas. Las filas llevan advertencia «no aditivas» si se solapan.
5. Para una vista aditiva por problema, pesos humanos/aprobados `w(evento,problema) >= 0`, suma por evento ≤1; el resto queda «sin atribuir». Reparto no significa causalidad. Si no hay política, no repartir automáticamente en partes iguales.
6. Contar clientes únicos solo entre IDs resueltos; mostrar «2 conocidos + 1 conversación sin identidad», nunca «3 clientes». Una orden sin customer_id sí puede contar en exposición de órdenes si su identidad/importe son verificables.
7. Snapshot de forecast excluye eventos ya liquidados dentro de la misma base. Cuando un riesgo se realiza, mantener pronóstico histórico y registrar realizado separado; no conservarlo además como riesgo abierto.

## 5. Monedas, horizontes e intervalos

No sumar USD+MXN ni usar un FX implícito. Salida nativa siempre separada por moneda. Conversión optativa requiere `fx_source, fx_date, base, quote, rate, rate_version` aprobados; preservar original, importe convertido y redondeo. Tipo faltante → total convertido desconocido; nunca 1:1.

Exposición usa ventana de órdenes; refunds pueden usar ventana de liquidación o cohorte de órdenes. Son métricas distintas con nombres distintos. EFL comienza estrictamente en `as_of` y termina en horizonte explícito (p. ej., 30 días), con cohorte congelada. No comparar forecast de 30 días con refund de un año ni sumar EFL de horizontes anidados 30/90 días.

Un intervalo de escenario es una sensibilidad a supuestos, no un intervalo de confianza. Guardar `interval_kind ∈ {scenario, confidence, prediction, none}`, nivel y método cuando correspondan. Las sumas de cuantiles no son cuantiles de la suma: para intervalos estadísticos agregados preservar dependencia por cliente/orden mediante simulación conjunta o remuestreo de unidades independientes. Sin modelo de dependencia reportar rango de escenarios y limitación. No fabricar un «95%».

## 6. Reversals, consistencia y trazabilidad

Ledger append-only lógico: correcciones referencian original y versión. Un reversal tiene signo negativo, mismo tenant/moneda/base y vínculo al evento original. Un reversal parcial no puede superar el saldo reversible; duplicados se ignoran por clave. Reversal sin original queda pendiente, no rebaja el total. Si llega primero, reconciliar al recibir original y generar nuevo snapshot. Reembolso sobre original cancelado/no liquidado se revisa. Conciliar refunds acumulados contra base elegible de orden; exceso se marca inconsistencia, no se recorta en silencio.

Al borrar evidencia por política de privacidad, aplicar el documento 03: no conservar texto en nombre de auditoría. Se puede invalidar/recalcular la métrica y conservar un registro mínimo autorizado de versión y motivo. Toda cifra clicable resuelve sus eventos fuente o indica explícitamente que la evidencia fue eliminada.

## 7. Calidad observada y prioridad

Confianza es un vector: cobertura de identidad, completitud de fuente, conciliación, validez de citas, antigüedad, precisión/recall medidos en evaluación humana comparable y calibración de forecast. Guardar numerador, denominador, versión y fecha. `confidence=0.97` emitido por un modelo se descarta. Sin evaluación aplicable: «no calibrado»; no extrapolar precisión de español a otro idioma o CRM nuevo.

Ranking en dos carriles: (1) incidentes de seguridad física, privacidad, fraude o severidad crítica, incluidos los **posibles** con baja evidencia, visibles en bandeja de revisión humana; (2) oportunidades ordinarias ordenadas con fórmula/versiones e información faltante expuestas. No multiplicar severidad por confianza para ocultar el carril 1. Hipótesis grave requiere revisión, no afirmación de incidente confirmado. Acuse/resolución por humano con razón; un cambio de filtro no debe hacer desaparecer sin aviso el contador de críticos fuera del filtro. «Sin señal crítica» no significa ausencia de riesgo.

## 8. Oráculo numérico SINTÉTICO F-FIN-01

Moneda USD, exponente 2, ventana de septiembre, base de ingreso de orden excluye impuestos/envío. Órdenes O1=100.00 (C1), O2=200.00 (C1), O3=null (cliente desconocido). P1 vincula O1/O2; P2 vincula O1. O3 queda sin problema. Eventos sobre O1: R1 refund liquidado +20.00, copia R1 +20.00, V1 reversal de R1 −5.00; replacement K1 con costo documentado 12.00. Soporte S1: 10 minutos observados × tarifa sintética aprobada 0.50 USD/min = 5.00 modelados.

Esperado: exposición P1=300.00; P2=100.00; global vinculado=300.00, nunca 400.00. Exposición de todas las órdenes: null, subtotal conocido 300.00, cobertura 2/3. Clientes conocidos en problemas=1. Refund neto=15.00; replacement=12.00; soporte modelado=5.00. No emitir «pérdida total 332.00». Con pesos de refund P1=.6/P2=.4, atribuciones=9.00/6.00.

Forecast independiente, posterior al snapshot y sobre O2: probabilidad sintética .2 y pérdida incremental condicional 50.00 → escenario EFL=10.00 USD; rangos de supuestos p=[.1,.3], pérdida=[40,60] → escenario [4,18]. No es intervalo estadístico ni forecast validado. Si probabilidad o pérdida faltan, EFL=null.

## 9. Pruebas y gates obligatorios

| ID | Preparación / acción | Aserción exacta |
|---|---|---|
| FIN-01 | Ejecutar F-FIN-01 con cada permutación de eventos y luego replay completo | Mismos importes y hash canónico; una R1 |
| FIN-02 | Agregar P3 con O1 y un ticket duplicado | Global sigue 300.00; conteo de órdenes=2; relaciones no inflan dinero |
| FIN-03 | O2 cambia a MXN; no FX | USD=100.00 y MXN=200.00 separados; total combinado=null |
| FIN-04 | Cambiar O3 null por cero verificado | Total todas órdenes=300.00, cobertura 3/3; antes era null |
| FIN-05 | V1 llega antes de R1; después llega reversal de 30.00 | Primero pendiente; luego neto 15.00; exceso bloqueado/inconsistencia visible |
| FIN-06 | R1 aparece en dos CRMs con alias aprobado / sin alias | Con alias cuenta una vez; sin alias no afirmar total conciliado |
| FIN-07 | Fecha exactamente fin de ventana; ingestión tardía | Excluida de ventana anterior; snapshot viejo inmutable y nuevo versionado |
| FIN-08 | SKU/customer_id desconocidos; varios tickets C1/O1 | No inventar SKU/cliente; únicos conocidos=1; subtotal visible |
| FIN-09 | Modelo dice confianza .99 y no tiene citas válidas | Hipótesis no confirmada; cifra no publicable; crítica posible permanece en revisión |
| FIN-10 | Recalcular snapshot tras cambiar versión de tarifa | Nueva versión; soporte antiguo preservado; ningún cambio retroactivo oculto |
| FIN-11 | Dos escenarios de 30 y 90 días | UI/export impiden sumarlos; horizontes visibles |
| FIN-12 | Falta costo de replacement, pero precio de venta=100 | Costo=null; no usar 100 como costo ni margen |

Gate de release: 100% de invariantes financieros y oráculos pasan; cero discrepancias UI/API/export para mismo scope_hash; cero importes sin unidad, base, procedencia y estado. Una falla bloquea publicación financiera. Estas pruebas están especificadas, no ejecutadas en un motor existente.
