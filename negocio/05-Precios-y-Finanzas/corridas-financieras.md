# Corridas financieras de 36 meses

**Escenarios, no pronósticos ni estados financieros.** Hay 108 filas mensuales (36×3), JSON de supuestos, CSV y Excel de resultados. No se verificaron clientes de pago, salarios, conversión o churn VEXA. La precisión decimal sirve para reproducir cuentas, no para expresar certeza.

## 1. Fórmulas y secuencia
Outreach empieza en mes3; cada cuenta se prospecta como nueva una sola vez. Reuniones→pilotos→ventas ganadas con tasas supuestas; se aplica lag de 2–3 meses; las ventas que exceden capacidad esperan en backlog y no cuentan como clientes. Churn se aplica al stock inicial; altas comienzan a facturar a mitad de mes. ARR de salida usa activos al final ×MRR×12, mientras ingresos anuales suman el revenue reconocido de cada mes. No son intercambiables.

`Caja final = caja inicial + revenue recurrente + setup − COGS − onboarding − pilotos no convertidos − fijos − marketing extra`. Caja inicial=0, financiación=0; saldos negativos indican necesidad de fondos, no dinero existente. Setup=0 en estas corridas. No hay upsell, expansión, pagos anuales adelantados, impuestos, retraso de cobro ni impagos. Algunos supuestos son favorables; otros conservadores. No esconderlos detrás de un único número de caja.

## 2. Drivers

| Input supuesto | Conservador | Base | Expansión |
|---|---:|---:|---:|
| MRR | $799 | $1,499 | $2,999 |
| Nuevas cuentas objetivo/mes años1/2/3 | 25 / 45 / 65 | 50 / 100 / 160 | 90 / 200 / 350 |
| Reunión sobre cuenta prospectada | 8% | 12% | 16% |
| Piloto sobre reunión | 30% | 35% | 45% |
| Pago sobre piloto | 35% | 50% | 55% |
| Lag ventas meses | 3 | 2 | 2 |
| Churn mensual logos | 2% | 1% | 0.75% |
| Onboardings máximos/mes años1/2/3 | 1 / 2 / 3 | 2 / 3 / 5 | 3 / 6 / 10 |
| Fijos mensuales años1/2/3 | $8K/$10K/$12K | $14K/$18K/$25K | $22K/$40K/$65K |

Fijos son presupuesto de capacidad de equipo/operación, NO nómina existente o promesa de contratación. Se modela trabajo fundador remunerado dentro del presupuesto económico; no afirmar que el costo desaparece por trabajar sin sueldo. Adaptar la caja real una vez acordados dedicación/sueldo del CTO y socio. Marketing extra $1K/mes en todos; soporte variable se trata fuera del fijo, según contrato de costos.

## 3. Resultados redondeados

| Escenario/año | Clientes equivalentes al cierre | ARR salida | Ingreso recurrente del año | Caja acumulada sin financiar |
|---|---:|---:|---:|---:|
| Conservador A1 | 1.38 | $13,276 | $3,928 | −$106,457 |
| Conservador A2 | 4.74 | $45,481 | $27,964 | −$222,064 |
| Conservador A3 | 9.19 | $88,092 | $65,208 | −$337,328 |
| Base A1 | 8.11 | $145,915 | $49,064 | −$145,095 |
| Base A2 | 29.16 | $524,524 | $321,855 | −$123,518 |
| Base A3 | 54.96 | $988,700 | $790,486 | $194,029 |
| Expansión A1 | 23.38 | $841,376 | $282,299 | −$39,162 |
| Expansión A2 | 90.13 | $3,243,562 | $2,048,251 | $1,253,757 |
| Expansión A3 | 102.85 | $3,701,426 | $3,782,581 | $3,825,795 |

En expansión, ingreso del A3 puede superar ARR de salida porque se agota la prospección y hay churn: el ARR final baja frente a algunos meses anteriores. Eso es una consecuencia del modelo y un recordatorio de que ARR no es facturación anual. Una generación infinita de cuentas ocultaría este límite.

Caso base entra en flujo mensual positivo por primera vez en mes18, expansión mes8 y conservador no lo hace en 36 meses. «Primer mes positivo» no prueba rentabilidad sostenida; revisar todos los meses, sobre todo después de aumentos de fijo o agotamiento de leads.

## 4. Caja / ronda

| Escenario | Máximo déficit dentro de primeros 18 meses | Más 6 mensualidades de fijos+marketing del año2 |
|---|---:|---:|
| Conservador | $167,110 | $233,110 |
| Base | $175,437 | $289,437 |
| Expansión | $131,189 | $377,189 |

La reserva es explícitamente de **costos fijos+marketing**, no un presupuesto integral validado para otros seis meses. Mayor crecimiento supuesto puede reducir déficit inicial y a la vez exigir mayor colchón para equipo. No usar el caso expansión para decir que el riesgo de financiación es menor.

**No hay ask aprobado de VEXA.** El $500K de materiales Likida pertenece a otra empresa y NO se reutiliza. Estos escenarios sugieren qué habría que financiar bajo ciertos planes; el monto final depende de salarios/dedicación, hitos, capital disponible, DSO, impuestos, gastos legales, políticas cloud, riesgo y condiciones societarias.

## 5. Umbrales de revisión antes de gastar
- Si no hay datos legítimos y sponsor al terminar semana1: sólo fixtures, no contratar capacidad productiva basada en piloto inexistente.
- Si al mes2 no hay problema conciliable y disposición a ejecutar una acción: restringir hipótesis antes de escalar adquisición.
- Si pilotos no convierten, probar buyer/alcance/precio; no mejorar el forecast subiendo a mano paid_rate.
- Si onboarding requiere 40h en vez de12, costo directo supuesto pasa $480→$1,600; incluirlo y revisar capacidad, no sólo margen recurrente.
- Si la cobranza tarda 30/60/90 días, añadir capital de trabajo según facturación y calendario, no suponer cobro instantáneo.
- Si churn anual/expansión se mide, recalcular por cohorts; no ajustar retrospectivamente para embellecer el pitch.

## 6. Reproducción y pruebas
`python3 scripts/business_model.py` produce JSON/CSV/XLSX. `python3 -m unittest discover -s tests/business -v` verifica fuente de 2,975/9 bandas, missing≠zero, fórmula TAM/SAM, ventas con lag, límite de prospectos, conservación de clientes/backlog/caja, no confundir ARR con ingresos y costos de tokens. El Excel es una presentación con valores calculados; no se validó una cadena de fórmulas editable dentro de Excel. El JSON es el punto de cambio y el script la implementación canónica.
