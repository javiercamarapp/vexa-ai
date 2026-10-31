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
| rendimiento_sku | analyst, owner | canal (amazon, walmart, bestbuy, shopify), orden (venta, reembolso, defectos), top 1–10 | Observado; ventana común del canal |
| candidatos_sin_venta | analyst, owner | meses_sin_venta (3, 6, 9), top 1–10 | Inferido (no es descontinuación confirmada) |
| eficiencia_bodegas | analyst, owner | dimension (latencia, motivo), bodega (catálogo) | Observado; k>=5; solo despacho |
| casos_por_estado | analyst, owner | pais (US, MX), tipo_caso (catálogo) | Observado; k>=5; sin volumen por destino |
| casos_por_subcanal | analyst, owner | retailer (todos, amazon, walmart), top 1–10 | Observado con sesgo |
| envio_propio_vs_amazon | analyst, owner | – | siempre no_data, con la lista exacta de lo que falta y a quién pedirlo |
Invariantes (probadas): cada cifra/bloque con clase y cobertura; respuesta `ok` con fuentes y «cómo lo calculé»; sin dato → «No tengo ese dato» + qué falta; el modelo solo recibe `modelViewOf` (cifras formateadas, sin citas ni ids); texto del modelo descartado si trae números ajenos, enlaces o citas; ≤3 herramientas y ≤2 llamadas al modelo por turno; historial ≤4; pregunta ≤600; tiempo por herramienta 8 s; presupuesto por tenant en micro-USD (reserva→liquida); turnos/día limitados.
Puerto de datos (`port.mjs`): coverage, trends, associations, tracker, problems, problemIncidents, categoryMonthly, exposure, ledgerBySource, evidence, problemCustomers, ccoSku, ccoSinVenta, ccoBodegas, ccoEstados, ccoSubcanal, ccoEnvio.
Conectados con SQL de solo lectura (`port-queries.mjs`): ledgerBySource, problems, problemIncidents, categoryMonthly y exposure (esta última devuelve «desconocida» mientras no haya vínculos problema–pedido). Siguen `not_connected`: evidence y problemCustomers.

CCO (`tools-cco.mjs`): las seis herramientas leen solo las funciones `insight_cco_*` (migraciones 20261201000000 y 20261207000000) y el mapa de estados; E (`casos_por_subcanal`) y F (`envio_propio_vs_amazon`) miden casos por modalidad derivada del campo Retailer (quién vende, de qué bodega sale, marketplace; valores desconocidos = Sin dato) y NUNCA recomiendan una modalidad: faltan venta, costos y margen; todo argumento es enumerado o acotado (ninguno es texto libre ni llega a SQL); se corren con reglas, sin modelo. Si la migración no está aplicada responden «no disponible», nunca ceros.
