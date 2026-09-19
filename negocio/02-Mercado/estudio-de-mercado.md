# Estudio de mercado: inteligencia económica de posventa para marcas físicas

## 1. Mercado que compra VEXA
VEXA entra en la intersección de **customer intelligence/VoC**, analítica de servicio, calidad de producto, gestión de devoluciones y planificación económica de operaciones. No sustituye inicialmente al helpdesk, al ERP, al sistema de refunds ni al equipo de garantías. Su trabajo es transformar evidencia dispersa en una decisión: qué problema arreglar, cuánto importe está observado, qué parte es escenario y quién debe actuar.

El comprador no compra clasificación de sentimiento por sí misma. Compra tiempo para decidir, trazabilidad que Finanzas acepte y un mecanismo para comprobar si una intervención cambió el problema. Hoy ese trabajo puede hacerse con analistas, Excel/BI, helpdesk reporting, plataformas de VoC o consultoría. La competencia incluye **no hacer nada** cuando los datos son malos o ninguna persona tiene autoridad para ejecutar.

## 2. Magnitud del contexto: cinco cifras que NO son TAM

| Contexto | Evidencia abierta | Qué permite afirmar | Qué NO permite |
|---|---|---|---|
| Ecommerce estadounidense | Census Q2-2026: $340.2B trimestrales ajustados, 17.1% del retail, +12.2% interanual, sin ajustar precios | El canal es económicamente importante y creció en ese período | Multiplicar por una comisión VEXA sin producto/contrato; anualizar como resultado anual observado |
| CEM global | MarketsandMarkets julio-2026: $15.78B 2026, $34.02B 2032, CAGR13.7% | Existe categoría amplia de gasto y previsiones comerciales | Llamarlo TAM VEXA; incluye servicios, BFSI, telecom, healthcare y muchas funciones |
| Devoluciones USA | NRF/Happy Returns octubre-2025: $849.9B proyectados; 19.3% de ventas online devueltas | El proceso tiene peso material y merece análisis | Llamar todo importe devuelto pérdida neta o ahorro capturable |
| Plataforma Shopify | Reporte financiero 2025: GMV $378.441B; ingresos plataforma $11.556B | Hay infraestructura con transacciones y contexto de pedidos a escala | Confundir GMV con gasto de marcas en analítica o contar tiendas como empresas únicas |
| México | AMVO EVO2026, página pública: $941 mil millones MXN y 77.2M compradores | Hay un mercado digital relevante para explorar distribución en español | Obtener empresas $10M–100M de consumidores/GMV; convertir moneda sin TC y período |

Fuentes/URLs: `../00-Fuentes/INDICE.md`. En AMVO no quedó inequívoco el año base de ambas cifras en la página pública, y no se accedió al informe afiliados. No se comparan como si fueran datos armonizados de 2026.

### Diferencias de metodología que importan
NRF 2024 estimaba $890B de devoluciones y 16.9% de ventas totales devueltas; su encuesta empresarial fue de 249 profesionales en retailers de más de $500M, fuera del ICP propuesto de VEXA. NRF 2025 publica 19.3% para **ventas online**, otro denominador. No concluir «subieron 2.4 puntos» comparando ambas tasas. Tampoco aplicar 19.3% a cada SKU de herramientas: varía por categoría, canal, políticas y geografía. Los reportes son evidencia del problema, no medición de Senix.

MarketsandMarkets publica estimaciones y metodología resumida, pero no se compró su dataset completo. Otros reportes GVR/Fortune no se pudieron leer por HTTP403; no se inventó una triangulación entre cifras. Su predicción de crecimiento no se convierte en crecimiento de número de clientes VEXA.

## 3. Cadena de valor y dónde se pierde información

`Fabricante/OEM → marca/importador → distribuidor/marketplace/DTC → comprador → soporte → devolución/garantía/reemplazo → calidad/operación → Finanzas`.

- El fabricante conoce lote/especificación, pero no necesariamente ve mensajes del comprador.
- La marca conserva promesa, contenido y políticas, pero un marketplace puede limitar identidad del cliente.
- El retailer observa pedido y retorno; la marca puede recibir sólo informes agregados.
- Soporte conoce síntoma narrado; almacén conoce motivo físico; ERP conoce importe final. Etiquetas no siempre concuerdan.
- Finanzas valida costo/margen, pero no suele leer miles de conversaciones para hallar causa.
- El dueño de contenido, producto, logística o garantías ejecuta la intervención; si falta ese dueño, no hay loop de resultado.

