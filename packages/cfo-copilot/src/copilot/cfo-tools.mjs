// Herramientas del Copiloto CFO (solo lectura). Cada una lee el informe CFO ya calculado de LA organización del principal
// (ctx.tenantId, derivado de la sesión) mediante ctx.data.report(tenantId). Ninguna acepta tenantId, SQL ni texto libre.
import {monthMetrics, GLOSSARY, reportRows} from '../cfo-model.mjs';
import {monthLabel} from '../format.mjs';
import {CopilotError} from './runtime.mjs';
import {sanitizeText} from './guards.mjs';
import {CCO_TOOLS} from './cco-tools.mjs';

const ROLES = ['owner', 'analyst'];
const CURRENCY = {type: 'enum', values: ['USD', 'CAD', 'MXN']};
const cite = (label, href) => ({label, href, kind: 'pantalla'});
const CITE = {
  resumen: cite('Panel CFO · Resumen del mes', '/cfo#resumen'), canales: cite('Panel CFO · Mezcla por canal', '/cfo#mezcla'), calidad: cite('Panel CFO · Calidad de datos', '/cfo#calidad'),
  proyeccion: cite('Panel CFO · Proyecciones (Estimado)', '/cfo#proyecciones'), alertas: cite('Panel CFO · Alertas', '/cfo#alertas'), exposicion: cite('Panel CFO · Exposición económica', '/cfo#exposicion'), glosario: cite('Panel CFO · Glosario', '/cfo#glosario'),
};

async function load(ctx) {
  if (!ctx.tenantId) throw new CopilotError('forbidden', 403);
  const result = await ctx.data.report(ctx.tenantId);
  if (!result || result.status !== 'ok') return {noData: true, summary: result?.status === 'timeout' ? 'No tengo el dato: la consulta del ledger superó el tiempo permitido. Reintenta en unos minutos.' : 'No tengo el dato: no hay asientos en el ledger de esta organización.', figures: [], citations: [CITE.calidad]};
  return result.report;
}
const lines = figs => figs.map(f => `${f.label}: ${f.display}` + (f.scope ? ` (${f.scope})` : '')).join('\n');
const flatMetrics = (report, currency, month) => {
  const list = currency ? [currency] : report.currencies;
  return list.flatMap(c => (monthMetrics(report, c, month)?.metrics ?? []));
};
const stripFig = f => ({id: f.id, label: f.label, display: f.display, kind: f.kind, coverage: f.coverage, scope: f.scope, how: f.how});

