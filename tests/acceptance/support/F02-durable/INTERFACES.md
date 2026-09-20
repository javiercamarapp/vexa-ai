# Interfaces reales y pendientes — gate02 local, no cloud

## Puertos usados

- `packages/platform/src/db.ts`: `createDatabase({identity,pool,selectedTenant}).transaction(action,fn)`. SqlPool implementado con `pg.Client` real, una conexión PostgreSQL por connect(), ejecutado dentro del contenedor Storage propio para reutilizar pg instalado. No driver simulado ni DB host publicada.
- `canonical-ports.mjs`: Auth GoTrue `/user`, memberships por PostgREST con token de sesión; ambos servicios reales propios. Selector de organización no es identidad. `database(request)` instancia el puerto canónico.
- `product-binding.mjs`: adapta `createImportHandler({database,confirmationSecret,storage:{createUpload,read}})`. Este export existe en el producto leído, no se inventó para obtener PASS. `read` devuelve Uint8Array conservando bytes; no usa SQL de administrador.
- `runtime.mjs`: db.ts se transpila en TMP, `session.mjs` reexporta el session.ts original. Mantener identidad de AccessError evita convertir400/403/404/409 en503 accidentalmente. Requiere Node con stripTypeScriptTypes y soporte TS nativo; probado Node26.7, Node22 no probado.
- `snapshot`, `injection`, `sqlAsync`: observador y fallos administrativos en conexiones DISTINTAS dentro de DB propia. Nunca se entregan al factory de producto. El rol productivo es f02_product NOINHERIT/NOSUPERUSER/NOBYPASSRLS/no dueño; createDatabase hace SET LOCAL ROLE vexa_backend y revalida memberships bajo RLS.
- Proceso HTTP hijo recibe el mismo secreto, reloj de fixture y configuración de DB/Storage al reiniciar. D02-14 mata con SIGKILL sólo ese proceso. DB y Storage permanecen vivos y se comprueban IDs de reserva/job/outbox, token anterior y queued≠completed.

## Contratos que aún requieren integración/revisión

1. Error de bytes: prototipo distinguía hash_mismatch/size_mismatch; producto devuelve object_bytes_invalid para ambos. Ambos casos deben seguir separados por fixtures independientes, no dar PASS por un503.
2. Expiración: prototipo reloj inyectado30s y403; producto SQL15min,409 reservation_expired. `product-expiry.test.mjs` prueba reloj real con DEFAULT SQL2s instalado ANTES de reservar/firmar, fixture aislado explícito. No cambia expires_at después de firmar y no declara probado el TTL15min completo.
3. Mantenimiento: no existe obligación contractual de export `reconcileExpired`. El gate no lo exige al producto; el callback sólo prueba reconciliador sintético. La reserva expirada debe permanecer trazable, sin job/outbox ni borrado de sus bytes; falta política productiva de retención/reconciliación aceptada.
4. Reserva concurrente/replay: la referencia responde201; producto devuelve200 si ya está queued. Confirm siempre202. Reconciliar semántica, no exigir implementación interna/provenance específica.
5. SSR: next-smoke construye en TMP e intenta ruta real, pero no pasa por omitir DB. Si devuelve503 por falta de configuración sólo es smoke fail-closed, nunca prueba SSR autenticada con SQL/Storage. Primer build falló por import relativo de seis niveles en server.ts (se requieren cinco). Fuentes del autor no se editan aquí.
6. El entrypoint conserva GATE_INCOMPLETE. Mutantes contra canonical-reference son validación de los oráculos; NO mutantes de producto ni sustituto de revisión independiente.

## Alcance que no se mezcla

No F06 ni migraciones legacy. No cloud, proveedores, Next autenticado, Node22, cleanup universal ante cancelaciones, aceptación ni publicación acreditados. La recuperación manual del broker anterior sigue siendo recuperación manual. Nueve controles sintéticos de mutación no constituyen nueve tareas aceptadas.

## Cierre nuevo 20-sep — ver FINAL-GATE.md para estado y comandos

Los párrafos anteriores conservan el checkpoint histórico. `ssr-exam.mjs` ejecuta Next construido en TMP, cookies SSR de sesiones GoTrue reales, pg productivo por socket Unix/docker nc y proxy local Auth/Storage/PostgREST. El administrador observa e inyecta fallos; no implementa SqlPool. El secret se conserva durante reinicios. No se copiaron aserciones de producto.

`exam02(...,{product:true})` conserva dieciséis casos canónicos; el D02-03 productivo prueba objeto ausente, y la expiración real se ejecuta en `product-expiry.test.mjs`. Los dos casos sintéticos de bytes/reconciliación no se presentan como cobertura productiva: bytes se comprueban en SSR/product-bytes y reconciliación/retención futura no acredita F02-02. `total-exam.mjs` ejecuta todas las suites productivas sin filtros y sin leer recibos. No hay fallback a referencia.

Contrato observado: meta.trace_id obligatorio; database es objeto por Request; Storage firma/lee con sesión; 401 anónimo con metadatos válidos, 403 Origin/revocación/selector, 404 tenant ajeno, 409 conflicto/expiración real, 422 hash de bytes incorrectos con tamaño correcto, 503 fallo SQL inyectado alcanzado; 202 queued nunca completed. Storage devuelve 500 DatabaseError/code23514 para tamaño incorrecto (rechazo SQL comprobado), sin objeto durable/job/outbox y con recuperación de la misma reserva+capacidad. Propiedad corresponde al firmante de la capacidad, no al dispositivo que transmite bytes.