La oportunidad no es únicamente añadir más fuentes: es **enlazar fuentes con sus derechos, identidades y ventanas correctas**, conservar desconocidos y resolver una decisión transversal.

## 4. Dolores por familia y mecanismo económico

| Familia | Señal conversacional | Evidencia adicional indispensable | Medida económica razonable |
|---|---|---|---|
| Expectativa/contenido | Tamaño, compatibilidad, accesorios no claros | Ficha/listing versionado, SKU, pedido, motivo devolución | Refund/reemplazo observado; tasa por unidades vendidas |
| Calidad/defecto | Falla repetida, batería, piezas | Lote, inspección, firmware, horas/uso; no sólo reclamo | Eventos observados y exposición de cohorte; severidad humana aparte |
| Fulfillment | Daño, atraso, pieza faltante | Carrier, entrega, almacén, número de envío | Reenvíos y costos confirmados; no atribuir causalmente por correlación |
| Garantía/servicio | Fricción, instrucciones, espera | Reglas garantía, elegibilidad, tiempos, resolución | Costo de servicio con tarifa declarada y outcome observado |
| Cobro/devolución | Refund pendiente/parcial, cargo duplicado | Transacción liquidada, reversals, moneda | Ledger neto deduplicado, nunca importe alegado como liquidado |

**ROI no es revenue-at-risk.** Un pedido expuesto puede devolverse, cambiarse o retenerse parcialmente. Recuperar ingreso bruto no es recuperar margen bruto, y evitar una llamada no elimina automáticamente una plaza laboral. Toda propuesta comercial debe separar capacidad liberada, reducción real de gasto y efecto causal todavía incierto.

## 5. Por qué ahora / fuerzas contrapuestas

**A favor:** estructura de datos de comercio más accesible; extracción y resúmenes ya viables; crecimiento del canal; fragmentación CRM que abre una compra por continuidad; líderes CX presionados para justificar inversión con economía. Evidencia: crecimiento Census, arquitectura de Gorgias, pricing explícito de SentiSum con causas “priced”, anuncios de agentes de los competidores.

**En contra:** los incumbentes incorporan funciones rápidamente; clientes pueden consolidar herramientas; AI reduce el precio percibido de etiquetar texto; acceso a marketplaces/PII introduce riesgo y trabajo; CFO exige más pruebas, no más dashboards. El presupuesto se puede ir a automatizar soporte o ejecutar devoluciones antes que a observarlas.

**No hay ventana demostrada de monopolio.** Una migración es un trigger de venta temporal, no moat duradero. VEXA debe sobrevivir una vez terminada la migración demostrando decisiones y resultados semanales.

## 6. Geografías y secuencia propuesta

| Mercado | Razón para considerarlo | Fricción/no conocido | Decisión |
|---|---|---|---|
| USA | Piloto propuesto; datos Census reproducibles; ecosistema ecommerce | Competencia fuerte, seguridad/seguro, procurement y datos | Núcleo cuantificado y prioridad de validación |
| México | Cercanía operativa/idioma; contexto AMVO | Falta censo armonizado por ingresos USD y tickets; pricing/MXN/contratos | Entrevistas, no sumar un TAM inventado |
| Canadá/Reino Unido | Ecosistema de commerce y operación en inglés | Falta denominador comparable, residencia/procurement | Expansión por clientes concretos, no masa supuesta |
| Brasil | Hipótesis de escala regional | Portugués, integraciones, LGPD y economía local sin estudio de campo | Postergar hasta demostrar repetibilidad |
| Otros países | Posible expansión | Sin conteo/canal/condiciones verificadas | Visión, fuera del sizing actual |

No se usó PIB ni % de población para distribuir TAM entre países. En cada expansión se necesita censo/registro/licencia, unidad compradora deduplicada, bandas de ingresos actualizadas, salarios/costos propios, acceso técnico y precio probado.

## 7. Conclusión de mercado

Hay problema económico y compradores que ya destinan presupuesto a productos cercanos. **No se ha probado que exista un hueco competitivo sin ocupar ni que VEXA gane.** La tesis más concreta es posventa física con ledger conciliable, evidencia por pedido/SKU y neutralidad frente al CRM, apoyada por capacidad de implementar cambios. El siguiente activo valioso no son más páginas: es una muestra autorizada que permita reconciliar el dinero y un comprador que pague por una decisión que cambió.
