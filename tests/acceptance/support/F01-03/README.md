# F01-03 — examen externo revisado

Sólo fixtures sintéticos y servicios locales propios. No es código del producto ni acredita producción.

## Ejecutar

```sh
node --test tests/acceptance/support/F01-03/oracles.test.mjs
VEXA_CANDIDATE=/ruta/al/candidato node --test tests/acceptance/F01-03.test.mjs
```

Docker e imágenes locales enumeradas en `harness.mjs` son requisitos. `--pull never`: no descargas. PostgreSQL UUID sin puerto publicado; Auth/Storage/PostgREST propios en localhost 56327–56329. Una colisión falla, nunca reinicia servicios ajenos. Se generan credenciales sintéticas dentro del proceso y se eliminan los recursos propios. No usa Supabase compartido, cloud, SMTP, OAuth Google ni inferencia pagada. Un fallo `INFRA_F01_03` no es una denegación válida.

## Contrato y controles

Ficha F01-03, `construccion/03-CONTRATOS.md` y `construccion/correcciones/F01-03-gate.md`. Matriz de 36 tablas de dominio, identidad/membership, operaciones CRUD propias y ajenas, roles, claves compuestas y relaciones descubiertas, deduplicación, Storage y retrieval. Revocación se prueba con sesión vieja y login GoTrue nuevo del mismo usuario; incluye autorreactivación prohibida. Los mutantes comprueban efectos reales, no sólo códigos HTTP.

Las pruebas físicas de FK aíslan exclusivamente los triggers de usuario en un probe administrativo con rollback. Los triggers internos RI permanecen activos y `SET CONSTRAINTS ALL IMMEDIATE` comprueba también FKs diferidas antes del rollback. Se exige SQLSTATE23503 y diagnóstico de constraint. Una regresión demuestra que guards de dominio, incluso uno que imita23503, no ocultan una FK ausente. Roles/RLS/Storage/inmutabilidad se prueban aparte con triggers normales. Esta técnica NO es una operación de aplicación ni autorización para modificar una DB compartida.

## Evidencia del snapshot — 19-sep-2026

- Suite de controles/mutantes: **73 pass, 0 fail, 0 skipped**, exit0.
- Examen contra laboratorio de integración: **168 pass, 0 fail, 0 skipped**, exit0. Todavía NO aceptación oficial del producto.
- Baseline canónico sin schema: exit1 por `IMPLEMENTATION_MISSING`, no por setup.
- Revisión independiente anterior: 67 controles SQL verdes; único rechazo restante por FK diferida válida. Corregido y revisado independientemente: 19 comprobaciones SQL positivas/negativas y cleanup verdes; sin hallazgos pendientes en ese correctivo. El revisor no repitió servicios HTTP; la suite completa sí fue repetida por principal.
- SHA256 `oracles.mjs`: `25c77cf77c063d84897ab32f3ce5b5dbb316727633a804007c1ae2741f09c23d`.
- SHA256 `matrix.mjs`: `48467c35a4071e077602d57696bebee1f7a2c664441dc0759209b1fe9b0fa8ea`.

Historial de rechazos, setup fallido y reproducciones conservado localmente, no sobrescrito. Congelar este examen no acepta migraciones: después se prepara un candidato oficial, adopta sólo el delta de schema, ejecutan gates/regresiones, revisión y materialización limpia. No acredita URLs firmadas revocables instantáneamente, providers remotos, datos de cliente ni SaaS completo.

## Extensión propuesta import_uploads — 20-sep-2026

`import-uploads/oracles.mjs` se activa por presencia en el catálogo público. El
baseline de cuatro migraciones conserva el examen core; cualquier otra tabla
pública desconocida sigue siendo un error. La presencia de `import_uploads`
obliga a comprobar schema/PK `import_id`, tipos/nullability, RLS/FORCE, grants,
lectura exclusiva del dueño y operaciones backend con rol `vexa_backend`,
acción, tenant y membership reales. No añade `id` al producto ni sustituye la
obligación de existencia del gate F02-02.

Las tres FK descubiertas se enrutan al oráculo específico, con positivos y
rechazos 23503 atribuidos a la constraint objetivo. El probe elimina sólo la
reserva A dentro de su transacción revertida antes de reinsertar (evita23505),
desactiva sólo triggers USER y fuerza constraints inmediatas. Los mutantes
físicos usan catálogo previo a retirar cada FK, para demostrar aceptación del
cruce cuando falta esa FK; no cuentan errores de setup como detecciones.

```sh
node tests/acceptance/support/F01-03/import-uploads/run.mjs \
  /ruta/baseline-0001-0004 /ruta/producto-0001-0005 /ruta/tmp-existente
```

El runner ejecuta los dos gates completos y los controles de mutación en serie,
con journals exclusivos0600 y comprobación de recursos retirados. Consulte
[RESULTADO.md](import-uploads/RESULTADO.md) para comandos/salidas/hashes y límites.
Esto es una propuesta control-plane para revisión independiente, sin freeze,
registro, prepare, aceptación ni publicación.
