// Modelo CFO PURO: de filas agregadas del ledger (por mes · canal · tipo · estado · moneda · base) a todo lo que muestra /cfo.
// Reglas inviolables (también verificadas en tests):
//  1. USD / CAD / MXN nunca se suman ni se convierten (la tabla de versiones de tipo de cambio está vacía): todo se agrupa por moneda.
//  2. Las bases del ledger no se mezclan: marketplace_line_price, marketplace_refund_amount y gross_order_including_tax_shipping
//     son magnitudes distintas. No se resta reembolso de ingreso ni se suma Shopify a marketplaces.
//  3. Cada cifra lleva clase (Observado / Estimado / Inferido), cobertura y «cómo se calculó».
//  4. Un importe desconocido es «No disponible», nunca 0; una moneda desconocida (XXX) no se adivina.
import {money, int, pct, signedPct, signedPp, monthLabel, divRound, ratioBps, changeBps, baseOf, toReviewBasis} from './format.mjs';
import {BASIS, CHANNELS} from './fixtures.mjs';

export const UNKNOWN_CURRENCY = 'XXX';
export const BASIS_LABEL = Object.freeze({
  [BASIS.line]: 'Precio de línea de marketplace',
  [BASIS.shopify]: 'Bruto con impuestos y envío (Shopify)',
  [BASIS.refund]: 'Importe reembolsado de marketplace',
});
/** Enlace a /economics CON alcance (moneda y rango de meses completos analizados): sin él la página de operador abre sin contexto. */
export const economicsHref = (currency, firstMonth, lastMonth) => {
  const next = ym => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10); };
  return `/economics?currency=${encodeURIComponent(currency)}&date_start=${firstMonth}-01&date_end=${next(lastMonth)}`;
};
export const bigintReplacer = (k, v) => (typeof v === 'bigint' ? v.toString() : v);
/** Copia serializable (BigInt -> cadena) que viaja al navegador. */
export const serializeReport = report => JSON.parse(JSON.stringify(report, bigintReplacer));
export const channelLabel = key => CHANNELS[key]?.label ?? key;
const big = v => BigInt(v ?? 0);
const sumBig = (list, f) => list.reduce((a, x) => a + big(f(x)), 0n);
const sumNum = (list, f) => list.reduce((a, x) => a + Number(f(x) ?? 0), 0);

/** Cifra con su clase, cobertura y método. `display` es lo ÚNICO que ven la pantalla, el CSV y el PDF. */
export function fig(id, label, display, {kind = 'observed', known = null, eligible = null, how, value = null, unit = null, scope = null} = {}) {
  const coverage = eligible === null ? {known: null, eligible: null, bps: null, label: 'Cobertura no aplica'} : {known, eligible, bps: ratioBps(known, eligible), label: eligible === 0 ? 'Sin registros elegibles' : `${int(known)} de ${int(eligible)} registros con importe`};
  return {id, label, display, kind, coverage, how, value, unit, scope};
}

function monthEnd(key) { const [y, m] = key.split('-').map(Number); return Date.UTC(y, m, 1); }
export function classifyMonths(months, watermark) {
  const wm = watermark ? Date.parse(watermark) : null;
  const partial = new Set(wm === null ? [] : months.filter(m => wm < monthEnd(m) - 86400000));
  return {partial, complete: months.filter(m => !partial.has(m))};
}

function normalise(rows) {
  const used = [], toReview = [];
  const sorted = [...rows].sort((a, b) => (a.month + '|' + a.channel + '|' + a.kind + '|' + a.status + '|' + a.currency + '|' + a.basis).localeCompare(b.month + '|' + b.channel + '|' + b.kind + '|' + b.status + '|' + b.currency + '|' + b.basis)); // determinista: no depende del orden de la consulta
  for (const r of sorted) (toReviewBasis(r.basis) ? toReview : used).push({...r, base: baseOf(r.basis), n: Number(r.n), known: Number(r.known)});
  return {used, toReview};
}
const isOrderOk = r => r.kind === 'order' && r.status === 'recorded';
const isRefundOk = r => r.kind === 'refund' && r.status === 'settled';

function cell(list) { return {n: sumNum(list, r => r.n), known: sumNum(list, r => r.known), amount: sumBig(list, r => r.amountMinor)}; }
const ticket = c => (c.known > 0 ? divRound(c.amount, c.known) : null);

