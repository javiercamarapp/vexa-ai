# Datos vivos: insights precalculados que se actualizan solos

Rama `rediseno-vivos` (23-oct-2026). Objetivo del dueño: que TODA la información ya esté calculada y guardada, y que se actualice sola cuando cambian las fuentes, sin pantallas de 25-35 s ni recargas. Nada de esto está aplicado ni desplegado: las migraciones son propuestas y el refresco automático nace APAGADO.

## 1. Arquitectura

```
fuente cambia ──► (a) gancho tras importación / tick HubSpot  ─┐
                  (b) programador periódico (propuesto, §3)   ─┼─► public.refresh_insights(tenant, fuente, desde, presupuesto_ms)
                  (c) operador: select public.refresh_insights ─┘            │  incremental · idempotente · con tope · reanudable
                                                                              ▼
                      insight_* (por tenant, RLS initplan, solo lectura para la app)  +  insight_state  +  source_sync_state
                                                                              ▼
 pantalla ──► GET /api/insights?name=…  (solo SELECT, ms)        GET /api/freshness (marca ligera, `version`)
                                                                              ▼
 navegador: vigilante cada 30 s (retroceso, solo pestaña visible) ─► píldora «Datos nuevos · actualizar» ─► SWR revalida en segundo plano
```

Migración propuesta: `supabase/migrations/20261104000000_insights_engine.sql` (reversa: `packages/workspace-service/tests/20261104000000_insights_engine.down.sql`). No coincide con las de BUILD-FUGA (la suya llega a `20261102000000_contact_repeat_summary`).

### Tablas

| Tabla | Contenido | Clave |
|---|---|---|
| `source_sync_state` | por fuente: método de entrada (`api_poll`, `webhook`, `file_drop`, `sheet_sync`, `manual_upload`, `stub`), estado, último intento y éxito, registros nuevos, error (código), latencia, siguiente corrida, cada cuánto se espera, corte de datos | `(tenant_id, source_key)` |
| `insight_state` | por insight: `status` (`ready`/`partial`/`failed`/`skipped`), `refreshed_at`, `source_watermark`, filas del origen, duración, `cursor` (periodos pendientes), `computed_from` (de dónde sale y con qué regla), `error_code` | `(tenant_id, insight)` |
| `insight_conversation_volume` | conversaciones por **semana (lunes ISO UTC)** y por **mes** | `(tenant, grain, period)` |
| `insight_refund_by_sku_month` | reembolsos del libro por mes × canal × SKU base × moneda: `n`, `n_known`, `n_cancelled`, `amount_minor`, `amount_active_minor` (sin cancelados). Nunca suma monedas | `(tenant, month, channel, sku_base, currency, exponent)` |
| `insight_thread_resolution` | hilos de HubSpot API: hilos, cerrados, reabiertos, p50/p90 de horas a cierre, <1 h, >7 d | `(tenant, grain month/all, period)` |
| `insight_tracker_refund_status` | hoja Refunds del Tracker por estado × motivo (catálogo cerrado) × retailer; monto sin moneda declarada (supuesto USD) | `(tenant, status, reason, retailer)` |

Todas llevan `refreshed_at` y `source_watermark` (y `computed_from` donde aplica). **Contacto repetido NO se duplica**: lo calcula `refresh_contact_repeat` (`20261102000000`, BUILD-FUGA); `refresh_insights('contacts')` lo invoca si existe (si no, `skipped`) y registra su frescura en `insight_state`.

Diseñadas pero NO implementadas (siguen el mismo patrón): `insight_category_trend_week/month` (issues por categoría; hoy solo 6 semanas útiles), `insight_resolution_by_agent`, `insight_refund_rate_cohort` (falta quantity y alias de orden, DATOS.md §7B).

### Refresco

`refresh_insights(p_tenant, p_source in ledger|conversations|hubspot|tracker|contacts|all, p_since, p_budget_ms)`:

