# Contrato del agente «Pregúntale a tus datos»
Herramientas (catálogo cerrado, `tools.mjs`; esquema JSON en `catalogForModel(role)`; todas de solo lectura, sin argumentos de tenant/rol/SQL):
| Herramienta | Roles | Argumentos | Clase |
|---|---|---|---|
| cobertura_datos | todos | – | Observado/Estimado por fila |
| estado_tracker | todos | – | Observado |
| estado_asociaciones | todos | – | Estimado si hay muestra |
| tendencia_conversaciones | todos | months 2–12 | Observado/Estimado (muestra 10 %) |
| problemas_top | todos | month AAAA-MM, limit 1–10 | Inferido |
| exposicion_por_problema | todos | limit 1–10 | Inferido (no es pérdida, no se suma) |
| categorias_por_mes | todos | months 2–12 | Inferido |
| ledger_por_fuente | todos | kind refund/order, month, months, fuente | Observado (monedas nunca se suman) |
| ledger_por_mes | todos | kind, months | Observado |
| comparar_meses | todos | a, b (AAAA-MM) | Mixto por fila |
| evidencias_de_problema | analyst, owner | problema (texto), limit 1–5 | Observado; citas solo-UI |
| clientes_por_problema | analyst, owner | problema, month | Inferido + citas |
Invariantes (probadas): cada cifra/bloque con clase y cobertura; respuesta `ok` con fuentes y «cómo lo calculé»; sin dato → «No tengo ese dato» + qué falta; el modelo solo recibe `modelViewOf` (cifras formateadas, sin citas ni ids); texto del modelo descartado si trae números ajenos, enlaces o citas; ≤3 herramientas y ≤2 llamadas al modelo por turno; historial ≤4; pregunta ≤600; tiempo por herramienta 8 s; presupuesto por tenant en micro-USD (reserva→liquida); turnos/día limitados.
Puerto de datos (`port.mjs`): coverage, trends, associations, tracker, problems, problemIncidents, categoryMonthly, exposure, ledgerBySource, evidence, problemCustomers.
Conectados con SQL de solo lectura (`port-queries.mjs`): ledgerBySource, problems, problemIncidents, categoryMonthly y exposure (esta última devuelve «desconocida» mientras no haya vínculos problema–pedido). Siguen `not_connected`: evidence y problemCustomers.
