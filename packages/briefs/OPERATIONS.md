# Briefs observados y versionados

`createBriefRepository({database})` usa la identidad y organización actuales. Owner y analyst generan; operator y viewer sólo leen. No envía correo, ejecuta acciones, escribe CRM ni llama modelos externos.

El listado requiere filtros compartidos y pins `snapshot_id`/`scope_hash`. `limit` (1–50) y `cursor` recorren todo el historial; el cursor está ligado al lector y alcance. Cada detalle y descarga valida de nuevo fuentes, autores financieros, mapeos capturados y evidencia. Un vínculo de descarga no concede acceso permanente.

`generate` recibe `query`, `comparisonQuery` opcional, `expectedPreviousId` y `requestKey`. La comparación se elige desde `comparisonOptions`, con pins propios. Un mismo input, independiente del lector y hora, reutiliza el brief inmutable. Una nueva versión requiere CAS del head; la clave de solicitud queda ligada al payload. Las versiones previas conservan documento, referencias y hashes.

La comparación requiere períodos anteriores no solapados, igual duración, moneda, base, filtros y versiones de medición. Delta = actual menos anterior, con enteros exactos. Un total desconocido deja desconocido su delta; subtotales no sustituyen totales. Incompatibilidades temporales o metodológicas explican la falta de comparación. No se atribuye causalidad ni ahorro. Las filas por problema no son aditivas.

El ranking publicado se captura sólo para scope financiero sin filtros de dimensión. Orden total: filas con ranking publicado por rank/id; después las demás por cantidad de citas/id, etiquetadas `evidence_count`. Con SKU/fuente no se presenta ranking global como ranking del subconjunto. El carril crítico usa severidad/categoría de la evidencia capturada y conserva problemas fuera del top 3. No genera pronósticos a partir de cifras observadas.

0027 extiende `weekly_briefs` y agrega heads y recibos de idempotencia. Filas gestionadas inmutables, lectura sólo por servidor. Guardas locales de fuentes/proyección reutilizan reglas aceptadas de 0026 con capacidad read/import; no modifican helpers anteriores. SQL verifica importes frente a componentes canónicos o proyección con IDs de mapeo fijados. El actor operativo histórico de una intervención se distingue del autor de evidencia financiera; planes/resultados revalidan referencias financieras.

JSON y HTML se producen en servidor como attachments privados, no-store/nosniff. HTML escapa textos, no contiene scripts y lleva CSP sandbox/default-src none. Ambos incluyen X-Contract-Version y X-Trace-Id; documento y contentHash coinciden. Ausencia de configuración devuelve configuration_required; los fallos operativos conservan su error propio.
