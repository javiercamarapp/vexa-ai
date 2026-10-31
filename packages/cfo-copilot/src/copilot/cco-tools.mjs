// Herramientas CCO del Copiloto CFO (solo lectura): contestan las seis preguntas A a F del director de cliente leyendo la vista CCO que ya calculó la pestaña /cco
// para LA organización del principal (ctx.data.cco(tenantId)); misma RLS y mismos roles que /cco (propietario y analista). Sin SQL, sin texto libre, sin modelo nuevo.
// Reglas de verdad: ingreso bruto (sin costo ni margen); lo desconocido es «Sin dato» o «Menos de 5», jamás 0; monedas sin sumar; E y F son CASOS del Tracker, no ventas, y nunca recomiendan.
// Módulo PURO (sin node: ni pg): lo importa también el cliente a través de cfo-tools.mjs.
import {money as moneyBase} from '../format.mjs';
import {CopilotError} from './runtime.mjs';

const ROLES = ['owner', 'analyst'];
const CITE = {label: 'Pestaña CCO', href: '/cco', kind: 'pantalla', en: 'CCO tab'};
const CANALES = {amazon: 'Amazon', walmart: 'Walmart', bestbuy: 'Best Buy', shopify: 'Shopify'};
const par = idioma => (es, en) => (idioma === 'en' ? en : es);
// Textos que cambian con el idioma del turno (ctx.idioma): estados, clases, fuentes, latencias, subcanales, quién vende/envía y los armadores de pie y sello.
const FALTAN_EN = Object.freeze({
  unidades: 'Quantity sold per line in each marketplace order report.',
  resenas: 'Product review export per marketplace.',
  skuBestBuyShopify: 'SKU in the Best Buy and Shopify orders.',
  inventario: 'Stock per SKU and warehouse, from NetSuite or the warehouses.',
  estadoProducto: 'Product catalog with status, active or discontinued.',
  recurrencia: 'A stable buyer identity in orders, if the marketplace provides it.',
  transportista: 'Carrier of each shipment, for example from the Speedship shipments.',
  entregaFecha: 'Delivery date and delivery events per shipment.',
  denominadorEnvios: 'Total shipments per warehouse so that rates can be calculated.',
  vinculoQuejaEnvio: 'A link between each complaint and the shipment it belongs to.',
  destinoPedido: 'Destination state and postal code of each Amazon, Walmart, Best Buy and Shopify order.',
  bodegaEstado: 'A warehouse to state table, confirmed by the client.',
  propiedadRetailer: 'The Retailer property of HubSpot tickets, with ticket read permission.',
  cumplimientoPedido: 'Fulfillment type of each order, own or Amazon.',
  proveedorDirecto: 'Amazon sales as a direct supplier, from the vendor portal.',
  tarifasAmazon: 'Amazon fees, commissions and fulfillment report.',
  facturasTransportista: 'FedEx and UPS invoices or rate cards.',
  bodegaOrigen: 'Origin warehouse of each sales order.',
  ventaPorModalidad: 'Sales by SKU and by model: Amazon and Walmart orders showing who sells and which warehouse ships them.',
  costoCumplimiento: 'Fulfillment cost per unit: marketplace fees and the cost of running the own warehouse.',
  costoSku: 'Cost per SKU, so that the margin of each model can be calculated.',
  tiempoResolucion: 'Creation and close dates of each ticket, to measure resolution time by model.',
});
const QUIEN_EN = Object.freeze({operaciones: "the client's operations lead", datos: "the client's data lead"});
function kit(idioma) {
  const L = par(idioma), en = idioma === 'en';
  const ESTADO = {listo: L('Listo', 'Ready'), salvedad: L('Con salvedad', 'With caveat'), falta: L('Falta dato', 'Data missing')};
  const CLASE = {observed: L('Observado', 'Observed'), inferred: L('Inferido', 'Inferred'), estimated: L('Estimado', 'Estimated')};
  const FUENTE = {libro: L('Libro económico', 'Economic ledger'), tracker: L('Tracker de Excel', 'Excel Tracker')};
  const LAT = en ? {menos_de_1_dia: 'Under 1 day', '1_dia': '1 day', '2_dias': '2 days', '3_o_mas_dias': '3 days or more', sin_dato: 'No SLA recorded'} : {menos_de_1_dia: 'Menos de 1 día', '1_dia': '1 día', '2_dias': '2 días', '3_o_mas_dias': '3 días o más', sin_dato: 'Sin SLA registrado'};
  const SUB = en ? {amazon_cumplido_por_piloto: 'Amazon fulfilled by the pilot client', amazon_cumplido_por_amazon: 'Amazon fulfilled by Amazon', amazon_com: 'Amazon.com', amazon_sin_subcanal: 'Amazon with no subchannel',
    walmart_cumplido_por_piloto: 'Walmart fulfilled by the pilot client', walmart_cumplido_por_walmart: 'Walmart fulfilled by Walmart', walmart_sin_subcanal: 'Walmart with no subchannel'} : {amazon_cumplido_por_piloto: 'Amazon cumplido por el cliente piloto', amazon_cumplido_por_amazon: 'Amazon cumplido por Amazon', amazon_com: 'Amazon.com', amazon_sin_subcanal: 'Amazon sin subcanal',
    walmart_cumplido_por_piloto: 'Walmart cumplido por el cliente piloto', walmart_cumplido_por_walmart: 'Walmart cumplido por Walmart', walmart_sin_subcanal: 'Walmart sin subcanal'};
  const VALOR = {empresa: L('La empresa', 'The company'), marketplace: L('El marketplace', 'The marketplace'), amazon: 'Amazon', walmart: 'Walmart', sin_dato: L('Sin dato', 'No data')};
  const GRUPO = en ? {vende: {empresa: 'The company sells', marketplace: 'The marketplace sells', sin_dato: 'No data on who sells'}, bodega: {empresa: "Ships from the company's warehouse", marketplace: "Ships from the marketplace's warehouse", sin_dato: 'No warehouse data'}} : {vende: {empresa: 'Vende la empresa', marketplace: 'Vende el marketplace', sin_dato: 'Sin dato de quién vende'}, bodega: {empresa: 'Sale de la bodega de la empresa', marketplace: 'Sale de la bodega del marketplace', sin_dato: 'Sin dato de la bodega'}};
  const MENOS = L('Menos de 5', 'Fewer than 5'), SIN = L('Sin dato', 'No data');
  const n = x => (x === null || x === undefined ? null : new Intl.NumberFormat(en ? 'en-US' : 'es-MX').format(x));
  const cnt = x => (x === null || x === undefined ? MENOS : n(x));
  const mes = iso => String(iso ?? '').slice(0, 7);
  const sello = card => [CLASE[card.clase] ?? SIN, FUENTE[card.fuente] ?? L('Sin fuente', 'No source'), card.corte ? L(`hasta ${card.corte}`, `through ${card.corte}`) : L('sin fecha de corte', 'no cutoff date')].join(' · ');
  const faltanLista = card => (en && Array.isArray(card.faltan) && card.faltan.length ? card.faltan.map(x => `${FALTAN_EN[x.clave] ?? x.clave} Ask ${QUIEN_EN[x.quien] ?? x.quien}.`) : card.faltanTextos);
  const faltan = card => { const l = faltanLista(card); return Array.isArray(l) && l.length ? L('\nQué falta:\n', '\nWhat is missing:\n') + l.map(x => '- ' + x).join('\n') : ''; };
  const pie = card => L(`Estado: ${ESTADO[card.estado] ?? SIN}. Procedencia: ${sello(card)}.${faltan(card)}`, `Status: ${ESTADO[card.estado] ?? SIN}. Source: ${sello(card)}.${faltan(card)}`);
  // Separador « · »: el copiloto sanea el texto del modelo y la barra vertical se perdería (y pegaría cifras vecinas).
  const tabla = (cols, rows) => [cols.join(' · '), ...rows.map(r => r.join(' · '))].join('\n');
  const figura = (id, label, display, card, covLabel, scope) => ({id, label, display, kind: card.clase ?? 'observed', scope: scope ?? sello(card), coverage: {label: covLabel ?? ''}, how: L('Pestaña CCO', 'CCO tab')});
  const covTexto = card => (card.cobertura?.[0] ? `${n(card.cobertura[0].conocido)} ${L('de', 'of')} ${card.cobertura[0].elegible === null ? SIN : n(card.cobertura[0].elegible)}` : '');
  return {L, en, ESTADO, CLASE, FUENTE, LAT, SUB, VALOR, GRUPO, MENOS, SIN, n, cnt, mes, sello, faltan, pie, tabla, figura, covTexto, sinDato: (card, texto) => ({noData: true, summary: `${texto}\n${card.indisponible ? L('La consulta no respondió; eso no significa cero.', 'The query did not respond; that does not mean zero.') + '\n' : ''}${pie(card)}`, figures: [], citations: [CITE]})};
}