export function buildCfoReport(input, options = {}) {
  const {watermark = null, exposure = {attestedLinks: 0, rows: [], coverageComplete: false}, now = new Date(), complete = true} = options;
  const {used, toReview} = normalise(input);
  const months = [...new Set(used.map(r => r.month))].sort();
  const {partial, complete: completeMonths} = classifyMonths(months, watermark);
  const lastComplete = completeMonths.at(-1) ?? null, prevComplete = completeMonths.at(-2) ?? null;
  const channels = [...new Set(used.map(r => r.channel))];
  const refundChannels = new Set(used.filter(r => r.kind === 'refund' && r.n > 0).map(r => r.channel));
  const currencies = [...new Set(used.filter(r => r.currency !== UNKNOWN_CURRENCY).map(r => r.currency))]
    .sort((a, b) => sumNum(used.filter(r => r.currency === b && isOrderOk(r)), r => r.n) - sumNum(used.filter(r => r.currency === a && isOrderOk(r)), r => r.n) || a.localeCompare(b));
  const exponentOf = c => used.find(r => r.currency === c)?.exponent ?? 2;

  const perCurrency = currencies.map(currency => {
    const exponent = exponentOf(currency), m$ = v => money(v, currency, exponent);
    const mine = used.filter(r => r.currency === currency);
    const bases = [...new Set(mine.filter(isOrderOk).map(r => r.base))].sort((a, b) => (a === BASIS.line ? -1 : b === BASIS.line ? 1 : a.localeCompare(b)));
    const orderBases = bases.map(base => {
      const rowsB = mine.filter(r => isOrderOk(r) && r.base === base);
      const series = months.map(month => { const c = cell(rowsB.filter(r => r.month === month)); return {month, partial: partial.has(month), ...c, ticket: ticket(c), amountDisplay: c.known > 0 ? m$(c.amount.toString()) : 'No disponible', ticketDisplay: c.known > 0 ? m$(ticket(c).toString()) : 'No disponible'}; });
      const total = cell(rowsB);
      const chans = [...new Set(rowsB.map(r => r.channel))].map(channel => { const c = cell(rowsB.filter(r => r.channel === channel)); return {channel, label: channelLabel(channel), ...c, ticket: ticket(c), shareBps: total.amount > 0n ? Number(c.amount * 10000n * 2n + total.amount) / Number(total.amount * 2n) | 0 : null}; }).sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : b.n - a.n));
      // Serie mensual por canal (misma moneda y base): permite decir qué canal explica un cambio entre meses sin atribuir causas.
      const channelSeries = chans.map(c => ({channel: c.channel, label: c.label, series: months.map(month => { const x = cell(rowsB.filter(r => r.channel === c.channel && r.month === month)); return {month, n: x.n, known: x.known, amount: x.amount}; })}));
      return {base, label: BASIS_LABEL[base] ?? base, additive: true, series, total, ticket: ticket(total), channels: chans, channelSeries};
    });
    const refRows = mine.filter(isRefundOk);
    const refundSeries = months.map(month => { const c = cell(refRows.filter(r => r.month === month)); return {month, partial: partial.has(month), ...c, amountDisplay: c.known > 0 ? m$(c.amount.toString()) : 'No disponible'}; });
    const refundTotal = cell(refRows);
    const refundChannels2 = [...new Set(refRows.map(r => r.channel))].map(channel => { const c = cell(refRows.filter(r => r.channel === channel)); const ord = cell(mine.filter(r => isOrderOk(r) && r.channel === channel)); return {channel, label: channelLabel(channel), ...c, orders: ord.n, rateBps: ratioBps(c.n, ord.n)}; });
    // tasa de reembolso por CONTEO, solo con canales que tienen fuente de devoluciones (si no, quedaría subestimada)
    const inRate = new Set([...refundChannels].filter(ch => mine.some(r => r.channel === ch && isOrderOk(r))));
    const hasRefunds = refRows.length > 0; // sin ninguna fila de reembolso en la moneda, la tasa no es 0: no se puede medir
    const rateSeries = months.map(month => { const o = cell(mine.filter(r => isOrderOk(r) && inRate.has(r.channel) && r.month === month)), f = cell(refRows.filter(r => inRate.has(r.channel) && r.month === month)); return {month, partial: partial.has(month), orders: o.n, refunds: f.n, bps: hasRefunds ? ratioBps(f.n, o.n) : null, display: hasRefunds ? pct(ratioBps(f.n, o.n)) : 'No disponible'}; });
    const rateTotal = (() => { const o = cell(mine.filter(r => isOrderOk(r) && inRate.has(r.channel))), f = cell(refRows.filter(r => inRate.has(r.channel))); return {orders: o.n, refunds: f.n, bps: hasRefunds ? ratioBps(f.n, o.n) : null}; })();
    const ordersAll = months.map(month => ({month, partial: partial.has(month), n: sumNum(mine.filter(r => isOrderOk(r) && r.month === month), r => r.n)}));
    const pcOut = {currency, exponent, orderBases, refunds: {base: BASIS.refund, label: BASIS_LABEL[BASIS.refund], series: refundSeries, total: refundTotal, channels: refundChannels2}, rate: {series: rateSeries, total: rateTotal, channels: [...inRate].map(channelLabel), excluded: channels.filter(ch => !inRate.has(ch) && mine.some(r => r.channel === ch && isOrderOk(r))).map(channelLabel)}, ordersAll};
    Object.defineProperty(pcOut, 'm$', {value: m$, enumerable: false}); // no viaja al cliente
    return pcOut;
  });

  // ---- KPIs del último mes completo contra el anterior (por moneda) ----
  const kpis = perCurrency.map(pc => ({currency: pc.currency, month: lastComplete, metrics: metricsFor(pc, lastComplete, prevComplete)}));

  // ---- Mezcla por canal ----
  const orderTotals = channels.map(channel => { const c = cell(used.filter(r => isOrderOk(r) && r.channel === channel)); return {channel, label: channelLabel(channel), n: c.n}; }).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
  const orderN = sumNum(orderTotals, x => x.n);
  const mix = {
    orders: orderTotals.map(x => ({...x, shareBps: ratioBps(x.n, orderN), family: CHANNELS[x.channel]?.family ?? 'otro'})),
    ordersFig: fig('mix:orders', 'Mezcla de pedidos por canal', int(orderN) + ' pedidos', {scope: '12 meses · pedidos registrados', how: 'Participación = pedidos registrados del canal ÷ pedidos registrados totales. Es un conteo: no depende de moneda ni de base.', value: orderN}),
    byCurrency: perCurrency.flatMap(pc => pc.orderBases.map(b => ({currency: pc.currency, base: b.base, baseLabel: b.label, items: b.channels.map(c => ({channel: c.channel, label: c.label, display: pc.m$(c.amount.toString()), shareBps: c.shareBps})), total: pc.m$(b.total.amount.toString())}))),
  };

  // ---- Calidad de datos ----
  const allRows = used.concat(toReview);
  const totalRows = sumNum(allRows, r => r.n);
  const noCurrency = sumNum(used.filter(r => r.currency === UNKNOWN_CURRENCY), r => r.n);
  const ordersKnownCur = used.filter(r => isOrderOk(r) && r.currency !== UNKNOWN_CURRENCY), refundsKnownCur = used.filter(r => r.kind === 'refund' && r.currency !== UNKNOWN_CURRENCY);
  const ordersNoAmount = sumNum(ordersKnownCur, r => r.n - r.known), refundsNoAmount = sumNum(refundsKnownCur, r => r.n - r.known);
  const nonRecorded = {cancelled: sumNum(used.filter(r => r.kind === 'order' && r.status === 'cancelled'), r => r.n), pending: sumNum(used.filter(r => r.kind === 'order' && r.status === 'pending'), r => r.n), unknown: sumNum(used.filter(r => r.status === 'unknown' || r.status === 'pending' && r.kind === 'refund'), r => r.n)};
  const byChannel = channels.map(channel => {
    const rs = used.filter(r => r.channel === channel), rows = sumNum(rs, r => r.n);
    const nc = sumNum(rs.filter(r => r.currency === UNKNOWN_CURRENCY), r => r.n), oa = sumNum(rs.filter(r => isOrderOk(r) && r.currency !== UNKNOWN_CURRENCY), r => r.n - r.known), ra = sumNum(rs.filter(r => r.kind === 'refund' && r.currency !== UNKNOWN_CURRENCY), r => r.n - r.known);
    return {channel, label: channelLabel(channel), rows, noCurrency: nc, ordersNoAmount: oa, refundsNoAmount: ra, completenessBps: ratioBps(rows - nc - oa - ra, rows), hasRefundSource: refundChannels.has(channel)};
  }).sort((a, b) => b.rows - a.rows);
  const unaccounted = perCurrency.map(pc => {
    const line = pc.orderBases.find(b => b.base === BASIS.line);
    let order = 0n, orderRows = 0;
    for (const ch of line?.channels ?? []) {
      const miss = sumNum(used.filter(r => isOrderOk(r) && r.currency === pc.currency && r.channel === ch.channel && r.base === BASIS.line), r => r.n - r.known);
      if (miss > 0 && ch.known > 0) { order += BigInt(miss) * (ticket(ch) ?? 0n); orderRows += miss; }
    }
    let refund = 0n, refundRows = 0;
    for (const ch of pc.refunds.channels) {
      const miss = ch.n - ch.known;
      if (miss > 0 && ch.known > 0) { refund += BigInt(miss) * (ticket(ch) ?? 0n); refundRows += miss; }
    }
    return {currency: pc.currency, exponent: pc.exponent, orderRows, refundRows, orderMinor: order.toString(), refundMinor: refund.toString(),
      orderFig: fig(`poorq:order:${pc.currency}`, `Ingresos no contabilizados · ${pc.currency}`, orderRows ? '≈ ' + pc.m$(order.toString()) : 'Sin pedidos sin importe', {kind: 'estimated', scope: '12 meses · pedidos registrados sin importe', how: 'Estimado: pedidos registrados sin importe × ticket promedio conocido del MISMO canal y moneda. No se agrega a los ingresos observados.', value: order.toString(), unit: currency2(pc)}),
      refundFig: fig(`poorq:refund:${pc.currency}`, `Reembolsos no contabilizados · ${pc.currency}`, refundRows ? '≈ ' + pc.m$(refund.toString()) : 'Sin reembolsos sin importe', {kind: 'estimated', scope: '12 meses · reembolsos sin importe', how: 'Estimado: reembolsos sin importe × reembolso promedio conocido del MISMO canal y moneda.', value: refund.toString(), unit: currency2(pc)})};
  });
  const quality = {
    totalRows,
    figs: {
      rows: fig('q:rows', 'Registros del libro económico', int(totalRows), {scope: 'ventana completa', how: 'Última revisión de cada entidad (pedidos y reembolsos), incluidos los apartados «a revisar».', value: totalRows}),
      noCurrency: fig('q:nocur', 'Filas sin moneda (diferidas)', int(noCurrency), {known: totalRows - noCurrency, eligible: totalRows, scope: `${pct(ratioBps(noCurrency, totalRows))} de los registros del libro`, how: 'Filas con moneda desconocida (código XXX). No se suman ni se convierten ni se les adivina moneda; quedan fuera de todos los importes.', value: noCurrency}),
      ordersNoAmount: fig('q:noamt-o', 'Pedidos sin importe', ordersNoAmount === 0 ? 'Ninguno (0)' : int(ordersNoAmount), {known: sumNum(ordersKnownCur, r => r.known), eligible: sumNum(ordersKnownCur, r => r.n), scope: ordersNoAmount === 0 ? `Todos los ${int(sumNum(ordersKnownCur, r => r.n))} pedidos registrados con moneda tienen importe` : 'pedidos registrados con moneda', how: 'Pedidos registrados con moneda conocida y importe nulo. Nunca se cuentan como 0.', value: ordersNoAmount}),
      refundsNoAmount: fig('q:noamt-r', 'Reembolsos sin importe', refundsNoAmount === 0 ? 'Ninguno (0)' : int(refundsNoAmount), {known: sumNum(refundsKnownCur, r => r.known), eligible: sumNum(refundsKnownCur, r => r.n), scope: 'reembolsos con moneda', how: 'Reembolsos con importe nulo en la fuente (cualquier estado).', value: refundsNoAmount}),
      toReview: fig('q:review', 'Duplicados «a revisar» (fuera de totales)', int(sumNum(toReview, r => r.n)), {scope: 'apartados sin identificador de línea', how: 'Copias excedentes marcadas «a_revisar» al cargar; se conservan pero no entran a ningún total.', value: sumNum(toReview, r => r.n)}),
    },
    nonRecorded, byChannel, unaccounted,
    notEstimable: {rows: noCurrency, reason: 'Sin moneda no se puede asignar un importe ni compararlo: se cuentan, no se valoran.'},
  };

  // ---- Proyecciones (Estimado, método explícito) ----
  const projections = perCurrency.flatMap(pc => {
    const line = pc.orderBases.find(b => b.base === BASIS.line);
    const horizon = 3, window = completeMonths.slice(-6);
    if (!line || window.length < 4) return [];
    const out = [];
    for (const [metric, pick, show] of [['ingresos', s => Number(s.amount) / Math.pow(10, pc.exponent), v => pc.m$(String(Math.round(v * Math.pow(10, pc.exponent))))], ['pedidos', s => s.n, v => int(Math.round(v))]]) {
      const ys = window.map(m => pick(line.series.find(s => s.month === m))), xs = window.map((_, i) => i);
      const fit = ols(xs, ys);
      if (!fit) continue;
      const points = [];
      const [ly, lm] = lastComplete.split('-').map(Number);
      for (let k = 1; k <= horizon; k++) {
        const d = new Date(Date.UTC(ly, lm - 1 + k, 1)), key = d.toISOString().slice(0, 7), x = window.length - 1 + k, mid = fit.a + fit.b * x;
        points.push({month: key, mid: Math.max(0, mid), low: Math.max(0, mid - fit.sigma), high: Math.max(0, mid + fit.sigma), midDisplay: '≈ ' + show(Math.max(0, mid)), lowDisplay: show(Math.max(0, mid - fit.sigma)), highDisplay: show(Math.max(0, mid + fit.sigma))});
      }
      out.push({id: `proj:${metric}:${pc.currency}`, currency: pc.currency, metric, kind: 'estimated', window, points, sigma: fit.sigma, slope: fit.b,
        method: `Tendencia lineal (mínimos cuadrados) sobre los últimos ${window.length} meses completos (${monthLabel(window[0])} a ${monthLabel(window.at(-1))}). Sin estacionalidad ni efecto de campañas. Rango = ±1 desviación estándar de los residuos. No es un pronóstico calibrado.`,
        label: metric === 'ingresos' ? `Ingresos proyectados · ${pc.currency}` : `Pedidos proyectados · ${pc.currency}`});
    }
    return out;
  });

  // ---- Alertas ----
  const alerts = [];
  for (const pc of perCurrency) {
    // reembolsos anómalos por canal
    for (const ch of pc.refunds.channels) {
      const hist = completeMonths.map(m => ({m, o: sumNum(used.filter(r => isOrderOk(r) && r.currency === pc.currency && r.channel === ch.channel && r.month === m), r => r.n), f: sumNum(used.filter(r => isRefundOk(r) && r.currency === pc.currency && r.channel === ch.channel && r.month === m), r => r.n)})).filter(x => x.o > 0);
      if (hist.length < 5) continue;
      const last = hist.at(-1), prior = hist.slice(0, -1), rates = prior.map(x => x.f / x.o), mean = rates.reduce((a, b) => a + b, 0) / rates.length, sd = Math.sqrt(rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length), rate = last.f / last.o;
      if (last.f >= 30 && sd > 0 && (rate - mean) / sd >= 2) alerts.push({id: `refund-anomaly:${ch.channel}:${pc.currency}`, severity: (rate - mean) / sd >= 3 ? 'alta' : 'media', title: `Reembolsos anómalos · ${ch.label} (${pc.currency})`, detail: `Tasa de ${monthLabel(last.m)}: ${pct(Math.round(rate * 10000))} frente a ${pct(Math.round(mean * 10000))} de promedio previo (${(rate - mean) / sd >= 10 ? 'más de 10' : ((rate - mean) / sd).toFixed(1)} desviaciones).`, kind: 'observed', how: `Se compara la tasa por conteo del último mes completo con la media y desviación de los ${prior.length} meses completos anteriores del mismo canal y moneda. Alerta si supera 2 desviaciones y hay al menos 30 reembolsos.`, cta: {label: 'Ver reembolsos del canal', href: economicsHref(pc.currency, prior[0]?.m ?? last.m, last.m)}});
    }
    // caída de pedidos
    const oa = pc.ordersAll.filter(x => completeMonths.includes(x.month));
    if (oa.length >= 4) {
      const last = oa.at(-1), prev3 = oa.slice(-4, -1), mean = prev3.reduce((a, x) => a + x.n, 0) / 3;
      if (mean >= 100) { const change = Math.round(((last.n - mean) / mean) * 10000); if (change <= -2000) alerts.push({id: `orders-drop:${pc.currency}`, severity: change <= -3500 ? 'alta' : 'media', title: `Caída de pedidos · ${pc.currency}`, detail: `${monthLabel(last.month)}: ${int(last.n)} pedidos, ${signedPct(change)} frente al promedio de los 3 meses anteriores (${int(Math.round(mean))}).`, kind: 'observed', how: 'Pedidos registrados del último mes completo contra la media de los 3 meses completos previos, misma moneda, todos los canales. Alerta si cae 20 % o más (35 % o más = alta).', cta: {label: 'Ver mezcla por canal', href: '#mezcla'}}); }
    }
  }
  const ncBps = ratioBps(noCurrency, totalRows);
  if (ncBps !== null && ncBps >= 100) alerts.push({id: 'quality:no-currency', severity: 'media', title: 'Filas sin moneda diferidas', detail: `${int(noCurrency)} registros del libro (${pct(ncBps)}) no tienen moneda y quedan fuera de todos los importes.`, kind: 'observed', how: 'Registros del libro con moneda XXX ÷ registros totales. Alerta desde 1 %.', cta: {label: 'Ver calidad de datos', href: '#calidad'}});
  const rnBps = ratioBps(refundsNoAmount, sumNum(refundsKnownCur, r => r.n));
  if (rnBps !== null && rnBps >= 500) alerts.push({id: 'quality:refund-no-amount', severity: 'media', title: 'Reembolsos sin importe', detail: `${int(refundsNoAmount)} reembolsos (${pct(rnBps)}) no traen importe: la cifra de reembolsos es un piso.`, kind: 'observed', how: 'Reembolsos con moneda sin importe ÷ reembolsos con moneda. Alerta desde 5 %.', cta: {label: 'Ver calidad de datos', href: '#calidad'}});
  const gap = channels.filter(ch => !refundChannels.has(ch));
  if (gap.length) alerts.push({id: 'coverage:refund-source', severity: 'baja', title: 'Canales sin fuente de devoluciones', detail: `${gap.map(channelLabel).join(', ')} no tienen reembolsos cargados: la tasa global no los incluye.`, kind: 'observed', how: 'Canales con pedidos y sin ninguna fila de reembolso en la ventana.', cta: {label: 'Ver cobertura de fuentes', href: '/imports'}});
  const partialList = [...partial];
  if (partialList.length) alerts.push({id: 'period:partial', severity: 'info', title: `Mes en curso incompleto: ${partialList.map(monthLabel).join(', ')}`, detail: `Los datos llegan hasta ${watermark?.slice(0, 10)}. Las comparativas usan el último mes COMPLETO (${lastComplete ? monthLabel(lastComplete) : 'ninguno'}).`, kind: 'observed', how: 'Un mes es parcial si el corte de la fuente es anterior a su penúltimo día.', cta: null});
  const order = {alta: 0, media: 1, baja: 2, info: 3};
  alerts.sort((a, b) => order[a.severity] - order[b.severity] || a.id.localeCompare(b.id));

  // ---- Exposición económica (solo con vínculos atestados) ----
  const exposureView = exposure.attestedLinks > 0 && exposure.rows.length
    ? {state: 'ok', attestedLinks: exposure.attestedLinks, coverageComplete: !!exposure.coverageComplete, kind: 'inferred', additive: false,
        note: 'Los importes expuestos de problemas distintos pueden incluir los mismos pedidos: NO se suman. Exposición no es pérdida ni ahorro.',
        rows: [...exposure.rows].sort((a, b) => (big(b.exposedMinor) > big(a.exposedMinor) ? 1 : -1)).map(r => ({...r, ...fig(`exp:${r.problemId}`, r.title, money(r.exposedMinor, r.currency, r.exponent), {kind: 'inferred', known: r.knownOrders, eligible: r.linkedOrders, scope: `${int(r.linkedOrders)} pedidos vinculados`, how: 'Suma de importes de pedidos vinculados al problema con evidencia atestada por el propietario. Vínculo por evidencia, no causalidad.', value: r.exposedMinor, unit: r.currency})}))}
    : {state: 'sin_atestar', attestedLinks: 0, kind: 'inferred', message: 'Sin vínculos atestados entre problemas y pedidos: no se muestra ninguna exposición. Sin atestar no hay cifra, ni siquiera estimada.', cta: {label: 'Pedir al propietario que ateste vínculos', href: '/problems'}, rows: []};

  return {generatedAt: now.toISOString(), watermark, complete, months, partialMonths: partialList, completeMonths, lastComplete, prevComplete, currencies, channels: channels.map(c => ({channel: c, label: channelLabel(c), hasRefundSource: refundChannels.has(c)})), perCurrency, kpis, mix, quality, projections, alerts, exposure: exposureView, glossary: GLOSSARY, rule: 'USD, CAD y MXN no se suman ni se convierten: cada moneda se muestra aparte.'};
}
const currency2 = pc => pc.currency;

