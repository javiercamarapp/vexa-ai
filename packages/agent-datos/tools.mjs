// Catálogo CERRADO de herramientas de consulta del agente. Todas son deterministas, de solo lectura y trabajan sobre agregados del
// servicio del espacio de trabajo a través de un «puerto de datos» ya atado a un tenant (ver port.mjs). Ninguna acepta tenant,
// rol, SQL ni identificadores de otras organizaciones. Cada resultado trae sus cifras con clase y cobertura, sus fuentes y el
// método de cálculo; las citas de clientes viajan por un canal aparte (`citations`) que NUNCA se envía al modelo.
import { formatMinorUnits } from '../metrics/money.mjs';
import { lineaDatosHasta } from '../workspace-service/datos-hasta.mjs';
import { estadoMes, estadosDeSerie, comparables, avisoMes as avisoMesBase, detalleMes, NO_COMPARABLE, NO_COMPARABLE_EN, mesPorDefecto as mesPorDefectoBase } from './meses.mjs';
import { CLASS_LABELS, classLabels, LIMITS, coverageOf, toJsonSchema, validateArgs } from './contract.mjs';
import { idiomaDe, localeAgente, par } from './idioma.mjs';
import { crearToolsCco } from './tools-cco.mjs';

/** Importe en unidades menores -> unidades mayores (solo para altura/eje de gráficas; el dinero mostrado sale de money()). */
const majorOf = (minor, exponent) => Number(BigInt(minor)) / 10 ** exponent;
const nf = new Intl.NumberFormat('es-MX');
/** Qué cuenta cada cifra: base, moneda, fuente y diferencias con otras pantallas (QA2-003). */
const ALCANCE_PEDIDOS = (cur) => `Pedidos y reembolsos: fuente libro económico, en ${cur}, filas vigentes en estado registrado de todas las bases (incluye Shopify bruto con impuestos y envío, y filas «a revisar»), por fecha efectiva. /cfo muestra una sola base (precio de línea de marketplace, sin filas «a revisar») y compara contra el mes completo anterior, por eso sus cifras pueden diferir.`;
const ALCANCE_CONV = 'Conversaciones: todas las fuentes cargadas (HubSpot y CSV histórico), fechadas por su inicio o, si falta, por su primer mensaje. El Explorador muestra otra cosa: las filas incorporadas por fuente (p. ej. solo HubSpot), no el total histórico.';
export const fmtInt = (n) => nf.format(n);
/** Si la parte clasificada de las conversaciones cambia mucho entre meses, una subida o caída puede ser avance del análisis y no un cambio real: se avisa (nunca se oculta). */
export function avisoCoberturaVariable(items, idioma = 'es') {
  const xs = (items ?? []).filter((i) => i && i.eligible > 0 && i.classified >= 0).map((i) => ({ month: i.month, p: i.classified / i.eligible }));
  if (xs.length < 2) return null;
  const hi = xs.reduce((a, b) => (b.p > a.p ? b : a)), lo = xs.reduce((a, b) => (b.p < a.p ? b : a));
  if (!(hi.p >= lo.p * 1.5 && hi.p - lo.p >= 0.05)) return null;
  const pc = (x) => (x < 0.01 ? '<1' : String(Math.round(x * 100))) + ' %';
  if (idioma === 'en') { const pe = (x) => (x < 0.01 ? '<1' : String(Math.round(x * 100))) + '%'; return `The share of conversations already classified changes a lot between months (${monthLabelEn(hi.month)}: ${pe(hi.p)}; ${monthLabelEn(lo.month)}: ${pe(lo.p)}): a rise or drop may reflect classification progress and not a real change.`; }
  return `La parte de las conversaciones ya clasificada cambia mucho entre meses (${monthLabel(hi.month)}: ${pc(hi.p)}; ${monthLabel(lo.month)}: ${pc(lo.p)}): una subida o caída puede reflejar el avance de la clasificación y no un cambio real.`;
}
export const monthLabel = (m) => new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(m + '-01T00:00:00Z'));
const monthLabelEn = (m) => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(m + '-01T00:00:00Z'));
const monthShort = (m) => new Intl.DateTimeFormat('es-MX', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(m + '-01T00:00:00Z')).replace('.', '');
const pct = (a, b) => (a === 0 ? null : ((b - a) * 100) / a);
const fmtPct = (p) => (p === null ? 'sin base' : (p >= 0 ? '+' : '') + p.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %');
const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmtInt(Math.abs(n));
export const normalize = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
export const tag = (f) => `(${CLASS_LABELS[f.class]} · cobertura ${f.coverage.eligible_n === null ? f.coverage.note : `${fmtInt(f.coverage.known_n)} de ${fmtInt(f.coverage.eligible_n)}`})`;
const money = (minor, currency, exponent) => (minor === null || minor === undefined ? 'No disponible' : formatMinorUnits(String(minor), currency, exponent));

const ALCANCE_PEDIDOS_EN = (cur) => `Orders and refunds: economic ledger source, in ${cur}, current rows in registered status from all bases (includes gross Shopify with taxes and shipping, and "to review" rows), by effective date. /cfo shows a single basis (marketplace line price, without "to review" rows) and compares against the full previous month, so its figures can differ.`;
const ALCANCE_CONV_EN = 'Conversations: all loaded sources (HubSpot and historical CSV), dated by their start or, if missing, by their first message. The Explorer shows something else: the rows incorporated per source (e.g. HubSpot only), not the historical total.';
const FUENTES_EN = { 'HubSpot (conversaciones, contactos)': 'HubSpot (conversations, contacts)', 'Asociaciones ticket–contacto (HubSpot)': 'Ticket–contact associations (HubSpot)', 'Archivos CSV (importaciones)': 'CSV files (imports)', 'Marketplaces y Shopify (libro de registros)': 'Marketplaces and Shopify (record ledger)', 'Adjuntos (archivos)': 'Attachments (files)', 'Archivo CSV': 'CSV file', 'Archivo Excel': 'Excel file' };
/** Ayudas ligadas al idioma del turno (`ctx.idioma`, 'es' por omisión). Cada herramienta las desestructura al inicio de `run`: así el texto, las cifras y los meses salen en el idioma de quien pregunta. */
export function ayudas(ctx) {
  const idioma = idiomaDe(ctx), en = idioma === 'en', locale = localeAgente(idioma), CL = classLabels(idioma);
  const L = (es, englishText) => (en ? englishText : es);
  const nfi = new Intl.NumberFormat(locale);
  const fmtInt = (n) => nfi.format(n);
  const monthLabel = (m) => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(m + '-01T00:00:00Z'));
  const monthShort = (m) => new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(m + '-01T00:00:00Z')).replace('.', '');
  const fmtPct = (p) => (p === null ? L('sin base', 'no base') : (p >= 0 ? '+' : '') + p.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + (en ? '%' : ' %'));
  const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmtInt(Math.abs(n));
  const nd = L('No disponible', 'Not available');
  const tag = (f) => `(${CL[f.class]} · ${L('cobertura', 'coverage')} ${f.coverage.eligible_n === null ? f.coverage.note : `${fmtInt(f.coverage.known_n)} ${L('de', 'of')} ${fmtInt(f.coverage.eligible_n)}`})`;
  const money = (minor, currency, exponent) => (minor === null || minor === undefined ? nd : formatMinorUnits(String(minor), currency, exponent, locale));
  return {
    idioma, locale, L, fmtInt, monthLabel, monthShort, fmtPct, signed, nd, tag, money, clase: (c) => CL[c], fuenteEtq: (label) => (en ? FUENTES_EN[label] ?? label : label),
    NO_COMPARABLE: en ? NO_COMPARABLE_EN : NO_COMPARABLE, ALCANCE_PEDIDOS: en ? ALCANCE_PEDIDOS_EN : ALCANCE_PEDIDOS, ALCANCE_CONV: en ? ALCANCE_CONV_EN : ALCANCE_CONV,
    avisoMes: (label, st) => avisoMesBase(label, st, idioma), mesPorDefecto: (c, ahora) => mesPorDefectoBase(c, ahora, idioma),
    lineaDatosHasta: (cortes) => lineaDatosHasta(cortes, idioma), avisoCoberturaVariable: (items) => avisoCoberturaVariable(items, idioma),
  };
}
const AYUDAS_NOMBRES = '{ idioma, locale, L, fmtInt, monthLabel, monthShort, fmtPct, signed, nd, tag, money, clase, fuenteEtq, NO_COMPARABLE, ALCANCE_PEDIDOS, ALCANCE_CONV, avisoMes, mesPorDefecto, lineaDatosHasta, avisoCoberturaVariable }';
/** Textos de la ficha de cada herramienta que ve la persona (etiqueta de paso, método y de dónde lee) en inglés. */
export const TOOL_EN = Object.freeze({
  cobertura_datos: { label: 'Checking which data is loaded', method: 'Reads coverage per source (imports + tables without an import) with bounded queries; it does not estimate the size of what was never loaded.', reads: ['registered imports', 'public.economic_ledger_entries', 'Tracker/attachments/associations tables (bounded counts)'] },
  estado_tracker: { label: 'Checking the Tracker', method: 'Counts current rows and closed sheets of the highest-ranked version; rejected rows are counted separately.', reads: ['Tracker tables (bounded counts)'] },
  estado_asociaciones: { label: 'Checking the ticket–contact associations', method: 'Counts association facts by status; with a 10% sample when the exact count does not fit (labeled Estimated).', reads: ['association facts (bounded counts)'] },
  tendencia_conversaciones: { label: 'Counting conversations per month', method: 'Counts conversations per month in a fixed window; if the exact count does not fit in time, it uses a scaled 10% sample and labels it Estimated.', reads: ['public.conversations', 'public.messages (date of the first message)'] },
  problemas_top: { label: 'Ranking problems by incidents', method: 'An incident is a conversation classified with that problem in the month. One conversation can count toward several problems, so rows are not added together.', reads: ['published problems', 'conversation–problem links (count per month)'] },
  exposicion_por_problema: { label: 'Calculating exposure per problem', method: 'Adds up the amounts of orders linked by evidence to each problem; if the amount of any order is missing, it shows the known subtotal and says so (never a zero).', reads: ['orders linked to conversations per problem (record ledger)'] },
  categorias_por_mes: { label: 'Comparing categories per month', method: 'Counts classified incidents per category in each month; the change compares the first and the last COMPLETE month of the window (an incomplete month is labeled and not compared).', reads: ['incidents classified by category and month'] },
  ledger_por_fuente: { label: 'Adding up the ledger by marketplace', method: 'Takes the latest revision of each record; "registered" orders and "settled" refunds by effective date; groups by source and currency. It does not convert or add currencies; amounts without a value are counted separately.', reads: ['public.economic_ledger_entries (latest revision per entity)'] },
  ledger_por_mes: { label: 'Reading the ledger month by month', method: 'Groups by month of the effective date in the currency with the most records; other currencies are mentioned without adding them.', reads: ['public.economic_ledger_entries (latest revision per entity)'] },
  comparar_meses: { label: 'Comparing the two months', method: 'Subtracts the base month from the compared month in each measure (records and incidents); the percentage uses the base month. It does not explain causes.', reads: ['monthly record trends', 'incidents per problem and month'] },
  evidencias_de_problema: { label: 'Looking up verifiable quotes', method: 'Returns literal quotes anchored to a message revision; each one links to its source record, row and file (provenance chain).', reads: ['classification evidence (quotes with message revision)', 'provenance chain'] },
  clientes_por_problema: { label: 'Counting affected customers', method: 'Counts distinct customers with an approved link to conversations of the problem; every statement about customers carries at least one verifiable quote.', reads: ['approved conversation–customer links', 'problem evidence'] },
  rendimiento_sku: { label: 'Checking performance by SKU', method: 'Adds lines and gross revenue per SKU only in the complete months of the common orders and returns window of the channel; returns without an amount stay unknown; defect cases come from the Tracker with a minimum of 5 per cell.', reads: ['public.insight_order_revenue_month', 'public.insight_refund_by_sku_month', 'public.economic_source_versions (windows)', 'tracker_row_heads (defect cases, k>=5)'] },
  candidatos_sin_venta: { label: 'Looking for SKUs with no recent sales', method: 'Takes the last month with sales of each SKU and compares it with the last complete month with ledger data; a SKU with no sales in these two channels may sell elsewhere.', reads: ['public.insight_order_revenue_month (last month with sales per SKU)'] },
  eficiencia_bodegas: { label: 'Checking dispatch by warehouse', method: 'Counts Tracker rows with a warehouse by time class until the tracking number came out; cells with fewer than 5 cases are hidden. It measures dispatch, not delivery, and there is no shipment denominator.', reads: ['tracker_row_heads (WH, SLA Status, Contact_reason; k>=5)'] },
  casos_por_estado: { label: 'Counting cases by state', method: 'Derives the state from the address of each Tracker case and counts cases; states with fewer than 5 cases are hidden and the address text is never stored or returned.', reads: ['tracker_row_revisions (address read in memory; the text is discarded)'] },
  casos_por_subcanal: { label: 'Counting cases by selling model', method: "Counts Tracker rows by the subchannel declared in their Retailer column and maps it through a closed table to who sells, which warehouse ships and which marketplace; whatever the table does not know stays as No data. Orders fulfilled by the marketplace barely reach the Tracker, so the comparison is biased.", reads: ['tracker_row_heads (Retailer, SKU, sheet, defect, WH, SLA Status; k>=5)'] },
  envio_propio_vs_amazon: { label: 'Counting cases by origin warehouse', method: "Counts Tracker rows by the subchannel declared in their Retailer column and maps it through a closed table to who sells, which warehouse ships and which marketplace; whatever the table does not know stays as No data. Orders fulfilled by the marketplace barely reach the Tracker, so the comparison is biased.", reads: ['tracker_row_heads (Retailer, SKU, sheet, defect, WH, SLA Status; k>=5)'] },
});
export const toolLabel = (tool, idioma) => (idioma === 'en' ? TOOL_EN[tool.name]?.label ?? tool.label : tool.label);

