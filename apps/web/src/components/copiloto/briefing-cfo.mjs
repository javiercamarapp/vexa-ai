// Briefing de CFO: convierte el informe ya calculado (/cfo/data/report) en el bloque que abre el copiloto. PURO: no llama a ningún modelo ni al servidor,
// solo reordena cifras que ya traen su clase (Observado / Estimado / Inferido), su cobertura y su fuente. Nunca suma monedas ni bases distintas.
import {explicarVariacion} from '../../lib/legibilidad/caida.mjs';
import {mesLargo as mesLargoIdioma} from '../../lib/formato/idioma.mjs';
import {monthLabel} from '../../../../../packages/cfo-copilot/src/format.mjs';

// Textos de este módulo puro: español canónico (lo que fijan las pruebas) e inglés. El idioma es siempre opcional y por omisión 'es'.
export const TXT = {
  es: {sev: {alta: 'Alta', media: 'Media', baja: 'Baja', info: 'Informativa'}, libro: 'Libro económico de tu organización', sinMes: 'Todavía no hay un mes completo para resumir tu dinero.',
    titular: (mes, ingresos, pedidos, cambio) => `En ${mes}: ${ingresos} de ingresos${pedidos ? ' y ' + pedidos + ' pedidos' : ''}${cambio}.`, contra: (d, mes) => ` (${d} contra ${mes})`,
    pedidosImporte: (k, n) => `${k} de ${n} pedidos con importe`, incompleto: meses => `${meses} está incompleto: no se compara con meses completos.`,
    avisoMonedas: 'USD, CAD y MXN no se suman ni se convierten: no hay tipos de cambio aprobados. Cada moneda se muestra aparte.', reembNoContab: 'Reembolsos no contabilizados',
    qCayo: mes => `¿Por qué cayó ${mes}?`, mCayo: 'Los ingresos o los pedidos bajaron contra el mes anterior.', qAlerta: '¿Qué alerta debo atender primero?', qCanal: '¿Qué canal sin importes pesa más?', mCanal: l => `${l} tiene registros sin importe.`,
    qProy: m => `¿Cómo se ve ${m} los próximos 3 meses?`, mProy: 'Hay una proyección Estimada con sus supuestos.', qExpo: '¿Qué problemas exponen más ingresos?', mExpo: 'Faltan vínculos entre problemas y pedidos.'},
  en: {sev: {alta: 'High', media: 'Medium', baja: 'Low', info: 'Informational'}, libro: 'Your organization ledger', sinMes: 'There is no complete month yet to summarize your money.',
    titular: (mes, ingresos, pedidos, cambio) => `In ${mes}: ${ingresos} in revenue${pedidos ? ' and ' + pedidos + ' orders' : ''}${cambio}.`, contra: (d, mes) => ` (${d} versus ${mes})`,
    pedidosImporte: (k, n) => `${k} of ${n} orders with an amount`, incompleto: meses => `${meses} is incomplete and is not compared with complete months.`,
    avisoMonedas: 'USD, CAD and MXN are not added or converted: there are no approved exchange rates. Each currency is shown separately.', reembNoContab: 'Unaccounted refunds',
    qCayo: mes => `Why did ${mes} drop?`, mCayo: 'Revenue or orders fell against the previous month.', qAlerta: 'Which alert should I handle first?', qCanal: 'Which channel without amounts weighs the most?', mCanal: l => `${l} has records without an amount.`,
    qProy: m => `What does ${m} look like over the next 3 months?`, mProy: 'There is an Estimated projection with its assumptions.', qExpo: 'Which problems expose the most revenue?', mExpo: 'Links between problems and orders are missing.'},
};
const T = idioma => TXT[idioma === 'en' ? 'en' : 'es'];
const ORDEN = {alta: 0, media: 1, baja: 2, info: 3};
export const mesLargo = (key, idioma) => /^\d{4}-\d{2}$/.test(key ?? '') ? mesLargoIdioma(key, idioma) : String(key ?? '');
const KPI_IDS = ['rev', 'orders', 'ticket', 'refund', 'rate'];