function metricsFor(pc, month, prevMonth) {
    const lastComplete = month, prevComplete = prevMonth;
    const line = pc.orderBases.find(b => b.base === BASIS.line) ?? pc.orderBases[0];
    const at = (series, m) => series.find(x => x.month === m);
    const cur = line && lastComplete ? at(line.series, lastComplete) : null, prev = line && prevComplete ? at(line.series, prevComplete) : null;
    const rCur = lastComplete ? at(pc.refunds.series, lastComplete) : null, rPrev = prevComplete ? at(pc.refunds.series, prevComplete) : null;
    const rateCur = lastComplete ? at(pc.rate.series, lastComplete) : null, ratePrev = prevComplete ? at(pc.rate.series, prevComplete) : null;
    const mo = lastComplete ? monthLabel(lastComplete) : 'sin mes completo';
    const delta = (c, p) => (c && p && p > 0n ? changeBps(c, p) : null);
    const metrics = [];
    if (line && cur) {
      metrics.push({...fig(`rev:${pc.currency}`, `Ingresos · ${pc.currency}`, pc.m$(cur.amount.toString()), {known: cur.known, eligible: cur.n, scope: `${mo} · ${line.label}`, how: `Suma de los pedidos «registrados» del mes con importe conocido, moneda ${pc.currency} y base «${line.label}». Pedidos sin importe no se estiman aquí (ver Calidad de datos).`, value: cur.amount.toString(), unit: pc.currency}), delta: prev ? {bps: delta(cur.amount, prev.amount), display: signedPct(delta(cur.amount, prev.amount)), vs: monthLabel(prevComplete)} : null});
      metrics.push({...fig(`orders:${pc.currency}`, `Pedidos · ${pc.currency}`, int(cur.n), {scope: `${mo} · pedidos registrados`, how: 'Conteo de pedidos con estado «registrado» en la moneda, todos los canales; excluye cancelados, pendientes y desconocidos.', value: cur.n}), delta: prev ? {bps: changeBps(BigInt(cur.n), BigInt(prev.n)), display: signedPct(changeBps(BigInt(cur.n), BigInt(prev.n))), vs: monthLabel(prevComplete)} : null});
      const t = ticket(cur), tp = prev ? ticket(prev) : null;
      metrics.push({...fig(`ticket:${pc.currency}`, `Ticket promedio · ${pc.currency}`, t === null ? 'No disponible' : pc.m$(t.toString()), {known: cur.known, eligible: cur.n, scope: `${mo} · ${line.label}`, how: 'Ingresos del mes ÷ pedidos con importe conocido (redondeo a la unidad menor, mitad hacia arriba). No incluye pedidos sin importe.', value: t?.toString() ?? null, unit: pc.currency}), delta: t !== null && tp !== null ? {bps: changeBps(t, tp), display: signedPct(changeBps(t, tp)), vs: monthLabel(prevComplete)} : null});
    }
    if (rCur && pc.refunds.total.n > 0) metrics.push({...fig(`refund:${pc.currency}`, `Reembolsos · ${pc.currency}`, rCur.known > 0 ? pc.m$(rCur.amount.toString()) : 'No disponible', {known: rCur.known, eligible: rCur.n, scope: `${mo} · ${pc.refunds.label}`, how: `Suma de reembolsos «liquidados» del mes con importe conocido (base «${pc.refunds.label}»). No se resta de los ingresos: son bases distintas.`, value: rCur.amount.toString(), unit: pc.currency}), delta: rPrev && rPrev.known > 0 ? {bps: delta(rCur.amount, rPrev.amount), display: signedPct(delta(rCur.amount, rPrev.amount)), vs: monthLabel(prevComplete)} : null});
    if (rateCur && rateCur.bps !== null) metrics.push({...fig(`rate:${pc.currency}`, `Tasa de reembolso · ${pc.currency}`, pct(rateCur.bps), {scope: `${mo} · por conteo`, how: `Reembolsos liquidados ÷ pedidos registrados del mismo mes, solo en canales con fuente de devoluciones cargada (${pc.rate.channels.join(', ') || 'ninguno'}). Los reembolsos pueden corresponder a pedidos de meses anteriores.`, value: rateCur.bps, unit: 'bps'}), delta: ratePrev?.bps != null ? {bps: rateCur.bps - ratePrev.bps, display: signedPp(rateCur.bps - ratePrev.bps), vs: monthLabel(prevComplete), pp: true} : null});
    return metrics;
}


