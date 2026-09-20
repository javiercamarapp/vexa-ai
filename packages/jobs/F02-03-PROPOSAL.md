# F02-03 — propuesta de producto, no aceptación

Base y HEAD (sin commits propios): `38a8c503cf691413fde27d385a47ade53273843e`. F02-02 sigue siendo dependencia propuesta. Fixture SYNTHETIC generado localmente; sin datos cliente, cloud, inferencia, push o migraciones. Revisor independiente pendiente.

## Implementación

- `packages/ingestion/mapping.mjs`, `mapping.d.mts`, `mapping.d.ts`: preview CSV/XLSX mediante parsers existentes, mapping canónico/hash normalizador v1, selección literal de headers/hoja, calendario y timezone Intl, DST gap/fold rechazados, ISO con offset conserva instante. Money usa exclusivamente parseMoney. Muestra hasta100, defecto20, no representativa; validación de población completa hasta límites del parser. Duplicados0 explícitamente diferidos a F02-04. Errores sólo line/field/code y CSV RFC4180 neutralizado.
- `packages/jobs/imports.mjs`: listado de conexiones/reservas propias con páginas acotadas y offsets; lectura de metadatos/headers/preview; POST preview/mapping; GET errors.csv. Verifica propietario, objeto/bytes/hash/size, conexión y membership usando createDatabase/Auth/Storage existentes. Mapping bajo rowlock y CAS, historial/config/autor/confirmación en provenance JSON; renueva fingerprint y token. Replay de misma operación idempotente; configuración queued inmutable. Confirmación revalida versión después de lectura Storage. No cambia0001–0005 ni crea0006.
- `apps/web/src/app/api/imports/route.ts` y nuevas rutas `[id]/{preview,mapping,errors.csv}/route.ts`: adaptador Next real existente, Origin en mutaciones.
- `apps/web/src/components/import-preview.tsx`, `app/(workspace)/imports/page.tsx`, `components/workspace/navigation.tsx`: reserva, SHA WebCrypto, carga directa20MiB, campos de mapping, preview/validación, aprobación explícita, confirmación202queued, descarga y recarga. React representa texto, sin HTML crudo. Errores/reintento/conflicto/caducidad explícitos.
- Pruebas propias: `packages/ingestion/mapping.test.mjs`, `mapping-fixtures.mjs`; `packages/jobs/test/mapping-{http,infra}.mjs`, `mapping-browser.cjs`. Infra derivada del soporte permitido, puertos libres57910–57949, UUID/journal0600/Docker pull never, DB sin puerto publicado. Fuentes originales no reciben dependencias/builds.

Compatibilidad: clientes programáticos F02-02 conservan etiquetas legacy y confirmación; eso no acredita validez analítica. Nuevo flujo UI exige mapping guardado para ofrecer confirmación. No consumidor ni nuevo pipeline F02-05/06.

## Evidencia separada

Logs en `packages/jobs/test/evidence/f0203/`. Builds y servicios en TMP indicado por `/tmp/f0203-tmp`.

| Área | Comando | Resultado |
|---|---|---|
| Puro | `node --test packages/ingestion/*.test.mjs` (Node26.7) | exit0,95/95; incluye calendario,DST,USD/JPY,null,10K,CSV injection,XLSX multisheet/serial/formula. |
| Regresión | `PYTHONDONTWRITEBYTECODE=1 npm test` | exit0,24 pruebas. |
| Controlador | `PYTHONDONTWRITEBYTECODE=1 npm run test:controller` | exit0,110 pruebas,67.174s; repos de ensayo TMP. |
| Grafo | `PYTHONDONTWRITEBYTECODE=1 npm run graph:check` | exit0; sólo consulta, sin promoción. |
| Build | `python3 -B /tmp/f0203-build.py`, después `npm run build --workspace @vexa/web` en copia TMP | instalación offline ignore-scripts/config npm vacía y build exit0. Build final2 incluye último cambio producto. Node22.22. |
| HTTP real | `F02_PRODUCT_TMP=<TMP> python3 -B <TMP>/tests/acceptance/support/F02-durable/run.py node packages/jobs/test/mapping-http.mjs` | primer ensayo exit0 y cleanup true; posteriores ejecutan también navegador. Auth/Pg/Storage/Next SSR reales: CAS,preview,money,errors,persistencia restart,queued immutable; A/B,Origin,roles/revocación,rollback,crash y reintento. |
| Browser | mismo comando, Chromium Docker real con `mapping-browser.cjs` | ver cierre abajo; no confundir HTTP verde con navegador completo. |
| Diff | `git diff --check` | exit0. |

## Límites y pendientes

No aceptación/gate03 leído, editado o ejecutado; mutantes externos/revisión/freeze pendientes. No producción/cloud ni consumidor. No se ha probado toda combinación de roles específicamente en cada endpoint nuevo, CAS concurrente con dos configuraciones diferentes, revocación durante una descarga en vuelo ni corpus Excel universal. API lista páginas; UI muestra sólo página reciente (sin botón de siguiente página). XLSX múltiple requiere escribir nombre exacto de hoja; no hay selector de nombres previo al mapping. Caducidad/interrupción de carga exige reinicio explícito con nueva reserva, no reanuda bytes.

## Cierre de navegador y estado final

**PARTIAL / no listo para aceptación.** Chromium real abrió /imports autenticado y seleccionó conexión/archivo. El flujo se detiene en PUT firmado directo a Storage con `net::ERR_FAILED` y UI `Failed to fetch`. El HTTP equivalente con bytes reales pasa. No se atribuye aún la causa a producto o CORS/puente del ensayo; requiere diagnóstico independiente. No se acreditan guardar/confirmar/descargar desde navegador. Los intentos fallidos y el diagnóstico se conservan (exit1); cleanup true en todos los ensayos. Corregir selector de prueba y headers de compresión del proxy no resolvió este fallo. No ocultar detrás de build/HTTP verdes.

Última evidencia: `browser-diagnostic2.log`, run `1f511d22-851f-4f11-8577-47bf963884e0`; observación HTTP03 pasa en ese mismo proceso antes del fallo navegador. `fixture-hashes.txt` contiene hashes de las pruebas/fixtures actuales. El estado final no altera HEAD ni incrementa tareas aceptadas.