/** Clave del bloque de una moneda: la pedida si existe en el informe; si no, la primera (nunca se inventa una). */
export const monedaElegida = (report, pedida) => (report?.currencies ?? []).includes(pedida) ? pedida : (report?.currencies?.[0] ?? null);

/** Parámetros de la URL al cambiar la moneda del resumen. `currency` es parte del alcance compartido de la app y `snapshot_id`/`scope_hash` fijan el corte de ESE alcance:
 *  cambiar solo la moneda dejaba un corte de otra moneda en los enlaces del menú (las demás pantallas respondían 409). Igual que el Explorador, se descarta el corte
 *  para que el servidor resuelva el del alcance nuevo. Devuelve el texto de la query (sin «?»). */
export const parametrosConMoneda = (search, moneda) => {
  const p = new URLSearchParams(search ?? '');
  p.set('currency', moneda); p.delete('snapshot_id'); p.delete('scope_hash');
  return p.toString();
};

function kpisDe(report, moneda) {
  const k = report.kpis.find(x => x.currency === moneda);
  return (k?.metrics ?? []).filter(m => KPI_IDS.includes(m.id.split(':')[0])).map(m => ({id: m.id, label: m.label.replace(/ · [A-Z]{3}$/, ''), display: m.display, kind: m.kind, delta: m.delta ? {display: m.delta.display, vs: m.delta.vs, bps: m.delta.bps ?? null, pp: !!m.delta.pp} : null, cobertura: m.coverage?.eligible == null ? null : m.coverage.label, how: m.how}));
}

/** Serie mensual de ingresos: principal (primera base), comparativas (otras bases de la MISMA moneda, mismo eje) y mes resaltado. */
export function serieIngresos(report, moneda, idioma) {
  const x = T(idioma);
  const bloque = report.perCurrency.find(c => c.currency === moneda);
  if (!bloque) return null;
  const exp = bloque.exponent ?? 2;
  const aPuntos = base => base.series.map(s => ({month: s.month, partial: !!s.partial, value: s.known > 0 ? Number(BigInt(s.amount)) / 10 ** exp : null, display: s.amountDisplay, detail: x.pedidosImporte(s.known, s.n)}));
  const [principal, ...otras] = bloque.orderBases;
  const puntos = aPuntos(principal);
  // Resaltado: la mayor caída entre dos meses completos consecutivos; si no hay, el último mes completo.
  let resaltado = null, peor = 0;
  for (let i = 1; i < puntos.length; i++) { const a = puntos[i - 1], b = puntos[i]; if (a.partial || b.partial || a.value == null || b.value == null || a.value <= 0) continue; const d = (b.value - a.value) / a.value; if (d < peor) { peor = d; resaltado = b.month; } }
  const motivo = resaltado && peor <= -0.1 ? 'caida' : 'ultimo';
  if (motivo === 'ultimo') resaltado = report.lastComplete;
  return {moneda, etiquetaPrincipal: principal.label, principal: puntos, comparativas: otras.map(b => ({etiqueta: b.label, puntos: aPuntos(b)})), resaltado, motivoResaltado: motivo, exponente: exp};
}

function titularCfo(report, moneda, kpis, idioma) {
  const x = T(idioma);
  const rev = kpis.find(k => k.id.startsWith('rev:')), ped = kpis.find(k => k.id.startsWith('orders:'));
  const mes = report.lastComplete ? mesLargo(report.lastComplete, idioma) : null;
  if (!mes || !rev) return {texto: x.sinMes, kind: 'observed', periodo: null, fuente: x.libro, moneda};
  const cambio = rev.delta && rev.delta.bps != null ? x.contra(rev.delta.display, mesLargo(report.prevComplete, idioma)) : '';
  return {texto: x.titular(mes, rev.display, ped?.display, cambio), kind: rev.kind, periodo: mes, fuente: x.libro, moneda};
}

