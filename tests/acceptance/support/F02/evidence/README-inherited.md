# Bloque externo F02 — propuesta parcial para revisión

Estado oficial conservado:11/60; baseline8340d26e1c6463ed6ccd158ee2a6ed4d202bc987.
Esta autoría no acepta, congela, registra, integra ni publica tareas.
Banco consultado read-only: connected HEAD5fbf2230b76d24e19cad966f97a136b661d03aaa.
No se copiaron sus pruebas; oráculos derivados de fichas y contratos canónicos.
No existen correcciones F02-gate en esta copia al iniciar.

| ID | Criterios/casos escritos | Negativos | Alcance actual |
|---|---|---|---|
| F02-01 | CSV UTF8/BOM/comillas/multilínea; bytes/columnas/campo/filas;20MiB/50K/2000chars; XLSX10hojas | UTF8/NUL/surrogate/truncado, límites+1, fórmula/HTML, zipbomb/macros/external links/formula cache |26 casos ejecutables; CSV parcial verde;9 casos XLSX rojos por binding ausente; falta probar streaming/pre-expansión y mutantes XLSX |
| F02-02 | Storage autorizado, hash/token, idempotencia y transacción | D02-01..07 en durable-contracts.md | Contrato de examen; harness durable aún no cableado; NO gate congelable |
| F02-03 | Fecha ambigua/offset, mapping/preview, USD1001/JPY, CSV errores | importe inválido, inyección por prefijos, pérdida de filas |6 casos; preview/export requieren binding, dinero no soportado actualmente |
| F02-04 | Identidad multitenant/conexión/revisión, historia/conflicto,10K y permutación | Scope incompleto, conflicto sobrescribe, conteos |3 casos puros + bloqueo explícito GATE_INCOMPLETE por DB; memoria no prueba SQL |
| F02-05 | Lease/fence/checkpoint/crash/401/429/cancelación/deadletter | D05-01..08 en durable-contracts.md | Contrato canónico existente identificado; falta ejecución SQL/procesos/mutantes |
| F02-06 | Consumidor separado, cola estancada, heartbeat≠avance,202≠complete | reinicio/kill, A→B polling, revocación | Contrato; health/daemon/alojamiento y ejecución pendientes |

## Interfaces y decisiones aún no congeladas

Binding real elegido: packages/ingestion/index.mjs exports parseCSV,
normalizeCSV, createEnvelope, identityKey, revisionKey, RevisionLedger. No se exige
un archivo limits.ts/parse.ts porque su nombre no demuestra comportamiento.
CSV parse retorna {rows:[{values,line}],errors:[{code,line,field}]}; normalize usa
SourceContext autorizado en servidor, observed_at, mappingVersion y conserva raw.
La prueba pura no demuestra autenticación de ese contexto.

No existe binding XLSX/preview/exportErrors en banco. Para hacer review concreto,
el borrador propone estos exports en el MISMO módulo, sin fallback:

- parseXLSX(bytes, {maxBytes=20971520,maxExpandedBytes=104857600,maxSheets=10}?)
  síncrono, devuelve {sheets:[{name,rows:[{values,line}],errors:[{code,line,field}]}]}.
  Valores de celdas strings, fórmulas/cached values null y error XLSX_FORMULA;
  rechazos globales IngestionError.code XLSX_LIMIT_EXPANDED/LIMIT_SHEETS,
  XLSX_EXTERNAL_LINK, XLSX_MACROS, XLSX_TRUNCATED. Estos códigos son una propuesta
  de binding revisable; obligación de no ejecutar/fallar cerrado es canónica.
- previewCSV(input,{mapping,timezone,mappingVersion,sampleRows}) retorna
  mapping_version,timezone,sample_rows,rows con amount_minor decimal string y currency.
  Mapeo configurable y elección visible son obligatorios; esta forma de retorno
  no está aceptada y no reemplaza prueba de UI.
- exportErrors([{line,field,code}]) devuelve CSV texto con encabezado y una fila
  por error, fórmula-safe, sin PII. La prueba cubre prefijos y estructura;
  redacción/descarga autorizada exige el gate HTTP durable.

CONTRACT_BINDING_MISSING es autoría pendiente de interfaz, no mutante muerto.
No adaptar expectativas a un verdictJSON ni inferir soporte por extensión.
50K se interpreta como filas de datos además de encabezado; localizar el primer
exceso por línea física50002. Es decisión explícita de examen para revisión.
2000 chars actualmente ejercita ASCII; Unicode code points y streaming real aún
pendientes. Tamaño expandido se prueba con límite configurable pequeño, no acredita
RSS/pre-expansión por sí solo. Fixtures OOXML generadas por xlsx.mjs son sintéticas.

## Reproducción

```sh
node --test tests/acceptance/F02-01.test.mjs
VEXA_CANDIDATE=/ruta/banco node --test tests/acceptance/F02-01.test.mjs tests/acceptance/F02-03.test.mjs tests/acceptance/F02-04.test.mjs
node tests/acceptance/support/F02/mutations.mjs /ruta/banco
```

Mutaciones sólo sobre copia mínima en TMP0700, cada caso sano0→mutante1 por aserción
específica→restaurado0; exactamente un test seleccionado, no setup como muerte.
Son controles del examen, no regresión completa del producto ni validación XLSX.
Logs y hashes en evidence/. Primer intento truncation rechazado por el clasificador
(mensaje esperado no correspondía a primera aserción); conservado íntegro en
mutation-attempt-1/. Se rotuló esa misma aserción; no cambió el comportamiento esperado.

## Pendientes que impiden congelar/aceptar

Revisión independiente de binding propuesto y examen, completar F02-01 con streaming,
pre-expansión y mutantes XLSX, integrar SQL/Auth/Storage/broker en F02-02/04/05/06,
UI preview/TZ/descargas,10K durable e intentos/crash reales. Los entrypoints02/05/06
no se crearon para evitar un archivo vacío que parezca gate completo. No se tocó
registry/guide/grafo ni orquestador. El principal decide tras revisión, sin
aceptación inferida de este paquete. No se validó el stack cloud por MCP aquí.

Resultado ejecutado: [RESULTADO.md](RESULTADO.md);12 mutantes puros con secuencia0/1/0.
Huellas finales: SHA256SUMS. Ningún PASS global;36casos/17pass/19fail contra banco.
