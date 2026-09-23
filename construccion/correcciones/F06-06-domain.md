# F06-06 — control independiente de dominio y SQL (292)

Preparado antes de la implementación; no afirma aprobación.

- Ausencia: BRIEF_IMPLEMENTATION_MISSING, antes de cargar módulos o iniciar servicios.
- Determinismo: mismo snapshot, alcance, versiones y opciones producen cifras, referencias y hash iguales; el actor lector y el orden incidental de objetos no recalculan historia.
- Dinero: strings exactos mayores a 2^53; null conserva desconocido y subtotal/cobertura. P1/P2 no se suman al global. Refund, replacement y soporte mantienen tipo y fuente; ningún “recuperado” causal.
- Selección: top3 estable con desempate; carril crítico conserva problemas de bajo volumen y dinero desconocido. Citas y acciones requieren referencias capturadas/autorizadas.
- Cambios: comparación opcional con período anterior compatible en duración/base/moneda/filtros/método; delta exacto o null con razones. Se reautoriza tanto snapshot actual como anterior.
- Persistencia: brief inmutable, idempotencia ligada al payload, aislamiento de tenant/FK, capacidades precisas y actores vigentes. UPDATE/DELETE no reescribe una versión. Los legacy0004 mantienen sus guardas originales fuera del esquema gestionado nuevo.
- Export: 291 verifica descarga HTTP real, mismo snapshot/scope, reautorización de usuario y referencias; no email/CRM implícitos. 292 verifica frontera SQL y dominio.
- Recursos: sólo puertos59920..25, journal0600 y brokerUUID previos al arranque, eliminación exclusiva por IDs propios. Focal antes de matriz27; ningún setup error cuenta como mutante muerto.

Resultados y hashes se registrarán en private/f0606-domain-292.json. No atribuir evidencia de la cadena26 a una migración27 distinta.

## Cortes y correcciones preservadas

El oráculo de orden mixto reprodujo un comparador no transitivo; el arreglo usa categoría publicada, rango y desempate estable, con fallback por evidencia. El builder final pasó ocho pruebas en Node22 y Node26, incluyendo mutante semántico que elimina el carril crítico (0→1→0).

En SQL se conservaron los rojos por CASE sin paréntesis, cobertura 999/999 recalculada con digest válido, causalClaim anidado y forecast monetario inventado. El autor corrigió además la referencia a evidence_spans.quote inexistente usando quote_hash. El corte final cb4775 rechaza todos esos casos, exige capacidad explícita y mantiene comparación anterior real con delta exacto y revocación independiente de sus fuentes.

Correcciones del control: UPDATE/DELETE/downgrade y cabecera ajena admiten específicamente 23514 como rechazo de la guarda, sin admitir cualquier error; arrays PostgreSQL en la semilla de comparación usan literales de array, no JSON. El probe sin acción omitía GRANT de exam_result: diagnóstico SQL42501 «permission denied for table exam_result» al guardar el resultado del wrapper; sólo se añadió el mismo GRANT temporal del helper backend existente. Se mantienen false/42501 esperados para capacidad ausente. Ninguna corrección modifica producto ni relaja aislamiento financiero.

Focal final: 18/18 sobre SQL cb4775e418936aa195eedd6822f8ebc75e4dbdd20ba3c01d49f1a88053c478e3. Matriz completa y recursos se consignan por separado en el recibo final; no se atribuyen corridas rojas a este resultado.
