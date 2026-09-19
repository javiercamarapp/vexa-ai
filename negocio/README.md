# VEXA · estudio de negocio, mercado y finanzas

**[Abrir informe completo HTML](INFORME-VEXA.html)** · **[PDF](INFORME-VEXA.pdf)** · **[Excel mercado/finanzas](05-Precios-y-Finanzas/VEXA-MERCADO-Y-FINANZAS.xlsx)**.

Corte **19-sep-2026 UTC**. Investigación secundaria con fuente primaria Census y fuentes oficiales/comerciales. USA es el núcleo cuantificado; México es expansión contextual. No pretende una medición global, entrevistas hechas ni validación comercial del producto.

## Las respuestas centrales
- **Universo verificable:** 2,975 firmas ecommerce/venta por catálogo USA, receipts empresariales $10M–<$100M, Census2022; no se confunden con3,212establecimientos ni con marcas únicas de2026.
- **TAM núcleo por precio:** base **$53.5M/año**, sensibilidad **$28.5M–$107.1M**. Depende de precio propuesto, no gasto observado.
- **SAM:** base **~589 cuentas equivalentes / $10.6M/año**, condicionado a filtros NO medidos. Se publica el embudo y cómo validarlo.
- **SOM base:** ARR salida A1 **~$146K**, A2 **~$525K**, A3 **~$989K**; no equivale a facturación ni a contratos existentes.
- **Finanzas:** 36 meses ×3escenarios, sensibilidad de tokens/volumen, CAC/payback y necesidad de caja; supuestos abiertos y pruebas numéricas.
- **Competencia:** precios, capacidades declaradas, financiación y sustitutos; SentiSum/Thematic ya venden inteligencia con economía y acción. No se proclama un mercado vacío.

## Índice por función (estructura comparable a Documentos Likida)

### 00 · Fuentes
[Registro y límites](00-Fuentes/INDICE.md) · [CSV de provenance](00-Fuentes/registro-fuentes.csv) · [Census XLSX original](00-Fuentes/census-receipts-2022.xlsx).
48 capturas/intentos, 35 fuentes empleadas, incluyendo páginas de diez marcas; no son35estudios independientes. HTTP403/404 y contenido insuficiente se conservan como límites, no éxitos.

### 01 · Inversionistas
[One-pager](01-Inversionistas/one-pager.md) · [Memo,20preguntas y data room](01-Inversionistas/memo-y-preguntas-dificiles.md).

### 02 · Mercado
[Estudio de mercado y geografías](02-Mercado/estudio-de-mercado.md) · [ICP, verticales y buying committee](02-Mercado/icp-y-segmentacion.md).

### 03 · Competencia
[Mapa/precios/bake-off](03-Competencia/mapa-competitivo.md) · [Capital y consolidación](03-Competencia/capital-y-consolidacion.md).

### 04 · GTM
[Plan comercial90días, pipeline, oferta y objeciones](04-GTM/plan-comercial-90-dias.md).

### 05 · Precios y finanzas — fuente canónica
[Cifras](05-Precios-y-Finanzas/00-CIFRAS-CANONICAS.md) · [TAM/SAM/SOM completo](05-Precios-y-Finanzas/tam-sam-som.md) · [Pricing/unit economics](05-Precios-y-Finanzas/precio-y-unit-economics.md) · [Corridas36meses](05-Precios-y-Finanzas/corridas-financieras.md).

[Inputs JSON](05-Precios-y-Finanzas/supuestos.json) · [Resultados JSON](05-Precios-y-Finanzas/resultados-modelo.json) · [108filas mensuales CSV](05-Precios-y-Finanzas/forecast-36-meses.csv) · [Censo extraído por fila](05-Precios-y-Finanzas/census-filas.csv) · [Sensibilidad volumen](05-Precios-y-Finanzas/sensibilidad-volumen.csv).

### 06 · Validación
[Protocolo de entrevistas, muestreo, WTP y gates](06-Validacion/protocolo-entrevistas-y-wtp.md).

### 07 · Riesgo/Compliance
[Premortem, datos, sociedad y condiciones](07-Riesgos-y-Compliance/premortem-y-condiciones.md). Complementa dossier CTO y seguridad en ../docs/; no sustituye abogado.

### 08 · Prospectos
[Diez marcas semilla, no calificadas](08-Prospectos/lista-semilla.md) · [CSV](08-Prospectos/marcas-semilla.csv).

## Comparación y estado
[Qué se igualó documentalmente y qué falta frente a Likida](MAPA-DE-COBERTURA.md). [Evidencia y límites](EVIDENCIA-Y-LIMITES.md). [Revisión independiente](REVISION-INDEPENDIENTE.md). [Plan de investigación](PLAN-INVESTIGACION.md). Investigación/documentación ≠ SaaS terminado. Tampoco basta para certificar que el escenario SAM es real: faltan investigación primaria, censo nominal deduplicado, cotizaciones homogéneas, permisos y pilotos pagados.

## Reproducción
Desde la raíz VEXA:
```bash
npm run business:build
npm run test:business
python3 scripts/source_register.py
python3 scripts/render_business_report.py
python3 scripts/render_business_pdf.py
python3 scripts/verify_business_delivery.py
```
Dependencias de negocio documentadas en requirements-negocio.txt. El cálculo Decimal es local; sin LLM/inferencia pagada. Excel contiene resultados, no un simulador enlazado de inputs: modificar JSON y regenerar.
