// Catálogo CERRADO de herramientas de consulta del agente. Todas son deterministas, de solo lectura y trabajan sobre agregados del
// servicio del espacio de trabajo a través de un «puerto de datos» ya atado a un tenant (ver port.mjs). Ninguna acepta tenant,
// rol, SQL ni identificadores de otras organizaciones. Cada resultado trae sus cifras con clase y cobertura, sus fuentes y el
// método de cálculo; las citas de clientes viajan por un canal aparte (`citations`) que NUNCA se envía al modelo.
import { formatMinorUnits } from '../metrics/money.mjs';
import { estadoMes, comparables, avisoMes, detalleMes, NO_COMPARABLE } from './meses.mjs';
import { CLASS_LABELS, LIMITS, coverageOf, toJsonSchema, validateArgs } from './contract.mjs';

/** Importe en unidades menores -> unidades mayores (solo para altura/eje de gráficas; el dinero mostrado sale de money()). */
const majorOf = (minor, exponent) => Number(BigInt(minor)) / 10 ** exponent;
const nf = new Intl.NumberFormat('es-MX');
export const fmtInt = (n) => nf.format(n);
export const monthLabel = (m) => new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(m + '-01T00:00:00Z'));
const monthShort = (m) => new Intl.DateTimeFormat('es-MX', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(m + '-01T00:00:00Z')).replace('.', '');
const pct = (a, b) => (a === 0 ? null : ((b - a) * 100) / a);
const fmtPct = (p) => (p === null ? 'sin base' : (p >= 0 ? '+' : '') + p.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %');
const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmtInt(Math.abs(n));
export const normalize = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
export const tag = (f) => `(${CLASS_LABELS[f.class]} · cobertura ${f.coverage.eligible_n === null ? f.coverage.note : `${fmtInt(f.coverage.known_n)} de ${fmtInt(f.coverage.eligible_n)}`})`;
const money = (minor, currency, exponent) => (minor === null || minor === undefined ? 'No disponible' : formatMinorUnits(String(minor), currency, exponent));

const fig = (tool, label, display, value, cls, coverage, extra = {}) => ({ id: tool, label, display, value, class: cls, coverage, ...extra });
const col = (key, label, kind = 'text') => ({ key, label, kind });
const unavailable = (tool, why = 'La consulta superó el tiempo permitido o el servicio no respondió; reintenta en un momento.') => ({ status: 'unavailable', summary: why, figures: [], blocks: [], missing: [], notes: [] });
const noData = (summary, missing) => ({ status: 'no_data', summary, figures: [], blocks: [], missing, notes: [] });

/** Texto del problema pedido -> problema del catálogo del tenant (nunca un id que venga del modelo sin comprobar). */
const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'que', 'con', 'por', 'sobre', 'para', 'una', 'un', 'en', 'al', 'y', 'o', 'problema', 'problemas', 'cliente', 'clientes', 'dicen', 'sin', 'se', 'su', 'sus', 'mi', 'mis']);
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
};

const MONTH_PROP = { type: 'string', format: 'month', description: 'Mes AAAA-MM.' };
const PROBLEM_PROP = { type: 'string', minLength: 3, maxLength: 120, description: 'Nombre del problema tal como aparece en la lista de problemas.' };