async function load(ctx) {
  const L = par(ctx.idioma);
  if (!ctx.tenantId) throw new CopilotError('forbidden', 403);
  const r = await ctx.data.cco(ctx.tenantId);
  if (!r || r.status !== 'ok' || !r.cco) return {noData: true, summary: L('No tengo el dato: la pestaña CCO no tiene datos de esta organización o no respondió a tiempo. Eso no significa cero.', `I don't have the data: the CCO tab has no data for this organization or did not respond in time. That does not mean zero.`), figures: [], citations: [CITE]};
  if (r.cco.status === 'not_installed') return {noData: true, summary: L('No tengo el dato: los agregados del CCO todavía no están instalados. No se muestra ninguna cifra y eso no significa cero.', `I don't have the data: the CCO aggregates are not installed yet. No figure is shown and that does not mean zero.`), figures: [], citations: [CITE]};
  return r.cco;
}

export const CCO_TOOLS = [
  {name: 'cco_rendimiento_sku', label: 'Revisando el rendimiento por SKU', scope: 'tenant', roles: ROLES,
    description: 'Pregunta A del CCO. Rendimiento por SKU y canal en su ventana común: ingreso bruto, líneas de pedido, reembolsos y casos de defecto del Tracker. Sin unidades ni reseñas.',
    input: {props: {canal: {type: 'enum', values: ['amazon', 'walmart', 'bestbuy', 'shopify']}, orden: {type: 'enum', values: ['venta', 'reembolso', 'defectos']}, top: {type: 'int', min: 1, max: 10}}},
    async run(args, ctx) {
      const {L, en, ESTADO, CLASE, FUENTE, LAT, SUB, VALOR, GRUPO, MENOS, SIN, n, cnt, mes, sello, faltan, pie, tabla, figura, covTexto, sinDato} = kit(ctx.idioma), money = (a, c, e) => moneyBase(a, c, e, ctx.idioma);
      const view = await load(ctx); if (view.noData) return view;
      const card = view.cards.A, canal = args.canal ?? 'amazon', orden = args.orden ?? 'venta', top = args.top ?? 5;
      if (card.estado === 'falta') return sinDato(card, L('No tengo datos suficientes para el rendimiento por SKU.', `I don't have enough data for performance by SKU.`));
      const c = card.canales.find(x => x.canal === canal);
      if (!c) return sinDato(card, L(`No hay una ventana común completa de pedidos y devoluciones para ${CANALES[canal]}.`, `There is no complete common window of orders and returns for ${CANALES[canal]}.`));
      const m = [...c.monedas].sort((a, b) => b.skus - a.skus || a.moneda.localeCompare(b.moneda))[0];
      if (!m || !m.top.length) return sinDato(card, L(`No hay SKU con venta en la ventana común de ${CANALES[canal]}.`, `There are no SKUs with sales in the common window of ${CANALES[canal]}.`));
      const v = x => (x === null || x === undefined ? -1 : x);
      const rows = [...m.top].sort(orden === 'reembolso' ? (a, b) => v(b.reembolsos) - v(a.reembolsos) || a.sku.localeCompare(b.sku) : orden === 'defectos' ? (a, b) => v(b.defectos) - v(a.defectos) || a.sku.localeCompare(b.sku) : () => 0).slice(0, top);
      const f1 = figura('cco:A:' + canal, L(`Ingreso bruto de ${rows[0].sku} en ${CANALES[canal]}`, `Gross revenue of ${rows[0].sku} in ${CANALES[canal]}`), money(rows[0].brutoMinor, m.moneda, rows[0].exponente), card, covTexto(card));
      const t = tabla(['SKU', L('Líneas', `Lines`), L('Ingreso bruto', `Gross revenue`), L('Reembolsos', `Refunds`), L('Por cada 100 líneas', `Per 100 lines`), L('Defectos del Tracker', `Tracker defects`)], rows.map(r => [r.sku, n(r.lineas), money(r.brutoMinor, m.moneda, r.exponente), r.reembolsos === null ? SIN : n(r.reembolsos), r.porCien === null ? SIN : String(r.porCien), r.defectos === null ? MENOS : n(r.defectos)]));
      return {summary: L(`A. Rendimiento por SKU · ${CANALES[canal]} · ${m.moneda}. Ventana común ${mes(c.ventana.desde)} a ${mes(c.ventana.hasta)}, ${c.ventana.meses} meses completos. Ingreso bruto, sin costo ni margen; las monedas no se suman.\n${t}\nNo hay unidades vendidas ni reseñas positivas, así que no mido venta en unidades ni satisfacción. Los defectos son casos atendidos del Tracker, no una tasa.\n${pie(card)}`, `A. Performance by SKU · ${CANALES[canal]} · ${m.moneda}. Common window ${mes(c.ventana.desde)} to ${mes(c.ventana.hasta)}, ${c.ventana.meses} complete months. Gross revenue, no cost or margin; currencies are not added.\n${t}\nThere are no units sold or positive reviews, so I do not measure sales in units or satisfaction. Defects are handled Tracker cases, not a rate.\n${pie(card)}`),
        figures: [f1], citations: [CITE]};
    }},
  {name: 'cco_sin_venta', label: 'Buscando SKU sin venta reciente', scope: 'tenant', roles: ROLES,
    description: 'Pregunta B del CCO. SKU de Amazon y Walmart sin venta desde hace 3, 6 o 9 meses. Es una señal Inferida, no una lista de descontinuados confirmados: no hay inventario ni estado de producto.',
    input: {props: {meses: {type: 'enum', values: ['3', '6', '9']}, top: {type: 'int', min: 1, max: 10}}},
    async run(args, ctx) {
      const {L, en, ESTADO, CLASE, FUENTE, LAT, SUB, VALOR, GRUPO, MENOS, SIN, n, cnt, mes, sello, faltan, pie, tabla, figura, covTexto, sinDato} = kit(ctx.idioma), money = (a, c, e) => moneyBase(a, c, e, ctx.idioma);
      const view = await load(ctx); if (view.noData) return view;
      const card = view.cards.B, meses = args.meses ?? '3', top = args.top ?? 5;
      if (card.estado === 'falta' || Array.isArray(card.top)) return sinDato(card, L('No tengo datos suficientes de SKU con venta en Amazon o Walmart.', `I don't have enough data on SKUs with sales on Amazon or Walmart.`));
      const um = card.umbrales.find(u => u.meses === Number(meses)), filas = (card.top[meses] ?? []).slice(0, top);
      const f = figura('cco:B:' + meses, L(`SKU sin venta desde hace ${meses} meses o más`, `SKUs with no sales for ${meses} months or more`), `${n(um.skus)} de ${n(card.total)}`, card, L(`${n(card.total)} SKU con alguna venta`, `${n(card.total)} SKUs with some sales`));
      const t = filas.length ? '\n' + tabla(['SKU', L('Último mes con venta', `Last month with sales`), L('Meses sin venta', `Months without sales`), L('Líneas en 9 meses', `Lines in 9 months`), L('Canales', `Channels`)], filas.map(r => [r.sku, mes(r.ultimoMes), n(r.mesesSinVenta), n(r.lineas9m), r.canales.map(c => CANALES[c] ?? c).join(', ')])) : '';
      return {summary: L(`B. ${n(um.skus)} de ${n(card.total)} SKU de Amazon y Walmart no tienen venta desde hace ${meses} meses o más. Es una señal inferida, no una confirmación de descontinuación: un SKU sin venta aquí puede venderse en otro canal, y no tengo inventario, estado de producto ni recurrencia de compra, así que no puedo decir cuánto inventario adicional tener.${t}\n${pie(card)}`, `B. ${n(um.skus)} of ${n(card.total)} Amazon and Walmart SKUs have had no sales for ${meses} months or more. It is an inferred signal, not a confirmation of discontinuation: a SKU with no sales here may sell in another channel, and I have no inventory, product status or repeat purchase data, so I can't say how much additional inventory to hold.${t}\n${pie(card)}`),
        figures: [f], citations: [CITE]};
    }},
  {name: 'cco_bodegas', label: 'Revisando el despacho por bodega', scope: 'tenant', roles: ROLES,
    description: 'Pregunta C del CCO. Casos del Tracker por bodega: tiempo de despacho de reposiciones de garantía y etiquetas de devolución, o motivo del caso. No hay transportista ni total de envíos.',
    input: {props: {dimension: {type: 'enum', values: ['latencia', 'motivo']}}},
    async run(args, ctx) {
      const {L, en, ESTADO, CLASE, FUENTE, LAT, SUB, VALOR, GRUPO, MENOS, SIN, n, cnt, mes, sello, faltan, pie, tabla, figura, covTexto, sinDato} = kit(ctx.idioma), money = (a, c, e) => moneyBase(a, c, e, ctx.idioma);
      const view = await load(ctx); if (view.noData) return view;
      const card = view.cards.C, dim = args.dimension ?? 'latencia';
      if (card.estado === 'falta' || !card.bodegas.length) return sinDato(card, L('Ninguna bodega tiene suficientes casos para mostrarse sin exponer personas, o no hay datos de bodega.', `No warehouse has enough cases to be shown without exposing people, or there is no warehouse data.`));
      const claves = dim === 'latencia' ? Object.keys(LAT) : [...new Set(card.bodegas.flatMap(b => Object.keys(b.motivos)))].sort();
      const total = card.bodegas.reduce((a, b) => a + b.total, 0);
      const f = figura('cco:C', L('Casos visibles con bodega', `Visible cases with a warehouse`), n(total), card, covTexto(card));
      const t = tabla([L('Bodega', `Warehouse`), ...claves.map(c => (dim === 'latencia' ? LAT[c] : c.replace(/_/g, ' ')))], card.bodegas.map(b => [b.bodega, ...claves.map(c => cnt((dim === 'latencia' ? b.latencia : b.motivos)[c]))]));
      return {summary: L(`C. Casos del Tracker por bodega: ${dim === 'latencia' ? 'tiempo de despacho' : 'motivo del caso'}. Es despacho, el tiempo hasta que sale el rastreo, no entrega. No puedo decir qué bodega o transportista es más eficiente: no hay transportista ni total de envíos por bodega, así que los conteos no son tasas. Una celda con menos de 5 casos no se muestra.\n${t}\n${pie(card)}`, `C. Tracker cases by warehouse: ${dim === 'latencia' ? 'dispatch time' : 'case reason'}. This is dispatch, the time until the tracking number comes out, not delivery. I can't say which warehouse or carrier is more efficient: there is no carrier and no total of shipments per warehouse, so the counts are not rates. A cell with fewer than 5 cases is not shown.\n${t}\n${pie(card)}`),
        figures: [f], citations: [CITE]};
    }},
  {name: 'cco_estados', label: 'Contando casos por estado', scope: 'tenant', roles: ROLES,
    description: 'Pregunta D del CCO. Casos del Tracker por estado de EE. UU. o México, tomados de la dirección en memoria. Sin volumen de pedidos ni venta por destino. Mínimo de 5 casos por celda.',
    input: {props: {pais: {type: 'enum', values: ['US', 'MX']}}},
    async run(args, ctx) {
      const {L, en, ESTADO, CLASE, FUENTE, LAT, SUB, VALOR, GRUPO, MENOS, SIN, n, cnt, mes, sello, faltan, pie, tabla, figura, covTexto, sinDato} = kit(ctx.idioma), money = (a, c, e) => moneyBase(a, c, e, ctx.idioma);
      const view = await load(ctx); if (view.noData) return view;
      const card = view.cards.D, pais = args.pais ?? 'US';
      const filas = (card.estados ?? []).filter(e => e.pais === pais).slice(0, 15);
      if (card.estado === 'falta' || !filas.length) return sinDato(card, L(`Ningún estado de ${pais === 'US' ? 'Estados Unidos' : 'México'} llega al mínimo de 5 casos, o no hay direcciones legibles.`, `No state of ${pais === 'US' ? 'the United States' : 'Mexico'} reaches the minimum of 5 cases, or there are no readable addresses.`));
      const f = figura('cco:D', L(`Casos en ${filas[0].nombre}`, `Cases in ${filas[0].nombre}`), n(filas[0].n), card, covTexto(card));
      return {summary: L(`D. Casos del Tracker por estado · ${pais === 'US' ? 'Estados Unidos' : 'México'}. No puedo decir dónde conviene tener bodegas grandes o pequeñas: los pedidos no traen estado de destino, así que no hay volumen ni venta por estado. Cada fila del Tracker cuenta como un caso.\n${tabla(['Estado', L('Casos', `Cases`)], filas.map(e => [e.nombre, n(e.n)]))}\n${pie(card)}`, `D. Tracker cases by state · ${pais === 'US' ? 'United States' : 'Mexico'}. I can't say where it is best to have bigger or smaller warehouses: orders do not carry a destination state, so there is no volume or sales by state. Each Tracker row counts as one case.\n${tabla(['State', 'Cases'], filas.map(e => [e.nombre, n(e.n)]))}\n${pie(card)}`),
        figures: [f], citations: [CITE]};
    }},
  modalidadTool('E'),
  modalidadTool('F'),
];

