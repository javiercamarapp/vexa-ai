// Herramientas CCO del Copiloto CFO (solo lectura): contestan las seis preguntas A a F del director de cliente leyendo la vista CCO que ya calculó la pestaña /cco
// para LA organización del principal (ctx.data.cco(tenantId)); misma RLS y mismos roles que /cco (propietario y analista). Sin SQL, sin texto libre, sin modelo nuevo.
// Reglas de verdad: ingreso bruto (sin costo ni margen); lo desconocido es «Sin dato» o «Menos de 5», jamás 0; monedas sin sumar; E y F son CASOS del Tracker, no ventas, y nunca recomiendan.
// Módulo PURO (sin node: ni pg): lo importa también el cliente a través de cfo-tools.mjs.
import {money} from '../format.mjs';
import {CopilotError} from './runtime.mjs';

const ROLES = ['owner', 'analyst'];
const CITE = {label: 'Pestaña CCO', href: '/cco', kind: 'pantalla'};
const CANALES = {amazon: 'Amazon', walmart: 'Walmart', bestbuy: 'Best Buy', shopify: 'Shopify'};
const ESTADO = {listo: 'Listo', salvedad: 'Con salvedad', falta: 'Falta dato'};
const CLASE = {observed: 'Observado', inferred: 'Inferido', estimated: 'Estimado'};
const FUENTE = {libro: 'Libro económico', tracker: 'Tracker de Excel'};
const LAT = {menos_de_1_dia: 'Menos de 1 día', '1_dia': '1 día', '2_dias': '2 días', '3_o_mas_dias': '3 días o más', sin_dato: 'Sin SLA registrado'};
const SUB = {amazon_cumplido_por_piloto: 'Amazon cumplido por el cliente piloto', amazon_cumplido_por_amazon: 'Amazon cumplido por Amazon', amazon_com: 'Amazon.com', amazon_sin_subcanal: 'Amazon sin subcanal',
  walmart_cumplido_por_piloto: 'Walmart cumplido por el cliente piloto', walmart_cumplido_por_walmart: 'Walmart cumplido por Walmart', walmart_sin_subcanal: 'Walmart sin subcanal'};
const VALOR = {empresa: 'La empresa', marketplace: 'El marketplace', amazon: 'Amazon', walmart: 'Walmart', sin_dato: 'Sin dato'};
const GRUPO = {vende: {empresa: 'Vende la empresa', marketplace: 'Vende el marketplace', sin_dato: 'Sin dato de quién vende'}, bodega: {empresa: 'Sale de la bodega de la empresa', marketplace: 'Sale de la bodega del marketplace', sin_dato: 'Sin dato de la bodega'}};
const MENOS = 'Menos de 5', SIN = 'Sin dato';
const n = x => (x === null || x === undefined ? null : new Intl.NumberFormat('es-MX').format(x));
const cnt = x => (x === null || x === undefined ? MENOS : n(x));
const mes = iso => String(iso ?? '').slice(0, 7);
const sello = card => [CLASE[card.clase] ?? SIN, FUENTE[card.fuente] ?? 'Sin fuente', card.corte ? `hasta ${card.corte}` : 'sin fecha de corte'].join(' · ');
const faltan = card => (Array.isArray(card.faltanTextos) && card.faltanTextos.length ? '\nQué falta:\n' + card.faltanTextos.map(x => '- ' + x).join('\n') : '');
const pie = card => `Estado: ${ESTADO[card.estado] ?? SIN}. Procedencia: ${sello(card)}.${faltan(card)}`;
// Separador « · »: el copiloto sanea el texto del modelo y la barra vertical se perdería (y pegaría cifras vecinas).
const tabla = (cols, rows) => [cols.join(' · '), ...rows.map(r => r.join(' · '))].join('\n');
const figura = (id, label, display, card, covLabel, scope) => ({id, label, display, kind: card.clase ?? 'observed', scope: scope ?? sello(card), coverage: {label: covLabel ?? ''}, how: 'Pestaña CCO'});
const covTexto = card => (card.cobertura?.[0] ? `${n(card.cobertura[0].conocido)} de ${card.cobertura[0].elegible === null ? SIN : n(card.cobertura[0].elegible)}` : '');

