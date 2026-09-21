# F05-04: contrato del examen externo 262

Estado: en construcción, no aceptación. Datos de pruebas rotulados SYN; ningún precio/tipo de cambio de mercado o aprobación financiera real se afirma.

1. Dinero runtime deriva de ledger autorizado: no basta probar helpers puros. Ejecutar Auth/PG reales, endpoint y navegador; imports originales inmutables. Dos monedas conservan bundles nativos separados sin FX por defecto.
2. Amount y subtotal son strings exactos. Caso >2^53 conserva dígitos en API y formatter compartido UI. Unknown con subtotal conocido no es total; todos desconocidos tampoco son cero. La fila situada exactamente en fin queda fuera y timezone se conserva visible. El runtime heredado admite UTC explícito; otra zona en query se rechaza. El browser corre en America/Merida para comprobar campos UTC; helpers puros admiten IANA por su contrato separado.
3. Catálogo monetario y tasa se aprueban por owner vigente con evidencia, versión CAS y procedencia. Un boolean enviado desde browser no prueba autorización. Probar roles, tenant ajeno, CSRF, retracción, catálogo/tasa obsoletos y revocación.
4. FX explícito conserva original completo y tasa decimal/source/date/version/rounding; no conversión implícita 1:1 ni floats. Catálogo/FX faltante no fabrica unidades aprobadas. API/UI comparten formatter y no cambian etiqueta de moneda de cifras viejas durante carga.
5. Calibración causal: copia temporal altera subtotal parcial a total completo coherente; el cálculo llega al oráculo `MONEY_UNKNOWN_NOT_TOTAL` (ERR_ASSERTION). Import/setup/validación fallida no cuenta como mutante muerto. Restaurar y ejecutar el mismo oráculo. Registrar 0→1→0.
6. Ausencia puro: `F0504_IMPLEMENTATION_MISSING`. Ausencia runtime: `F0504_RUNTIME_MISSING`. Nunca considerar gate listo con comentario que diga que browser se añadirá después.
7. Autor de controles262 escribió previamente propuesta251/fix257: sus corridas puras son evidencia de autoría, no aprobación independiente. Revisor263 y principal revisan esos módulos; dictamen262 sólo sobre runtime ajeno261/API/UI. Matriz SQL0020 pertenece263 y se hereda sólo por hash exacto, sin quitar strict unknown-table guard.
8. Infraestructura local aislada: puertos60120..60125, brokerUUID/journal0600, Docker existente --pull never; limpieza y reinspección por IDs propios. No API externa, datos cliente, inferencia ni gasto.

La revisión del componente aislado sugirió consentimiento obsoleto; el key del padre ya mitigaba cambios de catálogo/tasa. No existe rojo de integración original acreditado para ese caso. Se prueba el refuerzo final con otro owner, refresco y nueva aprobación; no se inventa historial de fallo.

Evidencia263: SQL0020 aceptaba `-infinity` como fecha de catálogo/tasa; guard `isfinite` lo rechaza, rojo focal preservado y nueve casos focalizados verdes sobre SQL5d5a. Su primer positivo usaba jsonb_populate_record, enviaba created_at=null y disparaba23502; se corrigió únicamente el fixture a INSERT de columnas explícitas. Matriz mantiene dos tablas nuevas/cuatro FK y clasificación estricta. Ausencia específica263: MONEY_IMPLEMENTATION_MISSING.

Preparación262: f48bd74 es commit de controles previo a producto03; usar producto41a3c94 más delta261. Un build con esa base equivocada se registró como fallo de preparación sin recursos creados. En browser, selects anidados en label incluyen opciones en su nombre accesible; usar prefijos específicos /^Moneda base/ y /^Moneda de destino/. El timeout exact-label no prueba defecto del producto; conservar DOM y reparación del selector.

## Respuestas monetarias y snapshots simultáneos —21-sep

La regresión con F05-05 encontró que dos esperas de navegador sólo filtraban GET y fxRateId. El nuevo panel consultaba snapshots con el mismo identificador y su respuesta200 podía capturarse como un DTO monetario. Ambas esperas deben exigir también la ruta exacta /api/economics; se conservan los importes, moneda, conversión, CAS y todos los oráculos financieros. El fallo TypeError de la prueba original se conserva en evidencia privada; el ajuste del selector recibió revisión independiente269 antes de repetir la regresión.
