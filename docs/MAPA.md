# Mapa de problemas (/map) y Carga y SLA (/workload)

Estado: construido en la rama `rediseno-mapa`, sin desplegar. Sin migraciones aplicadas. Sin PII.

## 1. Mapa de problemas

**Hoy** los pedidos y tickets cargados no traen ubicación (ninguna columna geográfica en `public`; HubSpot sin campos de dirección). Solo el Tracker de Excel trae columnas de dirección en texto libre (`Customer_address`, `Customer Address`, `Corrected Address (confirmed by customer)`, `Original Address (from Shopify)`). La pantalla es **provisional** y lo dice.

- Extractor: `packages/workspace-service/geo-estado.mjs`. Función pura; recibe el texto y devuelve solo `{pais, codigo}`. Orden: nombre completo de estado (sin que siga un tipo de vía: «Florida Ave» no es Florida) > nombre de estado de México (o CDMX/Edomex) > abreviatura de EE. UU. solo como «, XX 12345» o «, XX» al final > código postal de 5 dígitos (con marca explícita de México se usa la tabla de CP de México; si no, la tabla ZIP3 de EE. UU., porque el negocio vende en EE. UU.).
- Tablas CP documentadas en el mismo archivo: ZIP3 -> estado (rangos USPS aproximados) y prefijo de 2 dígitos del CP mexicano -> estado (SEPOMEX, aproximado: algunos CP fronterizos caen en el estado vecino).
- Servicio: `packages/workspace-service/mapa-problemas.mjs` (`createGeoMapRepository`). Lee `tracker_row_revisions` (última revisión por fila; hojas con columna de dirección; excluye los espejos WTR/WPR), deriva el estado **en memoria** y descarta el texto. Tope de tiempo en SAVEPOINT (12 s): si no responde, `status:'unavailable'`, nunca 0.
- Privacidad (k-anonimato, `K_MIN = 5`): solo salen estados con 5 casos o más y desgloses (tipo de caso, motivo, retailer) con 5 o más; lo demás va a «Otros». Si «Otros» quedaría con 1 a 4 casos, se une al desglose visible más pequeño para que no pueda restarse. Nunca salen direcciones, calles, nombres ni ciudades.
- Cobertura que devuelve: `{filas, conDireccion, interpretables, pctInterpretablesDeDireccion, pctInterpretablesDeFilas, pais}` («N de M filas del Tracker traen dirección interpretable»). Un caso = una fila del Tracker; un cliente puede aparecer en más de una hoja.
- API: `GET /api/map` (solo propietario y analista). Pantalla: mapa con geometrías reales (SVG propio, sin librerías, sin teselas, sin red; EE. UU. en Albers USA 975x610 de us-atlas@3.0.1 y México en Mercator 1000x629, ambos horneados en `components/map/geo/` con `generar-geo.mjs`), rampa gris de 5 pasos, rojo solo en el estado elegido, estados sin dato punteados (nunca cero), zoom/pan (botones, Ctrl/⌘+rueda, arrastre), tooltip, leyenda, tabla equivalente y panel lateral. Adaptado del mapa de prospección de Likida (repo propio).

### Contrato de datos reales: `GeoPedido`

Se activa al conectar Amazon, Walmart y Shopify (ship-to por pedido; ver guía de accesos de solo lectura).

```ts
type GeoPedido = {
  orderId: string;                                   // id del pedido en el canal (clave de unión con la conversación)
  canal: 'amazon' | 'walmart' | 'shopify' | 'bestbuy';
  estado: string | null;                             // 'US-TX' | 'MX-JAL' (misma clave que usa el mapa)
  ciudad?: string | null;                            // opcional; la pantalla NO la muestra salvo agregados con n >= 5
  mes: string;                                       // 'YYYY-MM'
};
```

Cálculo ya listo y probado: `quejasPor100Pedidos(pedidos: GeoPedido[], conversaciones: {orderId}[], {minPedidos = 30, k = 5})`. Una queja = pedido con al menos una conversación asociada (se cuenta el pedido una vez). Estados con menos de 30 pedidos devuelven «No disponible». Mientras no haya pedidos con estado, la pantalla muestra «No disponible» y explica qué falta.

## 2. Carga y SLA

HubSpot es la fuente de verdad; **Zendesk no se usa** (ni SLA ni abiertos) mientras su configuración esté en transición.

- Servicio: `packages/workspace-service/carga-sla.mjs` (`createWorkloadRepository`), API `GET /api/workload`.
- Mapa de carga: primer mensaje del cliente de cada conversación, en America/Mexico_City, por día de la semana y hora; promedio por día (total entre cuántos de ese día hubo). Hasta 6 meses completos: se excluyen el último mes con datos y los que caen bajo la mitad del anterior (huecos de exportación). Tarjetas: hora pico, días de menor carga, horas más tranquilas. Canal: `conversations.channel` está vacío en todas las filas, así que solo hay total y la pantalla lo dice.
- Riesgo de SLA de 24 h: solo hilos de HubSpot API con mensaje del cliente. Primera respuesta = primer mensaje de agente posterior al primer mensaje del cliente. Se muestran por separado: respuesta en 24 h o menos, respuesta tardía y sin respuesta registrada; mediana y p90; abiertos sin respuesta mayores de 24 h solo como conteo por edad. Un hilo sin respuesta registrada no se da por cumplido ni por incumplido.
- Cierre y reaperturas: se leen de `insight_thread_resolution`.
- Todo bloque lleva su cobertura y su «No disponible ahora».

### Migración propuesta (NO aplicada)

`supabase/migrations/20261112000000_insight_inbound_load.sql` (+ `packages/workspace-service/tests/20261112000000_insight_inbound_load.down.sql`): tabla `insight_inbound_load` (mes x día ISO x hora) y `refresh_inbound_load(tenant, mes?)`. Mismo patrón que 20261104 (RLS initplan, solo SELECT para `vexa_backend`, escritura solo por función autorizada). Mientras no se aplique, la pantalla calcula la matriz en vivo con tope de tiempo (≈6.5 s como superusuario; bajo RLS puede no caber y mostraría «No disponible ahora»). Con la tabla llena para todos los meses usados, la pantalla la lee y no escanea mensajes.