export const TOOLS = [
  {
    name: 'cobertura_datos', label: 'Revisando qué información está cargada', roles: 'all', parameters: { properties: {} },
    description: 'Qué fuentes de información están cargadas, cuánto se incorporó y qué falta cargar.',
    reads: ['importaciones registradas', 'public.economic_ledger_entries', 'tablas del Tracker/adjuntos/asociaciones (conteos acotados)'],
    method: 'Lee la cobertura por fuente (importaciones + tablas sin importación) con consultas acotadas; no estima el tamaño de lo que nunca se cargó.', source: SRC.coverage,
    async run({ port }) {
      const cv = await port.coverage(); const all = cv.sources ?? [];
      const loaded = all.filter((s) => s.loaded), missing = all.filter((s) => !s.loaded);
      if (!loaded.length) return noData('Todavía no hay información cargada en este espacio de trabajo.', missing.map((s) => s.label));
      const f = fig('cobertura_datos', 'Fuentes con datos cargados', `${loaded.length} de ${all.length}`, loaded.length, 'observed', coverageOf(loaded.length, all.length));
      const rows = all.map((s) => ({ fuente: s.label, estado: s.loaded ? 'Cargada' : 'Sin cargar', incorporadas: s.loaded ? s.incorporated : null, rechazadas: s.loaded ? s.rejected : null, pendientes: s.loaded ? s.pending : null, clase: CLASS_LABELS[s.class] }));
      return {
        status: 'ok', figures: [f],
        blocks: [{ tool: 'cobertura_datos', title: 'Cobertura por fuente', columns: [col('fuente', 'Fuente'), col('estado', 'Estado'), col('incorporadas', 'Incorporadas', 'integer'), col('rechazadas', 'Rechazadas', 'integer'), col('pendientes', 'Pendientes', 'integer'), col('clase', 'Clase')], rows, chart: { kind: 'donut', additive: true, unit: 'fuentes', series: [{ key: 'cargadas', label: 'Cargadas', value: loaded.length, display: fmtInt(loaded.length) }, { key: 'sin_cargar', label: 'Sin cargar', value: missing.length, display: fmtInt(missing.length) }].filter((x) => x.value > 0) }, class: 'mixed', coverage: f.coverage, truncated: false, note: 'Las fuentes marcadas «Estimado» vienen de una muestra rotulada.' }],
        summary: `Hay datos de ${loaded.length} de ${all.length} fuentes ${tag(f)}. Cargadas: ${loaded.map((s) => s.label).join('; ')}.${missing.length ? ` Falta cargar: ${missing.map((s) => s.label).join('; ')}; su tamaño no se estima.` : ''}`,
        missing: missing.map((s) => s.label), notes: [],
      };
    },
  },
  {
    name: 'estado_tracker', label: 'Revisando el Tracker', roles: 'all', parameters: { properties: {} },
    description: 'Estado del Tracker (Excel): versión que manda, filas vigentes y hojas cerradas.',
    reads: ['tablas del Tracker (conteos acotados)'], method: 'Cuenta filas vigentes y hojas cerradas de la versión de mayor rango; las filas rechazadas se cuentan aparte.', source: SRC.tracker,
    async run({ port }) {
      const t = await port.tracker();
      if (t.status !== 'ok') return noData('No tengo datos del Tracker.', ['El archivo Excel del Tracker (Importaciones)']);
      const f1 = fig('estado_tracker', 'Filas vigentes', fmtInt(t.rows), t.rows, t.class, coverageOf(t.rows, t.rows + t.rejected));
      const f2 = fig('estado_tracker', 'Hojas cerradas', `${fmtInt(t.sheetsClosed)} de ${fmtInt(t.sheetsTotal)}`, t.sheetsClosed, t.class, coverageOf(t.sheetsClosed, t.sheetsTotal));
      const f3 = fig('estado_tracker', 'Versiones cargadas', fmtInt(t.versions), t.versions, t.class, coverageOf(t.versions, t.versions));
      return {
        status: 'ok', figures: [f1, f2, f3],
        blocks: [{ tool: 'estado_tracker', title: 'Tracker (Excel)', columns: [col('medida', 'Medida'), col('valor', 'Valor')], rows: [{ medida: 'Versión que manda', valor: `${t.version} · ${t.sha}` }, { medida: f1.label, valor: f1.display }, { medida: f2.label, valor: f2.display }, { medida: 'Filas rechazadas', valor: fmtInt(t.rejected) }], class: t.class, coverage: f1.coverage, truncated: false }],
        summary: `La versión que manda es ${t.version} (${t.sha}), de ${fmtInt(t.versions)} cargadas. Tiene ${f1.display} filas vigentes ${tag(f1)} y ${f2.display} hojas cerradas ${tag(f2)}.`, missing: [], notes: [],
      };
    },
  },
  {
    name: 'estado_asociaciones', label: 'Revisando las asociaciones ticket–contacto', roles: 'all', parameters: { properties: {} },
    description: 'Cuántas asociaciones ticket–contacto están resueltas, pendientes o por revisar.',
    reads: ['hechos de asociación (conteos acotados)'], method: 'Cuenta hechos de asociación por estado; con muestra del 10 % cuando no cabe el conteo exacto (se rotula Estimado).', source: SRC.associations,
    async run({ port }) {
      const a = await port.associations();
      if (a.status !== 'ok') return noData('No tengo datos de asociaciones ticket–contacto.', ['Las asociaciones ticket–contacto de HubSpot']);
      const c = (k) => coverageOf(k, a.total);
      const fs = [fig('estado_asociaciones', 'Hechos de asociación', fmtInt(a.total), a.total, a.class, coverageOf(a.total, a.total)), fig('estado_asociaciones', 'Resueltos', fmtInt(a.resolved), a.resolved, a.class, c(a.resolved)), fig('estado_asociaciones', 'Pendientes', fmtInt(a.pending), a.pending, a.class, c(a.pending)), fig('estado_asociaciones', 'Vínculos activos conversación–cliente', fmtInt(a.activeLinks), a.activeLinks, a.class, coverageOf(a.activeLinks, a.total))];
      return {
        status: 'ok', figures: fs,
        blocks: [{ tool: 'estado_asociaciones', title: 'Asociaciones ticket–contacto', columns: [col('estado', 'Estado'), col('hechos', 'Hechos', 'integer')], rows: [{ estado: 'Resueltos', hechos: a.resolved }, { estado: 'Pendientes', hechos: a.pending }, { estado: 'Por revisar', hechos: a.review }, { estado: 'Retenidos', hechos: a.held }], class: a.class, coverage: c(a.total), truncated: false, note: a.sampled ? 'Estimado con una muestra del 10 %.' : undefined }],
        summary: `Hay ${fs[0].display} hechos de asociación: ${fs[1].display} resueltos y ${fs[2].display} pendientes ${tag(fs[1])}.`, missing: [], notes: a.sampled ? ['Estimado con una muestra del 10 %.'] : [],
      };
    },
  },
  {
    name: 'tendencia_conversaciones', label: 'Contando conversaciones por mes', roles: 'all', parameters: { properties: { months: { type: 'integer', minimum: 2, maximum: 12, default: 12 } } },
    description: 'Conversaciones cargadas por mes (fecha de inicio o de su primer mensaje).',
    reads: ['public.conversations', 'public.messages (fecha del primer mensaje)'], method: 'Cuenta conversaciones por mes en una ventana fija; si el conteo exacto no cabe en el tiempo, usa una muestra del 10 % escalada y la rotula Estimado.', source: SRC.trends,
    async run({ port, ctx }, { months }) {
      const t = await port.trends(); const c = t.conversations;
      if (!c || c.status === 'timeout') return unavailable('tendencia_conversaciones');
      if (c.status === 'empty' || !c.series?.length) return noData('No hay conversaciones cargadas en la ventana.', ['Conversaciones importadas (HubSpot o CSV)']);
      const ahora = new Date(ctx.now ?? Date.now());
      const s = c.series.slice(-months).map((x) => ({ ...x, st: estadoMes(x.month, c.completeness, ahora) }));
      const dato = s.filter((x) => x.st.estado !== 'sin_datos'), sum = dato.reduce((a, x) => a + x.count, 0), last = dato[dato.length - 1];
      if (!last) return noData('No hay conversaciones con datos en la ventana.', ['Conversaciones importadas (HubSpot o CSV)']);
      const avisos = s.map((x) => avisoMes(monthLabel(x.month), x.st)).filter(Boolean);
      const cov = coverageOf(sum, (c.total ?? sum) + (c.undated ?? 0));
      const f = fig('tendencia_conversaciones', `Conversaciones en ${monthLabel(last.month)}${last.st.estado === 'parcial' ? ' (mes incompleto)' : ''}`, fmtInt(last.count), last.count, c.class, cov);
      const f2 = fig('tendencia_conversaciones', `Conversaciones en ${dato.length} meses`, fmtInt(sum), sum, c.class, cov);
      const cell = (x) => (x.st.estado === 'sin_datos' ? 'No disponible' : x.st.estado === 'parcial' ? `${fmtInt(x.count)}*` : x.count);
      const note = [c.sampleNote, avisos.length ? `* ${avisos.join('. ')}. Un mes incompleto no se compara con otro ni se lee como caída.` : null].filter(Boolean).join(' ') || undefined;
      return {
        status: 'ok', figures: [f, f2],
        blocks: [{ tool: 'tendencia_conversaciones', title: 'Conversaciones por mes', columns: [col('mes', 'Mes'), col('conversaciones', 'Conversaciones', 'integer')], rows: s.map((x) => ({ mes: monthLabel(x.month), conversaciones: cell(x) })), chart: { kind: s.length >= 3 ? 'line' : 'bar', unit: 'conversaciones', series: s.map((x) => ({ key: x.month, label: monthShort(x.month) + (x.st.estado === 'parcial' ? '*' : ''), value: x.st.estado === 'sin_datos' ? null : x.count, display: x.st.estado === 'sin_datos' ? 'No disponible' : fmtInt(x.count) + (x.st.estado === 'parcial' ? ' (mes incompleto)' : ''), ...(x.st.estado === 'parcial' ? { partial: true } : {}) })) }, class: c.class, coverage: cov, truncated: false, note }],
        summary: `En ${monthLabel(last.month)} hubo ${f.display} conversaciones${last.st.estado === 'parcial' ? ` (${NO_COMPARABLE}: ${avisoMes(monthLabel(last.month), last.st).replace(/^[^(]*\(/, '').replace(/\)$/, '')})` : ''} y ${f2.display} en los últimos ${dato.length} meses con datos ${tag(f2)}.${c.sampled ? ' La cifra es una estimación a partir de una muestra del 10 %.' : ''}${s.some((x) => x.st.estado === 'sin_datos') ? ` Los meses posteriores al corte no tienen datos cargados (no son cero).` : ''}`, missing: [], notes: [...(c.sampleNote ? [c.sampleNote] : []), ...avisos],
      };
    },
  },
  {
    name: 'problemas_top', label: 'Ordenando los problemas por incidencias', roles: 'all', parameters: { properties: { month: MONTH_PROP, limit: { type: 'integer', minimum: 1, maximum: 10, default: 5 } } },
    description: 'Los problemas con más incidencias en un mes (por defecto, el mes en curso).',
    reads: ['problemas publicados', 'vínculos conversación–problema (conteo por mes)'], method: 'Una incidencia es una conversación clasificada con ese problema en el mes. Una conversación puede aportar a varios problemas, por eso las filas no se suman.', source: SRC.problems,
    async run({ port, ctx }, { month, limit }) {
      const m = month ?? ctx.month; const r = await port.problemIncidents({ month: m });
      if (r.status !== 'ok' || !r.rows?.length) return noData(`No tengo incidencias clasificadas para ${monthLabel(m)}.`, ['La clasificación de las conversaciones del mes']);
      const rows = [...r.rows].sort((a, b) => b.incidents - a.incidents || a.title.localeCompare(b.title, 'es')).slice(0, limit);
      const cov = coverageOf(r.classified, r.eligible);
      const fs = rows.map((p, i) => fig('problemas_top', p.title, fmtInt(p.incidents), p.incidents, 'inferred', cov, { rank: i + 1 }));
      return {
        status: 'ok', figures: fs,
        blocks: [{ tool: 'problemas_top', title: `Problemas con más incidencias · ${monthLabel(m)}`, columns: [col('problema', 'Problema'), col('incidencias', 'Incidencias', 'integer'), col('clientes', 'Clientes', 'integer')], rows: rows.map((p) => ({ problema: p.title, incidencias: p.incidents, clientes: p.customers })), chart: { kind: 'bar', unit: 'incidencias', series: rows.map((p) => ({ key: p.problemId, label: p.title, value: p.incidents, display: fmtInt(p.incidents) })) }, class: 'inferred', coverage: cov, truncated: r.rows.length > rows.length, note: 'Inferido: cada incidencia es una conversación vinculada al problema por su evidencia; las filas no se suman entre sí.' }],
        summary: `En ${monthLabel(m)}, los ${rows.length} problemas con más incidencias son: ${rows.map((p, i) => `${i + 1}. ${p.title} (${fmtInt(p.incidents)})`).join('; ')} ${tag(fs[0])}.`, missing: [], notes: [],
      };
    },
  },
  {
    name: 'exposicion_por_problema', label: 'Calculando la exposición por problema', roles: 'all', parameters: { properties: { limit: { type: 'integer', minimum: 1, maximum: 10, default: 6 } } },
    description: 'Ingresos expuestos (pedidos vinculados) por problema, con su cobertura. No es pérdida y no se suma entre problemas.',
    reads: ['pedidos vinculados a conversaciones por problema (libro de registros)'], method: 'Suma los importes de los pedidos vinculados por evidencia a cada problema; si falta el importe de algún pedido, muestra el subtotal conocido y lo dice (nunca un cero).', source: SRC.exposure,
    async run({ port }, { limit }) {
      const r = await port.exposure({ limit });
      if (r.status !== 'ok' || !r.rows?.length) return noData('No tengo ingresos vinculados a problemas.', ['Pedidos cargados y vinculados a conversaciones']);
      const rows = r.rows.map((x) => ({ problema: x.title, expuesto: x.amountMinor !== null ? money(x.amountMinor, r.currency, r.exponent) : x.knownSubtotalMinor ? `Parcial · subtotal conocido ${money(x.knownSubtotalMinor, r.currency, r.exponent)}` : 'No disponible', cobertura: `${fmtInt(x.known_n)} de ${fmtInt(x.eligible_n)}` }));
      const cov = coverageOf(r.coverage.known_n, r.coverage.eligible_n);
      const fs = r.rows.map((x, i) => fig('exposicion_por_problema', x.title, rows[i].expuesto, x.amountMinor, 'inferred', coverageOf(x.known_n, x.eligible_n), { currency: r.currency }));
      const full = r.rows.filter((x) => x.amountMinor !== null);
      return {
        status: 'ok', figures: fs,
        blocks: [{ tool: 'exposicion_por_problema', title: `Ingresos expuestos por problema (${r.currency})`, columns: [col('problema', 'Problema'), col('expuesto', 'Expuesto'), col('cobertura', 'Pedidos con importe')], rows, class: 'inferred', coverage: cov, truncated: false, note: 'Inferido: pedidos vinculados por evidencia. No equivale a pérdida ni se suma entre problemas.' }],
        summary: `${full.length ? `Mayor exposición con importe completo: ${full[0].title}, ${money(full[0].amountMinor, r.currency, r.exponent)} ${tag(fs[r.rows.indexOf(full[0])])}. ` : ''}${r.rows.length - full.length} de ${r.rows.length} problemas no tienen todos los importes (se muestra el subtotal conocido, no el total). La exposición no es pérdida y no se suma entre problemas.`, missing: r.rows.some((x) => x.amountMinor === null) ? ['El importe de los pedidos que no lo tienen'] : [], notes: [],
      };
    },
  },
  {
    name: 'categorias_por_mes', label: 'Comparando categorías por mes', roles: 'all', parameters: { properties: { months: { type: 'integer', minimum: 2, maximum: 12, default: 6 } } },
    description: 'Frecuencia de incidencias por categoría y por mes (últimos N meses).',
    reads: ['incidencias clasificadas por categoría y mes'], method: 'Cuenta incidencias clasificadas por categoría en cada mes; el cambio compara el primer y el último mes COMPLETO de la ventana (un mes incompleto se rotula y no se compara).', source: SRC.problems,
    async run({ port, ctx }, { months }) {
      const r = await port.categoryMonthly({ months });
      if (r.status !== 'ok' || !r.rows?.length) return noData('No tengo incidencias clasificadas por categoría.', ['La clasificación de las conversaciones']);
      // Las incidencias salen de conversaciones: heredan la completitud de las conversaciones (mismo corte).
      const completeness = await port.trends().then((t) => t?.conversations?.completeness ?? null).catch(() => null), ahora = new Date(ctx.now ?? Date.now());
      const st = Object.fromEntries(r.months.map((m) => [m, estadoMes(m, completeness, ahora)]));
      const cats = [...new Set(r.rows.map((x) => x.category))];
      const done = r.months.filter((m) => st[m].estado === 'completo'), first = done[0], last = done[done.length - 1];
      const get = (c, m) => r.rows.find((x) => x.category === c && x.month === m)?.count ?? 0;
      const cov = coverageOf(r.classified, r.eligible);
      const avisos = r.months.map((m) => avisoMes(monthLabel(m), st[m])).filter(Boolean);
      const cell = (c, m) => (st[m].estado === 'sin_datos' ? 'No disponible' : st[m].estado === 'parcial' ? `${get(c, m)}*` : get(c, m));
      const comparable = done.length >= 2;
      const cambioDe = (c) => (comparable ? `${signed(get(c, last) - get(c, first))} (${fmtPct(pct(get(c, first), get(c, last)))})` : NO_COMPARABLE);
      const table = cats.map((c) => ({ categoria: c.charAt(0).toUpperCase() + c.slice(1), ...Object.fromEntries(r.months.map((m) => [m, cell(c, m)])), cambio: cambioDe(c) }));
      const nota = ['Inferido: incidencias vinculadas por evidencia a cada categoría.', avisos.length ? `* ${avisos.join('. ')}. El cambio compara solo meses completos${comparable ? ` (${monthLabel(first)} a ${monthLabel(last)})` : ''}; un mes incompleto no se compara.` : null].filter(Boolean).join(' ');
      const colLabel = (m) => monthShort(m) + (st[m].estado === 'parcial' ? ' (parcial)' : st[m].estado === 'sin_datos' ? ' (sin datos)' : '');
      const title = `Incidencias por categoría · ${monthShort(r.months[0])} a ${monthShort(r.months[r.months.length - 1])}`;
      const columns = [col('categoria', 'Categoría'), ...r.months.map((m) => col(m, colLabel(m), 'integer')), col('cambio', 'Cambio')];
      if (!comparable) {
        const f0 = fig('categorias_por_mes', 'Cambio por categoría', NO_COMPARABLE, null, 'inferred', cov);
        return { status: 'ok', figures: [f0], blocks: [{ tool: 'categorias_por_mes', title, columns, rows: table, class: 'inferred', coverage: cov, truncated: false, note: nota }], summary: `No hay dos meses completos en la ventana para comparar categorías: ${NO_COMPARABLE} ${tag(f0)}. ${avisos.join('. ')}.`, missing: [], notes: avisos };
      }
      const ranked = cats.map((c) => ({ c, d: get(c, last) - get(c, first), p: pct(get(c, first), get(c, last)) })).sort((x, y) => y.d - x.d);
      const f = fig('categorias_por_mes', `Cambio de «${ranked[0].c}»`, `${signed(ranked[0].d)} (${fmtPct(ranked[0].p)})`, ranked[0].d, 'inferred', cov);
      return {
        status: 'ok', figures: [f],
        blocks: [{ tool: 'categorias_por_mes', title, columns, rows: table, class: 'inferred', coverage: cov, truncated: false, note: nota }],
        summary: `Entre ${monthLabel(first)} y ${monthLabel(last)} (meses completos), la categoría que más creció es «${ranked[0].c}»: ${f.display} ${tag(f)}. La que menos: «${ranked[ranked.length - 1].c}» (${signed(ranked[ranked.length - 1].d)}).${avisos.length ? ' ' + avisos.join('. ') + '.' : ''}`, missing: [], notes: avisos,
      };
    },
  },
  {
    name: 'ledger_por_fuente', label: 'Sumando el libro por marketplace', roles: 'all',
    parameters: { properties: { kind: { type: 'string', enum: ['refund', 'order'], default: 'refund' }, month: MONTH_PROP, months: { type: 'integer', minimum: 1, maximum: 12, default: 12 }, fuente: { type: 'string', maxLength: 60, description: 'Nombre de la fuente o marketplace (opcional).' } } },
    description: 'Pedidos registrados o reembolsos liquidados por fuente (marketplace/Shopify) y por moneda. Las monedas nunca se suman.',
    reads: ['public.economic_ledger_entries (última revisión por entidad)'], method: 'Toma la última revisión de cada registro; pedidos «registrados» y reembolsos «liquidados» por fecha efectiva; agrupa por fuente y moneda. No convierte ni suma monedas; los importes sin monto se cuentan aparte.', source: SRC.ledger,
    async run({ port }, { kind, month, months, fuente }) {
      const r = await port.ledgerBySource({ kind, month, months });
      const noun = kind === 'refund' ? 'reembolsos liquidados' : 'pedidos registrados';
      const span = month ? monthLabel(month) : `los últimos ${months} meses`;
      let rows = r.rows ?? [];
      if (fuente) {
        const q = normalize(fuente); const hit = rows.filter((x) => normalize(x.sourceLabel).includes(q) || normalize(x.source).includes(q));
        if (!hit.length) {
          const cv = await port.coverage(); const src = (cv.sources ?? []).find((s) => normalize(s.label).includes(q) || normalize(s.key).includes(q));
          const label = src?.label ?? fuente;
          return noData(`No tengo ${noun} de «${label}». ${src && !src.loaded ? `${label} no está cargado.` : 'No hay registros de esa fuente en el periodo.'}`, [`${label} (aún no cargado)`]);
        }
        rows = hit;
      }
      if (r.status !== 'ok' || !rows.length) return noData(`No tengo ${noun} en ${span}.`, ['Pedidos y reembolsos de los marketplaces (libro de registros)']);
      const nCur = (c) => rows.filter((x) => x.currency === c).length;
      rows = [...rows].sort((a, b) => nCur(b.currency) - nCur(a.currency) || a.currency.localeCompare(b.currency) || Number(BigInt(b.amountMinor) - BigInt(a.amountMinor)));
      const known = rows.reduce((a, x) => a + (x.count - x.unknown), 0), all = rows.reduce((a, x) => a + x.count, 0), cov = coverageOf(known, all);
      const fs = rows.map((x) => fig('ledger_por_fuente', `${x.sourceLabel} · ${x.currency}`, money(x.amountMinor, x.currency, x.exponent), x.amountMinor, 'observed', coverageOf(x.count - x.unknown, x.count), { currency: x.currency }));
      const currencies = [...new Set(rows.map((x) => x.currency))];
      const bar = rows.filter((x) => x.currency === currencies[0]);
      return {
        status: 'ok', figures: fs,
        blocks: [{ tool: 'ledger_por_fuente', title: `${kind === 'refund' ? 'Reembolsos liquidados' : 'Pedidos registrados'} por fuente · ${span}`, columns: [col('fuente', 'Fuente'), col('moneda', 'Moneda'), col('registros', 'Registros', 'integer'), col('importe', 'Importe'), col('sinImporte', 'Sin importe', 'integer')], rows: rows.map((x) => ({ fuente: x.sourceLabel, moneda: x.currency, registros: x.count, importe: money(x.amountMinor, x.currency, x.exponent), sinImporte: x.unknown })), chart: { kind: 'bar', unit: `importe en ${currencies[0]}`, series: bar.map((x) => ({ key: x.source, label: x.sourceLabel, value: majorOf(x.amountMinor, x.exponent), display: money(x.amountMinor, x.currency, x.exponent) })) }, class: 'observed', coverage: cov, truncated: false, note: currencies.length > 1 ? `Las monedas (${currencies.join(', ')}) no se suman entre sí ni se convierten.` : undefined }],
        summary: `${kind === 'refund' ? 'Reembolsos liquidados' : 'Pedidos registrados'} por fuente en ${span}: ${rows.map((x, i) => `${x.sourceLabel} ${fs[i].display}`).join('; ')} ${tag(fs[0])}.${currencies.length > 1 ? ' Las monedas no se suman entre sí.' : ''}`,
        missing: rows.some((x) => x.unknown > 0) ? ['El monto de los registros sin importe'] : [], notes: currencies.length > 1 ? ['Las monedas no se convierten ni se suman.'] : [],
      };
    },
  },
  {
    name: 'ledger_por_mes', label: 'Leyendo el libro mes a mes', roles: 'all', parameters: { properties: { kind: { type: 'string', enum: ['refund', 'order'], default: 'refund' }, months: { type: 'integer', minimum: 2, maximum: 12, default: 12 } } },
    description: 'Evolución mensual de reembolsos liquidados o pedidos registrados (moneda principal; las demás se listan aparte).',
    reads: ['public.economic_ledger_entries (última revisión por entidad)'], method: 'Agrupa por mes de la fecha efectiva en la moneda con más registros; otras monedas se mencionan sin sumarlas.', source: SRC.trends,
    async run({ port }, { kind, months }) {
      const t = await port.trends(); const l = t.ledger;
      if (!l || l.status === 'timeout') return unavailable('ledger_por_mes');
      if (l.status === 'empty') return noData('No hay pedidos ni reembolsos cargados.', ['Pedidos y reembolsos (libro de registros)']);
      const key = kind === 'refund' ? 'refunds' : 'orders'; const s = l.series.slice(-months);
      const n = s.reduce((a, x) => a + x[key].count, 0), unk = s.reduce((a, x) => a + x[key].unknownAmounts, 0), total = s.reduce((a, x) => a + BigInt(x[key].amountMinor), 0n);
      const cov = coverageOf(n - unk, n); const last = s[s.length - 1];
      const f = fig('ledger_por_mes', `${kind === 'refund' ? 'Reembolsos' : 'Pedidos'} en ${s.length} meses`, money(total, l.currency, l.exponent), String(total), 'observed', cov, { currency: l.currency });
      const f2 = fig('ledger_por_mes', `${kind === 'refund' ? 'Reembolsos' : 'Pedidos'} en ${monthLabel(last.month)}`, money(last[key].amountMinor, l.currency, l.exponent), last[key].amountMinor, 'observed', coverageOf(last[key].count - last[key].unknownAmounts, last[key].count), { currency: l.currency });
      return {
        status: 'ok', figures: [f, f2],
        blocks: [{ tool: 'ledger_por_mes', title: `${kind === 'refund' ? 'Reembolsos liquidados' : 'Pedidos registrados'} por mes (${l.currency})`, columns: [col('mes', 'Mes'), col('registros', 'Registros', 'integer'), col('importe', 'Importe')], rows: s.map((x) => ({ mes: monthLabel(x.month), registros: x[key].count, importe: money(x[key].amountMinor, l.currency, l.exponent) })), chart: { kind: 'bar', unit: `importe en ${l.currency}`, series: s.map((x) => ({ key: x.month, label: monthShort(x.month), value: majorOf(x[key].amountMinor, l.exponent), display: money(x[key].amountMinor, l.currency, l.exponent) })) }, class: 'observed', coverage: cov, truncated: false, note: l.otherCurrencies?.length ? `Hay registros en otras monedas (${l.otherCurrencies.join(', ')}); no se suman a esta serie.` : undefined }],
        summary: `${kind === 'refund' ? 'Los reembolsos liquidados' : 'Los pedidos registrados'} suman ${f.display} en ${s.length} meses ${tag(f)}; en ${monthLabel(last.month)}, ${f2.display}.${l.otherCurrencies?.length ? ` Hay otras monedas (${l.otherCurrencies.join(', ')}) que no se suman.` : ''}`, missing: [], notes: [],
      };
    },
  },
  {
    name: 'comparar_meses', label: 'Comparando los dos meses', roles: 'all', parameters: { properties: { a: { ...MONTH_PROP, description: 'Mes base AAAA-MM.' }, b: { ...MONTH_PROP, description: 'Mes a comparar AAAA-MM.' } }, required: ['a', 'b'] },
    description: 'Qué cambió entre dos meses: conversaciones, pedidos, reembolsos y problemas.',
    reads: ['tendencias mensuales de registros', 'incidencias por problema y mes'], method: 'Resta el mes base al mes comparado en cada medida (registros e incidencias); el porcentaje usa el mes base. No explica causas.', source: SRC.trends,
    async run({ port, ctx }, { a, b }) {
      const t = await port.trends(); const win = (t.conversations?.series ?? []).map((x) => x.month);
      if (!win.includes(a) || !win.includes(b)) return noData(`Solo tengo datos de ${win.length ? `${monthLabel(win[0])} a ${monthLabel(win[win.length - 1])}` : 'ningún mes'}; no puedo comparar ${monthLabel(a)} con ${monthLabel(b)}.`, ['Los meses que faltan']);
      const conv = (m) => t.conversations.series.find((x) => x.month === m).count, led = (m, k) => t.ledger.series.find((x) => x.month === m)?.[k];
      const covC = coverageOf(conv(a) + conv(b), (t.conversations.total ?? 0) + (t.conversations.undated ?? 0) || conv(a) + conv(b));
      // Un mes incompleto (corte a mitad de mes) o sin datos NO se compara: ni variación %, ni «0» presentado como dato. Misma regla que el Resumen y /cfo.
      const ahora = new Date(ctx.now ?? Date.now());
      const sc = { a: estadoMes(a, t.conversations.completeness, ahora), b: estadoMes(b, t.conversations.completeness, ahora) };
      const sl = { a: estadoMes(a, t.ledger?.completeness, ahora), b: estadoMes(b, t.ledger?.completeness, ahora) };
      const avisos = [...new Set([[a, sc.a], [b, sc.b]].map(([m, st]) => avisoMes(monthLabel(m), st)).concat([[a, sl.a], [b, sl.b]].map(([m, st]) => avisoMes(monthLabel(m) + ' (pedidos y reembolsos)', st))).filter(Boolean))];
      const rows = [], figs = [];
      const shown = (st, v, fmt) => (st.estado === 'sin_datos' ? 'No disponible' : fmt(v) + (st.estado === 'parcial' ? '*' : ''));
      const add = (label, cls, va, vb, cov, sta, stb, fmt = fmtInt) => {
        const ok = comparables(sta, stb), d = vb - va;
        const cambio = ok ? `${signed(d)} (${fmtPct(pct(va, vb))})` : NO_COMPARABLE;
        rows.push({ medida: label, [a]: shown(sta, va, fmt), [b]: shown(stb, vb, fmt), cambio, clase: CLASS_LABELS[cls] });
        figs.push(fig('comparar_meses', label, cambio, ok ? d : null, cls, cov));
      };
      add('Conversaciones', t.conversations.class, conv(a), conv(b), covC, sc.a, sc.b);
      if (t.ledger?.series?.length) { for (const [k, name] of [['orders', 'Pedidos registrados'], ['refunds', 'Reembolsos liquidados']]) add(name, 'observed', led(a, k).count, led(b, k).count, coverageOf(led(a, k).count + led(b, k).count - led(a, k).unknownAmounts - led(b, k).unknownAmounts, led(a, k).count + led(b, k).count), sl.a, sl.b); }
      const pa = await port.problemIncidents({ month: a }), pb = await port.problemIncidents({ month: b });
      const nota = ['Solo describe el cambio; no explica sus causas.', avisos.length ? `* ${avisos.join('. ')}. Una variación solo se calcula entre dos meses completos.` : null].filter(Boolean).join(' ');
      const blocks = [{ tool: 'comparar_meses', title: `Registros · ${monthLabel(a)} frente a ${monthLabel(b)}`, columns: [col('medida', 'Medida'), col(a, monthShort(a), 'integer'), col(b, monthShort(b), 'integer'), col('cambio', 'Cambio'), col('clase', 'Clase')], rows, class: 'mixed', coverage: covC, truncated: false, note: nota }];
      let probText = '';
      if (pa.status === 'ok' && pb.status === 'ok') {
        const covP = coverageOf(pb.classified, pb.eligible), okP = comparables(sc.a, sc.b);
        const diff = pb.rows.map((p) => { const x = pa.rows.find((r) => r.problemId === p.problemId)?.incidents ?? 0; return { title: p.title, a: x, b: p.incidents, d: p.incidents - x }; }).sort((p, q) => q.d - p.d).slice(0, 5);
        const cambioP = (x) => (okP ? `${signed(x.d)} (${fmtPct(pct(x.a, x.b))})` : NO_COMPARABLE);
        const pf = diff.map((x) => fig('comparar_meses', x.title, cambioP(x), okP ? x.d : null, 'inferred', covP));
        figs.push(...pf);
        blocks.push({ tool: 'comparar_meses', title: 'Problemas que más cambiaron (incidencias)', columns: [col('problema', 'Problema'), col(a, monthShort(a), 'integer'), col(b, monthShort(b), 'integer'), col('cambio', 'Cambio')], rows: diff.map((x) => ({ problema: x.title, [a]: shown(sc.a, x.a, fmtInt), [b]: shown(sc.b, x.b, fmtInt), cambio: cambioP(x) })), class: 'inferred', coverage: covP, truncated: false, note: okP ? 'Inferido: incidencias vinculadas por evidencia.' : `Inferido: incidencias vinculadas por evidencia. ${NO_COMPARABLE}: no se ordena por crecimiento.` });
        if (okP) probText = ` El problema que más creció es «${diff[0].title}»: de ${fmtInt(diff[0].a)} a ${fmtInt(diff[0].b)} incidencias, ${pf[0].display} ${tag(pf[0])}.`;
      }
      const todoOk = comparables(sc.a, sc.b) && comparables(sl.a, sl.b);
      const c0 = figs[0];
      const resumen = todoOk
        ? `Entre ${monthLabel(a)} y ${monthLabel(b)}, las conversaciones cambiaron ${c0.display} ${tag(c0)}${figs[2] ? `; los reembolsos liquidados, ${figs[2].display} ${tag(figs[2])}` : ''}.${probText}`
        : `Entre ${monthLabel(a)} y ${monthLabel(b)} no hay variación que reportar: ${NO_COMPARABLE}. ${avisos.join('. ')}. ${comparables(sc.a, sc.b) ? `Las conversaciones cambiaron ${c0.display} ${tag(c0)}. ` : ''}Un mes incompleto no se lee como caída ni como alza; los valores con * son parciales.${probText}`;
      return { status: 'ok', figures: figs, blocks, summary: resumen, missing: pa.status === 'ok' ? [] : ['La clasificación de las conversaciones de esos meses'], notes: avisos };
    },
  },
  {
    name: 'evidencias_de_problema', label: 'Buscando citas verificables', roles: ['analyst', 'owner'], parameters: { properties: { problema: PROBLEM_PROP, limit: { type: 'integer', minimum: 1, maximum: LIMITS.maxCitations, default: 3 } }, required: ['problema'] },
    description: 'Citas de clientes que respaldan un problema. El texto de las citas se muestra al usuario pero nunca se envía al modelo.',
    reads: ['evidencias de la clasificación (citas con revisión de mensaje)', 'cadena de origen (provenance)'], method: 'Devuelve citas literales ancladas a una revisión de mensaje; cada una enlaza a su registro de fuente, fila y archivo (cadena de origen).', source: SRC.evidence, restricted: true,
    async run({ port }, { problema, limit }) {
      const res = await resolveProblem(port, problema);
      if (res.kind === 'none') return noData(`No encontré un problema llamado «${problema}».`, ['La lista de problemas']);
      if (res.kind === 'ambiguous') return { status: 'clarify', summary: `¿A cuál problema te refieres? ${res.options.map((o) => `«${o.title}»`).join(', ')}.`, figures: [], blocks: [], missing: [], notes: [], options: res.options.map((o) => o.title) };
      const p = res.problem; const ev = await port.evidence({ problemId: p.problemId, limit });
      if (ev.status !== 'ok' || !ev.citations?.length) return noData(`No tengo citas verificables de «${p.title}».`, ['La extracción con evidencia para este problema']);
      const cov = coverageOf(ev.citations.length, ev.total);
      const f = fig('evidencias_de_problema', `Citas verificables de «${p.title}»`, `${ev.citations.length} de ${fmtInt(ev.total)}`, ev.citations.length, 'observed', cov);
      return {
        status: 'ok', figures: [f], blocks: [], citations: ev.citations.map((c) => ({ messageRevisionId: c.messageRevisionId, quote: String(c.quote).slice(0, 600), role: c.role, source: c.source, category: c.category })),
        summary: `Muestro ${f.display} citas verificables de «${p.title}» ${tag(f)}. Cada cita enlaza a su origen (registro, fila y archivo).`, missing: [], notes: [], problem: { title: p.title },
        modelView: { problem: p.title, citationsShown: ev.citations.length, citationsTotal: ev.total },
      };
    },
  },
  {
    name: 'clientes_por_problema', label: 'Contando clientes afectados', roles: ['analyst', 'owner'], parameters: { properties: { problema: PROBLEM_PROP, month: MONTH_PROP }, required: ['problema'] },
    description: 'Cuántos clientes distintos se vinculan a un problema, con citas de respaldo.',
    reads: ['vínculos conversación–cliente aprobados', 'evidencias del problema'], method: 'Cuenta clientes distintos con vínculo aprobado a conversaciones del problema; toda afirmación sobre clientes lleva al menos una cita verificable.', source: SRC.evidence, restricted: true,
    async run({ port, ctx }, { problema, month }) {
      const res = await resolveProblem(port, problema);
      if (res.kind === 'none') return noData(`No encontré un problema llamado «${problema}».`, ['La lista de problemas']);
      if (res.kind === 'ambiguous') return { status: 'clarify', summary: `¿A cuál problema te refieres? ${res.options.map((o) => `«${o.title}»`).join(', ')}.`, figures: [], blocks: [], missing: [], notes: [], options: res.options.map((o) => o.title) };
      const p = res.problem, m = month ?? ctx.month; const r = await port.problemCustomers({ problemId: p.problemId, month: m });
      if (r.status !== 'ok') return noData(`No tengo clientes vinculados a «${p.title}» en ${monthLabel(m)}.`, ['Los vínculos conversación–cliente aprobados']);
      const ev = await port.evidence({ problemId: p.problemId, limit: 2 });
      if (ev.status !== 'ok' || !ev.citations?.length) return noData(`Hay clientes vinculados a «${p.title}», pero sin una cita verificable no puedo afirmarlo.`, ['La extracción con evidencia']);
      const cov = coverageOf(r.customers, r.incidents);
      const f = fig('clientes_por_problema', `Clientes con «${p.title}»`, fmtInt(r.customers), r.customers, 'inferred', cov);
      return {
        status: 'ok', figures: [f], blocks: [], citations: ev.citations.map((c) => ({ messageRevisionId: c.messageRevisionId, quote: String(c.quote).slice(0, 600), role: c.role, source: c.source, category: c.category })),
        summary: `En ${monthLabel(m)}, ${f.display} clientes distintos se vinculan a «${p.title}» ${tag(f)}. Abajo, las citas que lo respaldan.`, missing: [], notes: [], problem: { title: p.title },
        modelView: { problem: p.title, customers: r.customers, month: m },
      };
    },
  },
];

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
  const tool = Object.hasOwn(TOOL_INDEX, name) ? TOOL_INDEX[name] : null;
  const base = { tool: name, args: {}, label: tool?.label ?? name };
  if (!tool) return { ...base, status: 'invalid_input', summary: 'Herramienta fuera del catálogo.', figures: [], blocks: [], citations: [], sources: [], missing: [], notes: [] };
  if (!toolAllowed(tool, ctx.role)) return { ...base, status: 'forbidden', summary: 'Tu rol no tiene acceso a esta consulta.', figures: [], blocks: [], citations: [], sources: [], missing: [], notes: [] };
  const v = validateArgs(tool.parameters, args);
  if (!v.ok) return { ...base, status: 'invalid_input', summary: `Argumentos no válidos: ${v.error}.`, figures: [], blocks: [], citations: [], sources: [], missing: [], notes: [] };
  const started = Date.now(); let timer;
  try {
    const out = await Promise.race([tool.run({ port, ctx }, v.args), new Promise((_, rej) => { timer = setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'timeout' })), timeoutMs); })]);
    const result = { tool: tool.name, label: tool.label, args: v.args, citations: [], ...out, sources: out.status === 'ok' || out.status === 'no_data' ? [{ ...tool.source, tool: tool.name }] : [] };
    result.figures = (result.figures ?? []).map((f, i) => ({ ...f, id: `${tool.name}.${i + 1}` }));
    result.method = tool.method; result.reads = tool.reads; result.durationMs = Date.now() - started;
    return result;
  } catch (e) {
    return { ...base, args: v.args, status: 'unavailable', summary: 'La consulta no pudo completarse a tiempo; reintenta.', figures: [], blocks: [], citations: [], sources: [], missing: [], notes: [], error: e?.code === 'timeout' ? 'timeout' : 'error', durationMs: Date.now() - started };
  } finally { clearTimeout(timer); }
}

/** Lo ÚNICO que ve el modelo de un resultado: cifras ya formateadas y notas. Sin citas, sin texto de clientes, sin ids. */
export function modelViewOf(result) {
  return {
    tool: result.tool, status: result.status, args: result.args, summary: result.summary,
    figures: (result.figures ?? []).map((f) => ({ label: f.label, display: f.display, class: CLASS_LABELS[f.class], coverage: f.coverage })),
    missing: result.missing ?? [], notes: result.notes ?? [], ...(result.modelView ? { facts: result.modelView } : {}),
  };
}
