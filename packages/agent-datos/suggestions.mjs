// Preguntas sugeridas y de demostración. Las sugerencias iniciales salen de la COBERTURA REAL: solo se ofrece lo que hay cargado.
export const DEMO_QUESTIONS = Object.freeze([
  { q: '¿Cuáles son los 5 problemas con más incidencias este mes?', tool: 'problemas_top', args: { limit: 5 }, direct: true, need: 'hubspot' },
  { q: '¿Cuánto dinero en reembolsos tuvimos por marketplace?', tool: 'ledger_por_fuente', args: { kind: 'refund' }, direct: true, need: 'ledger' },
  { q: '¿Qué cubre y qué falta de mi información?', tool: 'cobertura_datos', args: {}, direct: true, need: null },
  { q: '¿Qué cambió entre julio y septiembre?', tool: 'comparar_meses', args: { a: '2026-07', b: '2026-09' }, direct: true, need: 'hubspot' },
  { q: '¿Cómo van las conversaciones por mes?', tool: 'tendencia_conversaciones', args: {}, direct: true, need: 'hubspot' },
  { q: '¿Cuánto ingreso está expuesto por problema?', tool: 'exposicion_por_problema', args: {}, direct: true, need: 'ledger' },
  { q: '¿Qué categorías crecieron en los últimos 6 meses?', tool: 'categorias_por_mes', args: { months: 6 }, direct: true, need: 'hubspot' },
  { q: '¿Qué dicen los clientes sobre el producto dañado en tránsito?', tool: 'evidencias_de_problema', args: { problema: 'producto dañado en tránsito' }, direct: false, need: 'hubspot', roles: ['analyst', 'owner'] },
  { q: '¿Cuántos clientes se ven afectados por el cobro duplicado?', tool: 'clientes_por_problema', args: { problema: 'cobro duplicado' }, direct: false, need: 'hubspot', roles: ['analyst', 'owner'] },
  { q: '¿Qué versión del Tracker manda y cuántas hojas están cerradas?', tool: 'estado_tracker', args: {}, direct: true, need: 'excel' },
  { q: '¿Cómo van las asociaciones ticket–contacto?', tool: 'estado_asociaciones', args: {}, direct: true, need: 'associations' },
  { q: '¿Cuántos pedidos tuvimos por marketplace en septiembre?', tool: 'ledger_por_fuente', args: { kind: 'order', month: '2026-09' }, direct: false, need: 'ledger' },
  { q: '¿Cómo evolucionaron los reembolsos mes a mes?', tool: 'ledger_por_mes', args: { kind: 'refund' }, direct: true, need: 'ledger' },
  { q: '¿Cuántos reembolsos tuvimos en Zendesk?', tool: 'ledger_por_fuente', args: { kind: 'refund', fuente: 'zendesk' }, direct: false, need: null, expect: 'no_data' },
  // CCO: las seis preguntas del director de cliente. E y F miden casos por modalidad según el campo Retailer (nunca recomiendan: faltan venta, costos y margen).
  { q: '¿Cómo rinde cada SKU en Amazon según venta, devoluciones y defectos?', tool: 'rendimiento_sku', args: { canal: 'amazon' }, direct: true, need: 'ledger', roles: ['analyst', 'owner'] },
  { q: '¿Qué SKU parecen descontinuados porque llevan 3 meses sin venta?', tool: 'candidatos_sin_venta', args: { meses_sin_venta: '3' }, direct: true, need: 'ledger', roles: ['analyst', 'owner'] },
  { q: '¿Qué bodega tarda más en despachar las reposiciones de garantía?', tool: 'eficiencia_bodegas', args: {}, direct: true, need: 'excel', roles: ['analyst', 'owner'] },
  { q: '¿En qué estados se concentran los casos?', tool: 'casos_por_estado', args: { pais: 'US' }, direct: true, need: 'excel', roles: ['analyst', 'owner'] },
  { q: '¿Qué SKU conviene vender como vendedor de Amazon y cuáles directo?', tool: 'casos_por_subcanal', args: { retailer: 'amazon' }, direct: true, need: 'excel', roles: ['analyst', 'owner'] },
  { q: '¿Qué SKU conviene enviar desde medios propios y cuáles con el cumplimiento de Amazon?', tool: 'envio_propio_vs_amazon', args: {}, direct: true, need: 'excel', roles: ['analyst', 'owner'] },
  { q: '¿Cuánto voy a vender el próximo trimestre?', tool: null, args: {}, direct: false, need: null, expect: 'out_of_catalog' },
]);