- **Seguridad**: `SECURITY DEFINER`, `search_path=''`. `EXECUTE` solo para `vexa_backend`, y dentro exige (`insights_authorized`) el worker del propio tenant con `vexa.action='import'` y membresía owner/analyst, o un operador superusuario/BYPASSRLS conectado sin `SET ROLE`. Las tablas no se escriben desde la app.
- **Incremental real (libro)**: meses afectados = meses de todas las revisiones de las entidades con alguna revisión nueva (`recorded_at` > corte guardado − 2 min de traslape) ∪ meses pendientes del cursor. Cada mes se reemplaza completo (idempotente). Si se acaba `p_budget_ms`, lo que falta queda en `insight_state.cursor` (`partial`) y la siguiente llamada lo completa, recientes primero.
- **Por corte (conversaciones, HubSpot, Tracker, contactos)**: se compara el corte del origen con el guardado; sin cambios devuelve `noop` con una lectura de índice; con cambios recalcula esa fuente completa en una pasada (medido sobre el cliente piloto: conversaciones ≈ 2.1 s como propietario; HubSpot y Tracker, decenas de ms).
- **Aislamiento**: cada insight corre en su propio sub-bloque; si falla queda `failed` con el SQLSTATE y los demás siguen. Candado consultivo por (tenant, fuente): dos refrescos simultáneos no se pisan (`busy`).
- **Reglas de datos**: última revisión por entidad; SKU base = `upper` sin `-WMn`, `-nnnA-nnn`, `-NEW` (misma regla que `packages/insights/sku.mjs`); sin sumar monedas; Tracker: última revisión por fila, filas vacías descartadas, texto libre → `otro` (sin PII).

## 2. Disparo (hoy)

| Disparo | Dónde | Estado |
|---|---|---|
| Fin de importación | `afterWork` en `/api/internal/worker` (consumidor `imports`): anota `source_sync_state('imports', manual_upload)` y refresca `all` | **apagado** salvo `VEXA_INSIGHTS_REFRESH=enabled` |
| Tick de HubSpot (cada 5 min por el cron de Vercel ya existente) | `afterWork` en `/api/internal/crm`: anota `hubspot` (`api_poll`, espera 300 s) y refresca `hubspot`, `conversations`, `contacts` | **apagado** igual |
| Operador | `select public.refresh_insights('<tenant>','all');` | disponible tras aplicar la migración |

Los ganchos nunca rompen el trabajo principal (`.catch`), no cambian cron ni `vercel.json`, y son baratos cuando nada cambió (`noop`).

## 3. Programador: qué existe y qué se propone

Inspeccionado: **Vercel Cron** (`apps/web/vercel.json`: `/api/internal/crm` cada 5 min y `/api/internal/metadata` cada 15 min; autenticados con `CRON_SECRET` = `VEXA_WORKER_TRIGGER_SECRET`). Existe una alternativa `pg_cron`+`pg_net` solo como script de operador (`supabase/operations/crm-cron.sql`, no activa). No hay Supabase scheduled functions.

Con el gancho encendido, HubSpot y conversaciones se refrescan solos cada ~5 min y las importaciones al terminar. Lo que NO tiene disparador propio: el **libro/Tracker cargados por carpeta o por API de marketplace** (los conectores de §5 necesitan un host que los corra). Propuesta (NO agregada): una ruta `/api/internal/insights` (patrón `createCRMHostedHandler`) y una entrada `{ "path": "/api/internal/insights", "schedule": "*/10 * * * *" }` en `apps/web/vercel.json`. **Costo**: 1 build de Vercel al desplegar el cambio de `vercel.json` (agrupar con el resto de la rama) + 144 invocaciones/día de una función de ≈1-10 s (sin build adicional por ejecución). Para no agregar consumidor nuevo se reutilizaría un consumidor existente: añadir `'insights'` a `reserve_worker_scope` exige redefinir esa función (riesgo conocido de migración fuera de orden): por eso no se hizo.

## 4. Lectura rápida y cómo debe leer BUILD-FUGA (/refunds)

