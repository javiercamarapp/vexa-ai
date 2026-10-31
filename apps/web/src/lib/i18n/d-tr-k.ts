// Traducción grupo K (T43): textos que llegan de los paquetes como `note` y se pintan en pantalla, mensajes de error de rutas y tablas de motivos.
// Los paquetes mandan una CLAVE estable (`noteKey`, `codigo`…) además del texto en español de siempre; la capa de presentación traduce con `t`.
// tests/i18n.test.ts exige las mismas claves y {variables} en ES y EN. Los datos guardados del cliente no se traducen.
export const trKEs = {
  'tr.nt.tendencias': 'Conteos de registros cargados (conversaciones por fecha de inicio o, si falta, por la fecha de su primer mensaje; pedidos registrados y reembolsos liquidados por fecha efectiva, de todas las bases del libro económico —incluye Shopify bruto y filas «a revisar»; /cfo muestra una sola base—; conversaciones de todas las fuentes, no solo las filas de HubSpot del Explorador). No aplican las reglas de publicación del snapshot ni suman monedas distintas.',
  'tr.nt.tendenciasMuestra': 'Estimado con una muestra del {p} % de las conversaciones: fechar todas (por su primer mensaje) no cabe en el tiempo permitido.',
  'tr.nt.incCategorias': 'Cuenta incidencias (filas de issues), no problemas agrupados. Las categorías las asigna la IA: son Inferido, no un hecho observado.',
  'tr.nt.incProblema': 'Incidencias de las corridas de extracción vinculadas a este problema, por mes de su conversación (inicio o primer mensaje). Una corrida puede aportar incidencias de otras categorías; no es el volumen de clientes afectados ni una pérdida.',
  'tr.nt.incTotal': 'Incidencias por mes de su conversación (inicio o primer mensaje). No son problemas agrupados.',
} as const;
export const trKEn = {
  'tr.nt.tendencias': 'Counts of loaded records (conversations by start date or, if missing, by the date of their first message; orders recorded and refunds settled by effective date, from every basis of the economic ledger, including raw Shopify and “to review” rows; /cfo shows a single basis; conversations from all sources, not only the HubSpot rows in the Explorer). The publication rules of the published cut do not apply and different currencies are not added together.',
  'tr.nt.tendenciasMuestra': 'Estimated from a {p} % sample of the conversations: dating all of them (by their first message) does not fit in the allowed time.',
  'tr.nt.incCategorias': 'Counts incidents (issue rows), not grouped problems. The AI assigns the categories: they are Inferred, not an observed fact.',
  'tr.nt.incProblema': 'Incidents from the extraction runs linked to this problem, by month of their conversation (start or first message). A run can contribute incidents from other categories; it is not the number of affected customers or a loss.',
  'tr.nt.incTotal': 'Incidents by month of their conversation (start or first message). They are not grouped problems.',
} as const;