/** Cifras de un mes cualquiera (para el copiloto): el mes previo es el anterior de la serie. */
export function monthMetrics(report, currency, month) {
  const pc = report.perCurrency.find(c => c.currency === currency); if (!pc || !report.months.includes(month)) return null;
  const i = report.months.indexOf(month);
  return {partial: report.partialMonths.includes(month), metrics: metricsFor(pc, month, i > 0 ? report.months[i - 1] : null)};
}

function ols(xs, ys) {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0); if (sxx === 0) return null;
  const b = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx, a = my - b * mx;
  const sse = ys.reduce((s, y, i) => s + (y - (a + b * xs[i])) ** 2, 0), sigma = Math.sqrt(sse / Math.max(1, n - 2));
  return {a, b, sigma};
}

export const GLOSSARY = Object.freeze([
  {term: 'Observado', body: 'Cifra registrada en una fuente del libro económico (pedidos registrados, reembolsos liquidados). Se calcula sumando filas reales.'},
  {term: 'Estimado', body: 'Cifra calculada con un modelo (proyecciones, ingresos no contabilizados). Siempre lleva su método y nunca se mezcla con las observadas.'},
  {term: 'Inferido', body: 'Cifra obtenida vinculando registros con evidencia atestada (exposición por problema). No equivale a pérdida ni a ahorro y no es aditiva.'},
  {term: 'Cobertura', body: 'Cuántos registros tienen importe conocido frente a los elegibles. Un total con cobertura parcial es un piso, no el total.'},
  {term: 'Base económica', body: 'Qué mide un importe: precio de línea de marketplace, importe reembolsado o bruto de Shopify con impuestos y envío. Bases distintas no se suman ni se restan.'},
  {term: 'Moneda', body: 'USD, CAD y MXN se muestran por separado. No hay tipos de cambio aprobados (la tabla de versiones de tipo de cambio está vacía), así que no hay conversión.'},
  {term: 'Tasa de reembolso', body: 'Reembolsos liquidados ÷ pedidos registrados del mismo mes por conteo, solo en canales con fuente de devoluciones. No usa importes porque las bases difieren.'},
  {term: 'Ticket promedio', body: 'Ingresos ÷ pedidos con importe conocido, de la misma moneda y base.'},
  {term: 'Mes completo', body: 'Mes cuyos datos llegan hasta su final. Las comparativas mes contra mes solo usan meses completos.'},
  {term: 'Sin moneda (XXX)', body: 'Filas cuya moneda no se declaró en la fuente. Se cuentan pero no se valoran ni se les asigna moneda.'},
  {term: 'Exposición', body: 'Importe de pedidos vinculados a un problema con evidencia atestada por el propietario. Sin vínculos atestados no se muestra nada.'},
]);

