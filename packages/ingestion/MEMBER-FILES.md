# Cargador de archivos de miembros (F4)

Valida y registra CSV/XLSX que sube un miembro (propietario o analista) sobre la reserva de importación que ya existe. No escribe datos de negocio: deja constancia de procedencia y corte.

## Flujo
1. Reserva y subida: las mismas de `/api/imports` (conexión CSV activa, 20 MiB, política `vexa_private_member_upload_types`).
2. `POST /api/imports/{id}/member-file/preview` `{kind, sheet?, date_format?, timezone?, currency?}` devuelve conteos, motivos con línea/campo/código, agregados y el mapa de encabezados. Nunca valores de celda.
3. `POST /api/imports/{id}/member-file/register` (mismas opciones + `sha256`) guarda `provenance.member_file` en `imports`, con el corte (fecha más reciente observada), y pasa la reserva a `uploaded`. `confirm_import` exige `reserved`, así que el archivo registrado ya no puede convertirse en importación de mensajes. Los contadores de cobertura (`total/accepted/rejected/duplicates`) no se tocan. Es idempotente con el mismo hash y opciones.

## Tipos (`kind`)
`sales_by_sku`, `marketplace_orders`, `marketplace_returns`, `reviews`, `speedship_shipments`. Encabezados por alias ES/EN (`memberFileKindInfo(kind)`). Campos requeridos, tipos (fecha con serial de Excel, entero, dinero en unidades menores, calificación 1 a 5) y motivos de rechazo: `member-files.mjs`.

## Reglas
- Importes rotulados «Observada», ingreso bruto (nunca margen); reembolsos sin importe quedan desconocidos, no cero; costo de Speedship es cotizado.
- Moneda: columna del archivo o la declarada; sin ninguna, el servidor bloquea (`currency_required`).
- Filas idénticas se cuentan como repetidas (no entran); un mismo seguimiento con otras referencias es válido (multibulto).
- Tope de filas del parser: 50,000 por archivo y por libro XLSX; UTF-8 obligatorio; sin macros ni vínculos externos.
- `applied: false`: nada de esto alimenta todavía libro económico, SKU, reseñas ni envíos.

## Pruebas
`node --test packages/ingestion/member-files.test.mjs packages/jobs/import-member-file.test.mjs` y `npm run test:cargador --workspace @vexa/web`. Fixtures sintéticas (`member-files.fixtures.mjs`).
