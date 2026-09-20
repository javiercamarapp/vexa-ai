# Resultado parcial del bloque de gates F02

Autoría control-plane exclusivamente; NO aceptación ni congelación. Estado oficial
11/60. Baseline local/publicado8340d26e1c6463ed6ccd158ee2a6ed4d202bc987.
Banco leído5fbf2230b76d24e19cad966f97a136b661d03aaa, ingestion source SHA256
registrado y vuelto a comparar en evidence/mutations.json. Principal único integrador.
Reviewer: pendiente; los exports propuestos no son un contrato aceptado.

## Cubierto y comandos reales

| Comando | Exit | Observado |
|---|---|---|
| node --test tests/acceptance/F02-01.test.mjs |1| Rojo IMPLEMENTATION_MISSING en baseline; no confundir con fallo de infraestructura |
| VEXA_CANDIDATE=/Users/javiercamaraportepetit/vexa/.runtime/closure-1789847917909284000/connected node --test tests/acceptance/F02-01.test.mjs tests/acceptance/F02-03.test.mjs tests/acceptance/F02-04.test.mjs |1|36 tests,17pass,19fail,0skip; banco NO pasa |
| node tests/acceptance/support/F02/mutations.mjs /Users/javiercamaraportepetit/vexa/.runtime/closure-1789847917909284000/connected |0|12 mutantes específicos detectados; cada uno sano0→defecto1→restaurado0; logs por caso |
| node --check sobre seis archivos mjs propios |0| Sintaxis; evidence/syntax.json contiene lista exacta |
| Validación independiente Python zipfile.testzip + ElementTree de fixtures OOXML |0|7 archivos generados, CRC/estructura ZIP/XML comprobados, hash/bytes/expansión en fixtures.json; no demuestra parser producto |
| git diff --check |0| Sólo se añadieron rutas F02 propias; no se alteró HEAD |

El caso10K puro demuestra8000accepted+1000duplicates+1000rejected=10000 y mismo
conjunto tras invertir lote. No acredita import masivo durable ni persistencia.

Fallos del banco reproducibles:50K incluye encabezado en límite;9MiB ya excede
máximo8MiB; texto2001 es aceptado; amount inválido/fórmula y JPY fraccional se
ignoran. Nueve casos XLSX fallan CONTRACT_BINDING_MISSING (sin parseXLSX), preview y
export de errores no tienen binding. F02-04 falla deliberadamente GATE_INCOMPLETE
hasta incluir DB real. No sumar esas ausencias como mutantes detectados.

Mutantes demostrados: bytes, columnas, campo, filas, truncamiento, ejecución HTML,
valor fórmula alterado, tenant, conexión, cuenta, conflicto revisión, descarte
silencioso. Primer probe truncamiento falló en el clasificador porque el defecto
caía antes del mensaje esperado: se conservó mutation-attempt-1 íntegro y se
etiquetó la aserción ya existente. No relajación de expected/observed.

## No cubierto

- F02-01 completo: CSV streaming, límites de Unicode, prueba de rechazo antes de
  expansión/RSS, soporte XLSX real y sus mutantes zipbomb/fórmulas. Fixture válida
  y rechazo de Excel ausente NO son soporte. Binding XLSX es propuesta revisable.
- F02-02/05/06: contratos detallados en durable-contracts.md; no entrypoints vacíos,
  ni ejecución SQL/Auth/Storage/procesos. Reuso concreto de harness/broker fijado,
  aún falta cableado con lifecycle/journal y recursos propios.
- F02-03: preview UI/mapping versionado, elección TZ/moneda, cantidades exactas
  soportadas por producto, descarga autorizada/PII. Casos de interfaz en rojo.
- F02-04: unique DB concurrente, historial/quarentena durable,10K persistido y
  reconciliación. RevisionLedger en memoria no reemplaza esos oráculos.
- Crash real antes ACK, fence/lease/checkpoints,429/backoff/deadletters, consumidor
  separado/alarma sin progreso, revocación y permisos reales. Ninguna inferencia.
- Stack cloud/MCP Supabase/Vercel/GitHub/OpenRouter: no validado en esta autoría,
  sin cloudwrites/Actions/deploy/gasto/envíos. No CI remoto ni producción.
- Regresiones generales npm/controller/grafo no ejecutadas: no cambió producto,
  orchestration ni registro. Es un paquete de examen pendiente, no integración.

## Archivos, dead ends y siguiente trabajo permitido

Entradas F02-01/03/04; soporte common.mjs/xlsx.mjs/mutations.mjs; README con matriz
de seis IDs; durable-contracts.md; este resultado; evidence con logs/hashes.
SHA256SUMS incluye cada archivo del paquete salvo el propio manifiesto.

Dead ends preservados: absence baseline esperada,19 fallos del banco y primer
clasificador rechazado. No interpretar fail como ausencia de datos. Pendiente
resolver/revisar binding propuesto, completar F02-01 y los contratos durables
mediante infraestructura existente; luego revisión independiente y principal
congela/actualiza registry/guía. Este paquete NO permite prepare/adopt/verify/promote.

No hubo producto, Git/config/historial, otros worktrees, F01 ni DB compartida
modificados. Copias mínimas de mutación/fixtures se crearon en TMP y eliminaron
al terminar. Los archivos de soporte permanecen locales sin commit/publicación.