function siguientesPreguntas(report, moneda, caida, idioma) {
  const x = T(idioma), p = [], mes = report.lastComplete ? mesLargo(report.lastComplete, idioma) : null;
  const cai = !!caida, mom = report.kpis.find(k => k.currency === moneda)?.metrics.find(m => m.id.startsWith('rev:'))?.delta;
  if ((cai || (mom?.bps != null && mom.bps < 0)) && mes) p.push({pregunta: x.qCayo(mes.split(' ')[0]), directa: {tool: 'comparativa_mes', args: {currency: moneda}}, motivo: x.mCayo});
  const alta = report.alerts.find(a => a.severity === 'alta');
  if (alta) p.push({pregunta: x.qAlerta, directa: {tool: 'alertas', args: {severity: 'alta'}}, motivo: alta.title});
  const sinImporte = report.quality.byChannel.filter(c => c.ordersNoAmount + c.refundsNoAmount > 0).sort((a, b) => (b.ordersNoAmount + b.refundsNoAmount) - (a.ordersNoAmount + a.refundsNoAmount))[0];
  if (sinImporte) p.push({pregunta: x.qCanal, directa: {tool: 'calidad_datos', args: {}}, motivo: x.mCanal(sinImporte.label)});
  if (report.projections.some(x => x.currency === moneda)) p.push({pregunta: x.qProy(moneda), directa: {tool: 'proyeccion', args: {currency: moneda}}, motivo: x.mProy});
  if (report.exposure?.state === 'sin_atestar') p.push({pregunta: x.qExpo, directa: {tool: 'exposicion_problemas', args: {}}, motivo: x.mExpo});
  return p.slice(0, 4);
}

/** @returns el briefing completo de una moneda. `report` es CfoReport (serializado). */
export function briefingCfo(report, monedaPedida, idioma) {
  const x = T(idioma), moneda = monedaElegida(report, monedaPedida);
  if (!report || !moneda) return null;
  const kpis = kpisDe(report, moneda), caida = explicarVariacion(report, moneda, {idioma});
  const alertas = report.alerts.filter(a => a.severity !== 'info').sort((a, b) => ORDEN[a.severity] - ORDEN[b.severity]);
  const parcial = report.partialMonths?.length ? x.incompleto(report.partialMonths.map(monthLabel).join(', ')) : null;
  const calidad = report.quality;
  const costo = calidad.unaccounted.filter(u => u.currency === moneda).flatMap(u => [{id: u.orderFig.id, label: u.orderFig.label, display: u.orderFig.display, how: u.orderFig.how}, {id: u.refundFig.id, label: x.reembNoContab + ' · ' + moneda, display: u.refundFig.display, how: u.refundFig.how}]);
  const proy = report.projections.filter(p => p.currency === moneda && p.metric === 'ingresos')[0] ?? null;
  const sinCoberturaCompleta = calidad.byChannel.filter(c => (c.completenessBps ?? 0) < 10000).length;
  return {
    moneda, monedas: report.currencies, vacio: false,
    titular: titularCfo(report, moneda, kpis, idioma), parcial, corte: report.watermark,
    kpis, mesDelResumen: report.lastComplete ? monthLabel(report.lastComplete) : null,
    avisoMonedas: x.avisoMonedas,
    alertas: alertas.slice(0, 3).map(a => ({id: a.id, severidad: x.sev[a.severity], severity: a.severity, titulo: a.title, detalle: a.detail, kind: a.kind, how: a.how, cta: a.cta})), alertasActivas: alertas.length,
    serie: serieIngresos(report, moneda, idioma),
    canales: report.mix.orders.map(o => ({canal: o.channel, label: o.label, n: o.n, shareBps: o.shareBps})),
    calidad: {filas: calidad.totalRows, cifras: ['noCurrency', 'ordersNoAmount', 'refundsNoAmount'].map(k => calidad.figs[k]).filter(Boolean).map(f => ({id: f.id, label: f.label, display: f.display, kind: f.kind, how: f.how})), costo, canalesIncompletos: sinCoberturaCompleta, canalMenosCompleto: [...calidad.byChannel].sort((a, b) => (a.completenessBps ?? 0) - (b.completenessBps ?? 0))[0] ?? null},
    proyeccion: proy && {id: proy.id, label: proy.label, kind: 'estimated', metodo: proy.method, puntos: proy.points.map(p => ({month: p.month, mes: monthLabel(p.month), medio: p.midDisplay, rango: `${p.lowDisplay} a ${p.highDisplay}`}))},
    caida,
    siguientes: siguientesPreguntas(report, moneda, caida, idioma),
  };
}