const byQ = (q) => DEMO_QUESTIONS.find((d) => d.q === q);
export const defaultSuggestions = (role) => ['¿Qué cubre y qué falta de mi información?', '¿Cuáles son los 5 problemas con más incidencias este mes?', '¿Cuánto dinero en reembolsos tuvimos por marketplace?'].filter((q) => !byQ(q)?.roles || byQ(q).roles.includes(role));

/** Sugerencias, tarjetas y consultas directas según lo que hay cargado y el rol. `coverage` es la vista real de cobertura. */
export function buildSuggestions(coverage, role = 'viewer') {
  const loaded = new Set((coverage?.sources ?? []).filter((s) => s.loaded).map((s) => s.key));
  const total = (coverage?.sources ?? []).length;
  const ok = (d) => (!d.need || loaded.has(d.need)) && (!d.roles || d.roles.includes(role)) && !d.expect;
  const pool = DEMO_QUESTIONS.filter(ok);
  const first = ['¿Qué cubre y qué falta de mi información?', ...pool.map((d) => d.q).filter((q) => q !== '¿Qué cubre y qué falta de mi información?')];
  const pick = (names) => DEMO_QUESTIONS.filter((d) => names.includes(d.tool) && ok(d)).map((d) => d.q);
  const categorias = [
    { titulo: 'Cobertura', preguntas: pick(['cobertura_datos', 'estado_tracker', 'estado_asociaciones']) },
    { titulo: 'Dinero', preguntas: pick(['ledger_por_fuente', 'ledger_por_mes', 'exposicion_por_problema']) },
    { titulo: 'CCO', preguntas: pick(['rendimiento_sku', 'candidatos_sin_venta', 'eficiencia_bodegas', 'casos_por_estado', 'casos_por_subcanal', 'envio_propio_vs_amazon']) },
    { titulo: 'Problemas y clientes', preguntas: pick(['problemas_top', 'comparar_meses', 'categorias_por_mes', 'clientes_por_problema']) },
  ].filter((c) => c.preguntas.length).map((c) => ({ ...c, preguntas: c.preguntas.slice(0, 3) }));
  const directas = Object.fromEntries(DEMO_QUESTIONS.filter((d) => d.direct && d.tool).map((d) => [d.q, { tool: d.tool, args: d.args }]));
  return { loaded: loaded.size, total, empty: loaded.size === 0, sugerencias: first.slice(0, 5), categorias, directas };
}

/** Frases de ejemplo de las seis preguntas del CCO, en español e inglés. El enrutador por reglas (model.mjs) debe llevar cada una a su herramienta; una prueba lo exige. */
export const CCO_EJEMPLOS = Object.freeze({
  rendimiento_sku: Object.freeze({
    es: ['¿Cómo rinde cada SKU según venta, devoluciones, defectos y reseñas positivas?', '¿Qué SKU tienen más devoluciones en Amazon?'],
    en: ['How does each SKU perform on sales, returns, defects and positive reviews?', 'Which SKUs have the most refunds on Amazon?'],
  }),
  candidatos_sin_venta: Object.freeze({
    es: ['¿Qué productos descontinuados necesitan inventario adicional?', '¿Qué SKU llevan 6 meses sin venta?'],
    en: ['Which discontinued products need additional inventory?', 'Which SKUs have had no sales for 6 months?'],
  }),
  eficiencia_bodegas: Object.freeze({
    es: ['¿Cuáles bodegas y transportistas son más eficientes?', '¿Qué bodega da más problemas de logística?'],
    en: ['Which warehouses and carriers are the most efficient?', 'Which warehouse causes the most logistics problems?'],
  }),
  casos_por_estado: Object.freeze({
    es: ['¿En qué estados conviene tener bodegas grandes o pequeñas?', '¿Qué estados concentran más casos?'],
    en: ['In which states should we have bigger or smaller warehouses?', 'Which states have the most cases?'],
  }),
  casos_por_subcanal: Object.freeze({
    es: ['¿Qué SKU conviene vender a través de Amazon y cuáles venderle a Amazon como proveedor directo?', '¿Qué SKU vendo como vendedor de Walmart según el Retailer?'],
    en: ['Which SKUs should we sell through Amazon and which sell to Amazon as a direct supplier?', 'Which SKUs do we sell as a Walmart seller by Retailer?'],
  }),
  envio_propio_vs_amazon: Object.freeze({
    es: ['¿Qué SKU conviene enviar con medios propios y cuáles con el cumplimiento de Amazon?', '¿De qué bodega sale mejor cada SKU en Walmart, la propia o Walmart Fulfillment?'],
    en: ['Which SKUs should we ship with our own means and which with Amazon fulfillment?', 'Which warehouse should each SKU ship from on Walmart, our own or Walmart fulfillment?'],
  }),
});
