# TAM / SAM / SOM — mercado con cuentas reproducibles, no un porcentaje de un mercado gigante

## 1. Decisión geográfica y unidad económica

**USA primero**: el piloto propuesto opera posventa estadounidense y los audios priorizan migración HubSpot→Zendesk. Es una decisión de enfoque, no una afirmación de que VEXA sólo pueda vender allí. México se analiza como expansión comercial; Canadá, Reino Unido, Brasil y resto del mundo quedan fuera de esta cuantificación hasta tener denominadores comparables. No etiquetar el resultado como «TAM global».

Unidad objetivo: una organización compradora con presupuesto y acceso a los datos que financiaría una suscripción. Una empresa puede tener varias marcas, dominios, tiendas Shopify y cuentas de marketplace. Esos activos no equivalen automáticamente a múltiples clientes. Subsidiaria, marca y grupo consolidado pueden arrojar ingresos muy distintos: verificar quién contrata y quién cumple el rango $10M–100M. No se acreditó que Senix cumpla ese rango; es un design partner propuesto, no un dato que justifique el censo.

## 2. Fuente oficial y extracción

**Census, SUSB 2022**, publicación 10-abr-2025, tabla “The Number of Firms and Establishments, Employment, Annual Payroll, and Receipts by Industry and Enterprise Receipts Size: 2022”. URLs:
- Índice: https://www.census.gov/data/tables/2022/econ/susb/2022-susb-annual.html
- XLSX: https://www2.census.gov/programs-surveys/susb/tables/2022/us_6digitnaics_rcptsize_2022.xlsx
- Definiciones: https://www.census.gov/programs-surveys/susb/about/glossary.html

Se descargó el XLSX real, no una cifra de un resultado de búsqueda. Hoja `US 6-digit NAICS`; columnas: NAICS, descripción, **Enterprise Size ($1,000)**, Firms, Establishments. El rango `[10,000;100,000)` en esa columna significa **US$10 millones a menos de US$100 millones**. No US$10 mil a US$100 mil. No se incluye el bucket $100M+, que también incluiría empresas mucho mayores; no fingir una frontera exacta inclusiva en $100M que los datos no permiten.

NAICS 2017 `454110` = **Electronic Shopping and Mail-Order Houses**. Es una cohorte identificable de ecommerce/venta por catálogo, no todas las marcas DTC ni todos los negocios que venden online. Fabricantes, retailers omnicanal y marcas extranjeras pueden clasificarse en otras ramas. SUSB cubre empresas con empleo remunerado dentro de su alcance, no todas las tiendas digitales sin empleados.

| Fila Excel | Banda receipts ($1,000) | Firmas |
|---:|---|---:|
| 18333 | 10,000–14,999 | 996 |
| 18334 | 15,000–19,999 | 544 |
| 18335 | 20,000–24,999 | 340 |
| 18336 | 25,000–29,999 | 218 |
| 18337 | 30,000–34,999 | 166 |
| 18338 | 35,000–39,999 | 143 |
| 18339 | 40,000–49,999 | 170 |
| 18340 | 50,000–74,999 | 264 |
| 18341 | 75,000–99,999 | 134 |
| **Total** | | **2,975** |

Las nueve bandas están publicadas para este código. Correspondientes establecimientos: **3,212**, no 2,975; usamos firmas, no locales. Los recibos censales no son necesariamente ventas consolidadas auditadas: la definición advierte duplicación de receipts en algunas empresas multiestablecimiento. Estos límites se heredan al filtro de tamaño.

### La trampa de sumar NAICS
Census define firm como establecimientos del mismo dueño **dentro de industria/geografía**. Un grupo puede aparecer en más de una industria. Por tanto:
- 454110 está contenido en retail 44–45: sumarlos duplica.
- Manufactura 31–33 = 28,622 firmas; mayoreo 42 = 44,106; retail 44–45 = 37,825, todas en el mismo rango de receipts.
- **No** se pueden declarar 110,553 empresas únicas sumando esos sectores.
- Sin microdatos de identidad, la unión está acotada matemáticamente entre `max(28,622;44,106;37,825)=44,106` y `28,622+44,106+37,825=110,553`. Es una cota de unión sectorial, no de empresas que necesitan VEXA.