- Servicio: `packages/insights/reader.mjs` (`createInsightsReader({database})`): `conversationVolume({grain})`, `refundBySkuMonth({from,to,currency,top})`, `threadResolution()`, `trackerRefundStatus()`, `freshness()`. Solo SELECT bajo la RLS del usuario, tope 1.5 s por lectura, ~7 ms medidos localmente.
- HTTP: `GET /api/insights?name=conversations|refunds|threads|tracker` (refunds y tracker solo owner/analyst) y `GET /api/freshness`.
- Contrato de honestidad: `availability` = `ready` | `partial` (hay periodos por calcular) | `absent` (nunca calculado: usar el camino anterior, **nunca 0**) | `unavailable` (sin migración/permiso) | `timeout`. Cada respuesta trae `meta` con `refreshedAt`, `sourceWatermark`, `ageSeconds`, `computedFrom`.
- **Piloto ya cableado**: `/api/trends` lee primero `insight_conversation_volume` (`packages/insights/adapter.mjs`, con comprobación de obsolescencia al microsegundo) y cae al resumen `20261022000000` y luego al camino anterior. Probado con y sin tabla.
- **Para /refunds** (coordinar con Javier; no se tocaron sus archivos): en `fuga-reembolsos.mjs`, la parte `refunds` (grupos del libro por canal/SKU/mes, hoy `FUGA_BUDGETS_MS.refunds=4000 ms` contra el libro) puede reemplazarse por `readRefundBySkuMonth(s, {from,to})` (ya devuelve por moneda `gross/active/nCancelled/nKnown`, y `top.skus` + `top.sharePercent`); `tracker` por `readTrackerRefundStatus`; `repeat` ya lee `contact_repeat_summary` (se mantiene fresca con `refresh_insights('contacts')`). Conservar el camino actual como respaldo cuando `availability !== 'ready'`. Las líneas vendidas del libro (órdenes, `orders`) no están precalculadas aquí (siguiente insight: `insight_order_lines_month`, misma forma que el de reembolsos).

## 5. Actualización sin recargar (UI)

- `GET /api/freshness` → `{availability, version, sources[], insights[]}`; `version` es un hash corto de los cortes/estados: cambia solo si algo cambió.
- `apps/web/src/lib/workspace/vivos.mjs` (vigilante): cada 30 s; retroceso ×2 hasta 5 min si falla; no consulta con la pestaña oculta (consulta al volver); 401/403/404 detienen; la primera lectura es la línea base.
- `DatosNuevos` (en el encabezado del workspace): píldora «Datos nuevos · actualizar». Al pulsar: marca la caché SWR obsoleta y dispara `vexa:refresh` (cada vista revalida en segundo plano y conserva lo pintado). Modo automático: `localStorage['vexa-datos-auto']='true'`.
- `/sources` → «Estado de sincronización»: por fuente método, último éxito, siguiente corrida, error, nuevos y latencia; y cuándo se recalculó cada cálculo.

## 6. Conectores en código (`packages/insights/connectors`, sin credenciales ni red)

Interfaz común (`contract.mjs`): `init`, `backfill(ctx,{from,to,cursor})`, `incremental(ctx,{cursor})`, `toLedger(registro)` → candidatos `{externalId, kind, sku, quantity, currency, amountMinor, effectiveAt, status}`; `runConnector` valida, cuenta rechazados, pagina por cursor y registra `source_sync_state`. Los candidatos salen hacia la vía de importación económica existente (`economic_batch_import`, con reporte atestiguado); este paquete no escribe en el libro.

