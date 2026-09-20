# F02 — reutilización y brechas verificadas

Corte: 19 de septiembre de 2026. **11/60 aceptadas.** Esto no acepta F02 ni acredita producción.

Banco preservado: `5fbf2230b76d24e19cad966f97a136b661d03aaa` en el laboratorio `connected`. Se recuperó una copia temporal exacta, sin cambiar el original. Se reprodujeron 42 unitarios de ingesta/jobs/conectores, 24 regresiones y 110 pruebas del controlador: exit 0. Los unitarios no prueban persistencia ni conectividad cloud.

| Tarea | Reutilizar | Falta comprobar o completar |
|---|---|---|
| F02-01 | `parseCSV`, `normalizeCSV`, `adaptCSVRaw`, envelopes y hashes | Streaming; XLSX seguro; límites 20/100 MiB, 50.000 datos, 10 hojas y 2.000 caracteres; validación monetaria. |
| F02-02 | Enqueue transaccional y HTTP de imports | Carga directa Storage con reserva/confirmación, hash/token/propietario, bindings propios y huérfanos. |
| F02-03 | Mapping versionado, errores, UI de estado | Preview y mapping seleccionable, timezone/moneda, descarga autorizada y CSV seguro. |
| F02-04 | Identidades, hashes y reconciliación parcial | Dedup concurrente en DB, aplicación durable de revisiones/historia y cuarentena; no sustituir con mapas en memoria. |
| F02-05 | Chunks, checkpoints, leases y fencing canónicos | Retry-After/backoff, dead-letter, cuatro intentos, cancelación y crash real antes de ACK. |
| F02-06 | Consumidor separado del POST y estados honestos | Proceso operativo, reinicio, last_progress, alarma de atasco y decisión de alojamiento. |

## Evidencia que impide copiar todo sin revisar

- 50.000 filas de datos más cabecera exceden actualmente el límite del parser. Un mensaje de 2.001 caracteres es aceptado. Un amount inválido permanece raw sin validación monetaria. Estos resultados se conservaron como brechas, no se ajustaron los tests para obtener verde.
- Jobs canónico importa pipeline dinámicamente. Pipeline depende de módulos de análisis/recomendaciones y proyecciones F06. Copiar sólo jobs deja dependencias rotas; copiar todo arrastra otras fases.
- HTTP requiere el export `@vexa/platform/db`, un pool y dependencias pg todavía fuera de la allowlist F02. Cualquier ampliación se debe revisar **antes** de construir el candidato, no retroactivamente.
- El DDL legacy de jobs no es compatible con el núcleo aceptado. No sustituir las migraciones 0001–0004 ni aplicar propuestas antiguas por conveniencia.
- Las pruebas de ingesta HTTP anteriores usan siete migraciones y servicios F06. No se presentan como examen mínimo independiente de F02.

## Próximo incremento

Completar y revisar primero el examen de parser CSV/XLSX. Adoptar selectivamente los cuatro archivos de ingesta existentes y construir sólo sus brechas, conservando interfaces y hashes raw. En paralelo se desarrolla el examen durable de Storage/SQL/jobs, reutilizando la infraestructura aislada y su broker de recursos.

El borrador externo encontró 17 casos verdes y 19 fallos en 36 casos del banco. Doce mutantes puros tienen secuencias sano→defecto→restaurado verificadas. **El examen sigue incompleto: no habilita aceptación.**

Los informes originales y sus evidencias permanecen locales en `.runtime/f02-block-1789865317128980000/`. Dos informes se escribieron fuera de la ruta prevista porque el prompt del principal omitió la ruta exacta: recibos `blocked_or_partial` conservados. Este documento es una síntesis nueva del principal; no convierte esos recibos en aprobaciones ni copia sus logs privados a Git.