Algunas ramas estrechas omiten bandas. Ejemplo: fabricación de equipos de jardín 333112 sólo tiene dos de las nueve bandas objetivo publicadas; la suma publicada da 13, **no un total completo**. Se marca lower bound y missing, sin rellenar ceros ni extrapolar la proporción. `universo-census.json` guarda todos esos huecos y filas.

## 3. TAM núcleo: tamaño del bolsillo de software bajo precio supuesto

`TAM núcleo por precio = 2,975 firmas × ACV supuesto`.

| Escenario de precio, no tarifas acordadas | MRR | ACV | TAM núcleo anual |
|---|---:|---:|---:|
| Conservador | $799 | $9,588 | **$28,524,300** |
| Base | $1,499 | $17,988 | **$53,514,300** |
| Expansión/upmarket | $2,999 | $35,988 | **$107,064,300** |

**Interpretación correcta:** sensibilidad del máximo ingreso de suscripción de una cohorte histórica si todas compraran a ese precio. No una estimación de gasto ya existente, una valoración de VEXA ni evidencia de willingness to pay. Tampoco es todo el TAM potencial: faltan fabricantes y omnicanal fuera de 454110, pero no se suman sin deduplicación.

El escenario base aplicado a la cota amplia 44,106–110,553 da $793,378,728–$1,988,627,364/año **antes de filtrar ajuste al problema y sin deduplicación exacta**. Esa cifra sólo sirve como techo exploratorio de expansión, NO como titular del deck. A diferencia del núcleo, contiene mayoreo industrial, automoción, combustibles y otras actividades poco afines. No llamar al extremo superior «nuestro mercado de $2B».

No se inflaron los conteos 2022 con el CAGR de un reporte CEM: crecimiento del gasto software y crecimiento del número de empresas no son la misma variable. Una actualización a 2026 requeriría otro conteo o una proyección separada explícita.

## 4. SAM: filtros que hoy son hipótesis y así se presentan

SAM debería contar cuentas que VEXA puede servir con producto, datos, precio y capacidad comercial reales. **No contamos aún con una muestra representativa para medir estos filtros.** Esta entrega calcula escenarios condicionados, no inventa porcentajes «de mercado».

| Filtro secuencial condicional | Conservador | Base | Expansión | Qué dato permitiría sustituirlo |
|---|---:|---:|---:|---|
| Categorías físicas con dolor afín | 45% | 60% | 80% | Muestra de firmas/actividad principal/productos |
| Volumen de posventa y necesidad económica suficientes | 40% | 55% | 75% | Interacciones/mes, motivos, costo y dueño de decisión |
| Datos enlazables y stack exportable | 60% | 75% | 90% | Muestra real reconciliada de CRM/pedidos/refunds |
| Gobernanza, acceso y viabilidad de compra | 70% | 80% | 90% | Security/procurement/autoridad y presupuesto |

Cada tasa se aplica al conjunto que sobrevivió el filtro anterior; son probabilidades **condicionales propuestas**, no porcentajes marginales independientes extraídos de encuestas distintas. No añadir un filtro «nos responde al correo» aquí: la ejecución comercial se mide en SOM.

Base: `2,975 × .60 × .55 × .75 × .80 = 589.05` cuentas equivalentes. Trayectoria: 2,975 → 1,785 → 981.75 → 736.31 → 589.05. SAM base: `589.05 × $17,988 = $10,595,831.40/año`.

| Escenario | SAM cuentas equivalentes | SAM anual a precio del escenario |
|---|---:|---:|
| Conservador | 224.91 | $2,156,437 |
| Base | 589.05 | $10,595,831 |
| Expansión | 1,445.85 | $52,033,250 |

No son intervalos de confianza. Cambian al mismo tiempo filtros y precio, por lo que la amplitud refleja supuestos conjuntos. Sensibilidad univariable base: aumentar 10 puntos absolutos el filtro de datos (.75→.85), manteniendo los demás, añade 78.54 cuentas equivalentes y ~$1.41M de SAM; no justifica asumir que ese aumento se logrará.

