# Interoperabilidad XLSX — propuesta F02-01

Corrección local, sin aceptación, integración, publicación ni cambio del examen.
Baseline heredado del handoff: `71bd4bf3c26c16f37fa8be98ae6765316e329a03`
(no se modifica ni se consulta Git). Evidencia nueva en
`interoperability-result.json`; registros en `/tmp/vexa-xml-interop-renewed/`.

## Problema y corrección

El archivo SYNTHETIC del principal, producido por openpyxl 3.1.5, fallaba con
`XLSX_UNSUPPORTED`: la gramática no admitía `workbookProtection` y `definedNames`
vacíos. Se reprodujo antes de editar. El mismo archivo ahora devuelve las dos
filas `id,amount` y `row-1,12.34`, sin errores.

Se conserva saxes 6.0.0 con namespaces y xmlchars 2.2.0 vendorizados. No vuelve el
lexer manual. La ampliación añade reglas explícitas para workbookProtection,
definedNames/definedName, autoFilter y sus variantes de filtro, sortState,
sortCondition y headerFooter con sus seis escalares. No hay comodines ni
subárboles omitidos. Cada atributo debe tener el nombre expandido autorizado;
orden, cardinalidad, hojas/celdas anidadas, texto inesperado y atributos ajenos
siguen rechazándose. Filas/columnas marcadas hidden conservan sus datos.

Validación semántica adicional: booleanos y enums de filtros, rangos A1 acotados,
columnas de filtro únicas y relativas al rango, elección única de filtro,
ordenación contenida en su rango, nombres únicos por scope e índices de hoja
existentes. Print_Area/Print_Titles/_FilterDatabase exigen referencias locales
válidas y coherentes con su scope; se admiten nombres de hoja Unicode, comas y
apóstrofes escapados. Protección valida hashes codificados, grupos completos y
contadores; algoritmos ajenos al subconjunto SHA-1/256/384/512 se rechazan.

El texto de nombres definidos generales se conserva sólo como metadata interna,
no se evalúa ni se retorna como dato. Referencias externas con corchetes y flags
XLM/VB/función ejecutable se rechazan. Fórmulas de celda, aunque tengan cache, no
aportan importe y generan XLSX_FORMULA. No se interpretan estilos/fechas como
importes, no se resuelven URLs, no cambia money/CSV/ZIP/CRC ni límites.

Es un subconjunto explícito, no un validador XSD completo. Permanecen fuera del
subconjunto conditionalFormatting, dataValidations, hyperlinks, drawing,
extLst y AlternateContent. Las partes XML no consumidas mantienen la validación
XML estándar previa, sin interpretar su semántica OOXML.

## Corpus y reproducción

`test-fixtures/generate.py` produce **24 archivos SYNTHETIC** con el openpyxl
3.1.5 preinstalado en `/usr/bin/python3`. Cinco válidos: básico, múltiples hojas
con rich text/fórmula, metadata de impresión/filtro/protección, filtro custom y
filas/columnas ocultas con nombre definido de fórmula. Diecinueve pares
maliciosos alteran únicamente la parte indicada del ZIP del escritor, conservando
CRC correcto: nodos de datos ocultos, atributos/booleans inválidos, scope/nombres
ambiguos, enlaces externos, macros, rangos/filtros y protección incompleta.

```sh
/usr/bin/python3 -B packages/ingestion/test-fixtures/generate.py
node --test packages/ingestion/*.test.mjs
```

Sólo se normalizan fechas ZIP y `docProps/core.xml` modified a 2020-01-01 para
reproducibilidad byte a byte. Los XML de workbook/worksheet se generan realmente
con openpyxl; no se simplifican para el parser. `manifest.json` incluye hashes.
Dos generaciones dieron los mismos 24 hashes. No es corpus cliente ni prueba
contra Excel Office/LibreOffice. xlsxwriter no está instalado, no se instaló.

## Verificación

En Node 26.7.0 y Node 22.22.0 Darwin arm64:

| Suite | Resultado esperado al cierre |
|---|---:|
| Propias previas + interoperabilidad | 81/81 (57 + 24) |
| Independientes previas | 17/17 |
| Recheck XML independiente | 8/8 |
| Gate root inmutable con VEXA_CANDIDATE | 64/64 |
| Archivo original del principal | exit 0, valores exactos |

La antigua prueba propia que exigía rechazar un definedName válido se actualiza
al contrato solicitado: exige rechazar celdas dentro de definedName. Se conserva
el número de 57 pruebas previas; no se modifica ninguna prueba externa. Los diez
rechazos XML independientes permanecen verdes. El rojo inicial de los cuatro
writers, el primer intento (11/14), el fallo de setup por import ausente y los dos
rojos semánticos posteriores se registran como fallos, no como mutantes muertos.

Node 22 se descargó del sitio oficial a temporal, SHA256 contrastado con
SHASUMS256.txt del mismo origen; sin instalación global ni Docker. No se afirma
verificación de firma criptográfica del archivo SHASUMS. Las pruebas corren con
PYTHONDONTWRITEBYTECODE=1. Los hashes del gate/probes y vendor se comparan antes y
después. 23 archivos vendor concuerdan con provenance.json y LICENSE de saxes con
license-provenance.json; ninguna dependencia o licencia se editó.

Pendiente: revisión independiente de esta ampliación, aceptación del principal,
corpus Office/LibreOffice/xlsxwriter, fuzzing exhaustivo, nuevo perfil RSS,
typecheck consumidor y pruebas globales/build/DB/cloud/producción. Los comandos
y exits definitivos del recibo prevalecen sobre esta tabla descriptiva.
