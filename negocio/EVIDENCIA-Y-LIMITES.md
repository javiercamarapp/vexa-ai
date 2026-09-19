# Evidencia y límites de esta ampliación

## ✓ Verificado
- `npm run test:business` → **12 tests OK**, última corrida registrada0.130s. Cubren nueve bandas Census/2,975firmas, missing≠zero, TAM/SAM, lag, stock/churn/backlog, caja, límite de prospección, COGS, ARR≠revenue y contenido de workbook.
- `npm test` → **12 pruebas kernel pasan**; `npm run test:controller` → **23 tests OK**. Sin regresión observada en esas suites; no son pruebas del SaaS completo.
- `python3 scripts/verify_business_delivery.py` → **PASS**:48capturas/35usadas,108filas mensuales,links locales y **35páginas**. SHA256 Census: `f2cf0cfcfee4317d50118baf0507d40492907abe73ccb78f5e76a89b99425264`.
- Revisor independiente Astra/Codex: filas XLSX y140filas extraídas coinciden; modelo recalculado en memoria; no P0/P1/P2 en alcance examinado. [Informe](REVISION-INDEPENDIENTE.md). No revalidó autenticidad remota ni entrevistó compradores.
- `python3 scripts/render_business_pdf.py` → salida0;16capítulos y cifra crítica presentes, navegador con perfil temporal y grupo de procesos limpiado. El primer intento de Chrome dejó PDF válido pero no cerró: se registró timeout y se sustituyó por wrapper con verificación del artefacto y limpieza acotada.
- Portada y páginas10/21inspeccionadas visualmente; tablas legibles en esas muestras. Se extrajo texto de35páginas, no una revisión visual exhaustiva página por página.

## ? Escenarios / inferencias
- Precio $799/$1,499/$2,999, filtros SAM, conversiones, churn, salarios/fijos y costos de operación no son mediciones VEXA.
- SAM base589.05 y $10.6M, SOM A3~$989KARR y caja base~$289Kconcolchón son consecuencias de esos inputs, no hechos del negocio.
- La especialización posventa/SKU y portabilidadCRM puede ser una ventaja; no se demostró contra productos competidores en un bake-off.

## ✗ No verificado
Censo nominal de cuentas con parent/revenue/stack/dolor; filtros SAM de muestra representativa; entrevistas/disposición a pagar; cotizaciones comparables; contratos/pagos; intervención causal; costos cloud reales; residencia/certificaciones/configuraciones; mercado global armonizado; TAM México/Brasil/UK/Canadá.

Los diez nombres semilla son marcas con categoría visible, no prospectos calificados. Las35fuentes incluyen sus páginas, por lo que no se anuncian como35estudios independientes. Fuente comercial ≠ estudio independiente.

## Qué NO prueba la aritmética
La tabla es de2022y la industria esNAICS2017; no todas las marcas DTC entran allí. Un grupo puede aparecer en varias industrias. Price×población no demuestra gasto disponible. El forecast conserva backlog sin caducidad y no incluye impuestos, DSO/impagos o financiación: puede sobreestimar resultados y subestimar caja. El colchón sólo cubre fijos/marketing. Datos reales pueden cambiar por completo el veredicto.

## Cómo avanzar
Ejecutar el protocolo de entrevistas y calificación, obtener autorización/muestra/piloto, medir costos y pagos, reemplazar inputs y regenerar artefactos. No se completa esa validación borrando la palabra «supuesto» de una presentación.