## 5. SOM: se gana con capacidad, no escogiendo «1% del TAM»

Modelo mensual de 36 meses, reproducible. Arranca prospección en mes 3. Base: 50 cuentas nuevas investigadas/mes año 1, 100 año 2, 160 año 3; 12% reunión, 35% piloto sobre reuniones y 50% pago sobre pilotos. Ciclo de venta supuesto dos meses. Onboarding máximo 2/3/5 cuentas al mes según año; backlog preservado. Churn logo 1% mensual supuesto, sin upsell. Cada cuenta nueva empieza a facturar a mitad de mes; las bajas ocurren al inicio para el cálculo.

No contamos cada mensaje como lead nuevo. El universo de prospección se agota en 2,975 cuentas: el modelo reduce o detiene outreach al agotarlo, en vez de «generar» nuevos prospectos infinitos. Ese universo es el core bruto, mayor que el SAM postcalificación; el embudo capta descartes/no respuesta y no supera SAM en clientes activos. Se conserva un backlog de ventas ganadas no onboardeadas, sin contabilizarlas como clientes de pago.

| Base | Año 1 | Año 2 | Año 3 |
|---|---:|---:|---:|
| Clientes equivalentes al cierre | 8.11 | 29.16 | 54.96 |
| ARR de salida | $145,915 | $524,524 | $988,700 |
| Ingreso recurrente reconocido durante el año | $49,064 | $321,855 | $790,486 |

**No se acreditó un solo contrato de pago VEXA en esta investigación.** Los decimales son expectativas, no fracciones de clientes reales. Estos resultados describen las consecuencias de supuestos que aún pueden fallar simultáneamente. El SOM no es pronóstico garantizado ni prueba de PMF.

## 6. Qué sí puede decir el pitch

> «Identificamos una cohorte censal estadounidense de 2,975 firmas de ecommerce/venta por catálogo en el rango de tamaño buscado, con datos 2022. A un precio propuesto de $17,988 anuales, esa cohorte representa un escenario de $53.5M de suscripción. Estamos validando qué parte tiene datos y dolor suficientes; nuestro escenario base servible es ~$10.6M, todavía no un censo validado. Empezamos por posventa de productos físicos y continuidad entre CRMs.»

Si esa explicación ocupa demasiado en una slide, mostrar cifra+etiqueta+pie corto y conservar metodología en appendix, **no eliminar el calificativo**. No decir «TAM validado $2B», «mercado 2026 de 2,975 marcas» ni «capturaremos $1M en tres años».

## 7. Cómo convertir los supuestos en evidencia

1. Seleccionar una muestra probabilística de cuentas del universo cuando exista un directorio licenciado que permita identidad y dedup. SUSB agregado no entrega una lista comercial de esas firmas.
2. Registrar parent/buyer/geografía/ingresos/fuentes y clasificar elegibilidad con dos evaluadores; no imputar ingreso a partir de tráfico web.
3. Separar una muestra cualitativa de 12–20 entrevistas (buena para descubrir motivos) de una muestra probabilística para estimar prevalencias. Doce entrevistas por conveniencia NO estiman el 60% de fit.
4. Para orientación muestral: una proporción simple de población ~2,975, 95% de confianza y ±10 puntos, bajo muestreo aleatorio simple y peor caso p=.5, requiere del orden de 94 respuestas completas. No respuestas/contactabilidad/clustering pueden aumentar necesidad; no declarar ese margen sobre una muestra de conveniencia.
5. Calcular embudo observado por cohorte y precio; pilot completion, pago y renovación se documentan por evento, no sólo intención declarada.
6. Actualizar source/model version y todas las piezas dependientes. No reescribir el dato histórico como actual.

Reproducción: `python3 scripts/census_market.py && python3 scripts/business_model.py && python3 -m unittest discover -s tests/business -v`. Fuentes originales, filas y resultados acompañan el documento.
