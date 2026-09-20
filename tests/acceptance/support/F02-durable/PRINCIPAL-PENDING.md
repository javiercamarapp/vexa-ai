# Gate02 renovación — checkpoint vivo, no aceptación

Build del producto separado falló en TMP (Node26.7 / Next16.3.5):
`apps/web/src/lib/imports/server.ts` importa `../../../../../../packages/jobs/index.mjs`, un nivel por encima del repositorio. Desde `apps/web/src/lib/imports/` se necesitan cinco `..`, no seis. No se corrigió fuente ajena.
Recibo: `evidence/run-07122742-35ff-439b-a7da-ab7d38016837/` exit1, npm ci offline0, build1, cleanup true. No Next/SSR acreditado.

SQL canónico sintético ya pasa: SqlPool pg real dentro de Docker propio, createDatabase original, SET LOCAL ROLE vexa_backend, login f02_product NOINHERIT/NOSUPERUSER/NOBYPASSRLS/no dueño. SQL administrativo sólo setup/observador independiente/inyección.
Primer run renovado: `run-1789878166181001000`, 15 casos funcionales pass, reconciliación sintética falló porque usaba acción retain para UPDATE; se corrigió referencia a import conforme RLS, sin tocar política.
Mutaciones hasta ahora: hash/atomic/mapping/restart ciclos0→1→0, expiry pendiente de diagnóstico (ver mutations-b43b0308-4190-4ff0-8128-b21ad9c1eb87).

Binding producto añadido en product-binding.mjs: database objeto por Request, confirmationSecret y Storage createUpload/read(bytes), sin SQL admin. Entry point conserva GATE_INCOMPLETE. Contrato expiración requiere reconciliar reloj inyectable sintético con expiración SQL15min real; no falsificar prueba cambiando un dato que está firmado. No exigir export de mantenimiento inventado para aprobar.

No integración, freeze, accept, publish, Git ni cambios de estado realizados por este rol. Este checkpoint se ampliará con resultado final y hashes.

## Corrección de transporte, no producto
El diagnóstico `run-eed40611-2df6-4b11-8b0e-93c53b59823e` pasó9/falló9 funcionales. Varios503 son **artefacto del adaptador**: db.mjs importaba otra copia de AccessError respecto a packages/jobs/imports.mjs. runtime ahora reexporta session.ts original; no modifica producto. No atribuir esos503 al autor. Expiración por h.advance tampoco aplica al producto; nuevo product-expiry.test.mjs propone fixture SQL TTL2s ANTES de firmar y espera reloj real, sin alterar firma después.

## Evolución de fuente ajena durante la renovación
El autor añadió guard_reserved_import_object. Dos intentos de preparar dueño corrupto fueron rechazados por42501 `reserved import object immutable`, incluso antes de llegar a confirmación: no fallo de producto ni mutante muerto. Se preservan run-134fc26c-ce2b-4cfa-936e-a2bc11a1c314 y run-517021e3-9b98-49c1-960d-2d912ca13a23. El oráculo ahora observa ese rechazo SQL, owner_id intacto y control positivo de confirmación.
La expiración productiva con TTL2s previo a firma sí pasó en ambos runs. El tamaño declarado incorrecto ahora se rechaza durante carga por trigger Storage; el intento de mutante productivo que esperaba cargar bytes inválidos falla en setup (product-mutations-a840d1ad-7360-49a7-b843-bc860e621c4a), NO cuenta como mutante. Se conserva prueba separada de hash productivo, cuyo objeto de tamaño correcto llega a confirmación.

## Cierre renovado verificado
- Nueve mutantes sintéticos completos0→1→0: `mutations-60e1b9d4-22b4-47a0-99b5-f5095cacd163`.
- Hash de producto real0→1→0: `product-mutations-e512f190-a0b5-487e-b975-e9868f062fe0`.
- Atomicidad de producto real0→1→0: `product-mutations-5b6c26dc-2483-4225-807e-26cbd000f9c9`. Mutante añade escritura de provenance en transacción previa: trigger outbox alcanzado,503, snapshot detecta fuga. No sintaxis/setup contabilizado.
- Expiry SQL real + rechazo de modificación owner + controles positivos: `run-afc71bbb-efe6-46f1-ab8d-2c3456352281`, exit0,3tests (2funcionales).
- El autor corrigió su import relativo: nuevo buildNext16.3.5/TypeScript/smoke ruta real pasó en TMP, `run-3b003fa7-4969-4038-9af9-eb5207d3fa6b`, exit0.503/auth_not_configured demuestra fail-closed sin configuración; NO SSR autenticado.
- Nulo actual: `run-b9a67dec-bfae-40aa-b7f7-34e35fb9e5a1` exit1 IMPLEMENTATION_MISSING, antes de infraestructura.

**No congelar todavía:** entrypoint mantiene GATE_INCOMPLETE; faltan reconciliar contrato HTTP preciso y fixture tamaño rechazado por Storage, conectar escenario SSR autenticado, fijar snapshot final del autor y revisión independiente. No falta cloud para gate LOCAL; cloud sencillamente fuera del alcance probado. No integrar resultados del full product diagnostic previo con clase AccessError duplicada como fallos del autor.


## Cierre posterior —20-sep, sin reescribir el checkpoint anterior

Consultar FINAL-GATE.md: entrypoint total exit0 contra snapshot exacto, SSR autenticado real +24/24 Node; controles SSR Origin/SHA/atomicidad0→1→0; ausente IMPLEMENTATION_MISSING. GATE_INCOMPLETE retirado tras esos resultados. Hashes antes/después idénticos. Pendientes revisión independiente y freezeprincipal; NO aceptación, F02-04/05/06 no aprobados. Ensayos fallidos conservados.