// E (quién vende) y F (de qué bodega sale): misma evidencia, otro eje. Casos del Tracker según el campo Retailer; jamás «conviene X».
function modalidadTool(id) {
  const eje = id === 'E' ? 'vende' : 'bodega';
  return {name: id === 'E' ? 'cco_modalidad_venta' : 'cco_modalidad_envio', label: id === 'E' ? 'Revisando la modalidad de venta' : 'Revisando la modalidad de envío', scope: 'tenant', roles: ROLES,
    description: id === 'E'
      ? 'Pregunta E del CCO. Modalidad de venta en Amazon y Walmart según el campo Retailer: quién vende, la empresa o el marketplace. Casos, reembolsos, defectos y despacho por subcanal o por SKU. Son casos con sesgo, no ventas: no decide qué SKU vender en cada modalidad.'
      : 'Pregunta F del CCO. Modalidad de envío en Amazon y Walmart según el campo Retailer: de qué bodega sale, la de la empresa o la del marketplace. Casos, reembolsos, defectos y despacho por subcanal o por SKU. Son casos con sesgo, no ventas ni costos: no decide desde dónde enviar.',
    input: {props: {retailer: {type: 'enum', values: ['todos', 'amazon', 'walmart']}, vista: {type: 'enum', values: ['modalidad', 'sku']}, top: {type: 'int', min: 1, max: 10}}},
    async run(args, ctx) {
      const {L, en, ESTADO, CLASE, FUENTE, LAT, SUB, VALOR, GRUPO, MENOS, SIN, n, cnt, mes, sello, faltan, pie, tabla, figura, covTexto, sinDato} = kit(ctx.idioma), money = (a, c, e) => moneyBase(a, c, e, ctx.idioma);
      const view = await load(ctx); if (view.noData) return view;
      const card = view.cards[id], retailer = args.retailer ?? 'todos', vista = args.vista ?? 'modalidad', top = args.top ?? 7;
      if (card.estado === 'falta') return sinDato(card, L('No hay casos de Amazon o Walmart con subcanal visible en el Tracker, así que no tengo nada que comparar por modalidad.', `There are no Amazon or Walmart cases with a visible subchannel in the Tracker, so I have nothing to compare by model.`));
      const subs = card.subcanales.filter(x => retailer === 'todos' || x.marketplace === retailer);
      if (!subs.length) return sinDato(card, L(`Ningún subcanal de ${VALOR[retailer] ?? retailer} llega al mínimo de 5 casos.`, `No subchannel of ${VALOR[retailer] ?? retailer} reaches the minimum of 5 cases.`));
      const f0 = figura('cco:' + id, L('Casos de Amazon y Walmart con subcanal visible', `Amazon and Walmart cases with a visible subchannel`), n(card.totalCasos), card, covTexto(card));
      const figs = card.ejes.map(e => figura(`cco:${id}:${e.valor}`, GRUPO[eje][e.valor], n(e.casos), card, covTexto(card)));
      const det = card.detalleIndisponible, c = x => (det ? SIN : cnt(x));
      let cuerpo;
      if (vista === 'modalidad') {
        const des = x => (x.despacho === null ? SIN : x.despacho.legibles === null ? MENOS : L(`${cnt(x.despacho.tresODias)} de ${n(x.despacho.legibles)}`, `${cnt(x.despacho.tresODias)} of ${n(x.despacho.legibles)}`));
        cuerpo = tabla([L('Subcanal', `Subchannel`), id === 'E' ? L('Quién vende', `Who sells`) : L('Bodega de origen', `Origin warehouse`), 'Marketplace', L('Casos', `Cases`), L('Reembolsos', `Refunds`), L('Garantías', `Warranties`), L('Defectos', `Defects`), L('Despacho de 3 días o más', `Dispatch of 3 days or more`)],
          subs.slice(0, top).map(x => [SUB[x.subcanal] ?? String(x.subcanal).replace(/_/g, ' '), VALOR[eje === 'vende' ? x.vende : x.bodega], VALOR[x.marketplace], n(x.casos), c(x.reembolsos), c(x.garantias), c(x.defectos), des(x)]));
      } else {
        if (det) return sinDato(card, L('El detalle por SKU y modalidad todavía no está instalado; solo tengo los conteos por subcanal.', `The detail by SKU and model is not installed yet; I only have the counts by subchannel.`));
        const valores = card.ejes.map(e => e.valor).filter(v => v !== 'sin_dato' || card.skus.some(x => x.grupos.sin_dato));
        const celda = g => (g ? L(`${n(g.casos)} (reembolsos ${cnt(g.reembolsos)}, defectos ${cnt(g.defectos)})`, `${n(g.casos)} (refunds ${cnt(g.reembolsos)}, defects ${cnt(g.defectos)})`) : MENOS);
        if (!card.skus.length) return sinDato(card, L('Ningún SKU llega al mínimo de 5 casos en estas modalidades.', `No SKU reaches the minimum of 5 cases in these models.`));
        cuerpo = tabla(['SKU', ...valores.map(v => GRUPO[eje][v])], card.skus.slice(0, top).map(x => [x.sku, ...valores.map(v => celda(x.grupos[v]))]));
      }
      const falta = id === 'E' ? L('la venta por SKU y por modalidad, el costo de cumplimiento, las tarifas del marketplace y el margen', `sales by SKU and by model, the fulfillment cost, the marketplace fees and the margin`) : L('la venta por SKU y por origen, el costo de envío propio, el costo de cumplimiento del marketplace y el margen', `sales by SKU and by origin, the cost of own shipping, the marketplace fulfillment cost and the margin`);
      const cierre = id === 'E' ? L('no puedo decir qué SKU conviene vender como vendedor de Amazon o a través del marketplace', `I can't say which SKU is better sold as an Amazon seller or through the marketplace`) : L('no puedo decir desde dónde conviene enviar cada SKU, con medios propios o con el cumplimiento del marketplace', `I can't say where each SKU should ship from, with own means or with marketplace fulfillment`);
      const notas = [card.salvedades.includes('walmartSoloBodega') ? L('Walmart no compra producto de la empresa: solo se vende a través de Walmart, así que para Walmart solo importa de qué bodega sale el pedido.', `Walmart does not buy product from the company: it is only sold through Walmart, so for Walmart only the warehouse the order ships from matters.`) : null,
        L('Un Retailer cuyo subcanal no se conoce queda como Sin dato; no se asigna a ninguna modalidad.', `A Retailer whose subchannel is unknown stays as No data; it is not assigned to any model.`), L('El único tiempo medible es el de despacho de reposiciones y etiquetas, no el tiempo de resolución del caso.', `The only measurable time is the dispatch time of replacements and labels, not the case resolution time.`), L('Cada cifra cuenta solo celdas visibles de al menos 5 casos: es un mínimo.', `Each figure counts only visible cells of at least 5 cases: it is a minimum.`),
        det ? L('El detalle por modalidad todavía no está instalado: reembolsos, garantías, defectos y despacho figuran como Sin dato.', `The detail by model is not installed yet: refunds, warranties, defects and dispatch appear as No data.`) : null].filter(Boolean);
      const ejesTxt = card.ejes.map(e => `${GRUPO[eje][e.valor]} ${n(e.casos)}`).join(', ');
      return {summary: L(`${id}. ${id === 'E' ? 'Modalidad de venta' : 'Modalidad de envío'}: hay ${f0.display} casos de Amazon y Walmart con subcanal visible en el Tracker (${ejesTxt}). Son casos atendidos con sesgo, no ventas: ${cierre}, porque faltan ${falta}.\n${cuerpo}\n${notas.join(' ')}\n${pie(card)}`, `${id}. ${id === 'E' ? 'Selling model' : 'Shipping model'}: there are ${f0.display} Amazon and Walmart cases with a visible subchannel in the Tracker (${ejesTxt}). They are handled cases with bias, not sales: ${cierre}, because ${falta} are missing.\n${cuerpo}\n${notas.join(' ')}\n${pie(card)}`),
        figures: [f0, ...figs], citations: [CITE]};
    }};
}