/** Filas planas de TODA cifra mostrada: la pantalla, el CSV y el PDF leen exactamente esto (misma cifra). */
export function reportRows(report) {
  const rows = [];
  const push = (section, f, extra = {}) => rows.push({section, id: f.id, label: f.label, scope: f.scope ?? '', value: f.display, kind: f.kind, coverage: f.coverage.eligible === null ? '' : f.coverage.label, how: f.how, ...extra});
  for (const k of report.kpis) for (const m of k.metrics) { push('Resumen del último mes completo · ' + k.currency, m); if (m.delta) rows.push({section: 'Resumen del último mes completo · ' + k.currency, id: m.id + ':mom', label: m.label + ' · variación', scope: 'contra ' + m.delta.vs, value: m.delta.display, kind: 'observed', coverage: '', how: 'Variación del último mes completo contra el mes completo anterior.'}); }
  push('Mezcla por canal', report.mix.ordersFig);
  for (const o of report.mix.orders) rows.push({section: 'Mezcla por canal', id: 'mix:' + o.channel, label: o.label, scope: 'pedidos registrados', value: `${int(o.n)} (${pct(o.shareBps)})`, kind: 'observed', coverage: '', how: report.mix.ordersFig.how});
  for (const g of report.mix.byCurrency) for (const i of g.items) rows.push({section: 'Mezcla por canal · ' + g.currency + ' · ' + g.baseLabel, id: `mixamt:${g.currency}:${g.base}:${i.channel}`, label: i.label, scope: g.baseLabel, value: `${i.display} (${pct(i.shareBps)})`, kind: 'observed', coverage: '', how: 'Participación dentro de la misma moneda y la misma base; no se suma entre monedas ni bases.'});
  for (const f of Object.values(report.quality.figs)) push('Calidad de datos', f);
  for (const u of report.quality.unaccounted) { push('Costo de la mala calidad', u.orderFig); push('Costo de la mala calidad', u.refundFig); }
  for (const p of report.projections) for (const pt of p.points) rows.push({section: 'Proyecciones (Estimado)', id: `${p.id}:${pt.month}`, label: p.label, scope: monthLabel(pt.month), value: `${pt.midDisplay} (${pt.lowDisplay} a ${pt.highDisplay})`, kind: 'estimated', coverage: '', how: p.method});
  for (const a of report.alerts) rows.push({section: 'Alertas', id: a.id, label: a.title, scope: a.severity, value: a.detail, kind: a.kind, coverage: '', how: a.how});
  if (report.exposure.state === 'ok') for (const r of report.exposure.rows) rows.push({section: 'Exposición económica (Inferido)', id: r.id, label: r.label, scope: r.scope, value: r.display, kind: 'inferred', coverage: r.coverage.label, how: r.how});
  else rows.push({section: 'Exposición económica (Inferido)', id: 'exp:none', label: 'Exposición por problema', scope: '', value: 'Sin atestar', kind: 'inferred', coverage: '', how: report.exposure.message});
  return rows;
}
