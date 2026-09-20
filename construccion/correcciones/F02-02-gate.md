# F02-02 — congelación revisada, todavía sin aceptación

## Contrato y alcance

Carga directa Storage privada, SSR/Auth real, tenant derivado de sesión autorizada, reserva idempotente, confirmación de bytes/hash/tamaño/dueño/expiry y transacción import+job+outbox. queued no es completed. No incluye consumidor05/06, UI03, retención global07 ni cloud.

Revisión conjunta independiente aprobada: examen, producto y ampliación prospectiva de scope. Únicamente se añaden a allowed_paths los manifests apps/web/package.json (pg8.16.3/@types8.15.5), packages/platform/package.json (exportdb) y package-lock.json. Lock:15entradas nuevas, sin actualizaciones ajenas. Ingestion ya aceptada3f4cc27; no se arrastra pipelineF06. Todo antes de prepare02; no modificación del examen desde candidato.

## Evidencia independiente

- Entrypoint externo completo en Node26.7/22.23.2: SSR autenticado+24/24Node, sin skips. Origin/SHA/atomicidad:0→1→0 por aserciones específicas, no setup.
- Ocho controles adicionales: límites20MiB, literalSQL/idempotency, inmutabilidad privilegiada, catálogo/grants deldefiner, permisosRPC, conexión deshabilitada, downgrade al redimir y scopeSQL fuera detransacción.
- HTTP propio adicional incluye muerte real deNext durante PgSleep, rollback/reinicio y mismosIDs. Son15grupos lógicos,14líneasPASS; no inflar número de pruebas.
- Web/M10: instalaciónoffline,lint/types/build/health200;51artefactos/73respuestas sin canario servidor/service_role.12corridas,90recursos retirados ycleanup comprobado.
- Hashes/modos de2713archivos de snapshots intactos. Entrypoint SHA256 `ec93ed7a288f535a245db19bdd11e953065d90a2e61bb78efbfc21beffa9cea6`. Informes/receipts originales locales preservados.

## Lecciones y rechazos preservados

El primer oráculo usabaSQLadministrativo: se sustituyó porSqlPool/pg/createDatabase real, con observadoradmin independiente. Dos copias deAccessError falseaban503 enadaptador: se corrigió identidad de clase, no producto. Caducidad seprueba conTTLSQL2s ANTESdefirmar yrelojreal, no editando token después. Un cambio deowner no podía prepararse porque eltrigger ya lo rechazaba: no contabilizar ese setup como kill.

Tamaño incorrecto se rechaza enStorage antes de confirmar: DatabaseError/23514 específico, ningún objeto SQL/bytesdurables ni job/outbox, misma capacidad acepta despuésbytescorrectos. No exigir pasar una vulnerabilidad del paso previo para poder examinar el siguiente.500 genérico no es prueba de seguridad.

El trigger SECURITYDEFINER tiene search_pathvacío/referencias calificadas yEXECUTE revocado; confirm_import esSECURITYINVOKER sólo backend. Capacidad bearer transferible atribuida alfirmante, no aldispositivo. TLSremoto fuera de prueba local.

## Empaquetado de evidencia

547archivos control-plane copiados porSHA.96copias históricas resources-*.jsonl pasan600→644 para materializaciónGit; se comprobó que sólo contienen kind/name/brokerUUID, sin credenciales. Originales inmutables permanecen600. Ningún código/fixture cambió bytes/modos, ni la creación/verificación600 de journals ACTIVOS. La misma normalización se aplicará a nueve archivos históricos delproducto; no ocultarla como identidad de modos absoluta. Gate/reproducción y aceptaciónlimpia volverán a ejecutarse. No usar un journalhistórico público como autoridad de limpieza activa.

## Pendiente

freeze/registro/guía, prepare, adopción exacta, verify, regresiones completas yacceptlimpio por principal. **12/60** al redactar; esto no afirma13/60 ni despliegue. Datoscliente, TLS/cloud, operación prolongada, consumidor, cuotasagregadas/retención, rotación de secretos y fases posteriores quedan pendientes.