- Esqueletos: Amazon SP-API (Orders v0 + Finances `RefundEventList`), Walmart Marketplace (`/v3/orders`, reembolsos por línea), Mirakl (Best Buy US/CA, OR11), Shopify Admin GraphQL, Zendesk (solo declara la fuente; su ingesta real ya existe). Las formas de respuesta se modelaron con las API públicas y se verifican **solo con fixtures sintéticos**: hay que validarlas con una muestra autorizada al conectar.
- Secretos: solo `secret://nombre` (validado); el valor se resuelve en tiempo de ejecución desde un almacén inyectado y viaja únicamente al transporte; transporte por defecto apagado (`EXTERNAL_CALLS_DISABLED`).
- Carpeta compartida (`folder-drop.mjs`): reglas por nombre (`pedidos-amazon*.csv`, `devoluciones-walmart*.csv`, `*tracker*.xlsx`…), espera a que el archivo se asiente, recibos por SHA-256 (memoria o archivo JSON), orden de recepción, un fallo detiene la pasada sin dejar recibo, no sigue enlaces simbólicos. El `importer` se inyecta (aquí el cargador existente de `economic_batch_import` / `packages/ingestion/tracker/loader.mjs`).
- `TrackerSource` (`tracker-source.mjs`): `folderTrackerSource` (probada), `googleSheetsTrackerSource` (Drive `files.export` .xlsx) y `oneDriveTrackerSource` (Graph versions) con contrato y transporte inyectable; `syncTracker` importa solo versiones nuevas, en orden (la última manda).

### Qué activar para cada fuente (no se activó nada)

1. **HubSpot en tiempo real** (receptor ya construido, hoy apagado): aplicar `0040_crm_webhook_receipts.sql`; tener la conexión HubSpot activa con credencial de lectura; `NEXT_PUBLIC_SITE_URL` exacto; `VEXA_CRM_WEBHOOK_BINDINGS_JSON` (secreto del servidor; un binding por conexión con `portalId`, `appId`, `secret`); en HubSpot, suscripción con firma v3 a `https://<dominio>/api/webhooks/crm/<id>`; `VEXA_CRM_WEBHOOKS_ENABLED=true` en el receptor **y** en el consumidor CRM. El webhook no ejecuta el importador: solo adelanta el siguiente tick (cada 5 min). Detalle completo: `packages/connectors/WEBHOOKS.md`. Sigue necesitando el polling para eventos perdidos.
2. **Insights automáticos**: aplicar `20261104000000` (y, para contacto repetido, `20261102000000`); ejecutar una vez `select public.refresh_insights('<tenant>','all');` como operador; luego `VEXA_INSIGHTS_REFRESH=enabled` en el entorno de producción (cambio de configuración externa: lo decide Javier).
3. **Marketplaces por API**: credenciales en un almacén (Vault) y `secret://…`; un host que corra `runConnector` (ver §3); ver `quantity` y alias de orden Walmart (DATOS.md §2.3) que estas APIs sí entregan.
4. **Tracker en línea / carpeta**: elegir fuente (`folder`, Google Sheets, OneDrive), el `importer` del cargador y el host periódico.

## 7. Anclas verificadas contra la base real (solo SELECT, 23-oct)

Las cifras reales de producción (filas del libro, montos, SKU, contactos repetidos, hilos y percentiles) se retiraron de este documento por política de datos de cliente (ver `docs/seguridad/DATOS-DE-CLIENTE.md`). Las anclas se verificaron: cada medición de DATOS.md coincidió con la base real, con diferencias explicadas por datos posteriores al corte. Las cifras exactas viven en el cuaderno privado de la sesión del 23-oct, no en el repositorio.

| Ancla (DATOS.md) | Resultado |
|---|---|
| Reembolsos del libro | coincide; desglose por canal omitido |
| USD bruto / sin cancelados | coincide; montos omitidos |
| Top-10 SKU base | coincide con la tabla; códigos de producto omitidos |
| Contacto repetido 90 d | coincide; conteos omitidos |
| Tracker Refunds por estado | coincide; conteos omitidos |
| Hilos HubSpot | coincide; diferencia mínima explicada por hilos posteriores al corte |

## 8. Costos y alcance de despliegue

Builds de Vercel provocados por esta rama: **0** (no se hizo push). Al integrar: 1 build por push a la rama ligada. Llamadas a APIs externas: 0. Modelos: 0.