const fig = (tool, label, display, value, cls, coverage, extra = {}) => ({ id: tool, label, display, value, class: cls, coverage, ...extra });
const col = (key, label, kind = 'text') => ({ key, label, kind });
const unavailable = (tool, why = 'La consulta superó el tiempo permitido o el servicio no respondió; reintenta en un momento.') => ({ status: 'unavailable', summary: why, figures: [], blocks: [], missing: [], notes: [] });
const noData = (summary, missing) => ({ status: 'no_data', summary, figures: [], blocks: [], missing, notes: [] });

/** Texto del problema pedido -> problema del catálogo del tenant (nunca un id que venga del modelo sin comprobar). */
const STOP = new Set(['the', 'of', 'about', 'what', 'do', 'say', 'customers', 'customer', 'problem', 'problems', 'with', 'is', 'are', 'for', 'to', 'on', 'in', 'and', 'how', 'many', 'affected', 'by', 'de', 'del', 'la', 'el', 'los', 'las', 'que', 'con', 'por', 'sobre', 'para', 'una', 'un', 'en', 'al', 'y', 'o', 'problema', 'problemas', 'cliente', 'clientes', 'dicen', 'sin', 'se', 'su', 'sus', 'mi', 'mis']);
export async function resolveProblem(port, text) {
  const cat = await port.problems();
  const rows = cat.rows ?? [];
  const q = normalize(text).split(' ').filter((w) => w.length >= 3 && !STOP.has(w));
  if (!q.length || !rows.length) return { kind: 'none', rows };
  const scored = rows.map((p) => { const t = normalize(p.title); return { p, s: q.filter((w) => t.includes(w.slice(0, Math.max(4, w.length - 2)))).length }; }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  if (!scored.length) return { kind: 'none', rows };
  if (scored.length > 1 && scored[0].s === scored[1].s) return { kind: 'ambiguous', options: scored.filter((x) => x.s === scored[0].s).slice(0, 4).map((x) => x.p), rows };
  return { kind: 'one', problem: scored[0].p, rows };
}

const SRC = {
  coverage: { ref: 'agent:coverage', label: 'Cobertura de fuentes cargadas', href: '/imports' },
  trends: { ref: 'agent:trends', label: 'Tendencias mensuales de registros', href: '/overview' },
  ledger: { ref: 'agent:ledger', label: 'Libro de registros por fuente y moneda', href: '/economics' },
  problems: { ref: 'agent:problems', label: 'Problemas e incidencias vinculadas', href: '/problems' },
  exposure: { ref: 'agent:exposure', label: 'Exposición de ingresos por problema', href: '/problems' },
  evidence: { ref: 'agent:evidence', label: 'Citas verificables del problema', href: '/explorer' },
  tracker: { ref: 'agent:tracker', label: 'Tracker (Excel)', href: '/imports' },
  associations: { ref: 'agent:associations', label: 'Asociaciones ticket–contacto', href: '/history' },
  ccoLibro: { ref: 'agent:cco-libro', label: 'CCO: libro económico por SKU y canal', href: '/cco' },
  ccoTracker: { ref: 'agent:cco-tracker', label: 'CCO: casos del Tracker', href: '/cco' },
  ccoGeo: { ref: 'agent:cco-geo', label: 'CCO: casos por estado del Tracker', href: '/cco' },
};

const SRC_EN = { 'agent:coverage': 'Coverage of loaded sources', 'agent:trends': 'Monthly record trends', 'agent:ledger': 'Record ledger by source and currency', 'agent:problems': 'Problems and linked incidents', 'agent:exposure': 'Revenue exposure by problem', 'agent:evidence': 'Verifiable quotes of the problem', 'agent:tracker': 'Tracker (Excel)', 'agent:associations': 'Ticket–contact associations', 'agent:cco-libro': 'CCO: economic ledger by SKU and channel', 'agent:cco-tracker': 'CCO: Tracker cases', 'agent:cco-geo': 'CCO: Tracker cases by state' };
const fuenteDe = (src, idioma) => (idioma === 'en' && SRC_EN[src.ref] ? { ...src, label: SRC_EN[src.ref] } : src);

const MONTH_PROP = { type: 'string', format: 'month', description: 'Mes AAAA-MM.' };
const PROBLEM_PROP = { type: 'string', minLength: 3, maxLength: 120, description: 'Nombre del problema tal como aparece en la lista de problemas.' };

export const TOOLS = [
  {
    name: 'cobertura_datos', label: 'Revisando qué información está cargada', roles: 'all', parameters: { properties: {} },
    description: 'Qué fuentes de información están cargadas, cuánto se incorporó y qué falta cargar.',
    reads: ['importaciones registradas', 'public.economic_ledger_entries', 'tablas del Tracker/adjuntos/asociaciones (conteos acotados)'],
    method: 'Lee la cobertura por fuente (importaciones + tablas sin importación) con consultas acotadas; no estima el tamaño de lo que nunca se cargó.', source: SRC.coverage,
    async run({ port, ctx }) {
      const { idioma, locale, L, fmtInt, monthLabel, monthShort, fmtPct, signed, nd, tag, money, clase, fuenteEtq, NO_COMPARABLE, ALCANCE_PEDIDOS, ALCANCE_CONV, avisoMes, mesPorDefecto, lineaDatosHasta, avisoCoberturaVariable } = ayudas(ctx);
      const cv = await port.coverage(); const all = cv.sources ?? [];
      const loaded = all.filter((s) => s.loaded), missing = all.filter((s) => !s.loaded);
      if (!loaded.length) return noData(L('Todavía no hay información cargada en este espacio de trabajo.', `No data has been loaded in this workspace yet.`), missing.map((s) => s.label));
      const f = fig('cobertura_datos', L('Fuentes con datos cargados', `Sources with data loaded`), L(`${loaded.length} de ${all.length}`, `${loaded.length} of ${all.length}`), loaded.length, 'observed', coverageOf(loaded.length, all.length));
      const rows = all.map((s) => ({ fuente: s.label, estado: s.loaded ? L('Cargada', `Loaded`) : L('Sin cargar', `Not loaded`), incorporadas: s.loaded ? s.incorporated : null, rechazadas: s.loaded ? s.rejected : null, pendientes: s.loaded ? s.pending : null, clase: CLASS_LABELS[s.class] }));
      return {
        status: 'ok', figures: [f],
        blocks: [{ tool: 'cobertura_datos', title: L('Cobertura por fuente', `Coverage by source`), columns: [col('fuente', L('Fuente', `Source`)), col('estado', L('Estado', `Status`)), col('incorporadas', L('Incorporadas', `Incorporated`), 'integer'), col('rechazadas', L('Rechazadas', `Rejected`), 'integer'), col('pendientes', L('Pendientes', `Pending`), 'integer'), col('clase', L('Clase', `Class`))], rows, chart: { kind: 'donut', additive: true, unit: L('fuentes', `sources`), series: [{ key: 'cargadas', label: L('Cargadas', `Loaded`), value: loaded.length, display: fmtInt(loaded.length) }, { key: 'sin_cargar', label: L('Sin cargar', `Not loaded`), value: missing.length, display: fmtInt(missing.length) }].filter((x) => x.value > 0) }, class: 'mixed', coverage: f.coverage, truncated: false, note: L('Las fuentes marcadas «Estimado» vienen de una muestra rotulada.', `Sources marked "Estimated" come from a labeled sample.`) }],
        summary: L(`Hay datos de ${loaded.length} de ${all.length} fuentes ${tag(f)}. Cargadas: ${loaded.map((s) => s.label).join('; ')}.${missing.length ? ` Falta cargar: ${missing.map((s) => s.label).join('; ')}; su tamaño no se estima.` : ''}`, `There is data from ${loaded.length} of ${all.length} sources ${tag(f)}. Loaded: ${loaded.map((s) => fuenteEtq(s.label)).join('; ')}.${missing.length ? ` Still to load: ${missing.map((s) => fuenteEtq(s.label)).join('; ')}; their size is not estimated.` : ''}`),
        missing: missing.map((s) => s.label), notes: [],
      };
    },
  },
  {
    name: 'estado_tracker', label: 'Revisando el Tracker', roles: 'all', parameters: { properties: {} },
    description: 'Estado del Tracker (Excel): versión que manda, filas vigentes y hojas cerradas.',
    reads: ['tablas del Tracker (conteos acotados)'], method: 'Cuenta filas vigentes y hojas cerradas de la versión de mayor rango; las filas rechazadas se cuentan aparte.', source: SRC.tracker,
    async run({ port, ctx }) {
      const { idioma, locale, L, fmtInt, monthLabel, monthShort, fmtPct, signed, nd, tag, money, clase, fuenteEtq, NO_COMPARABLE, ALCANCE_PEDIDOS, ALCANCE_CONV, avisoMes, mesPorDefecto, lineaDatosHasta, avisoCoberturaVariable } = ayudas(ctx);
      const t = await port.tracker();
      if (t.status !== 'ok') return noData(L('No tengo datos del Tracker.', `I don't have Tracker data.`), [L('El archivo Excel del Tracker (Importaciones)', `The Tracker Excel file (Imports)`)]);
      const f1 = fig('estado_tracker', L('Filas vigentes', `Current rows`), fmtInt(t.rows), t.rows, t.class, coverageOf(t.rows, t.rows + t.rejected));
      const f2 = fig('estado_tracker', L('Hojas cerradas', `Closed sheets`), L(`${fmtInt(t.sheetsClosed)} de ${fmtInt(t.sheetsTotal)}`, `${fmtInt(t.sheetsClosed)} of ${fmtInt(t.sheetsTotal)}`), t.sheetsClosed, t.class, coverageOf(t.sheetsClosed, t.sheetsTotal));
      const f3 = fig('estado_tracker', L('Versiones cargadas', `Versions loaded`), fmtInt(t.versions), t.versions, t.class, coverageOf(t.versions, t.versions));
      return {
        status: 'ok', figures: [f1, f2, f3],
        blocks: [{ tool: 'estado_tracker', title: 'Tracker (Excel)', columns: [col('medida', L('Medida', `Measure`)), col('valor', L('Valor', `Value`))], rows: [{ medida: L('Versión que manda', `Leading version`), valor: `${t.version} · ${t.sha}` }, { medida: f1.label, valor: f1.display }, { medida: f2.label, valor: f2.display }, { medida: L('Filas rechazadas', `Rejected rows`), valor: fmtInt(t.rejected) }], class: t.class, coverage: f1.coverage, truncated: false }],
        summary: L(`La versión que manda es ${t.version} (${t.sha}), de ${fmtInt(t.versions)} cargadas. Tiene ${f1.display} filas vigentes ${tag(f1)} y ${f2.display} hojas cerradas ${tag(f2)}.`, `The leading version is ${t.version} (${t.sha}), out of ${fmtInt(t.versions)} loaded. It has ${f1.display} current rows ${tag(f1)} and ${f2.display} closed sheets ${tag(f2)}.`), missing: [], notes: [],
      };
    },
  },
  {
    name: 'estado_asociaciones', label: 'Revisando las asociaciones ticket–contacto', roles: 'all', parameters: { properties: {} },
    description: 'Cuántas asociaciones ticket–contacto están resueltas, pendientes o por revisar.',
    reads: ['hechos de asociación (conteos acotados)'], method: 'Cuenta hechos de asociación por estado; con muestra del 10 % cuando no cabe el conteo exacto (se rotula Estimado).', source: SRC.associations,
    async run({ port, ctx }) {
      const { idioma, locale, L, fmtInt, monthLabel, monthShort, fmtPct, signed, nd, tag, money, clase, fuenteEtq, NO_COMPARABLE, ALCANCE_PEDIDOS, ALCANCE_CONV, avisoMes, mesPorDefecto, lineaDatosHasta, avisoCoberturaVariable } = ayudas(ctx);
      const a = await port.associations();
      if (a.status !== 'ok') return noData(L('No tengo datos de asociaciones ticket–contacto.', `I don't have ticket–contact association data.`), [L('Las asociaciones ticket–contacto de HubSpot', `The HubSpot ticket–contact associations`)]);
      const c = (k) => coverageOf(k, a.total);
      const fs = [fig('estado_asociaciones', L('Hechos de asociación', `Association facts`), fmtInt(a.total), a.total, a.class, coverageOf(a.total, a.total)), fig('estado_asociaciones', L('Resueltos', `Resolved`), fmtInt(a.resolved), a.resolved, a.class, c(a.resolved)), fig('estado_asociaciones', L('Pendientes', `Pending`), fmtInt(a.pending), a.pending, a.class, c(a.pending)), fig('estado_asociaciones', L('Vínculos activos conversación–cliente', `Active conversation–customer links`), fmtInt(a.activeLinks), a.activeLinks, a.class, coverageOf(a.activeLinks, a.total))];
      return {
        status: 'ok', figures: fs,
        blocks: [{ tool: 'estado_asociaciones', title: L('Asociaciones ticket–contacto', `Ticket–contact associations`), columns: [col('estado', L('Estado', `Status`)), col('hechos', L('Hechos', `Facts`), 'integer')], rows: [{ estado: L('Resueltos', `Resolved`), hechos: a.resolved }, { estado: L('Pendientes', `Pending`), hechos: a.pending }, { estado: L('Por revisar', `To review`), hechos: a.review }, { estado: L('Retenidos', `Held`), hechos: a.held }], class: a.class, coverage: c(a.total), truncated: false, note: a.sampled ? L('Estimado con una muestra del 10 %.', `Estimated from a 10% sample.`) : undefined }],
        summary: L(`Hay ${fs[0].display} hechos de asociación: ${fs[1].display} resueltos y ${fs[2].display} pendientes ${tag(fs[1])}.`, `There are ${fs[0].display} association facts: ${fs[1].display} resolved and ${fs[2].display} pending ${tag(fs[1])}.`), missing: [], notes: a.sampled ? [L('Estimado con una muestra del 10 %.', `Estimated from a 10% sample.`)] : [],
      };
    },
  },
  {
    name: 'tendencia_conversaciones', label: 'Contando conversaciones por mes', roles: 'all', parameters: { properties: { months: { type: 'integer', minimum: 2, maximum: 12, default: 12 } } },
    description: 'Conversaciones cargadas por mes (fecha de inicio o de su primer mensaje).',
    reads: ['public.conversations', 'public.messages (fecha del primer mensaje)'], method: 'Cuenta conversaciones por mes en una ventana fija; si el conteo exacto no cabe en el tiempo, usa una muestra del 10 % escalada y la rotula Estimado.', source: SRC.trends,
    async run({ port, ctx }, { months }) {
      const { idioma, locale, L, fmtInt, monthLabel, monthShort, fmtPct, signed, nd, tag, money, clase, fuenteEtq, NO_COMPARABLE, ALCANCE_PEDIDOS, ALCANCE_CONV, avisoMes, mesPorDefecto, lineaDatosHasta, avisoCoberturaVariable } = ayudas(ctx);
      const t = await port.trends(); const c = t.conversations;
      const sampleNote = c?.sampleNote ? L(c.sampleNote, c.sampleNote.replace(/^Estimado con una muestra del (\d+) % de las conversaciones: fechar todas \(por su primer mensaje\) no cabe en el tiempo permitido\./, 'Estimated from a $1% sample of the conversations: dating all of them (by their first message) does not fit in the allowed time.')) : null;
      if (!c || c.status === 'timeout') return unavailable('tendencia_conversaciones', L('La consulta superó el tiempo permitido o el servicio no respondió; reintenta en un momento.', 'The query exceeded the allowed time or the service did not respond; try again in a moment.'));
      if (c.status === 'empty' || !c.series?.length) return noData(L('No hay conversaciones cargadas en la ventana.', `There are no conversations loaded in the window.`), [L('Conversaciones importadas (HubSpot o CSV)', `Imported conversations (HubSpot or CSV)`)]);
      const ahora = new Date(ctx.now ?? Date.now());
      const est = estadosDeSerie(c.series, c.completeness, ahora);
      const s = c.series.slice(-months).map((x) => { const st = est.get(x.month); return { ...x, st: st.estado === 'parcial' && Number(x.count) === 0 ? { ...st, estado: 'sin_datos' } : st }; }); // un mes parcial con 0 es dato ausente, no cero
      const dato = s.filter((x) => x.st.estado !== 'sin_datos'), sum = dato.reduce((a, x) => a + x.count, 0), last = dato[dato.length - 1];
      if (!last) return noData(L('No hay conversaciones con datos en la ventana.', `There are no conversations with data in the window.`), [L('Conversaciones importadas (HubSpot o CSV)', `Imported conversations (HubSpot or CSV)`)]);
      const avisos = s.map((x) => avisoMes(monthLabel(x.month), x.st)).filter(Boolean);
      const cov = coverageOf(sum, (c.total ?? sum) + (c.undated ?? 0));
      const lastParcial = last.st.estado === 'parcial', lastDisplay = !lastParcial ? fmtInt(last.count) : last.count > 0 ? `${fmtInt(last.count)} (mes incompleto)` : L('sin datos completos', `no complete data`);
      const f = fig('tendencia_conversaciones', L(`Conversaciones en ${monthLabel(last.month)}${lastParcial ? L(' (mes incompleto)', ` (incomplete month)`) : ''}`, `Conversations in ${monthLabel(last.month)}${lastParcial ? ' (incomplete month)' : ''}`), lastDisplay, lastParcial ? null : last.count, c.class, cov);
      const f2 = fig('tendencia_conversaciones', L(`Conversaciones en ${dato.length} meses`, `Conversations in ${dato.length} months`), fmtInt(sum), sum, c.class, cov);
      const cell = (x) => (x.st.estado === 'sin_datos' ? L('No disponible', `Not available`) : x.st.estado === 'parcial' ? `${fmtInt(x.count)}*` : x.count);
      const note = [sampleNote, L(`${ALCANCE_CONV} Ventana: ${s.length} meses; ${fmtInt(sum)} con fecha de ${fmtInt((c.total ?? sum) + (c.undated ?? 0))} conversaciones cargadas.`, `${ALCANCE_CONV} Window: ${s.length} months; ${fmtInt(sum)} dated out of ${fmtInt((c.total ?? sum) + (c.undated ?? 0))} conversations loaded.`), avisos.length ? L(`* ${avisos.join('. ')}. Un mes incompleto no se compara con otro ni se lee como caída.`, `* ${avisos.join('. ')}. An incomplete month is not compared with another and is not read as a drop.`) : null].filter(Boolean).join(' ') || undefined;
      return {
        status: 'ok', figures: [f, f2],
        blocks: [{ tool: 'tendencia_conversaciones', title: L('Conversaciones por mes', `Conversations per month`), columns: [col('mes', L('Mes', `Month`)), col('conversaciones', L('Conversaciones', `Conversations`), 'integer')], rows: s.map((x) => ({ mes: monthLabel(x.month), conversaciones: cell(x) })), chart: { kind: s.length >= 3 ? 'line' : 'bar', unit: L('conversaciones', `conversations`), series: s.map((x) => ({ key: x.month, label: monthShort(x.month) + (x.st.estado === 'parcial' ? '*' : ''), value: x.st.estado === 'sin_datos' ? null : x.count, display: x.st.estado === 'sin_datos' ? L('No disponible', `Not available`) : fmtInt(x.count) + (x.st.estado === 'parcial' ? L(' (mes incompleto)', ` (incomplete month)`) : ''), ...(x.st.estado === 'parcial' ? { partial: true } : {}) })) }, class: c.class, coverage: cov, truncated: false, note }],
        summary: L(`${lastParcial ? `${monthLabel(last.month)}: ${lastDisplay} (${NO_COMPARABLE}: ${avisoMes(monthLabel(last.month), last.st).replace(/^[^(]*\(/, '').replace(/\)$/, '')})` : `En ${monthLabel(last.month)} hubo ${f.display} conversaciones`}; ${f2.display} conversaciones en los últimos ${dato.length} meses con datos ${tag(f2)}.${c.sampled ? ' La cifra es una estimación a partir de una muestra del 10 %.' : ''}${s.some((x) => x.st.estado === 'sin_datos') ? ` Los meses posteriores al corte no tienen datos cargados (no son cero).` : ''}`, `${lastParcial ? `${monthLabel(last.month)}: ${lastDisplay} (${NO_COMPARABLE}: ${avisoMes(monthLabel(last.month), last.st).replace(/^[^(]*\(/, '').replace(/\)$/, '')})` : `In ${monthLabel(last.month)} there were ${f.display} conversations`}; ${f2.display} conversations in the last ${dato.length} months with data ${tag(f2)}.${c.sampled ? ' The figure is an estimate from a 10% sample.' : ''}${s.some((x) => x.st.estado === 'sin_datos') ? ` The months after the cutoff have no data loaded (they are not zero).` : ''}`), missing: [], notes: [...(sampleNote ? [sampleNote] : []), ...avisos, lineaDatosHasta({ conversaciones: c.completeness?.dataThrough })].filter(Boolean),
      };
    },
  },
  {
    name: 'problemas_top', label: 'Ordenando los problemas por incidencias', roles: 'all', parameters: { properties: { month: MONTH_PROP, limit: { type: 'integer', minimum: 1, maximum: 10, default: 5 } } },
    description: 'Los problemas con más incidencias en un mes (por defecto, el mes en curso).',
    reads: ['problemas publicados', 'vínculos conversación–problema (conteo por mes)'], method: 'Una incidencia es una conversación clasificada con ese problema en el mes. Una conversación puede aportar a varios problemas, por eso las filas no se suman.', source: SRC.problems,
    async run({ port, ctx }, { month, limit }) {
      const { idioma, locale, L, fmtInt, monthLabel, monthShort, fmtPct, signed, nd, tag, money, clase, fuenteEtq, NO_COMPARABLE, ALCANCE_PEDIDOS, ALCANCE_CONV, avisoMes, mesPorDefecto, lineaDatosHasta, avisoCoberturaVariable } = ayudas(ctx);
      // «Este mes» (sin mes o el mes calendario en curso): se resuelve al último mes completo con datos y se dice (A4).
      let m = month ?? ctx.month, aviso = null;
      if (!month || month === ctx.month) {
        const completeness = await port.trends().then((t) => t?.conversations?.completeness ?? null).catch(() => null);
        const d = mesPorDefecto(completeness, new Date(ctx.now ?? Date.now()));
        if (d.resuelto) { m = d.month; aviso = d.nota; }
      }
      const r = await port.problemIncidents({ month: m });
      if (r.status !== 'ok' || !r.rows?.length) return noData(L(`${aviso ? aviso + '. ' : ''}No tengo incidencias clasificadas para ${monthLabel(m)}.`, `${aviso ? aviso + '. ' : ''}I don't have classified incidents for ${monthLabel(m)}.`), [L('La clasificación de las conversaciones del mes', `The classification of the month conversations`)]);
      const rows = [...r.rows].sort((a, b) => b.incidents - a.incidents || a.title.localeCompare(b.title, 'es')).slice(0, limit);
      const cov = coverageOf(r.classified, r.eligible);
      const fs = rows.map((p, i) => fig('problemas_top', p.title, fmtInt(p.incidents), p.incidents, 'inferred', cov, { rank: i + 1 }));
      return {
        status: 'ok', figures: fs,
        blocks: [{ tool: 'problemas_top', title: L(`Problemas con más incidencias · ${monthLabel(m)}`, `Problems with the most incidents · ${monthLabel(m)}`), columns: [col('problema', L('Problema', `Problem`)), col('incidencias', L('Incidencias', `Incidents`), 'integer'), ...(rows.some((p) => p.customers != null) ? [col('clientes', L('Clientes', `Customers`), 'integer')] : [])], rows: rows.map((p) => ({ problema: p.title, incidencias: p.incidents, ...(rows.some((q) => q.customers != null) ? { clientes: p.customers ?? null } : {}) })), chart: { kind: 'bar', unit: L('incidencias', `incidents`), series: rows.map((p) => ({ key: p.problemId, label: p.title, value: p.incidents, display: fmtInt(p.incidents) })) }, class: 'inferred', coverage: cov, truncated: r.rows.length > rows.length, note: L('Inferido: cada incidencia es una conversación vinculada al problema por su evidencia; las filas no se suman entre sí.', `Inferred: each incident is a conversation linked to the problem by its evidence; rows are not added together.`) }],
        summary: L(`${aviso ? aviso + '. ' : ''}En ${monthLabel(m)}, los ${rows.length} problemas con más incidencias son: ${rows.map((p, i) => `${i + 1}. ${p.title} (${fmtInt(p.incidents)})`).join('; ')} ${tag(fs[0])}.`, `${aviso ? aviso + '. ' : ''}In ${monthLabel(m)}, the ${rows.length} problems with the most incidents are: ${rows.map((p, i) => `${i + 1}. ${p.title} (${fmtInt(p.incidents)})`).join('; ')} ${tag(fs[0])}.`), missing: [], notes: aviso ? [aviso] : [],
      };
    },
  },
  {
    name: 'exposicion_por_problema', label: 'Calculando la exposición por problema', roles: 'all', parameters: { properties: { limit: { type: 'integer', minimum: 1, maximum: 10, default: 6 } } },
    description: 'Ingresos expuestos (pedidos vinculados) por problema, con su cobertura. No es pérdida y no se suma entre problemas.',
    reads: ['pedidos vinculados a conversaciones por problema (libro de registros)'], method: 'Suma los importes de los pedidos vinculados por evidencia a cada problema; si falta el importe de algún pedido, muestra el subtotal conocido y lo dice (nunca un cero).', source: SRC.exposure,
    async run({ port, ctx }, { limit }) {
      const { idioma, locale, L, fmtInt, monthLabel, monthShort, fmtPct, signed, nd, tag, money, clase, fuenteEtq, NO_COMPARABLE, ALCANCE_PEDIDOS, ALCANCE_CONV, avisoMes, mesPorDefecto, lineaDatosHasta, avisoCoberturaVariable } = ayudas(ctx);
      const r = await port.exposure({ limit });
      if (r.status !== 'ok' || !r.rows?.length) return noData(L('No tengo ingresos vinculados a problemas.', `I don't have revenue linked to problems.`), [L('Pedidos cargados y vinculados a conversaciones', `Orders loaded and linked to conversations`)]);
      const rows = r.rows.map((x) => ({ problema: x.title, expuesto: x.amountMinor !== null ? money(x.amountMinor, r.currency, r.exponent) : x.knownSubtotalMinor ? L(`Parcial · subtotal conocido ${money(x.knownSubtotalMinor, r.currency, r.exponent)}`, `Partial · known subtotal ${money(x.knownSubtotalMinor, r.currency, r.exponent)}`) : L('No disponible', `Not available`), cobertura: L(`${fmtInt(x.known_n)} de ${fmtInt(x.eligible_n)}`, `${fmtInt(x.known_n)} of ${fmtInt(x.eligible_n)}`) }));
      const cov = coverageOf(r.coverage.known_n, r.coverage.eligible_n);
      const fs = r.rows.map((x, i) => fig('exposicion_por_problema', x.title, rows[i].expuesto, x.amountMinor, 'inferred', coverageOf(x.known_n, x.eligible_n), { currency: r.currency }));
      const full = r.rows.filter((x) => x.amountMinor !== null);
      return {
        status: 'ok', figures: fs,
        blocks: [{ tool: 'exposicion_por_problema', title: L(`Ingresos expuestos por problema (${r.currency})`, `Revenue exposed per problem (${r.currency})`), columns: [col('problema', L('Problema', `Problem`)), col('expuesto', L('Expuesto', `Exposed`)), col('cobertura', L('Pedidos con importe', `Orders with an amount`))], rows, class: 'inferred', coverage: cov, truncated: false, note: L('Inferido: pedidos vinculados por evidencia. No equivale a pérdida ni se suma entre problemas.', `Inferred: orders linked by evidence. It is not a loss and is not added across problems.`) }],
        summary: L(`${full.length ? `Mayor exposición con importe completo: ${full[0].title}, ${money(full[0].amountMinor, r.currency, r.exponent)} ${tag(fs[r.rows.indexOf(full[0])])}. ` : ''}${r.rows.length - full.length} de ${r.rows.length} problemas no tienen todos los importes (se muestra el subtotal conocido, no el total). La exposición no es pérdida y no se suma entre problemas.`, `${full.length ? `Largest exposure with a complete amount: ${full[0].title}, ${money(full[0].amountMinor, r.currency, r.exponent)} ${tag(fs[r.rows.indexOf(full[0])])}. ` : ''}${r.rows.length - full.length} of ${r.rows.length} problems do not have all the amounts (the known subtotal is shown, not the total). Exposure is not loss and is not added across problems.`), missing: r.rows.some((x) => x.amountMinor === null) ? [L('El importe de los pedidos que no lo tienen', `The amount of the orders that do not have one`)] : [], notes: [],
      };
    },
  },
  {
    name: 'categorias_por_mes', label: 'Comparando categorías por mes', roles: 'all', parameters: { properties: { months: { type: 'integer', minimum: 2, maximum: 12, default: 6 } } },
    description: 'Frecuencia de incidencias por categoría y por mes (últimos N meses).',
    reads: ['incidencias clasificadas por categoría y mes'], method: 'Cuenta incidencias clasificadas por categoría en cada mes; el cambio compara el primer y el último mes COMPLETO de la ventana (un mes incompleto se rotula y no se compara).', source: SRC.problems,
    async run({ port, ctx }, { months }) {
      const { idioma, locale, L, fmtInt, monthLabel, monthShort, fmtPct, signed, nd, tag, money, clase, fuenteEtq, NO_COMPARABLE, ALCANCE_PEDIDOS, ALCANCE_CONV, avisoMes, mesPorDefecto, lineaDatosHasta, avisoCoberturaVariable } = ayudas(ctx);
      const r = await port.categoryMonthly({ months });
      if (r.status !== 'ok' || !r.rows?.length) return noData(L('No tengo incidencias clasificadas por categoría.', `I don't have incidents classified by category.`), [L('La clasificación de las conversaciones', `The classification of the conversations`)]);
      // Las incidencias salen de conversaciones: heredan la completitud de las conversaciones (mismo corte).
      const completeness = await port.trends().then((t) => t?.conversations?.completeness ?? null).catch(() => null), ahora = new Date(ctx.now ?? Date.now());
      const st = Object.fromEntries(r.months.map((m) => [m, estadoMes(m, completeness, ahora)]));
      const cats = [...new Set(r.rows.map((x) => x.category))];
      const done = r.months.filter((m) => st[m].estado === 'completo'), first = done[0], last = done[done.length - 1];
      const get = (c, m) => r.rows.find((x) => x.category === c && x.month === m)?.count ?? 0;
      const cov = coverageOf(r.classified, r.eligible);
      const avisos = r.months.map((m) => avisoMes(monthLabel(m), st[m])).filter(Boolean), cobAviso = avisoCoberturaVariable(r.perMonth);
      const cell = (c, m) => (st[m].estado === 'sin_datos' ? L('No disponible', `Not available`) : st[m].estado === 'parcial' ? `${get(c, m)}*` : get(c, m));
      const comparable = done.length >= 2;
      const cambioDe = (c) => (comparable ? `${signed(get(c, last) - get(c, first))} (${fmtPct(pct(get(c, first), get(c, last)))})` : NO_COMPARABLE);
      const table = cats.map((c) => ({ categoria: c.charAt(0).toUpperCase() + c.slice(1), ...Object.fromEntries(r.months.map((m) => [m, cell(c, m)])), cambio: cambioDe(c) }));
      const nota = [L('Inferido: incidencias vinculadas por evidencia a cada categoría.', `Inferred: incidents linked by evidence to each category.`), cobAviso, avisos.length ? L(`* ${avisos.join('. ')}. El cambio compara solo meses completos${comparable ? ` (${monthLabel(first)} a ${monthLabel(last)})` : ''}; un mes incompleto no se compara.`, `* ${avisos.join('. ')}. The change compares complete months only${comparable ? ` (${monthLabel(first)} to ${monthLabel(last)})` : ''}; an incomplete month is not compared.`) : null].filter(Boolean).join(' ');
      const colLabel = (m) => monthShort(m) + (st[m].estado === 'parcial' ? L(' (parcial)', ` (partial)`) : st[m].estado === 'sin_datos' ? L(' (sin datos)', ` (no data)`) : '');
      const title = L(`Incidencias por categoría · ${monthShort(r.months[0])} a ${monthShort(r.months[r.months.length - 1])}`, `Incidents per category · ${monthShort(r.months[0])} to ${monthShort(r.months[r.months.length - 1])}`);
      const columns = [col('categoria', L('Categoría', `Category`)), ...r.months.map((m) => col(m, colLabel(m), 'integer')), col('cambio', L('Cambio', `Change`))];
      if (!comparable) {
        const f0 = fig('categorias_por_mes', L('Cambio por categoría', `Change per category`), NO_COMPARABLE, null, 'inferred', cov);
        return { status: 'ok', figures: [f0], blocks: [{ tool: 'categorias_por_mes', title, columns, rows: table, class: 'inferred', coverage: cov, truncated: false, note: nota }], summary: L(`No hay dos meses completos en la ventana para comparar categorías: ${NO_COMPARABLE} ${tag(f0)}. ${avisos.join('. ')}.${cobAviso ? ' ' + cobAviso : ''}`, `There are not two complete months in the window to compare categories: ${NO_COMPARABLE} ${tag(f0)}. ${avisos.join('. ')}.${cobAviso ? ' ' + cobAviso : ''}`), missing: [], notes: [...avisos, cobAviso].filter(Boolean) };
      }
      const ranked = cats.map((c) => ({ c, d: get(c, last) - get(c, first), p: pct(get(c, first), get(c, last)) })).sort((x, y) => y.d - x.d);
      const f = fig('categorias_por_mes', L(`Cambio de «${ranked[0].c}»`, `Change of "${ranked[0].c}"`), `${signed(ranked[0].d)} (${fmtPct(ranked[0].p)})`, ranked[0].d, 'inferred', cov);
      return {
        status: 'ok', figures: [f],
        blocks: [{ tool: 'categorias_por_mes', title, columns, rows: table, class: 'inferred', coverage: cov, truncated: false, note: nota }],
        summary: L(`Entre ${monthLabel(first)} y ${monthLabel(last)} (meses completos), la categoría que más creció es «${ranked[0].c}»: ${f.display} ${tag(f)}. La que menos: «${ranked[ranked.length - 1].c}» (${signed(ranked[ranked.length - 1].d)}).${avisos.length ? ' ' + avisos.join('. ') + '.' : ''}${cobAviso ? ' ' + cobAviso : ''}`, `Between ${monthLabel(first)} and ${monthLabel(last)} (complete months), the category that grew the most is "${ranked[0].c}": ${f.display} ${tag(f)}. The one that grew the least: "${ranked[ranked.length - 1].c}" (${signed(ranked[ranked.length - 1].d)}).${avisos.length ? ' ' + avisos.join('. ') + '.' : ''}${cobAviso ? ' ' + cobAviso : ''}`), missing: [], notes: [...avisos, cobAviso].filter(Boolean),
      };
    },
  },
  {
    name: 'ledger_por_fuente', label: 'Sumando el libro por marketplace', roles: 'all',
    parameters: { properties: { kind: { type: 'string', enum: ['refund', 'order'], default: 'refund' }, month: MONTH_PROP, months: { type: 'integer', minimum: 1, maximum: 12, default: 12 }, fuente: { type: 'string', maxLength: 60, description: 'Nombre de la fuente o marketplace (opcional).' } } },
    description: 'Pedidos registrados o reembolsos liquidados por fuente (marketplace/Shopify) y por moneda. Las monedas nunca se suman.',
    reads: ['public.economic_ledger_entries (última revisión por entidad)'], method: 'Toma la última revisión de cada registro; pedidos «registrados» y reembolsos «liquidados» por fecha efectiva; agrupa por fuente y moneda. No convierte ni suma monedas; los importes sin monto se cuentan aparte.', source: SRC.ledger,
    async run({ port, ctx }, { kind, month, months, fuente }) {
      const { idioma, locale, L, fmtInt, monthLabel, monthShort, fmtPct, signed, nd, tag, money, clase, fuenteEtq, NO_COMPARABLE, ALCANCE_PEDIDOS, ALCANCE_CONV, avisoMes, mesPorDefecto, lineaDatosHasta, avisoCoberturaVariable } = ayudas(ctx);
      const r = await port.ledgerBySource({ kind, month, months });
      const todos = kind === 'refund' && r.basis === 'all_statuses';
      const noun = kind === 'refund' ? (todos ? L('reembolsos registrados en el libro (todos los estados)', `refunds recorded in the ledger (all statuses)`) : L('reembolsos liquidados', `settled refunds`)) : L('pedidos registrados', `registered orders`);
      const etiqueta = kind === 'refund' ? (todos ? L('Reembolsos registrados (todos los estados)', `Refunds recorded (all statuses)`) : L('Reembolsos liquidados', `Settled refunds`)) : L('Pedidos registrados', `Registered orders`);
      const span = month ? monthLabel(month) : L(`los últimos ${months} meses`, `the last ${months} months`);
      let rows = r.rows ?? [];
      if (fuente) {
        const q = normalize(fuente); const hit = rows.filter((x) => normalize(x.sourceLabel).includes(q) || normalize(x.source).includes(q));
        if (!hit.length) {
          const cv = await port.coverage(); const src = (cv.sources ?? []).find((s) => normalize(s.label).includes(q) || normalize(s.key).includes(q));
          const label = src?.label ?? fuente;
          return noData(L(`No tengo ${noun} de «${label}». ${src && !src.loaded ? `${label} no está cargado.` : 'No hay registros de esa fuente en el periodo.'}`, `I don't have ${noun} from "${label}". ${src && !src.loaded ? `${label} is not loaded.` : 'There are no records from that source in the period.'}`), [L(`${label} (aún no cargado)`, `${label} (not loaded yet)`)]);
        }
        rows = hit;
      }
      if (r.status !== 'ok' || !rows.length) return noData(L(`No tengo ${noun} en ${span}.`, `I don't have ${noun} in ${span}.`), [L('Pedidos y reembolsos de los marketplaces (libro de registros)', `Marketplace orders and refunds (record ledger)`)]);
      const nCur = (c) => rows.filter((x) => x.currency === c).length;
      rows = [...rows].sort((a, b) => nCur(b.currency) - nCur(a.currency) || a.currency.localeCompare(b.currency) || Number(BigInt(b.amountMinor) - BigInt(a.amountMinor)));
      const known = rows.reduce((a, x) => a + (x.count - x.unknown), 0), all = rows.reduce((a, x) => a + x.count, 0), cov = coverageOf(known, all);
      const fs = rows.map((x) => fig('ledger_por_fuente', `${x.sourceLabel} · ${x.currency}`, money(x.amountMinor, x.currency, x.exponent), x.amountMinor, 'observed', coverageOf(x.count - x.unknown, x.count), { currency: x.currency }));
      const currencies = [...new Set(rows.map((x) => x.currency))];
      const bar = rows.filter((x) => x.currency === currencies[0]);
      return {
        status: 'ok', figures: fs,
        blocks: [{ tool: 'ledger_por_fuente', title: L(`${etiqueta} por fuente · ${span}`, `${etiqueta} by source · ${span}`), columns: [col('fuente', L('Fuente', `Source`)), col('moneda', L('Moneda', `Currency`)), col('registros', L('Registros', `Records`), 'integer'), col('importe', todos ? L('Importe bruto', `Gross amount`) : L('Importe', `Amount`)), ...(todos ? [col('liquidado', L('De ellos, liquidado', `Of which, settled`)), col('cancelado', L('De ellos, cancelado', `Of which, canceled`))] : []), col('sinImporte', L('Sin importe', `No amount`), 'integer')], rows: rows.map((x) => ({ fuente: x.sourceLabel, moneda: x.currency, registros: x.count, importe: money(x.amountMinor, x.currency, x.exponent), ...(todos ? { liquidado: money(x.settledAmountMinor ?? '0', x.currency, x.exponent), cancelado: money(x.cancelledAmountMinor ?? '0', x.currency, x.exponent) } : {}), sinImporte: x.unknown })), chart: { kind: 'bar', unit: L(`importe en ${currencies[0]}`, `amount in ${currencies[0]}`), series: bar.map((x) => ({ key: x.source, label: x.sourceLabel, value: majorOf(x.amountMinor, x.exponent), display: money(x.amountMinor, x.currency, x.exponent) })) }, class: 'observed', coverage: cov, truncated: false, note: [todos ? L('Importe bruto de todos los reembolsos registrados (incluye pendientes y cancelados); «liquidado» es solo el de estado liquidado. Los de estado desconocido o sin importe cuentan en «Registros» pero no en el importe.', `Gross amount of all recorded refunds (includes pending and canceled); "settled" is only the one in settled status. Those with unknown status or no amount count in "Records" but not in the amount.`) : null, r.note ?? null, currencies.length > 1 ? L(`Las monedas (${currencies.join(', ')}) no se suman entre sí ni se convierten.`, `The currencies (${currencies.join(', ')}) are not added to each other or converted.`) : null].filter(Boolean).join(' ') || undefined }],
        summary: L(`${etiqueta} por fuente en ${span}: ${rows.map((x, i) => `${x.sourceLabel} ${fs[i].display}`).join('; ')} ${tag(fs[0])}.${currencies.length > 1 ? ' Las monedas no se suman entre sí.' : ''}`, `${etiqueta} by source in ${span}: ${rows.map((x, i) => `${x.sourceLabel} ${fs[i].display}`).join('; ')} ${tag(fs[0])}.${currencies.length > 1 ? ' Currencies are not added to each other.' : ''}`),
        missing: rows.some((x) => x.unknown > 0) ? [L('El monto de los registros sin importe', `The amount of the records without an amount`)] : [], notes: [...(currencies.length > 1 ? [L('Las monedas no se convierten ni se suman.', `Currencies are not converted or added.`)] : []), ...(r.note ? [r.note] : [])],
      };
    },
  },
  {
    name: 'ledger_por_mes', label: 'Leyendo el libro mes a mes', roles: 'all', parameters: { properties: { kind: { type: 'string', enum: ['refund', 'order'], default: 'refund' }, months: { type: 'integer', minimum: 2, maximum: 12, default: 12 } } },
    description: 'Evolución mensual de reembolsos liquidados o pedidos registrados (moneda principal; las demás se listan aparte).',
    reads: ['public.economic_ledger_entries (última revisión por entidad)'], method: 'Agrupa por mes de la fecha efectiva en la moneda con más registros; otras monedas se mencionan sin sumarlas.', source: SRC.trends,
    async run({ port, ctx }, { kind, months }) {
      const { idioma, locale, L, fmtInt, monthLabel, monthShort, fmtPct, signed, nd, tag, money, clase, fuenteEtq, NO_COMPARABLE, ALCANCE_PEDIDOS, ALCANCE_CONV, avisoMes, mesPorDefecto, lineaDatosHasta, avisoCoberturaVariable } = ayudas(ctx);
      const t = await port.trends(); const l = t.ledger;
      if (!l || l.status === 'timeout') return unavailable('ledger_por_mes', L('La consulta superó el tiempo permitido o el servicio no respondió; reintenta en un momento.', 'The query exceeded the allowed time or the service did not respond; try again in a moment.'));
      if (l.status === 'empty') return noData(L('No hay pedidos ni reembolsos cargados.', `There are no orders or refunds loaded.`), [L('Pedidos y reembolsos (libro de registros)', `Orders and refunds (record ledger)`)]);
      const key = kind === 'refund' ? 'refunds' : 'orders'; const s = l.series.slice(-months);
      const n = s.reduce((a, x) => a + x[key].count, 0), unk = s.reduce((a, x) => a + x[key].unknownAmounts, 0), total = s.reduce((a, x) => a + BigInt(x[key].amountMinor), 0n);
      const cov = coverageOf(n - unk, n); const last = s[s.length - 1];
      const f = fig('ledger_por_mes', L(`${kind === 'refund' ? 'Reembolsos' : 'Pedidos'} en ${s.length} meses`, `${kind === 'refund' ? 'Refunds' : 'Orders'} in ${s.length} months`), money(total, l.currency, l.exponent), String(total), 'observed', cov, { currency: l.currency });
      const f2 = fig('ledger_por_mes', L(`${kind === 'refund' ? 'Reembolsos' : 'Pedidos'} en ${monthLabel(last.month)}`, `${kind === 'refund' ? 'Refunds' : 'Orders'} in ${monthLabel(last.month)}`), money(last[key].amountMinor, l.currency, l.exponent), last[key].amountMinor, 'observed', coverageOf(last[key].count - last[key].unknownAmounts, last[key].count), { currency: l.currency });
      return {
        status: 'ok', figures: [f, f2],
        blocks: [{ tool: 'ledger_por_mes', title: L(`${kind === 'refund' ? 'Reembolsos liquidados' : 'Pedidos registrados'} por mes (${l.currency})`, `${kind === 'refund' ? 'Settled refunds' : 'Registered orders'} per month (${l.currency})`), columns: [col('mes', L('Mes', `Month`)), col('registros', L('Registros', `Records`), 'integer'), col('importe', L('Importe', `Amount`))], rows: s.map((x) => ({ mes: monthLabel(x.month), registros: x[key].count, importe: money(x[key].amountMinor, l.currency, l.exponent) })), chart: { kind: 'bar', unit: L(`importe en ${l.currency}`, `amount in ${l.currency}`), series: s.map((x) => ({ key: x.month, label: monthShort(x.month), value: majorOf(x[key].amountMinor, l.exponent), display: money(x[key].amountMinor, l.currency, l.exponent) })) }, class: 'observed', coverage: cov, truncated: false, note: [ALCANCE_PEDIDOS(l.currency), l.otherCurrencies?.length ? L(`Hay registros en otras monedas (${l.otherCurrencies.join(', ')}); no se suman a esta serie.`, `There are records in other currencies (${l.otherCurrencies.join(', ')}); they are not added to this series.`) : null].filter(Boolean).join(' ') }],
        summary: L(`${kind === 'refund' ? 'Los reembolsos liquidados' : 'Los pedidos registrados'} suman ${f.display} en ${s.length} meses ${tag(f)}; en ${monthLabel(last.month)}, ${f2.display}.${l.otherCurrencies?.length ? ` Hay otras monedas (${l.otherCurrencies.join(', ')}) que no se suman.` : ''}`, `${kind === 'refund' ? 'Settled refunds' : 'Registered orders'} add up to ${f.display} in ${s.length} months ${tag(f)}; in ${monthLabel(last.month)}, ${f2.display}.${l.otherCurrencies?.length ? ` There are other currencies (${l.otherCurrencies.join(', ')}) that are not added.` : ''}`), missing: [], notes: [],
      };
    },
  },
  {
    name: 'comparar_meses', label: 'Comparando los dos meses', roles: 'all', parameters: { properties: { a: { ...MONTH_PROP, description: 'Mes base AAAA-MM.' }, b: { ...MONTH_PROP, description: 'Mes a comparar AAAA-MM.' } }, required: ['a', 'b'] },
    description: 'Qué cambió entre dos meses: conversaciones, pedidos, reembolsos y problemas.',
    reads: ['tendencias mensuales de registros', 'incidencias por problema y mes'], method: 'Resta el mes base al mes comparado en cada medida (registros e incidencias); el porcentaje usa el mes base. No explica causas.', source: SRC.trends,
    async run({ port, ctx }, { a, b }) {
      const { idioma, locale, L, fmtInt, monthLabel, monthShort, fmtPct, signed, nd, tag, money, clase, fuenteEtq, NO_COMPARABLE, ALCANCE_PEDIDOS, ALCANCE_CONV, avisoMes, mesPorDefecto, lineaDatosHasta, avisoCoberturaVariable } = ayudas(ctx);
      const t = await port.trends(); const win = (t.conversations?.series ?? []).map((x) => x.month);
      if (!win.includes(a) || !win.includes(b)) return noData(L(`Solo tengo datos de ${win.length ? `${monthLabel(win[0])} a ${monthLabel(win[win.length - 1])}` : 'ningún mes'}; no puedo comparar ${monthLabel(a)} con ${monthLabel(b)}.`, `I only have data from ${win.length ? `${monthLabel(win[0])} to ${monthLabel(win[win.length - 1])}` : 'no month'}; I can't compare ${monthLabel(a)} with ${monthLabel(b)}.`), [L('Los meses que faltan', `The missing months`)]);
      const conv = (m) => t.conversations.series.find((x) => x.month === m).count, led = (m, k) => t.ledger.series.find((x) => x.month === m)?.[k];
      const covC = coverageOf(conv(a) + conv(b), (t.conversations.total ?? 0) + (t.conversations.undated ?? 0) || conv(a) + conv(b));
      // Un mes incompleto (corte a mitad de mes) o sin datos NO se compara: ni variación %, ni «0» presentado como dato. Misma regla que el Resumen y /cfo.
      const ahora = new Date(ctx.now ?? Date.now());
      const estC = estadosDeSerie(t.conversations.series, t.conversations.completeness, ahora);
      const sc = { a: estC.get(a), b: estC.get(b) };
      const sl = { a: estadoMes(a, t.ledger?.completeness, ahora), b: estadoMes(b, t.ledger?.completeness, ahora) };
      const avisos = [...new Set([[a, sc.a], [b, sc.b]].map(([m, st]) => avisoMes(monthLabel(m), st)).concat([[a, sl.a], [b, sl.b]].map(([m, st]) => avisoMes(monthLabel(m) + L(' (pedidos y reembolsos)', ' (orders and refunds)'), st))).filter(Boolean))];
      const rows = [], figs = [];
      const shown = (st, v, fmt) => (st.estado === 'sin_datos' ? L('No disponible', `Not available`) : fmt(v) + (st.estado === 'parcial' ? '*' : ''));
      const add = (label, cls, va, vb, cov, sta, stb, fmt = fmtInt) => {
        const ok = comparables(sta, stb), d = vb - va;
        const cambio = ok ? `${signed(d)} (${fmtPct(pct(va, vb))})` : NO_COMPARABLE;
        rows.push({ medida: label, [a]: shown(sta, va, fmt), [b]: shown(stb, vb, fmt), cambio, clase: CLASS_LABELS[cls] });
        figs.push(fig('comparar_meses', label, cambio, ok ? d : null, cls, cov));
      };
      add(L('Conversaciones (todas las fuentes, con fecha)', `Conversations (all sources, dated)`), t.conversations.class, conv(a), conv(b), covC, sc.a, sc.b);
      if (t.ledger?.series?.length) { for (const [k, name] of [['orders', L(`Pedidos registrados (${t.ledger.currency}, todas las bases)`, `Registered orders (${t.ledger.currency}, all bases)`)], ['refunds', L(`Reembolsos liquidados (${t.ledger.currency}, todas las bases)`, `Settled refunds (${t.ledger.currency}, all bases)`)]]) add(name, 'observed', led(a, k).count, led(b, k).count, coverageOf(led(a, k).count + led(b, k).count - led(a, k).unknownAmounts - led(b, k).unknownAmounts, led(a, k).count + led(b, k).count), sl.a, sl.b); }
      const pa = await port.problemIncidents({ month: a }), pb = await port.problemIncidents({ month: b });
      const cobAviso = pa.status === 'ok' && pb.status === 'ok' ? avisoCoberturaVariable([{ month: a, classified: pa.classified, eligible: pa.eligible }, { month: b, classified: pb.classified, eligible: pb.eligible }]) : null;
      const nota = [L('Solo describe el cambio; no explica sus causas.', `It only describes the change; it does not explain its causes.`), cobAviso, L(`Compara los meses que elegiste: ${monthLabel(a)} frente a ${monthLabel(b)}.`, `Compares the months you chose: ${monthLabel(a)} against ${monthLabel(b)}.`), ALCANCE_CONV, t.ledger?.series?.length ? ALCANCE_PEDIDOS(t.ledger.currency) : null, avisos.length ? L(`* ${avisos.join('. ')}. Una variación solo se calcula entre dos meses completos.`, `* ${avisos.join('. ')}. A change is only calculated between two complete months.`) : null].filter(Boolean).join(' ');
      const blocks = [{ tool: 'comparar_meses', title: L(`Registros · ${monthLabel(a)} frente a ${monthLabel(b)}`, `Records · ${monthLabel(a)} against ${monthLabel(b)}`), columns: [col('medida', L('Medida', `Measure`)), col(a, monthShort(a), 'integer'), col(b, monthShort(b), 'integer'), col('cambio', L('Cambio', `Change`)), col('clase', L('Clase', `Class`))], rows, class: 'mixed', coverage: covC, truncated: false, note: nota }];
      let probText = '';
      if (pa.status === 'ok' && pb.status === 'ok') {
        const covP = coverageOf(pb.classified, pb.eligible), okP = comparables(sc.a, sc.b);
        const diff = pb.rows.map((p) => { const x = pa.rows.find((r) => r.problemId === p.problemId)?.incidents ?? 0; return { title: p.title, a: x, b: p.incidents, d: p.incidents - x }; }).sort((p, q) => q.d - p.d).slice(0, 5);
        const cambioP = (x) => (okP ? `${signed(x.d)} (${fmtPct(pct(x.a, x.b))})` : NO_COMPARABLE);
        const pf = diff.map((x) => fig('comparar_meses', x.title, cambioP(x), okP ? x.d : null, 'inferred', covP));
        figs.push(...pf);
        blocks.push({ tool: 'comparar_meses', title: L('Problemas que más cambiaron (incidencias)', `Problems that changed the most (incidents)`), columns: [col('problema', L('Problema', `Problem`)), col(a, monthShort(a), 'integer'), col(b, monthShort(b), 'integer'), col('cambio', L('Cambio', `Change`))], rows: diff.map((x) => ({ problema: x.title, [a]: shown(sc.a, x.a, fmtInt), [b]: shown(sc.b, x.b, fmtInt), cambio: cambioP(x) })), class: 'inferred', coverage: covP, truncated: false, note: okP ? L('Inferido: incidencias vinculadas por evidencia.', `Inferred: incidents linked by evidence.`) : L(`Inferido: incidencias vinculadas por evidencia. ${NO_COMPARABLE}: no se ordena por crecimiento.`, `Inferred: incidents linked by evidence. ${NO_COMPARABLE}: not ranked by growth.`) });
        if (okP) probText = L(` El problema que más creció es «${diff[0].title}»: de ${fmtInt(diff[0].a)} a ${fmtInt(diff[0].b)} incidencias, ${pf[0].display} ${tag(pf[0])}.`, ` The problem that grew the most is "${diff[0].title}": from ${fmtInt(diff[0].a)} to ${fmtInt(diff[0].b)} incidents, ${pf[0].display} ${tag(pf[0])}.`);
      }
      const todoOk = comparables(sc.a, sc.b) && comparables(sl.a, sl.b);
      const c0 = figs[0];
      const resumen = todoOk
        ? L(`Entre ${monthLabel(a)} y ${monthLabel(b)}, las conversaciones cambiaron ${c0.display} ${tag(c0)}${figs[2] ? `; los reembolsos liquidados, ${figs[2].display} ${tag(figs[2])}` : ''}.${probText}`, `Between ${monthLabel(a)} and ${monthLabel(b)}, conversations changed ${c0.display} ${tag(c0)}${figs[2] ? `; settled refunds, ${figs[2].display} ${tag(figs[2])}` : ''}.${probText}`)
        : L(`Entre ${monthLabel(a)} y ${monthLabel(b)} no hay variación que reportar: ${NO_COMPARABLE}. ${avisos.join('. ')}. ${comparables(sc.a, sc.b) ? `Las conversaciones cambiaron ${c0.display} ${tag(c0)}. ` : ''}Un mes incompleto no se lee como caída ni como alza; los valores con * son parciales.${probText}`, `Between ${monthLabel(a)} and ${monthLabel(b)} there is no change to report: ${NO_COMPARABLE}. ${avisos.join('. ')}. ${comparables(sc.a, sc.b) ? `Conversations changed ${c0.display} ${tag(c0)}. ` : ''}An incomplete month is not read as a drop or a rise; values marked * are partial.${probText}`);
      const resumenFinal = cobAviso ? `${resumen} ${cobAviso}` : resumen;
      return { status: 'ok', figures: figs, blocks, summary: resumenFinal, missing: pa.status === 'ok' ? [] : [L('La clasificación de las conversaciones de esos meses', `The classification of the conversations of those months`)], notes: [...avisos, cobAviso, lineaDatosHasta({ libro: t.ledger?.completeness?.dataThrough, conversaciones: t.conversations.completeness?.dataThrough })].filter(Boolean) };
    },
  },
  {
    name: 'evidencias_de_problema', label: 'Buscando citas verificables', roles: ['analyst', 'owner'], parameters: { properties: { problema: PROBLEM_PROP, limit: { type: 'integer', minimum: 1, maximum: LIMITS.maxCitations, default: 3 } }, required: ['problema'] },
    description: 'Citas de clientes que respaldan un problema. El texto de las citas se muestra al usuario pero nunca se envía al modelo.',
    reads: ['evidencias de la clasificación (citas con revisión de mensaje)', 'cadena de origen (provenance)'], method: 'Devuelve citas literales ancladas a una revisión de mensaje; cada una enlaza a su registro de fuente, fila y archivo (cadena de origen).', source: SRC.evidence, restricted: true,
    async run({ port, ctx }, { problema, limit }) {
      const { idioma, locale, L, fmtInt, monthLabel, monthShort, fmtPct, signed, nd, tag, money, clase, fuenteEtq, NO_COMPARABLE, ALCANCE_PEDIDOS, ALCANCE_CONV, avisoMes, mesPorDefecto, lineaDatosHasta, avisoCoberturaVariable } = ayudas(ctx);
      const res = await resolveProblem(port, problema);
      if (res.kind === 'none') return noData(L(`No encontré un problema llamado «${problema}».`, `I did not find a problem called "${problema}".`), [L('La lista de problemas', `The list of problems`)]);
      if (res.kind === 'ambiguous') return { status: 'clarify', summary: L(`¿A cuál problema te refieres? ${res.options.map((o) => `«${o.title}»`).join(', ')}.`, `Which problem do you mean? ${res.options.map((o) => `"${o.title}"`).join(', ')}.`), figures: [], blocks: [], missing: [], notes: [], options: res.options.map((o) => o.title) };
      const p = res.problem; const ev = await port.evidence({ problemId: p.problemId, limit });
      if (ev.status !== 'ok' || !ev.citations?.length) return noData(L(`No tengo citas verificables de «${p.title}».`, `I don't have verifiable quotes for "${p.title}".`), [L('La extracción con evidencia para este problema', `The evidence extraction for this problem`)]);
      const cov = coverageOf(ev.citations.length, ev.total);
      const f = fig('evidencias_de_problema', L(`Citas verificables de «${p.title}»`, `Verifiable quotes for "${p.title}"`), L(`${ev.citations.length} de ${fmtInt(ev.total)}`, `${ev.citations.length} of ${fmtInt(ev.total)}`), ev.citations.length, 'observed', cov);
      return {
        status: 'ok', figures: [f], blocks: [], citations: ev.citations.map((c) => ({ messageRevisionId: c.messageRevisionId, quote: String(c.quote).slice(0, 600), role: c.role, source: c.source, category: c.category })),
        summary: L(`Muestro ${f.display} citas verificables de «${p.title}» ${tag(f)}. Cada cita enlaza a su origen (registro, fila y archivo).`, `I show ${f.display} verifiable quotes for "${p.title}" ${tag(f)}. Each quote links to its origin (record, row and file).`), missing: [], notes: [], problem: { title: p.title },
        modelView: { problem: p.title, citationsShown: ev.citations.length, citationsTotal: ev.total },
      };
    },
  },
  {
    name: 'clientes_por_problema', label: 'Contando clientes afectados', roles: ['analyst', 'owner'], parameters: { properties: { problema: PROBLEM_PROP, month: MONTH_PROP }, required: ['problema'] },
    description: 'Cuántos clientes distintos se vinculan a un problema, con citas de respaldo.',
    reads: ['vínculos conversación–cliente aprobados', 'evidencias del problema'], method: 'Cuenta clientes distintos con vínculo aprobado a conversaciones del problema; toda afirmación sobre clientes lleva al menos una cita verificable.', source: SRC.evidence, restricted: true,
    async run({ port, ctx }, { problema, month }) {
      const { idioma, locale, L, fmtInt, monthLabel, monthShort, fmtPct, signed, nd, tag, money, clase, fuenteEtq, NO_COMPARABLE, ALCANCE_PEDIDOS, ALCANCE_CONV, avisoMes, mesPorDefecto, lineaDatosHasta, avisoCoberturaVariable } = ayudas(ctx);
      const res = await resolveProblem(port, problema);
      if (res.kind === 'none') return noData(L(`No encontré un problema llamado «${problema}».`, `I did not find a problem called "${problema}".`), [L('La lista de problemas', `The list of problems`)]);
      if (res.kind === 'ambiguous') return { status: 'clarify', summary: L(`¿A cuál problema te refieres? ${res.options.map((o) => `«${o.title}»`).join(', ')}.`, `Which problem do you mean? ${res.options.map((o) => `"${o.title}"`).join(', ')}.`), figures: [], blocks: [], missing: [], notes: [], options: res.options.map((o) => o.title) };
      const p = res.problem, m = month ?? ctx.month; const r = await port.problemCustomers({ problemId: p.problemId, month: m });
      if (r.status !== 'ok') return noData(L(`No tengo clientes vinculados a «${p.title}» en ${monthLabel(m)}.`, `I don't have customers linked to "${p.title}" in ${monthLabel(m)}.`), [L('Los vínculos conversación–cliente aprobados', `The approved conversation–customer links`)]);
      const ev = await port.evidence({ problemId: p.problemId, limit: 2 });
      if (ev.status !== 'ok' || !ev.citations?.length) return noData(L(`Hay clientes vinculados a «${p.title}», pero sin una cita verificable no puedo afirmarlo.`, `There are customers linked to "${p.title}", but without a verifiable quote I can't state it.`), [L('La extracción con evidencia', `The evidence extraction`)]);
      const cov = coverageOf(r.customers, r.incidents);
      const f = fig('clientes_por_problema', L(`Clientes con «${p.title}»`, `Customers with "${p.title}"`), fmtInt(r.customers), r.customers, 'inferred', cov);
      return {
        status: 'ok', figures: [f], blocks: [], citations: ev.citations.map((c) => ({ messageRevisionId: c.messageRevisionId, quote: String(c.quote).slice(0, 600), role: c.role, source: c.source, category: c.category })),
        summary: L(`En ${monthLabel(m)}, ${f.display} clientes distintos se vinculan a «${p.title}» ${tag(f)}. Abajo, las citas que lo respaldan.`, `In ${monthLabel(m)}, ${f.display} distinct customers are linked to "${p.title}" ${tag(f)}. Below, the quotes that support it.`), missing: [], notes: [], problem: { title: p.title },
        modelView: { problem: p.title, customers: r.customers, month: m },
      };
    },
  },
];

// Seis herramientas del CCO (A a F): catálogo cerrado, solo analista y propietario.
TOOLS.push(...crearToolsCco({ fig, col, noData, unavailable, coverageOf, SRC, ayudas }));

export const TOOL_INDEX = Object.freeze(Object.fromEntries(TOOLS.map((t) => [t.name, t])));
export const toolAllowed = (tool, role) => tool.roles === 'all' ? ['viewer', 'operator', 'analyst', 'owner'].includes(role) : tool.roles.includes(role);
export const toolsForRole = (role) => TOOLS.filter((t) => toolAllowed(t, role));

/** Catálogo que ve el modelo: nombre, descripción y JSON Schema. Nada de datos del tenant. */
export function catalogForModel(role) {
  return toolsForRole(role).map((t) => ({ name: t.name, description: t.description, parameters: toJsonSchema(t.parameters) }));
}

/** Ejecuta UNA herramienta con todas las barreras: catálogo cerrado, rol, esquema estricto y tiempo máximo. */
export async function executeTool({ name, args, port, ctx: rawCtx, timeoutMs = LIMITS.toolTimeoutMs }) {
  const ctx = { ...rawCtx, month: rawCtx.month ?? new Date(rawCtx.now ?? Date.now()).toISOString().slice(0, 7) };
  const idioma = idiomaDe(ctx), L = par(idioma);
  const tool = Object.hasOwn(TOOL_INDEX, name) ? TOOL_INDEX[name] : null;
  const base = { tool: name, args: {}, label: tool ? toolLabel(tool, idioma) : name };
  const vacio = { figures: [], blocks: [], citations: [], sources: [], missing: [], notes: [] };
  if (!tool) return { ...base, status: 'invalid_input', summary: L('Herramienta fuera del catálogo.', 'Tool outside the catalog.'), ...vacio };
  if (!toolAllowed(tool, ctx.role)) return { ...base, status: 'forbidden', summary: L('Tu rol no tiene acceso a esta consulta.', 'Your role does not have access to this query.'), ...vacio };
  const v = validateArgs(tool.parameters, args);
  if (!v.ok) return { ...base, status: 'invalid_input', summary: L(`Argumentos no válidos: ${v.error}.`, 'Invalid arguments.'), ...vacio };
  const started = Date.now(); let timer;
  try {
    const out = await Promise.race([tool.run({ port, ctx }, v.args), new Promise((_, rej) => { timer = setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'timeout' })), timeoutMs); })]);
    const result = { tool: tool.name, label: base.label, args: v.args, citations: [], ...out, sources: out.status === 'ok' || out.status === 'no_data' ? [{ ...fuenteDe(tool.source, idioma), tool: tool.name }] : [] };
    result.figures = (result.figures ?? []).map((f, i) => ({ ...f, id: `${tool.name}.${i + 1}` }));
    result.method = idioma === 'en' ? TOOL_EN[tool.name]?.method ?? tool.method : tool.method; result.reads = idioma === 'en' ? TOOL_EN[tool.name]?.reads ?? tool.reads : tool.reads; result.durationMs = Date.now() - started;
    return result;
  } catch (e) {
    return { ...base, args: v.args, status: 'unavailable', summary: L('La consulta no pudo completarse a tiempo; reintenta.', 'The query could not be completed in time; try again.'), ...vacio, error: e?.code === 'timeout' ? 'timeout' : 'error', durationMs: Date.now() - started };
  } finally { clearTimeout(timer); }
}

/** Lo ÚNICO que ve el modelo de un resultado: cifras ya formateadas y notas. Sin citas, sin texto de clientes, sin ids. */
export function modelViewOf(result, idioma = 'es') {
  return {
    tool: result.tool, status: result.status, args: result.args, summary: result.summary,
    figures: (result.figures ?? []).map((f) => ({ label: f.label, display: f.display, class: classLabels(idioma)[f.class], coverage: f.coverage })),
    missing: result.missing ?? [], notes: result.notes ?? [], ...(result.modelView ? { facts: result.modelView } : {}),
  };
}
