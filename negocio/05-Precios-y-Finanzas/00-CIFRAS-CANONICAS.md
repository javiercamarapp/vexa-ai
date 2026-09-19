# Cifras canónicas de mercado y negocio VEXA

Corte de investigación: **19-sep-2026 UTC**. Moneda del modelo: **USD**. Datos oficiales de empresas: **2022**, publicados 10-abr-2025, clasificación NAICS 2017. Los precios propuestos son escenarios de 2026 aplicados a ese universo histórico: NO son un conteo actualizado a 2026.

## Semáforo obligatorio
- **OBSERVADO:** valor encontrado en tabla primaria o página abierta; no implica que midamos su verdad independientemente.
- **DERIVADO:** cálculo reproducible desde valores observados; hereda límites de la fuente.
- **ESCENARIO:** depende de precios, filtros o desempeño supuesto; NO es evidencia de tracción.
- **NO MEDIDO:** datos propios/piloto/contratos que todavía no existen en esta investigación.

| Indicador | Valor | Naturaleza / procedencia |
|---|---:|---|
| Firmas NAICS 454110, receipts empresariales ≥$10M y <$100M | **2,975** | DERIVADO de 9 bandas Census, filas Excel 18333–18341 |
| Establecimientos de esas firmas | 3,212 | DERIVADO; no usar establecimientos como clientes |
| Firmas retail 44–45, mismas bandas | 37,825 | DERIVADO sector; incluye 454110, no sumarlos |
| Firmas manufactura 31–33 | 28,622 | DERIVADO sector, no todas son marcas de consumo |
| Firmas mayoreo 42 | 44,106 | DERIVADO sector, no todas tienen posventa consumidor |
| Unión amplia manufactura/mayoreo/retail | **44,106–110,553** | COTA matemática, no censo deduplicado ni TAM elegible |
| Precio base supuesto | $1,499/mes; $17,988/año | ESCENARIO del PRD; no validado por compradores |
| TAM núcleo, a precio base | **$53,514,300/año** | ESCENARIO: 2,975 × $17,988; no TAM global |
| TAM núcleo sensibilidad precio | **$28.52M–$107.06M/año** | ESCENARIOS a $799–$2,999/mes; no intervalo estadístico |
| SAM base | **589.05 cuentas equivalentes; $10,595,831/año** | ESCENARIO con 4 filtros NO medidos; redondear ~589 y ~$10.6M al presentar |
| SOM base salida años 1/2/3 | **$145,915 / $524,524 / $988,700 ARR** | ESCENARIO de embudo, capacidad, churn y universo agotable |
| Ingreso recurrente reconocido base años 1/2/3 | **$49,064 / $321,855 / $790,486** | ESCENARIO, distinto de ARR de salida |
| Clientes equivalentes base al cierre años 1/2/3 | **8.11 / 29.16 / 54.96** | Expectativa matemática; no clientes reales ni cuota prometida |
| COGS recurrente ejemplo 50K conversaciones | **$270.90/cuenta-mes** | ESCENARIO, incluye soporte/AI/cloud/reserva/pagos; no factura observada |
| Margen bruto recurrente ejemplo base | **81.93%** | ESCENARIO; excluye onboarding/fijos que sí entran al flujo de caja |
| Caja base máxima necesaria para primeros 18 meses | **$175,437** | ESCENARIO de déficit acumulado antes de financiar, sin colchón |
| Caja base anterior + 6 mensualidades de fijos/marketing año 2 | **$289,437** | ESCENARIO; no ask aprobado ni garantía de 24 meses |
| Clientes de pago VEXA acreditados en esta investigación | **0 acreditados** | NO MEDIDO: no se aportaron contratos/facturas; no afirmación sobre hechos externos desconocidos |

## Cifras de contexto que jamás se convierten en TAM VEXA
- Census Q2-2026: **$340.2B** ventas ecommerce USA ajustadas estacionalmente, **17.1%** del retail. Ventas de comercios, no gasto en VEXA.
- NRF/Happy Returns: **$849.9B** devoluciones retail proyectadas para 2025 y **19.3%** de ventas online devueltas. Valor devuelto, no pérdida neta evitada ni mercado software.
- MarketsandMarkets: CEM global **$15.78B en 2026 → $34.02B en 2032**, CAGR **13.7%**; estimación comercial amplia con software/servicios y sectores distintos.
- Shopify: **$378.441B GMV 2025**, reporte financiero p.1; no número de empresas compradoras de VEXA.
- AMVO, edición EVO 2026: **$941 mil millones MXN** y **77.2M compradores**; la página pública no fija inequívocamente el año base de esas dos cifras. No convertir compradores ni ventas en empresas elegibles.

## Fuente única / cómo cambiar
Universo: `universo-census.json` + `census-filas.csv` + XLSX oficial en ../00-Fuentes/ (la ruta correcta desde aquí: `../00-Fuentes/census-receipts-2022.xlsx`). Supuestos: `supuestos.json`. Cálculo: `../../scripts/business_model.py` desde la raíz negocio; comando desde proyecto `python3 scripts/business_model.py`. Resultados: `resultados-modelo.json`, `forecast-36-meses.csv` y `VEXA-MERCADO-Y-FINANZAS.xlsx`.

Si cambia un input, regenerar modelo/tablas e informe. No corregir a mano sólo el deck. El Excel es una **vista de resultados calculados**, no promete recalcular todo al editar una celda: modificar JSON y volver a generar. Los importes aquí se redondean para lectura, el JSON mantiene precisión de cálculo suficiente.
