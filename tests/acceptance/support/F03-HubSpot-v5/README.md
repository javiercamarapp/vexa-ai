# S01 v5 — paquete externo autónomo propuesto

No repo/candidato/grafo/runner modificados. No red autenticada ni HMACreales en autoría. Node22.23.2, paquete relocatable con parse5 8.0.1/entities8.1.0 pineados y licenciasMIT/BSDincluidas. vendor contiene copiasbyteexactas de observerv2, parserfragmentv1, perfilcontenidoaccionesv2/contextotipado y dualoracle revisados.

Pruebas de composición: integration-final.tap y bootstrap-v1.tap históricos; integration-release.tap será recibo final de fuentes congeladas. SYN instalan offline2paquetes en TEMPprivado (cacheexistente; nuncaonline), prueban limpieza y relocación sin node_modules en origen/candidato. Los fallos previos de entryorden se preservan: el primer subproceso heredaba NODE_TEST_CONTEXT y Node no ejecutaba sus tests; ahora se retira esa variable sólo del subprocesoSYN y el mutantefalla por marcador específico. No era evidencia válida de orden hasta corregirlo.

Adopción y contrato están en LIVE-v5-proposed.md y F03-01-correction-proposed.md. adoption-files.json es lista pública mínima para copiar; excluye node_modules, artefactos/TAP/snapshots y toda referencia/clave/datoUI. dependencies.json requiere byteexactitud del paquete; cualquier cambio de código exige regeneración/review/freeze. Mover la carpeta completa no cambia pins relativos. proposed-entry se copia al entry oficial, importando bootstrap antes de dynamicimport de controleslocales.

Ejecución directa revisable: Node22 run.mjs con VEXA_CANDIDATE y entorno autorizado original (config/token/key/approvalreference). No hay flags de transporte/éxito/configoffline. No ejecutar antes de revisión del paquete y autorizaciónreal. Preparaciónbootstrap no llamaHubSpot; puede comprobarse aisladamente y cerrarse sin ejecutar runLive.

Cada intento usa configprivado nuevo con receipt_filewxúnico. La referenciaUI firmada sigue externa y revisada; no se genera desde actual. Receiptsprivados de live y cleanup más fuente/TAP deben evaluarse juntos; formalAcceptancefalse siempre hasta controladoroficial.

El cargo lógico callback se declaraestimación, no garantíaheap. Límite64MiBobserver y cap8MiB porrespuesta permanecen; parser8MiB/100knodos/depth256 yproyección10knodos más deadlines acotan entrada. No prometer que esto es RSSmáximo.
