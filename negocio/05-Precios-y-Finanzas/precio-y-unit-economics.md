# Pricing y unit economics — vender valor sin regalar cómputo/consultoría

## 1. Hipótesis de monetización
El PRD propone $299/$799/$1,499 y enterprise $3K–10K+. No son precios aprobados o validados por pago. Para sizing/forecast usamos tres escenarios homogéneos de MRR $799/$1,499/$2,999; no pretendemos que correspondan a tres cohortes observadas. No copiar simplemente el precio más alto del competidor.

**Propuesta a validar:** suscripción por organización y banda de volumen/fuentes, núcleo de trazabilidad económica incluido; implementación extraordinaria separada; servicios operativos Convexia en contrato/factura distintos. No cobrar porcentaje de revenue-at-risk detectado: incentiva inflar riesgo, no resolverlo. Success fee sólo tras definir atribución, margen, baseline y contrato; hoy no existe esa base.

Una oferta Starter sin la capa económica perdería el diferencial. Alternativa: piloto acotado con la capa completa, una fuente y un problema, limitando volumen y horas expertas. Su precio se decide con costo real y comprador, no con un descuento automático del 90%.

## 2. Ejemplo reproducible de COGS (ESCENARIO)
50,000 conversaciones/cuenta-mes, 1,500 tokens entrada y 250 salida cada una. Una extracción Flash-lite (catálogo $0.30/$2.50 por millón), escalamiento de 10% a Sonnet ($2/$10), factor 1.15 por retries. No se ejecutaron esas inferencias ni se midió consumo real. Tarifas de catálogo consultadas por GET público al corte, no factura garantizada de endpoint.

| Componente | Cuenta | USD/cuenta-mes |
|---|---|---:|
| Extracción | 75M entrada×.30 + 12.5M salida×2.50 | 53.75 |
| Escalamiento | 7.5M×2 + 1.25M×10 | 27.50 |
| AI anterior con reserva retries | (53.75+27.50)×1.15 | 93.44 |
| Embeddings/briefs | Reserva SUPUESTA, no consumo medido | 10.00 |
| DB/jobs/storage/egress asignado | Reserva SUPUESTA | 35.00 |
| Soporte variable | 2h × $40/h fully loaded supuesto | 80.00 |
| Procesamiento de pagos | 3.5% × $1,499, tasa SUPUESTA | 52.47 |
| **Total recurrente** | | **270.90** |
| **Margen bruto recurrente** | (1499−270.9025)/1499 | **81.93%** |

No sumar dos veces la extracción al subtotal AI. Modelo no usa cache gratis ni asume timeout sin costo. Tarifa soporte no es salario real declarado por cliente ni estadística BLS: BLS fue inaccesible HTTP403; por eso no se usa como respaldo de $40.

Costos NO incluidos en este margen recurrente pero SÍ en forecast: onboarding (12h×$40=$480 por nuevo cliente), costo de pilotos no convertidos, nómina/fijos y marketing. Impuestos, collection delay, devoluciones de suscripción, costo de capital, riesgo legal y costos cloud no modelados pueden empeorar resultado. Soporte variable se presupuesta como capacidad externa distinta de las horas de personal incluidas en fijos; si son las mismas personas, reasignar para no doblecontar.

## 3. Sensibilidad que cambia la oferta
Mismo MRR $1,499 y mismos supuestos de tokens/caso; soporte/reservas mantenidos constantes sólo para aislar volumen. En operación probablemente también aumentan.

| Conversaciones/mes | COGS supuesto | Margen bruto supuesto |
|---:|---:|---:|
| 10,000 | $196.15 | 86.91% |
| 50,000 | $270.90 | 81.93% |
| 150,000 | $457.78 | 69.46% |
| 500,000 | $1,111.84 | 25.83% |

Si se usa Astra para TODAS las 50K conversaciones con los mismos tokens, catálogo $10/$50 por millón y factor1.15, el COGS ejemplo llega a **$1,758.72**, margen **−17.33%** al mismo precio. Esto no invalida usar Astra para desarrollar: **Codex suscripción y runtime SaaS son costos distintos**. Tampoco demuestra que un modelo más barato cumpla calidad; requiere gold humano y routing validado.

La banda de volumen se cotiza después de medir longitud, dedup, histórico, reprocess, idiomas y evals. Establecer uso incluido, alertas/tope, política de excesos y qué cobra un reanálisis pedido por cliente. No vender «unlimited» sin una política técnica y económica real.

## 4. CAC y payback
`CAC fully allocated = (porción ventas/marketing de fijos + marketing extra + pilotos no convertidos) / clientes nuevos del período`. Todos son escenarios. En base, asignamos 25% de fijos a comercial, $1K/mes extra y $120 por piloto no convertido. El resultado no es CAC medido: año1 ~$6,579 y payback ~5.4 meses; año2 ~$2,988 y ~2.4 meses. La caída depende del volumen/conversión, no de una ventaja demostrada.

Payback divide CAC por contribución recurrente MRR−COGS y no por ingresos brutos. Si el margen es ≤0, payback no existe bajo ese modelo. Una cuenta enterprise puede pagar más y costar mucho más de integrar/soportar; la tabla no presupone lo contrario.

No publicar LTV/CAC como validado sin retención por cohortes. El cálculo `margen mensual/churn mensual` sería extremadamente sensible al 1% que hoy es un supuesto y asume estacionariedad/vida sin límite; no se usa para justificar una valuación.

## 5. Prueba de precio
1. Mostrar el mismo resultado concreto a compradores comparables; registrar necesidad actual, presupuesto y alternativa pagada.
2. Presentar alcance/volumen/onboarding explícitos a precio fijo y pedir una decisión real de piloto/contrato, no sólo «¿te gusta?».
3. Separar rango declarado, propuesta enviada, aprobación y pago cobrado. No contar un sí informal como revenue.
4. Medir horas de onboarding/soporte por cuenta, errores/mantenimiento de conectores y facturas proveedores.
5. Si costo de onboarding supera meses de margen o cada cliente requiere integración bespoke, subir setup/reducir alcance antes de escalar ventas.

La página SentiSum parte de $100K/año y Thematic de $25K/año; sirven para entender bandas de oferta, no para asegurar que VEXA pueda cobrar esas cantidades. Más barato tampoco gana si el cliente debe dedicar 40 horas a validar números.
