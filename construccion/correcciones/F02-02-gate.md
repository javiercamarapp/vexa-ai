# F02-02 — recuperación revisada y aceptación limpia

## Cierre oficial del 20-sep

**13/60 aceptadas**, commit `791c854904b2121295dd7313eb37823c5286aaf8`. Tras congelar la corrección en `c9aee57`, se preparó otro candidato y se copiaron los mismos71archivos de producto por hash/modo. Verify exit0; regresión F02-01 y los cuatro jobs F01-05 exit0, cubriendo12gates anteriores y controlador110. Huellas de fuente/control intactas,24recursos retirados. Accept reejecutó el examen desde materialización limpia y terminó exit0. Los estados pendientes y rechazos siguientes son historia preservada, no estado vigente.

El cierre prueba carga/confirmación durable local, no procesamiento completo, UI de mapeo03, consumidores05/06, cuentas reales ni producción. Actions continúa desactivado.

## Recuperación del 20-sep: revisión independiente aprobada

Se conserva abajo el rechazo original. La extensión externa de F01-03 ahora clasifica `import_uploads` como metadatos 1:1 de `imports`: PK `import_id`, procedencia/identidad en el padre, autorización y tres FK comprobadas separadamente. No se añadió un `id` artificial ni se modificó el producto para satisfacer la forma del fixture.

Revisor independiente: `f0202-matrix-review-1789920300925213000`. Baseline 168/168, producto 172/172, 97/100 FK, Auth/Storage y revocación reales. Nueve ciclos de mutación 0→aserción→0, más tres probes independientes (FORCE RLS, DELETE backend, SELECT anon) en Node22.22.0. 4989 archivos conservaron hashes/modos; 20 recursos propios eliminados. Matriz/harness/services históricos intactos; ninguna tabla adicional desconocida se permite.

Esta aprobación autoriza congelar el examen y volver a preparar F02-02, no aceptarlo directamente. Pendientes: verify, regresiones completas y accept limpio. Sigue 12/60 hasta ese cierre. Las instrucciones posteriores del usuario («continúa», «hasta terminar», varios puntos en paralelo) renovaron la ejecución sin resetear consumo: 28 llamadas F02 / 172 acumuladas al cerrar esta revisión; techo global 220, sin gasto externo adicional.

## Historial: revisión local aprobada; integración rechazada por matriz global

## Estado vigente después de verify/regresiones

Prepare yverify oficiales exit0. RegresiónF02-01 pasó; los jobscontrol-kernel/web-quality/AuthUIpasaron, peroSQL falló enF01-03: `MATRIX: unclassified public table; extend external exam before freeze`, tablaimport_uploads. El principal ejecutóreject, preservando candidato/commit/recibos. **12/60**; no integración niaceptación02.

La matrizglobal clasifica36tablas conid; import_uploads usaimport_idPK ylectura directasólo deldueño, porloqueno cabeañadiendounnombrenalista genérica. Requiere extensióncontrol-plane por catálogo, conoráculos completos cuando latabla estépresente; mantener168pruebasdelcore yfallo porcualquierotra tabladesconocida. F02-02 seguirá exigiendo latabla; la extensión opcional enF01-03 no autorizaomitirlapara02.

Añadir: schema/RLS/FORCE/PK/grants, A/B/dual/viewer/anon/outsider yowner-only; backendacción/tenant/revocación; sus3FKs compuestas haciaimports/memberships/jobs conpositivosy23503reales. Aislar cadaFK paraquenootrarestricciónmateelmutante; nodebilitaraserciones ni cambiarproductoestructuralmentepara satisfacerfixtureid. Baseline0001–0004 y candidato0001–0005 deben pasar; mutantes RLS/FK/owner ytabladesconocida debenfallarporcriteriocorrecto.

Faltaautoría/revisiónindependiente de esaextensión, nuevafreeze yreprepare. Laaprobaciónlocal siguiente noincluíalasregresionesglobales, yno sesobrescribecomorechazodelcódigofuncional. PresupuestoF02:24/24llamadasconsumidas,168/220global; nollamadasadicionalessinrenovaciónexplícita. STOPyrecibosconservados.

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
