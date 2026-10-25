// Briefing de CFO: convierte el informe ya calculado (/cfo/data/report) en el bloque que abre el copiloto. PURO: no llama a ningún modelo ni al servidor,
// solo reordena cifras que ya traen su clase (Observado / Estimado / Inferido), su cobertura y su fuente. Nunca suma monedas ni bases distintas.
import {explicarVariacion} from '../../lib/legibilidad/caida.mjs';
import {monthLabel} from '../../../../../packages/cfo-copilot/src/format.mjs';

const SEVERIDAD = {alta: 'Alta', media: 'Media', baja: 'Baja', info: 'Informativa'};
const ORDEN = {alta: 0, media: 1, baja: 2, info: 3};
export const mesLargo = key => /^\d{4}-\d{2}$/.test(key ?? '') ? new Intl.DateTimeFormat('es-MX', {month: 'long', year: 'numeric', timeZone: 'UTC'}).format(new Date(key + '-01T00:00:00Z')).replace(' de ', ' de ') : String(key ?? '');
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
export function serieIngresos(report, moneda) {
  const bloque = report.perCurrency.find(c => c.currency === moneda);
  if (!bloque) return null;
  const exp = bloque.exponent ?? 2;
  const aPuntos = base => base.series.map(s => ({month: s.month, partial: !!s.partial, value: s.known > 0 ? Number(BigInt(s.amount)) / 10 ** exp : null, display: s.amountDisplay, detail: `${s.known} de ${s.n} pedidos con importe`}));
  const [principal, ...otras] = bloque.orderBases;
  const puntos = aPuntos(principal);
  // Resaltado: la mayor caída entre dos meses completos consecutivos; si no hay, el último mes completo.
  let resaltado = null, peor = 0;
  for (let i = 1; i < puntos.length; i++) { const a = puntos[i - 1], b = puntos[i]; if (a.partial || b.partial || a.value == null || b.value == null || a.value <= 0) continue; const d = (b.value - a.value) / a.value; if (d < peor) { peor = d; resaltado = b.month; } }
  const motivo = resaltado && peor <= -0.1 ? 'caida' : 'ultimo';
  if (motivo === 'ultimo') resaltado = report.lastComplete;
  return {moneda, etiquetaPrincipal: principal.label, principal: puntos, comparativas: otras.map(b => ({etiqueta: b.label, puntos: aPuntos(b)})), resaltado, motivoResaltado: motivo, exponente: exp};
}

function titularCfo(report, moneda, kpis) {
  const rev = kpis.find(k => k.id.startsWith('rev:')), ped = kpis.find(k => k.id.startsWith('orders:'));
  const mes = report.lastComplete ? mesLargo(report.lastComplete) : null;
  if (!mes || !rev) return {texto: 'Todavía no hay un mes completo para resumir tu dinero.', kind: 'observed', periodo: null, fuente: 'Libro económico de tu organización', moneda};
  const cambio = rev.delta && rev.delta.bps != null ? ` (${rev.delta.display} contra ${mesLargo(report.prevComplete)})` : '';
  return {texto: `En ${mes}: ${rev.display} de ingresos${ped ? ' y ' + ped.display + ' pedidos' : ''}${cambio}.`, kind: rev.kind, periodo: mes, fuente: 'Libro económico de tu organización', moneda};
}