async function load(ctx) {
  if (!ctx.tenantId) throw new CopilotError('forbidden', 403);
  const r = await ctx.data.cco(ctx.tenantId);
  if (!r || r.status !== 'ok' || !r.cco) return {noData: true, summary: 'No tengo el dato: la pestaña CCO no tiene datos de esta organización o no respondió a tiempo. Eso no significa cero.', figures: [], citations: [CITE]};
  if (r.cco.status === 'not_installed') return {noData: true, summary: 'No tengo el dato: los agregados del CCO todavía no están instalados. No se muestra ninguna cifra y eso no significa cero.', figures: [], citations: [CITE]};
  return r.cco;
}
const sinDato = (card, texto) => ({noData: true, summary: `${texto}\n${card.indisponible ? 'La consulta no respondió; eso no significa cero.\n' : ''}${pie(card)}`, figures: [], citations: [CITE]});

export const CCO_TOOLS = [
  {name: 'cco_rendimiento_sku', label: 'Revisando el rendimiento por SKU', scope: 'tenant', roles: ROLES,
    description: 'Pregunta A del CCO. Rendimiento por SKU y canal en su ventana común: ingreso bruto, líneas de pedido, reembolsos y casos de defecto del Tracker. Sin unidades ni reseñas.',
    input: {props: {canal: {type: 'enum', values: ['amazon', 'walmart', 'bestbuy', 'shopify']}, orden: {type: 'enum', values: ['venta', 'reembolso', 'defectos']}, top: {type: 'int', min: 1, max: 10}}},
    async run(args, ctx) {
      const view = await load(ctx); if (view.noData) return view;
      const card = view.cards.A, canal = args.canal ?? 'amazon', orden = args.orden ?? 'venta', top = args.top ?? 5;
      if (card.estado === 'falta') return sinDato(card, 'No tengo datos suficientes para el rendimiento por SKU.');
      const c = card.canales.find(x => x.canal === canal);
      if (!c) return sinDato(card, `No hay una ventana común completa de pedidos y devoluciones para ${CANALES[canal]}.`);
      const m = [...c.monedas].sort((a, b) => b.skus - a.skus || a.moneda.localeCompare(b.moneda))[0];
      if (!m || !m.top.length) return sinDato(card, `No hay SKU con venta en la ventana común de ${CANALES[canal]}.`);
      const v = x => (x === null || x === undefined ? -1 : x);
      const rows = [...m.top].sort(orden === 'reembolso' ? (a, b) => v(b.reembolsos) - v(a.reembolsos) || a.sku.localeCompare(b.sku) : orden === 'defectos' ? (a, b) => v(b.defectos) - v(a.defectos) || a.sku.localeCompare(b.sku) : () => 0).slice(0, top);
      const f1 = figura('cco:A:' + canal, `Ingreso bruto de ${rows[0].sku} en ${CANALES[canal]}`, money(rows[0].brutoMinor, m.moneda, rows[0].exponente), card, covTexto(card));
      const t = tabla(['SKU', 'Líneas', 'Ingreso bruto', 'Reembolsos', 'Por cada 100 líneas', 'Defectos del Tracker'], rows.map(r => [r.sku, n(r.lineas), money(r.brutoMinor, m.moneda, r.exponente), r.reembolsos === null ? SIN : n(r.reembolsos), r.porCien === null ? SIN : String(r.porCien), r.defectos === null ? MENOS : n(r.defectos)]));
      return {summary: `A. Rendimiento por SKU · ${CANALES[canal]} · ${m.moneda}. Ventana común ${mes(c.ventana.desde)} a ${mes(c.ventana.hasta)}, ${c.ventana.meses} meses completos. Ingreso bruto, sin costo ni margen; las monedas no se suman.\n${t}\nNo hay unidades vendidas ni reseñas positivas, así que no mido venta en unidades ni satisfacción. Los defectos son casos atendidos del Tracker, no una tasa.\n${pie(card)}`,
        figures: [f1], citations: [CITE]};
    }},
  {name: 'cco_sin_venta', label: 'Buscando SKU sin venta reciente', scope: 'tenant', roles: ROLES,
    description: 'Pregunta B del CCO. SKU de Amazon y Walmart sin venta desde hace 3, 6 o 9 meses. Es una señal Inferida, no una lista de descontinuados confirmados: no hay inventario ni estado de producto.',
    input: {props: {meses: {type: 'enum', values: ['3', '6', '9']}, top: {type: 'int', min: 1, max: 10}}},
    async run(args, ctx) {
      const view = await load(ctx); if (view.noData) return view;
      const card = view.cards.B, meses = args.meses ?? '3', top = args.top ?? 5;
      if (card.estado === 'falta' || Array.isArray(card.top)) return sinDato(card, 'No tengo datos suficientes de SKU con venta en Amazon o Walmart.');
      const um = card.umbrales.find(u => u.meses === Number(meses)), filas = (card.top[meses] ?? []).slice(0, top);
      const f = figura('cco:B:' + meses, `SKU sin venta desde hace ${meses} meses o más`, `${n(um.skus)} de ${n(card.total)}`, card, `${n(card.total)} SKU con alguna venta`);
      const t = filas.length ? '\n' + tabla(['SKU', 'Último mes con venta', 'Meses sin venta', 'Líneas en 9 meses', 'Canales'], filas.map(r => [r.sku, mes(r.ultimoMes), n(r.mesesSinVenta), n(r.lineas9m), r.canales.map(c => CANALES[c] ?? c).join(', ')])) : '';
      return {summary: `B. ${n(um.skus)} de ${n(card.total)} SKU de Amazon y Walmart no tienen venta desde hace ${meses} meses o más. Es una señal inferida, no una confirmación de descontinuación: un SKU sin venta aquí puede venderse en otro canal, y no tengo inventario, estado de producto ni recurrencia de compra, así que no puedo decir cuánto inventario adicional tener.${t}\n${pie(card)}`,
        figures: [f], citations: [CITE]};
    }},
  {name: 'cco_bodegas', label: 'Revisando el despacho por bodega', scope: 'tenant', roles: ROLES,
    description: 'Pregunta C del CCO. Casos del Tracker por bodega: tiempo de despacho de reposiciones de garantía y etiquetas de devolución, o motivo del caso. No hay transportista ni total de envíos.',
    input: {props: {dimension: {type: 'enum', values: ['latencia', 'motivo']}}},
    async run(args, ctx) {
      const view = await load(ctx); if (view.noData) return view;
      const card = view.cards.C, dim = args.dimension ?? 'latencia';
      if (card.estado === 'falta' || !card.bodegas.length) return sinDato(card, 'Ninguna bodega tiene suficientes casos para mostrarse sin exponer personas, o no hay datos de bodega.');
      const claves = dim === 'latencia' ? Object.keys(LAT) : [...new Set(card.bodegas.flatMap(b => Object.keys(b.motivos)))].sort();
      const total = card.bodegas.reduce((a, b) => a + b.total, 0);
      const f = figura('cco:C', 'Casos visibles con bodega', n(total), card, covTexto(card));
      const t = tabla(['Bodega', ...claves.map(c => (dim === 'latencia' ? LAT[c] : c.replace(/_/g, ' ')))], card.bodegas.map(b => [b.bodega, ...claves.map(c => cnt((dim === 'latencia' ? b.latencia : b.motivos)[c]))]));
      return {summary: `C. Casos del Tracker por bodega: ${dim === 'latencia' ? 'tiempo de despacho' : 'motivo del caso'}. Es despacho, el tiempo hasta que sale el rastreo, no entrega. No puedo decir qué bodega o transportista es más eficiente: no hay transportista ni total de envíos por bodega, así que los conteos no son tasas. Una celda con menos de 5 casos no se muestra.\n${t}\n${pie(card)}`,
        figures: [f], citations: [CITE]};
    }},
  {name: 'cco_estados', label: 'Contando casos por estado', scope: 'tenant', roles: ROLES,
    description: 'Pregunta D del CCO. Casos del Tracker por estado de EE. UU. o México, tomados de la dirección en memoria. Sin volumen de pedidos ni venta por destino. Mínimo de 5 casos por celda.',
    input: {props: {pais: {type: 'enum', values: ['US', 'MX']}}},
    async run(args, ctx) {
      const view = await load(ctx); if (view.noData) return view;
      const card = view.cards.D, pais = args.pais ?? 'US';
      const filas = (card.estados ?? []).filter(e => e.pais === pais).slice(0, 15);
      if (card.estado === 'falta' || !filas.length) return sinDato(card, `Ningún estado de ${pais === 'US' ? 'Estados Unidos' : 'México'} llega al mínimo de 5 casos, o no hay direcciones legibles.`);
      const f = figura('cco:D', `Casos en ${filas[0].nombre}`, n(filas[0].n), card, covTexto(card));
      return {summary: `D. Casos del Tracker por estado · ${pais === 'US' ? 'Estados Unidos' : 'México'}. No puedo decir dónde conviene tener bodegas grandes o pequeñas: los pedidos no traen estado de destino, así que no hay volumen ni venta por estado. Cada fila del Tracker cuenta como un caso.\n${tabla(['Estado', 'Casos'], filas.map(e => [e.nombre, n(e.n)]))}\n${pie(card)}`,
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
      const view = await load(ctx); if (view.noData) return view;
      const card = view.cards[id], retailer = args.retailer ?? 'todos', vista = args.vista ?? 'modalidad', top = args.top ?? 7;
      if (card.estado === 'falta') return sinDato(card, 'No hay casos de Amazon o Walmart con subcanal visible en el Tracker, así que no tengo nada que comparar por modalidad.');
      const subs = card.subcanales.filter(x => retailer === 'todos' || x.marketplace === retailer);
      if (!subs.length) return sinDato(card, `Ningún subcanal de ${VALOR[retailer] ?? retailer} llega al mínimo de 5 casos.`);
      const f0 = figura('cco:' + id, 'Casos de Amazon y Walmart con subcanal visible', n(card.totalCasos), card, covTexto(card));
      const figs = card.ejes.map(e => figura(`cco:${id}:${e.valor}`, GRUPO[eje][e.valor], n(e.casos), card, covTexto(card)));
      const det = card.detalleIndisponible, c = x => (det ? SIN : cnt(x));
      let cuerpo;
      if (vista === 'modalidad') {
        const des = x => (x.despacho === null ? SIN : x.despacho.legibles === null ? MENOS : `${cnt(x.despacho.tresODias)} de ${n(x.despacho.legibles)}`);
        cuerpo = tabla(['Subcanal', id === 'E' ? 'Quién vende' : 'Bodega de origen', 'Marketplace', 'Casos', 'Reembolsos', 'Garantías', 'Defectos', 'Despacho de 3 días o más'],
          subs.slice(0, top).map(x => [SUB[x.subcanal] ?? String(x.subcanal).replace(/_/g, ' '), VALOR[eje === 'vende' ? x.vende : x.bodega], VALOR[x.marketplace], n(x.casos), c(x.reembolsos), c(x.garantias), c(x.defectos), des(x)]));
      } else {
        if (det) return sinDato(card, 'El detalle por SKU y modalidad todavía no está instalado; solo tengo los conteos por subcanal.');
        const valores = card.ejes.map(e => e.valor).filter(v => v !== 'sin_dato' || card.skus.some(x => x.grupos.sin_dato));
        const celda = g => (g ? `${n(g.casos)} (reembolsos ${cnt(g.reembolsos)}, defectos ${cnt(g.defectos)})` : MENOS);
        if (!card.skus.length) return sinDato(card, 'Ningún SKU llega al mínimo de 5 casos en estas modalidades.');
        cuerpo = tabla(['SKU', ...valores.map(v => GRUPO[eje][v])], card.skus.slice(0, top).map(x => [x.sku, ...valores.map(v => celda(x.grupos[v]))]));
      }
      const falta = id === 'E' ? 'la venta por SKU y por modalidad, el costo de cumplimiento, las tarifas del marketplace y el margen' : 'la venta por SKU y por origen, el costo de envío propio, el costo de cumplimiento del marketplace y el margen';
      const cierre = id === 'E' ? 'no puedo decir qué SKU conviene vender como vendedor de Amazon o a través del marketplace' : 'no puedo decir desde dónde conviene enviar cada SKU, con medios propios o con el cumplimiento del marketplace';
      const notas = [card.salvedades.includes('walmartSoloBodega') ? 'Walmart no compra producto de la empresa: solo se vende a través de Walmart, así que para Walmart solo importa de qué bodega sale el pedido.' : null,
        'Un Retailer cuyo subcanal no se conoce queda como Sin dato; no se asigna a ninguna modalidad.', 'El único tiempo medible es el de despacho de reposiciones y etiquetas, no el tiempo de resolución del caso.', 'Cada cifra cuenta solo celdas visibles de al menos 5 casos: es un mínimo.',
        det ? 'El detalle por modalidad todavía no está instalado: reembolsos, garantías, defectos y despacho figuran como Sin dato.' : null].filter(Boolean);
      const ejesTxt = card.ejes.map(e => `${GRUPO[eje][e.valor]} ${n(e.casos)}`).join(', ');
      return {summary: `${id}. ${id === 'E' ? 'Modalidad de venta' : 'Modalidad de envío'}: hay ${f0.display} casos de Amazon y Walmart con subcanal visible en el Tracker (${ejesTxt}). Son casos atendidos con sesgo, no ventas: ${cierre}, porque faltan ${falta}.\n${cuerpo}\n${notas.join(' ')}\n${pie(card)}`,
        figures: [f0, ...figs], citations: [CITE]};
    }};
}