export const CFO_TOOLS = [
  {name: 'resumen_mes', label: 'Leyendo el resumen del mes', scope: 'tenant', roles: ROLES, description: 'Ingresos, pedidos, ticket promedio, reembolsos y tasa de reembolso de un mes (por defecto el último completo), por moneda.',
    input: {props: {currency: CURRENCY, month: {type: 'month'}}},
    async run(args, ctx) {
      const report = await load(ctx); if (report.noData) return report;
      const month = args.month ?? report.lastComplete;
      if (!month || !report.months.includes(month)) return {noData: true, summary: `No tengo el dato: no hay registros del mes ${month ?? 'solicitado'} en la ventana cargada.`, figures: [], citations: [CITE.resumen]};
      const figs = flatMetrics(report, args.currency, month);
      const note = report.partialMonths.includes(month) ? `\nAviso: ${monthLabel(month)} es un mes incompleto (datos hasta ${report.watermark?.slice(0, 10)}); no lo compares con meses completos.` : '';
      return {summary: `Resumen de ${monthLabel(month)} (Observado; USD, CAD y MXN no se suman):\n${lines(figs)}${note}`, figures: figs.map(stripFig), citations: [CITE.resumen]};
    }},
  {name: 'comparativa_mes', label: 'Comparando contra el mes anterior', scope: 'tenant', roles: ROLES, description: 'Variación mes contra mes del último mes completo (ingresos, pedidos, ticket, reembolsos, tasa) por moneda.',
    input: {props: {currency: CURRENCY}},
    async run(args, ctx) {
      const report = await load(ctx); if (report.noData) return report;
      const kpis = report.kpis.filter(k => !args.currency || k.currency === args.currency);
      const rows = kpis.flatMap(k => k.metrics.filter(m => m.delta).map(m => ({id: m.id + ':mom', label: `${m.label} · variación`, display: `${m.display} (${m.delta.display} contra ${m.delta.vs})`, kind: 'observed', scope: monthLabel(report.lastComplete), coverage: m.coverage, how: m.how})));
      if (!rows.length) return {noData: true, summary: 'No tengo el dato: se necesitan dos meses completos para comparar.', figures: [], citations: [CITE.resumen]};
      return {summary: `Comparativa de ${monthLabel(report.lastComplete)} contra ${monthLabel(report.prevComplete)} (solo meses completos):\n${lines(rows)}`, figures: rows.map(stripFig), citations: [CITE.resumen]};
    }},
  {name: 'mezcla_canal', label: 'Revisando la mezcla por canal', scope: 'tenant', roles: ROLES, description: 'Participación de cada canal (Amazon, Mirakl, Walmart, Shopify) en pedidos y, por moneda y base, en importes.',
    input: {props: {currency: CURRENCY}},
    async run(args, ctx) {
      const report = await load(ctx); if (report.noData) return report;
      const orders = report.mix.orders.map(o => ({id: 'mix:' + o.channel, label: `Pedidos · ${o.label}`, display: `${o.n} (${(o.shareBps / 100).toFixed(1)} %)`, kind: 'observed', scope: '12 meses', coverage: {label: ''}}));
      const groups = report.mix.byCurrency.filter(g => !args.currency || g.currency === args.currency);
      const amt = groups.flatMap(g => g.items.map(i => ({id: `mixamt:${g.currency}:${g.base}:${i.channel}`, label: `${g.currency} · ${i.label}`, display: `${i.display} (${(i.shareBps / 100).toFixed(1)} %)`, kind: 'observed', scope: g.baseLabel, coverage: {label: ''}})));
      return {summary: `Mezcla por canal (Observado, 12 meses). Pedidos:\n${lines(orders)}\n\nImportes por moneda y base (no se suman entre monedas ni bases):\n${lines(amt)}`, figures: [...orders, ...amt].map(stripFig), citations: [CITE.canales]};
    }},
  {name: 'calidad_datos', label: 'Midiendo la calidad de los datos', scope: 'tenant', roles: ROLES, description: 'Pedidos y reembolsos sin importe o sin moneda, duplicados a revisar y su estimación del importe no contabilizado.',
    input: {props: {}},
    async run(_args, ctx) {
      const report = await load(ctx); if (report.noData) return report;
      const q = report.quality, figs = [...Object.values(q.figs), ...q.unaccounted.flatMap(u => [u.orderFig, u.refundFig])];
      return {summary: `Calidad de datos:\n${lines(figs)}\nLas filas sin moneda se cuentan pero no se valoran.`, figures: figs.map(stripFig), citations: [CITE.calidad]};
    }},
  {name: 'exposicion_problemas', label: 'Revisando la exposición por problema', scope: 'tenant', roles: ROLES, description: 'Exposición económica por problema, solo con vínculos atestados por el propietario.',
    input: {props: {}},
    async run(_args, ctx) {
      const report = await load(ctx); if (report.noData) return report;
      const e = report.exposure;
      if (e.state === 'sin_atestar') return {noData: true, summary: 'Exposición económica: sin atestar. ' + e.message, figures: [], citations: [CITE.exposicion]};
      const figs = e.rows.map(stripFig);
      return {summary: `Exposición por problema (Inferido; no es pérdida y no es aditiva):\n${lines(figs)}\n${e.note}`, figures: figs, citations: [CITE.exposicion]};
    }},
  {name: 'proyeccion', label: 'Calculando la proyección (Estimado)', scope: 'tenant', roles: ROLES, description: 'Proyección Estimada a 3 meses de ingresos o pedidos por moneda, con su método.',
    input: {props: {currency: CURRENCY, metric: {type: 'enum', values: ['ingresos', 'pedidos']}}},
    async run(args, ctx) {
      const report = await load(ctx); if (report.noData) return report;
      const list = report.projections.filter(p => (!args.currency || p.currency === args.currency) && (!args.metric || p.metric === args.metric));
      if (!list.length) return {noData: true, summary: 'No tengo el dato: se necesitan al menos 4 meses completos para estimar una tendencia.', figures: [], citations: [CITE.proyeccion]};
      const figs = list.flatMap(p => p.points.map(pt => ({id: `${p.id}:${pt.month}`, label: p.label, display: `${pt.midDisplay} (rango ${pt.lowDisplay} a ${pt.highDisplay})`, kind: 'estimated', scope: monthLabel(pt.month), coverage: {label: ''}, how: p.method})));
      return {summary: `Proyección (ESTIMADO, no observado):\n${lines(figs)}\nMétodo: ${list[0].method}`, figures: figs.map(stripFig), citations: [CITE.proyeccion]};
    }},
  {name: 'alertas', label: 'Revisando las alertas', scope: 'tenant', roles: ROLES, description: 'Alertas activas: reembolsos anómalos, caída de pedidos, calidad de datos y cobertura.',
    input: {props: {severity: {type: 'enum', values: ['alta', 'media', 'baja', 'info']}}},
    async run(args, ctx) {
      const report = await load(ctx); if (report.noData) return report;
      const list = report.alerts.filter(a => !args.severity || a.severity === args.severity);
      if (!list.length) return {noData: true, summary: 'No hay alertas activas con ese filtro.', figures: [], citations: [CITE.alertas]};
      return {summary: 'Alertas:\n' + list.map(a => `[${a.severity}] ${a.title}: ${a.detail}`).join('\n'), figures: list.map(a => ({id: a.id, label: a.title, display: a.detail, kind: a.kind, scope: a.severity, coverage: {label: ''}, how: a.how})), citations: [CITE.alertas]};
    }},
  {name: 'explicar_cifra', label: 'Buscando cómo se calculó', scope: 'tenant', roles: ROLES, description: 'Explica cómo se calculó una cifra del panel o define un término del glosario.',
    input: {props: {id: {type: 'string', max: 120, pattern: /^[\w:.\-]+$/}, term: {type: 'string', max: 40}}},
    async run(args, ctx) {
      if (args.term) {
        const t = sanitizeText(args.term, 40).toLowerCase(), g = GLOSSARY.find(x => x.term.toLowerCase() === t || x.term.toLowerCase().includes(t));
        return g ? {summary: `${g.term}: ${g.body}`, figures: [], citations: [CITE.glosario]} : {noData: true, summary: 'No tengo ese término en el glosario.', figures: [], citations: [CITE.glosario]};
      }
      const report = await load(ctx); if (report.noData) return report;
      const row = reportRows(report).find(r => r.id === args.id);
      return row ? {summary: `${row.label}${row.scope ? ' (' + row.scope + ')' : ''}: ${row.value}. Cómo se calculó: ${row.how}`, figures: [{id: row.id, label: row.label, display: row.value, kind: row.kind, scope: row.scope, coverage: {label: row.coverage}}], citations: [CITE.glosario]} : {noData: true, summary: 'No encuentro esa cifra en el informe actual.', figures: [], citations: [CITE.glosario]};
    }},
  ...CCO_TOOLS,
];