function siguientesPreguntas(report, moneda, caida) {
  const p = [], mes = report.lastComplete ? mesLargo(report.lastComplete) : null;
  const cai = !!caida, mom = report.kpis.find(k => k.currency === moneda)?.metrics.find(m => m.id.startsWith('rev:'))?.delta;
  if ((cai || (mom?.bps != null && mom.bps < 0)) && mes) p.push({pregunta: `¿Por qué cayó ${mes.split(' ')[0]}?`, directa: {tool: 'comparativa_mes', args: {currency: moneda}}, motivo: 'Los ingresos o los pedidos bajaron contra el mes anterior.'});
  const alta = report.alerts.find(a => a.severity === 'alta');
  if (alta) p.push({pregunta: '¿Qué alerta debo atender primero?', directa: {tool: 'alertas', args: {severity: 'alta'}}, motivo: alta.title});
  const sinImporte = report.quality.byChannel.filter(c => c.ordersNoAmount + c.refundsNoAmount > 0).sort((a, b) => (b.ordersNoAmount + b.refundsNoAmount) - (a.ordersNoAmount + a.refundsNoAmount))[0];
  if (sinImporte) p.push({pregunta: '¿Qué canal sin importes pesa más?', directa: {tool: 'calidad_datos', args: {}}, motivo: `${sinImporte.label} tiene registros sin importe.`});
  if (report.projections.some(x => x.currency === moneda)) p.push({pregunta: `¿Cómo se ve ${moneda} los próximos 3 meses?`, directa: {tool: 'proyeccion', args: {currency: moneda}}, motivo: 'Hay una proyección Estimada con sus supuestos.'});
  if (report.exposure?.state === 'sin_atestar') p.push({pregunta: '¿Qué problemas exponen más ingresos?', directa: {tool: 'exposicion_problemas', args: {}}, motivo: 'Faltan vínculos entre problemas y pedidos.'});
  return p.slice(0, 4);
}

/** @returns el briefing completo de una moneda. `report` es CfoReport (serializado). */
export function briefingCfo(report, monedaPedida) {
  const moneda = monedaElegida(report, monedaPedida);
  if (!report || !moneda) return null;
  const kpis = kpisDe(report, moneda), caida = explicarVariacion(report, moneda);
  const alertas = report.alerts.filter(a => a.severity !== 'info').sort((a, b) => ORDEN[a.severity] - ORDEN[b.severity]);
  const parcial = report.partialMonths?.length ? `${report.partialMonths.map(monthLabel).join(', ')} está incompleto: no se compara con meses completos.` : null;
  const calidad = report.quality;
  const costo = calidad.unaccounted.filter(u => u.currency === moneda).flatMap(u => [{id: u.orderFig.id, label: u.orderFig.label, display: u.orderFig.display, how: u.orderFig.how}, {id: u.refundFig.id, label: 'Reembolsos no contabilizados · ' + moneda, display: u.refundFig.display, how: u.refundFig.how}]);
  const proy = report.projections.filter(p => p.currency === moneda && p.metric === 'ingresos')[0] ?? null;
  const sinCoberturaCompleta = calidad.byChannel.filter(c => (c.completenessBps ?? 0) < 10000).length;
  return {
    moneda, monedas: report.currencies, vacio: false,
    titular: titularCfo(report, moneda, kpis), parcial, corte: report.watermark,
    kpis, mesDelResumen: report.lastComplete ? monthLabel(report.lastComplete) : null,
    avisoMonedas: 'USD, CAD y MXN no se suman ni se convierten: no hay tipos de cambio aprobados. Cada moneda se muestra aparte.',
    alertas: alertas.slice(0, 3).map(a => ({id: a.id, severidad: SEVERIDAD[a.severity], severity: a.severity, titulo: a.title, detalle: a.detail, kind: a.kind, how: a.how, cta: a.cta})), alertasActivas: alertas.length,
    serie: serieIngresos(report, moneda),
    canales: report.mix.orders.map(o => ({canal: o.channel, label: o.label, n: o.n, shareBps: o.shareBps})),
    calidad: {filas: calidad.totalRows, cifras: ['noCurrency', 'ordersNoAmount', 'refundsNoAmount'].map(k => calidad.figs[k]).filter(Boolean).map(f => ({id: f.id, label: f.label, display: f.display, kind: f.kind, how: f.how})), costo, canalesIncompletos: sinCoberturaCompleta, canalMenosCompleto: [...calidad.byChannel].sort((a, b) => (a.completenessBps ?? 0) - (b.completenessBps ?? 0))[0] ?? null},
    proyeccion: proy && {id: proy.id, label: proy.label, kind: 'estimated', metodo: proy.method, puntos: proy.points.map(p => ({month: p.month, mes: monthLabel(p.month), medio: p.midDisplay, rango: `${p.lowDisplay} a ${p.highDisplay}`}))},
    caida,
    siguientes: siguientesPreguntas(report, moneda, caida),
  };
}
