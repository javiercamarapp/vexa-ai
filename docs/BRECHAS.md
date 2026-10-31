# Brechas de ingreso (`/gaps`)

Pantalla del grupo «Dinero» que responde las tres preguntas del responsable del cliente: **dónde gano más, dónde pierdo y por qué, y dónde podría ganar más**. Rama `rediseno-brechas` (23-oct-2026). Nada aplicado ni desplegado.

## Regla de oro: todo es INGRESO BRUTO
Cliente piloto no compartirá costo por producto. Ninguna cifra es margen, utilidad ni ganancia, y la pantalla lo rotula («ingreso bruto»). Las recomendaciones miden **ingreso en juego**; lo recuperable solo se estima con supuestos que teclea el usuario (estimador con candado, el mismo de `/refunds`).

Clases: **Observado** (hecho del libro/Tracker), **Estimado** (solo con supuestos tecleados, en el navegador), **Inferido** (regla sobre datos observados; así se rotulan las recomendaciones). Sin sumar monedas (CAD/MXN aparte), `unknown ≠ 0` (una parte que no responde dice «No disponible ahora»), ventanas parciales dichas en una línea.

## Fuentes (solo `insight_*`, nunca agregados en vivo)
| Parte | Origen | Estado |
|---|---|---|
| Reembolsos por mes × canal × SKU | `insight_refund_by_sku_month` | existe (migración 20261104) |
| Tracker (estado × motivo × canal) | `insight_tracker_refund_status` | existe |
| Ingreso por mes × canal × SKU | `insight_order_revenue_month` | **propuesta** `supabase/propuestas/20261110000000_insight_gaps.sql` |
| Conversaciones por mes × familia | `insight_complaint_family_month` | propuesta (misma migración) |
| Pares de familias (venta cruzada) | `insight_family_pair` | propuesta |
| Avance del análisis del histórico | `extraction_runs` (2 conteos baratos) + `insight_state.conversation_volume` | existe |

La migración es **solo propuesta** (reversa en `packages/workspace-service/tests/20261110000000_insight_gaps.down.sql`, copia en `supabase/propuestas/`). Hasta aplicarla, «Dónde gano», la intensidad y las recomendaciones dicen «No disponible ahora»; reembolsos y Tracker ya funcionan. Refresco: `select public.refresh_gap_insights('<tenant>')` (worker del tenant con acción `import` u operador; noop si el corte no cambió; recalculo completo, idempotente). No toca `refresh_insights` (sin riesgo de redefinición fuera de orden). Probada con Postgres local: `packages/workspace-service/tests/brechas-migracion.test.mjs`.

## Cálculo
- **Ingreso**: última revisión de cada línea de pedido, USD; activo = bruto − cancelados. Ranking y % acumulado sobre el ingreso total (incluye Shopify/Best Buy, que no traen SKU del vendedor).
- **Mes completo** (por canal): si es el primero, empieza el día ≤ 3; si es el último, termina a menos de 3 días de su fin; y no cae a menos de la mitad del mes previo (posible hueco de exportación). **Solo meses completos** entran a mes contra mes (último par consecutivo de cada canal).
- **Intensidad de reembolso** = reembolsos sin cancelados / ingreso bruto, mismo SKU, canal y mes, solo meses completos desde que existe el libro de reembolsos del canal. **No es tasa por cohorte**; se reporta la cobertura del cruce (% del dinero devuelto que se pudo cruzar).
- **Familias**: `cod:<PREFIJO>` (prefijo de 2 a 6 letras del SKU, igual que `producto-familias.mjs` de `rediseno-ia`) ↔ SKU base. Prefijos de una letra y categorías `cat:` **no se cruzan** con ventas. Tasa = conversaciones que mencionan la familia por cada 100 líneas vendidas de esa familia en los meses con análisis y libro completo. Sin análisis v2 en la base, la sección muestra «El análisis del histórico aún no termina» con el avance leído (`extraction_runs` v2 / (conversaciones cargadas − corridas previas)).
- **Umbrales de las reglas** (`UMBRALES` en `packages/workspace-service/brechas.mjs`, visibles en «Cómo se calculó»): intensidad ≥ 2 × mediana del canal con ≥ US[omitido: dato de cliente] de ingreso, 30 líneas y 15 reembolsos; crecimiento ≥ 10 %; venta cruzada con ≥ 30 conversaciones y análisis ≥ 50 %.

## Recomendaciones con evidencia (reglas, sin IA)
Tipos: `revisar_proveedor`, `empujar`, `revisar_canal` («no ofrecer en ciertos mercados»; mercado = canal, aún sin geografía) y `cross_sell` (solo con `product_families`). Forma de cada una: `{id, tipo, sku, canal, titulo, accion, porque, evidencia[], cobertura, impacto:{clase, usdMinor, texto}, baseMinor}`.

## Contrato con el flujo de recomendaciones (BUILD-FLUJO)
`recomendacionDeBrecha(rec, {generadoEn?, supuestos?})` — función **pura** en `packages/workspace-service/brechas-recomendacion.mjs` (re-exportada por `brechas.mjs`; sin imports, segura para el navegador). Devuelve:

```
{ origen: 'brechas-de-ingreso', clave: rec.id, tipoBrecha, titulo, resumen (= porque), cuerpo (texto listo: Qué hacer / Por qué / Evidencia / Cobertura / Impacto / Supuestos),
  evidencia[], cobertura, impacto: {clase:'observed'|'estimated', usdMinor|null, texto}, supuestos[], estadoSugerido: 'proposed', etiquetas[] }
```
Lanza `brecha_invalida` si falta `id` o `titulo`. El botón «Pasar a recomendación» solo **prepara** el texto: lo muestra, deja el objeto en `sessionStorage['vexa:borrador-recomendacion']` (JSON) y ofrece «Copiar texto» e «Ir a Recomendaciones». No crea ni envía nada; Proceder / Ajustar / Descartar lo construye el flujo en `/recommendations`, que puede leer esa clave al abrir para precargar el borrador.

## Archivos
Todo en `apps/web/src/components/gaps/` (pantalla, secciones, gráficos, familias, recomendaciones, modelo de textos, archivos locales HTML/CSV sin PII), `apps/web/src/lib/gaps/server.ts` + `app/api/gaps/route.ts` (solo lectura, solo propietarios y analistas), `packages/insights/reader-brechas.mjs` (lectores) y `packages/workspace-service/brechas.mjs` (modelo puro y repositorio). Datos de demostración para la auditoría visual: `apps/web/tests/ui/brechas-sintetico.mjs` (marcas inventadas; `GAPS_VARIANT=pendiente|sinordenes|sintracker|vacio|error`).

## Pruebas
`cd apps/web && node --require ./tests/server-only-stub.cjs --import tsx --test tests/brechas.test.mjs` · `node --test packages/workspace-service/tests/brechas-migracion.test.mjs` (Postgres local) · auditoría visual: `VIEWS_EXTRA='gaps=/gaps' node apps/web/tests/ui/audit.mjs`.
