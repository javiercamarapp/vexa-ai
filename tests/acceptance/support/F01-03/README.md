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