export const CFO_SHORTCUTS = {
  suggestions: ['¿Cómo cerró el último mes por moneda?', '¿Qué canal pesa más en los pedidos?', '¿Cuántos reembolsos no traen importe?', '¿Hay alertas activas?', '¿Cuál es la proyección de ingresos?'],
  categories: [
    {title: 'Resultados', questions: ['¿Cómo cerró el último mes por moneda?', '¿Cómo vamos contra el mes anterior?', '¿Cuál es la proyección de ingresos?']},
    {title: 'Canales y calidad', questions: ['¿Qué canal pesa más en los pedidos?', '¿Cuántos reembolsos no traen importe?', '¿Cuánto cuesta la mala calidad de datos?']},
    {title: 'Riesgos', questions: ['¿Hay alertas activas?', '¿Qué problemas exponen más ingresos?']},
    {title: 'CCO', questions: ['¿Cómo rinde cada SKU en Amazon?', '¿Qué SKU llevan 3 meses sin venta?', '¿Cómo se comparan las modalidades de venta de Amazon y Walmart?', '¿Desde qué bodega sale cada SKU en Amazon y Walmart?']},
  ],
  direct: {
    '¿Cómo cerró el último mes por moneda?': {tool: 'resumen_mes', args: {}},
    '¿Cómo vamos contra el mes anterior?': {tool: 'comparativa_mes', args: {}},
    '¿Cuál es la proyección de ingresos?': {tool: 'proyeccion', args: {metric: 'ingresos'}},
    '¿Qué canal pesa más en los pedidos?': {tool: 'mezcla_canal', args: {}},
    '¿Cuántos reembolsos no traen importe?': {tool: 'calidad_datos', args: {}},
    '¿Cuánto cuesta la mala calidad de datos?': {tool: 'calidad_datos', args: {}},
    '¿Hay alertas activas?': {tool: 'alertas', args: {}},
    '¿Qué problemas exponen más ingresos?': {tool: 'exposicion_problemas', args: {}},
    '¿Cómo rinde cada SKU en Amazon?': {tool: 'cco_rendimiento_sku', args: {canal: 'amazon'}},
    '¿Qué SKU llevan 3 meses sin venta?': {tool: 'cco_sin_venta', args: {meses: '3'}},
    '¿Cómo se comparan las modalidades de venta de Amazon y Walmart?': {tool: 'cco_modalidad_venta', args: {}},
    '¿Desde qué bodega sale cada SKU en Amazon y Walmart?': {tool: 'cco_modalidad_envio', args: {vista: 'sku'}},
  },
};
