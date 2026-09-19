**Sin hallazgos P0/P1/P2 en el alcance revisado.** El conteo censal y las cifras publicadas son reproducibles; TAM/SAM/SOM se presentan como escenarios condicionados, no como mercado validado ni tracción de VEXA.

Verificación realizada:

- **Census:** leí directamente encabezados y filas **18333–18341** del XLSX. Confirman año **2022**, columna **Firms**, NAICS **454110** y nueve bandas de receipts empresariales **USD10M ≤ receipts < USD100M**. Suma independiente: `996+544+340+218+166+143+170+264+134 = 2,975 firmas`; establecimientos: **3,212**. Las **140 filas extraídas** coinciden con `census-filas.csv` y los agregados con `universo-census.json`.
- **Sin doble suma:** `tam-sam-som.md:35` explica solapamientos NAICS y presenta la unión amplia como cota, no como empresas únicas elegibles. El cálculo del núcleo utiliza únicamente 2,975.
- **Supuestos identificados:** `supuestos.json:4` y `tam-sam-som.md:60` califican explícitamente filtros SAM, precios y conversiones como supuestos. No encontré que la falta conocida de validación se ocultara como evidencia observada.
- **Forecast:** `scripts/business_model.py:24` conserva stock, bajas y backlog, aplica lag, capacidad y caja; distingue ARR final de ingresos reconocidos. Verifiqué límites mensuales de onboarding y SAM en los tres escenarios. Prospección acumulada: **1,570 / 2,975 / 2,975** cuentas.
- **Concordancia:** importé los scripts mediante `sys.path` y recalculé en memoria sizing, COGS, agregados anuales, CAC/payback, déficit máximo, colchón y primer mes positivo. Coinciden con `resultados-modelo.json`; las tablas de los tres documentos coinciden al redondear. También coinciden las cuatro sensibilidades de volumen.
- **Afirmaciones comerciales:** `tam-sam-som.md:95` declara ausencia de contratos de pago acreditados; las cifras no se presentan como mercado global, clientes efectivos ni ingresos obtenidos.

Cifras base corroboradas: TAM **USD53,514,300/año**; SAM **589.05 cuentas equivalentes / USD10,595,831.40/año**; SOM A3 **USD988,699.64 ARR**, frente a **USD790,486.45** de ingreso recurrente durante A3.

Comando solicitado:

```text
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests/business -v
Ran 12 tests in 0.126s
OK
```

La comprobación adicional terminó con `ALL_CHECKS_OK`, salida 0. El entorno emitió avisos de caché de Xcode denegada; no impidieron las verificaciones.

**Limitaciones materiales:** la reproducibilidad permite defender la aritmética y procedencia local, pero no valida demanda, disposición a pagar ni filtros SAM. El universo es histórico y sectorial; no constituye un directorio comercial actualizado. El forecast supone disponibilidad de prospectos, conversiones y capacidad, y conserva oportunidades ganadas en backlog sin caducidad. Excluye impuestos, impagos y retrasos de cobro; el colchón sólo cubre fijos y marketing. Estas condiciones pueden alterar materialmente SOM y financiación necesaria.

Sin red, no revalidé autenticidad remota del XLSX ni tarifas vigentes. SHA256 del XLSX, coincidente con el manifiesto:

```text
f2cf0cfcfee4317d50118baf0507d40492907abe73ccb78f5e76a89b99425264
```

No regeneré ni modifiqué archivos; no accedí a `private/`, `.git` ni otros repositorios. No determiné SHA Git por ese límite. Esta revisión no cubre el SaaS.