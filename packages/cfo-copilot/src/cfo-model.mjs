// Modelo CFO PURO: de filas agregadas del ledger (por mes · canal · tipo · estado · moneda · base) a todo lo que muestra /cfo.
// Reglas inviolables (también verificadas en tests):
//  1. USD / CAD / MXN nunca se suman ni se convierten (la tabla de versiones de tipo de cambio está vacía): todo se agrupa por moneda.
//  2. Las bases del ledger no se mezclan: marketplace_line_price, marketplace_refund_amount y gross_order_including_tax_shipping
//     son magnitudes distintas. No se resta reembolso de ingreso ni se suma Shopify a marketplaces.
//  3. Cada cifra lleva clase (Observado / Estimado / Inferido), cobertura y «cómo se calculó».
//  4. Un importe desconocido es «No disponible», nunca 0; una moneda desconocida (XXX) no se adivina.
import {money as moneyBase, int as intBase, pct as pctBase, signedPct as signedPctBase, signedPp as signedPpBase, monthLabel as monthLabelBase, divRound, ratioBps, changeBps, baseOf, toReviewBasis} from './format.mjs';
import {BASIS, CHANNELS} from './fixtures.mjs';

export const UNKNOWN_CURRENCY = 'XXX';
export const BASIS_LABEL = Object.freeze({
  [BASIS.line]: 'Precio de línea de marketplace',
  [BASIS.shopify]: 'Bruto con impuestos y envío (Shopify)',
  [BASIS.refund]: 'Importe reembolsado de marketplace',
});
export const BASIS_LABEL_EN = Object.freeze({
  [BASIS.line]: 'Marketplace line price',
  [BASIS.shopify]: 'Gross with taxes and shipping (Shopify)',
  [BASIS.refund]: 'Marketplace refunded amount',
});
/** Formato ligado a un idioma ('es' por omisión): el modelo es el mismo, solo cambia la presentación. */
function ligar(idioma = 'es') {
  const en = idioma === 'en', L = (es, enText) => (en ? enText : es);
  return {
    idioma, en, L, BASIS_LABEL: en ? BASIS_LABEL_EN : BASIS_LABEL,
    money: (v, c, e = 2) => moneyBase(v, c, e, idioma), int: n => intBase(n, idioma), pct: b => pctBase(b, idioma), signedPct: b => signedPctBase(b, idioma), signedPp: b => signedPpBase(b, idioma), monthLabel: k => monthLabelBase(k, idioma),
    nd: L('No disponible', 'Not available'),
    fig: (id, label, display, o = {}) => fig(id, label, display, {...o, idioma}),
  };
}
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
export function fig(id, label, display, {kind = 'observed', known = null, eligible = null, how, value = null, unit = null, scope = null, idioma = 'es'} = {}) {
  const en = idioma === 'en', int = n => intBase(n, idioma);
  const coverage = eligible === null ? {known: null, eligible: null, bps: null, label: en ? 'Coverage not applicable' : 'Cobertura no aplica'} : {known, eligible, bps: ratioBps(known, eligible), label: eligible === 0 ? (en ? 'No eligible records' : 'Sin registros elegibles') : (en ? `${int(known)} of ${int(eligible)} records with an amount` : `${int(known)} de ${int(eligible)} registros con importe`)};
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
  const {watermark = null, exposure = {attestedLinks: 0, rows: [], coverageComplete: false}, now = new Date(), complete = true, idioma = 'es'} = options;
  const {L, BASIS_LABEL, money, int, pct, signedPct, monthLabel, nd, fig} = ligar(idioma);
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
      const series = months.map(month => { const c = cell(rowsB.filter(r => r.month === month)); return {month, partial: partial.has(month), ...c, ticket: ticket(c), amountDisplay: c.known > 0 ? m$(c.amount.toString()) : nd, ticketDisplay: c.known > 0 ? m$(ticket(c).toString()) : nd}; });
      const total = cell(rowsB);
      const chans = [...new Set(rowsB.map(r => r.channel))].map(channel => { const c = cell(rowsB.filter(r => r.channel === channel)); return {channel, label: channelLabel(channel), ...c, ticket: ticket(c), shareBps: total.amount > 0n ? Number(c.amount * 10000n * 2n + total.amount) / Number(total.amount * 2n) | 0 : null}; }).sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : b.n - a.n));
      // Serie mensual por canal (misma moneda y base): permite decir qué canal explica un cambio entre meses sin atribuir causas.
      const channelSeries = chans.map(c => ({channel: c.channel, label: c.label, series: months.map(month => { const x = cell(rowsB.filter(r => r.channel === c.channel && r.month === month)); return {month, n: x.n, known: x.known, amount: x.amount}; })}));
      return {base, label: BASIS_LABEL[base] ?? base, additive: true, series, total, ticket: ticket(total), channels: chans, channelSeries};
    });
    const refRows = mine.filter(isRefundOk);
    const refundSeries = months.map(month => { const c = cell(refRows.filter(r => r.month === month)); return {month, partial: partial.has(month), ...c, amountDisplay: c.known > 0 ? m$(c.amount.toString()) : nd}; });
    const refundTotal = cell(refRows);
    const refundChannels2 = [...new Set(refRows.map(r => r.channel))].map(channel => { const c = cell(refRows.filter(r => r.channel === channel)); const ord = cell(mine.filter(r => isOrderOk(r) && r.channel === channel)); return {channel, label: channelLabel(channel), ...c, orders: ord.n, rateBps: ratioBps(c.n, ord.n)}; });
    // tasa de reembolso por CONTEO, solo con canales que tienen fuente de devoluciones (si no, quedaría subestimada)
    const inRate = new Set([...refundChannels].filter(ch => mine.some(r => r.channel === ch && isOrderOk(r))));
    const hasRefunds = refRows.length > 0; // sin ninguna fila de reembolso en la moneda, la tasa no es 0: no se puede medir
    const rateSeries = months.map(month => { const o = cell(mine.filter(r => isOrderOk(r) && inRate.has(r.channel) && r.month === month)), f = cell(refRows.filter(r => inRate.has(r.channel) && r.month === month)); return {month, partial: partial.has(month), orders: o.n, refunds: f.n, bps: hasRefunds ? ratioBps(f.n, o.n) : null, display: hasRefunds ? pct(ratioBps(f.n, o.n)) : nd}; });
    const rateTotal = (() => { const o = cell(mine.filter(r => isOrderOk(r) && inRate.has(r.channel))), f = cell(refRows.filter(r => inRate.has(r.channel))); return {orders: o.n, refunds: f.n, bps: hasRefunds ? ratioBps(f.n, o.n) : null}; })();
    const ordersAll = months.map(month => ({month, partial: partial.has(month), n: sumNum(mine.filter(r => isOrderOk(r) && r.month === month), r => r.n)}));
    const pcOut = {currency, exponent, orderBases, refunds: {base: BASIS.refund, label: BASIS_LABEL[BASIS.refund], series: refundSeries, total: refundTotal, channels: refundChannels2}, rate: {series: rateSeries, total: rateTotal, channels: [...inRate].map(channelLabel), excluded: channels.filter(ch => !inRate.has(ch) && mine.some(r => r.channel === ch && isOrderOk(r))).map(channelLabel)}, ordersAll};
    Object.defineProperty(pcOut, 'm$', {value: m$, enumerable: false}); // no viaja al cliente
    return pcOut;
  });

  // ---- KPIs del último mes completo contra el anterior (por moneda) ----
  const kpis = perCurrency.map(pc => ({currency: pc.currency, month: lastComplete, metrics: metricsFor(pc, lastComplete, prevComplete, idioma)}));

  // ---- Mezcla por canal ----
  const orderTotals = channels.map(channel => { const c = cell(used.filter(r => isOrderOk(r) && r.channel === channel)); return {channel, label: channelLabel(channel), n: c.n}; }).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
  const orderN = sumNum(orderTotals, x => x.n);
  const mix = {
    orders: orderTotals.map(x => ({...x, shareBps: ratioBps(x.n, orderN), family: CHANNELS[x.channel]?.family ?? 'otro'})),
    ordersFig: fig('mix:orders', L('Mezcla de pedidos por canal', `Order mix by channel`), int(orderN) + L(' pedidos', ' orders'), {scope: L('12 meses · pedidos registrados', `12 months · registered orders`), how: L('Participación = pedidos registrados del canal ÷ pedidos registrados totales. Es un conteo: no depende de moneda ni de base.', `Share = registered orders of the channel ÷ total registered orders. It is a count: it does not depend on currency or basis.`), value: orderN}),
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
      orderFig: fig(`poorq:order:${pc.currency}`, L(`Ingresos no contabilizados · ${pc.currency}`, `Unaccounted revenue · ${pc.currency}`), orderRows ? '≈ ' + pc.m$(order.toString()) : L('Sin pedidos sin importe', `No orders without an amount`), {kind: 'estimated', scope: L('12 meses · pedidos registrados sin importe', `12 months · registered orders without an amount`), how: L('Estimado: pedidos registrados sin importe × ticket promedio conocido del MISMO canal y moneda. No se agrega a los ingresos observados.', `Estimated: registered orders without an amount × known average ticket of the SAME channel and currency. It is not added to observed revenue.`), value: order.toString(), unit: currency2(pc)}),
      refundFig: fig(`poorq:refund:${pc.currency}`, L(`Reembolsos no contabilizados · ${pc.currency}`, `Unaccounted refunds · ${pc.currency}`), refundRows ? '≈ ' + pc.m$(refund.toString()) : L('Sin reembolsos sin importe', `No refunds without an amount`), {kind: 'estimated', scope: L('12 meses · reembolsos sin importe', `12 months · refunds without an amount`), how: L('Estimado: reembolsos sin importe × reembolso promedio conocido del MISMO canal y moneda.', `Estimated: refunds without an amount × known average refund of the SAME channel and currency.`), value: refund.toString(), unit: currency2(pc)})};
  });
  const quality = {
    totalRows,
    figs: {
      rows: fig('q:rows', L('Registros del libro económico', `Economic ledger records`), int(totalRows), {scope: L('ventana completa', `full window`), how: L('Última revisión de cada entidad (pedidos y reembolsos), incluidos los apartados «a revisar».', `Latest revision of each entity (orders and refunds), including the "to review" set-asides.`), value: totalRows}),
      noCurrency: fig('q:nocur', L('Filas sin moneda (diferidas)', `Rows without currency (deferred)`), int(noCurrency), {known: totalRows - noCurrency, eligible: totalRows, scope: L(`${pct(ratioBps(noCurrency, totalRows))} de los registros del libro`, `${pct(ratioBps(noCurrency, totalRows))} of the ledger records`), how: L('Filas con moneda desconocida (código XXX). No se suman ni se convierten ni se les adivina moneda; quedan fuera de todos los importes.', `Rows with an unknown currency (code XXX). They are not added or converted and their currency is not guessed; they stay out of all amounts.`), value: noCurrency}),
      ordersNoAmount: fig('q:noamt-o', L('Pedidos sin importe', `Orders without an amount`), ordersNoAmount === 0 ? L('Ninguno (0)', `None (0)`) : int(ordersNoAmount), {known: sumNum(ordersKnownCur, r => r.known), eligible: sumNum(ordersKnownCur, r => r.n), scope: ordersNoAmount === 0 ? L(`Todos los ${int(sumNum(ordersKnownCur, r => r.n))} pedidos registrados con moneda tienen importe`, `All ${int(sumNum(ordersKnownCur, r => r.n))} registered orders with a currency have an amount`) : L('pedidos registrados con moneda', `registered orders with a currency`), how: L('Pedidos registrados con moneda conocida y importe nulo. Nunca se cuentan como 0.', `Registered orders with a known currency and a null amount. They are never counted as 0.`), value: ordersNoAmount}),
      refundsNoAmount: fig('q:noamt-r', L('Reembolsos sin importe', `Refunds without an amount`), refundsNoAmount === 0 ? L('Ninguno (0)', `None (0)`) : int(refundsNoAmount), {known: sumNum(refundsKnownCur, r => r.known), eligible: sumNum(refundsKnownCur, r => r.n), scope: L('reembolsos con moneda', `refunds with a currency`), how: L('Reembolsos con importe nulo en la fuente (cualquier estado).', `Refunds with a null amount in the source (any status).`), value: refundsNoAmount}),
      toReview: fig('q:review', L('Duplicados «a revisar» (fuera de totales)', `Duplicates "to review" (outside totals)`), int(sumNum(toReview, r => r.n)), {scope: L('apartados sin identificador de línea', `set-asides without a line identifier`), how: L('Copias excedentes marcadas «a_revisar» al cargar; se conservan pero no entran a ningún total.', `Excess copies marked "a_revisar" on load; they are kept but do not enter any total.`), value: sumNum(toReview, r => r.n)}),
    },
    nonRecorded, byChannel, unaccounted,
    notEstimable: {rows: noCurrency, reason: L('Sin moneda no se puede asignar un importe ni compararlo: se cuentan, no se valoran.', `Without a currency an amount cannot be assigned or compared: they are counted, not valued.`)},
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
        method: L(`Tendencia lineal (mínimos cuadrados) sobre los últimos ${window.length} meses completos (${monthLabel(window[0])} a ${monthLabel(window.at(-1))}). Sin estacionalidad ni efecto de campañas. Rango = ±1 desviación estándar de los residuos. No es un pronóstico calibrado.`, `Linear trend (least squares) over the last ${window.length} complete months (${monthLabel(window[0])} to ${monthLabel(window.at(-1))}). No seasonality or campaign effects. Range = ±1 standard deviation of the residuals. It is not a calibrated forecast.`),
        label: metric === 'ingresos' ? L(`Ingresos proyectados · ${pc.currency}`, `Projected revenue · ${pc.currency}`) : L(`Pedidos proyectados · ${pc.currency}`, `Projected orders · ${pc.currency}`)});
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
      if (last.f >= 30 && sd > 0 && (rate - mean) / sd >= 2) alerts.push({id: `refund-anomaly:${ch.channel}:${pc.currency}`, severity: (rate - mean) / sd >= 3 ? 'alta' : 'media', title: L(`Reembolsos anómalos · ${ch.label} (${pc.currency})`, `Abnormal refunds · ${ch.label} (${pc.currency})`), detail: L(`Tasa de ${monthLabel(last.m)}: ${pct(Math.round(rate * 10000))} frente a ${pct(Math.round(mean * 10000))} de promedio previo (${(rate - mean) / sd >= 10 ? 'más de 10' : ((rate - mean) / sd).toFixed(1)} desviaciones).`, `Rate for ${monthLabel(last.m)}: ${pct(Math.round(rate * 10000))} versus a prior average of ${pct(Math.round(mean * 10000))} (${(rate - mean) / sd >= 10 ? 'more than 10' : ((rate - mean) / sd).toFixed(1)} standard deviations).`), kind: 'observed', how: L(`Se compara la tasa por conteo del último mes completo con la media y desviación de los ${prior.length} meses completos anteriores del mismo canal y moneda. Alerta si supera 2 desviaciones y hay al menos 30 reembolsos.`, `The count-based rate of the last complete month is compared with the mean and deviation of the ${prior.length} previous complete months of the same channel and currency. It alerts if it exceeds 2 standard deviations and there are at least 30 refunds.`), cta: {label: L('Ver reembolsos del canal', `View the channel refunds`), href: economicsHref(pc.currency, prior[0]?.m ?? last.m, last.m)}});
    }
    // caída de pedidos
    const oa = pc.ordersAll.filter(x => completeMonths.includes(x.month));
    if (oa.length >= 4) {
      const last = oa.at(-1), prev3 = oa.slice(-4, -1), mean = prev3.reduce((a, x) => a + x.n, 0) / 3;
      if (mean >= 100) { const change = Math.round(((last.n - mean) / mean) * 10000); if (change <= -2000) alerts.push({id: `orders-drop:${pc.currency}`, severity: change <= -3500 ? 'alta' : 'media', title: L(`Caída de pedidos · ${pc.currency}`, `Drop in orders · ${pc.currency}`), detail: L(`${monthLabel(last.month)}: ${int(last.n)} pedidos, ${signedPct(change)} frente al promedio de los 3 meses anteriores (${int(Math.round(mean))}).`, `${monthLabel(last.month)}: ${int(last.n)} orders, ${signedPct(change)} versus the average of the previous 3 months (${int(Math.round(mean))}).`), kind: 'observed', how: L('Pedidos registrados del último mes completo contra la media de los 3 meses completos previos, misma moneda, todos los canales. Alerta si cae 20 % o más (35 % o más = alta).', `Registered orders of the last complete month against the mean of the previous 3 complete months, same currency, all channels. It alerts if it drops 20% or more (35% or more = high).`), cta: {label: L('Ver mezcla por canal', `View the channel mix`), href: '#mezcla'}}); }
    }
  }
  const ncBps = ratioBps(noCurrency, totalRows);
  if (ncBps !== null && ncBps >= 100) alerts.push({id: 'quality:no-currency', severity: 'media', title: L('Filas sin moneda diferidas', `Deferred rows without currency`), detail: L(`${int(noCurrency)} registros del libro (${pct(ncBps)}) no tienen moneda y quedan fuera de todos los importes.`, `${int(noCurrency)} ledger records (${pct(ncBps)}) have no currency and stay out of all amounts.`), kind: 'observed', how: L('Registros del libro con moneda XXX ÷ registros totales. Alerta desde 1 %.', `Ledger records with currency XXX ÷ total records. It alerts from 1%.`), cta: {label: L('Ver calidad de datos', `View data quality`), href: '#calidad'}});
  const rnBps = ratioBps(refundsNoAmount, sumNum(refundsKnownCur, r => r.n));
  if (rnBps !== null && rnBps >= 500) alerts.push({id: 'quality:refund-no-amount', severity: 'media', title: L('Reembolsos sin importe', `Refunds without an amount`), detail: L(`${int(refundsNoAmount)} reembolsos (${pct(rnBps)}) no traen importe: la cifra de reembolsos es un piso.`, `${int(refundsNoAmount)} refunds (${pct(rnBps)}) have no amount: the refund figure is a floor.`), kind: 'observed', how: L('Reembolsos con moneda sin importe ÷ reembolsos con moneda. Alerta desde 5 %.', `Refunds with a currency and no amount ÷ refunds with a currency. It alerts from 5%.`), cta: {label: L('Ver calidad de datos', `View data quality`), href: '#calidad'}});
  const gap = channels.filter(ch => !refundChannels.has(ch));
  if (gap.length) alerts.push({id: 'coverage:refund-source', severity: 'baja', title: L('Canales sin fuente de devoluciones', `Channels without a returns source`), detail: L(`${gap.map(channelLabel).join(', ')} no tienen reembolsos cargados: la tasa global no los incluye.`, `${gap.map(channelLabel).join(', ')} have no refunds loaded: the overall rate does not include them.`), kind: 'observed', how: L('Canales con pedidos y sin ninguna fila de reembolso en la ventana.', `Channels with orders and no refund row in the window.`), cta: {label: L('Ver cobertura de fuentes', `View source coverage`), href: '/imports'}});
  const partialList = [...partial];
  if (partialList.length) alerts.push({id: 'period:partial', severity: 'info', title: L(`Mes en curso incompleto: ${partialList.map(monthLabel).join(', ')}`, `Current month incomplete: ${partialList.map(monthLabel).join(', ')}`), detail: L(`Los datos llegan hasta ${watermark?.slice(0, 10)}. Las comparativas usan el último mes COMPLETO (${lastComplete ? monthLabel(lastComplete) : 'ninguno'}).`, `Data goes up to ${watermark?.slice(0, 10)}. Comparisons use the last COMPLETE month (${lastComplete ? monthLabel(lastComplete) : 'none'}).`), kind: 'observed', how: L('Un mes es parcial si el corte de la fuente es anterior a su penúltimo día.', `A month is partial if the source cutoff is before its second-to-last day.`), cta: null});
  const order = {alta: 0, media: 1, baja: 2, info: 3};
  alerts.sort((a, b) => order[a.severity] - order[b.severity] || a.id.localeCompare(b.id));

  // ---- Exposición económica (solo con vínculos atestados) ----
  const exposureView = exposure.attestedLinks > 0 && exposure.rows.length
    ? {state: 'ok', attestedLinks: exposure.attestedLinks, coverageComplete: !!exposure.coverageComplete, kind: 'inferred', additive: false,
        note: L('Los importes expuestos de problemas distintos pueden incluir los mismos pedidos: NO se suman. Exposición no es pérdida ni ahorro.', `The exposed amounts of different problems may include the same orders: they are NOT added. Exposure is not loss or savings.`),
        rows: [...exposure.rows].sort((a, b) => (big(b.exposedMinor) > big(a.exposedMinor) ? 1 : -1)).map(r => ({...r, ...fig(`exp:${r.problemId}`, r.title, money(r.exposedMinor, r.currency, r.exponent), {kind: 'inferred', known: r.knownOrders, eligible: r.linkedOrders, scope: L(`${int(r.linkedOrders)} pedidos vinculados`, `${int(r.linkedOrders)} linked orders`), how: L('Suma de importes de pedidos vinculados al problema con evidencia atestada por el propietario. Vínculo por evidencia, no causalidad.', `Sum of the amounts of orders linked to the problem with evidence attested by the owner. A link by evidence, not causality.`), value: r.exposedMinor, unit: r.currency})}))}
    : {state: 'sin_atestar', attestedLinks: 0, kind: 'inferred', message: L('Sin vínculos atestados entre problemas y pedidos: no se muestra ninguna exposición. Sin atestar no hay cifra, ni siquiera estimada.', `There are no attested links between problems and orders: no exposure is shown. Without attestation there is no figure, not even an estimated one.`), cta: {label: L('Pedir al propietario que ateste vínculos', `Ask the owner to attest links`), href: '/problems'}, rows: []};

  return {generatedAt: now.toISOString(), watermark, complete, months, partialMonths: partialList, completeMonths, lastComplete, prevComplete, currencies, channels: channels.map(c => ({channel: c, label: channelLabel(c), hasRefundSource: refundChannels.has(c)})), perCurrency, kpis, mix, quality, projections, alerts, exposure: exposureView, glossary: glossaryOf(idioma), idioma, rule: L('USD, CAD y MXN no se suman ni se convierten: cada moneda se muestra aparte.', 'USD, CAD and MXN are not added or converted: each currency is shown separately.')};
}
const currency2 = pc => pc.currency;

function metricsFor(pc, month, prevMonth, idioma = 'es') {
    const {L, money, int, pct, signedPct, signedPp, monthLabel, nd, fig} = ligar(idioma);
    const lastComplete = month, prevComplete = prevMonth;
    const line = pc.orderBases.find(b => b.base === BASIS.line) ?? pc.orderBases[0];
    const at = (series, m) => series.find(x => x.month === m);
    const cur = line && lastComplete ? at(line.series, lastComplete) : null, prev = line && prevComplete ? at(line.series, prevComplete) : null;
    const rCur = lastComplete ? at(pc.refunds.series, lastComplete) : null, rPrev = prevComplete ? at(pc.refunds.series, prevComplete) : null;
    const rateCur = lastComplete ? at(pc.rate.series, lastComplete) : null, ratePrev = prevComplete ? at(pc.rate.series, prevComplete) : null;
    const mo = lastComplete ? monthLabel(lastComplete) : L('sin mes completo', `no complete month`);
    const delta = (c, p) => (c && p && p > 0n ? changeBps(c, p) : null);
    const metrics = [];
    if (line && cur) {
      metrics.push({...fig(`rev:${pc.currency}`, L(`Ingresos · ${pc.currency}`, `Revenue · ${pc.currency}`), pc.m$(cur.amount.toString()), {known: cur.known, eligible: cur.n, scope: `${mo} · ${line.label}`, how: L(`Suma de los pedidos «registrados» del mes con importe conocido, moneda ${pc.currency} y base «${line.label}». Pedidos sin importe no se estiman aquí (ver Calidad de datos).`, `Sum of the month's "registered" orders with a known amount, currency ${pc.currency} and basis "${line.label}". Orders without an amount are not estimated here (see Data quality).`), value: cur.amount.toString(), unit: pc.currency}), delta: prev ? {bps: delta(cur.amount, prev.amount), display: signedPct(delta(cur.amount, prev.amount)), vs: monthLabel(prevComplete)} : null});
      metrics.push({...fig(`orders:${pc.currency}`, L(`Pedidos · ${pc.currency}`, `Orders · ${pc.currency}`), int(cur.n), {scope: L(`${mo} · pedidos registrados`, `${mo} · registered orders`), how: L('Conteo de pedidos con estado «registrado» en la moneda, todos los canales; excluye cancelados, pendientes y desconocidos.', `Count of orders with "registered" status in the currency, all channels; it excludes canceled, pending and unknown ones.`), value: cur.n}), delta: prev ? {bps: changeBps(BigInt(cur.n), BigInt(prev.n)), display: signedPct(changeBps(BigInt(cur.n), BigInt(prev.n))), vs: monthLabel(prevComplete)} : null});
      const t = ticket(cur), tp = prev ? ticket(prev) : null;
      metrics.push({...fig(`ticket:${pc.currency}`, L(`Ticket promedio · ${pc.currency}`, `Average ticket · ${pc.currency}`), t === null ? nd : pc.m$(t.toString()), {known: cur.known, eligible: cur.n, scope: `${mo} · ${line.label}`, how: L('Ingresos del mes ÷ pedidos con importe conocido (redondeo a la unidad menor, mitad hacia arriba). No incluye pedidos sin importe.', `Revenue for the month ÷ orders with a known amount (rounded to the minor unit, half up). It does not include orders without an amount.`), value: t?.toString() ?? null, unit: pc.currency}), delta: t !== null && tp !== null ? {bps: changeBps(t, tp), display: signedPct(changeBps(t, tp)), vs: monthLabel(prevComplete)} : null});
    }
    if (rCur && pc.refunds.total.n > 0) metrics.push({...fig(`refund:${pc.currency}`, L(`Reembolsos · ${pc.currency}`, `Refunds · ${pc.currency}`), rCur.known > 0 ? pc.m$(rCur.amount.toString()) : nd, {known: rCur.known, eligible: rCur.n, scope: `${mo} · ${pc.refunds.label}`, how: L(`Suma de reembolsos «liquidados» del mes con importe conocido (base «${pc.refunds.label}»). No se resta de los ingresos: son bases distintas.`, `Sum of the month's "settled" refunds with a known amount (basis "${pc.refunds.label}"). It is not subtracted from revenue: they are different bases.`), value: rCur.amount.toString(), unit: pc.currency}), delta: rPrev && rPrev.known > 0 ? {bps: delta(rCur.amount, rPrev.amount), display: signedPct(delta(rCur.amount, rPrev.amount)), vs: monthLabel(prevComplete)} : null});
    if (rateCur && rateCur.bps !== null) metrics.push({...fig(`rate:${pc.currency}`, L(`Tasa de reembolso · ${pc.currency}`, `Refund rate · ${pc.currency}`), pct(rateCur.bps), {scope: L(`${mo} · por conteo`, `${mo} · by count`), how: L(`Reembolsos liquidados ÷ pedidos registrados del mismo mes, solo en canales con fuente de devoluciones cargada (${pc.rate.channels.join(', ') || 'ninguno'}). Los reembolsos pueden corresponder a pedidos de meses anteriores.`, `Settled refunds ÷ registered orders of the same month, only in channels with a returns source loaded (${pc.rate.channels.join(', ') || 'none'}). Refunds may belong to orders from earlier months.`), value: rateCur.bps, unit: 'bps'}), delta: ratePrev?.bps != null ? {bps: rateCur.bps - ratePrev.bps, display: signedPp(rateCur.bps - ratePrev.bps), vs: monthLabel(prevComplete), pp: true} : null});
    return metrics;
}


/** Cifras de un mes cualquiera (para el copiloto): el mes previo es el anterior de la serie. */
export function monthMetrics(report, currency, month) {
  const pc = report.perCurrency.find(c => c.currency === currency); if (!pc || !report.months.includes(month)) return null;
  const i = report.months.indexOf(month);
  return {partial: report.partialMonths.includes(month), metrics: metricsFor(pc, month, i > 0 ? report.months[i - 1] : null, report.idioma)};
}

function ols(xs, ys) {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0); if (sxx === 0) return null;
  const b = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx, a = my - b * mx;
  const sse = ys.reduce((s, y, i) => s + (y - (a + b * xs[i])) ** 2, 0), sigma = Math.sqrt(sse / Math.max(1, n - 2));
  return {a, b, sigma};
}

export const GLOSSARY_EN = Object.freeze([
  {term: 'Observed', body: 'A figure recorded in a source of the economic ledger (registered orders, settled refunds). It is calculated by adding real rows.'},
  {term: 'Estimated', body: 'A figure calculated with a model (projections, unaccounted revenue). It always carries its method and is never mixed with observed ones.'},
  {term: 'Inferred', body: 'A figure obtained by linking records with attested evidence (exposure per problem). It is not loss or savings and it is not additive.'},
  {term: 'Coverage', body: 'How many records have a known amount versus the eligible ones. A total with partial coverage is a floor, not the total.'},
  {term: 'Economic basis', body: 'What an amount measures: marketplace line price, refunded amount or gross Shopify with taxes and shipping. Different bases are not added or subtracted.'},
  {term: 'Currency', body: 'USD, CAD and MXN are shown separately. There are no approved exchange rates (the exchange-rate version table is empty), so there is no conversion.'},
  {term: 'Refund rate', body: 'Settled refunds ÷ registered orders of the same month by count, only in channels with a returns source. It does not use amounts because the bases differ.'},
  {term: 'Average ticket', body: 'Revenue ÷ orders with a known amount, of the same currency and basis.'},
  {term: 'Complete month', body: 'A month whose data reaches its end. Month-over-month comparisons only use complete months.'},
  {term: 'No currency (XXX)', body: 'Rows whose currency was not declared in the source. They are counted but not valued, and no currency is assigned to them.'},
  {term: 'Exposure', body: 'Amount of orders linked to a problem with evidence attested by the owner. Without attested links nothing is shown.'},
]);
export const glossaryOf = idioma => (idioma === 'en' ? GLOSSARY_EN : GLOSSARY);
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
  const {L, int, pct, monthLabel} = ligar(report.idioma);
  const rows = [];
  const push = (section, f, extra = {}) => rows.push({section, id: f.id, label: f.label, scope: f.scope ?? '', value: f.display, kind: f.kind, coverage: f.coverage.eligible === null ? '' : f.coverage.label, how: f.how, ...extra});
  for (const k of report.kpis) for (const m of k.metrics) { push(L('Resumen del último mes completo · ', 'Summary of the last complete month · ') + k.currency, m); if (m.delta) rows.push({section: L('Resumen del último mes completo · ', 'Summary of the last complete month · ') + k.currency, id: m.id + ':mom', label: m.label + L(' · variación', ' · change'), scope: L('contra ', 'against ') + m.delta.vs, value: m.delta.display, kind: 'observed', coverage: '', how: L('Variación del último mes completo contra el mes completo anterior.', 'Change of the last complete month against the previous complete month.')}); }
  push(L('Mezcla por canal', 'Channel mix'), report.mix.ordersFig);
  for (const o of report.mix.orders) rows.push({section: L('Mezcla por canal', 'Channel mix'), id: 'mix:' + o.channel, label: o.label, scope: L('pedidos registrados', 'registered orders'), value: `${int(o.n)} (${pct(o.shareBps)})`, kind: 'observed', coverage: '', how: report.mix.ordersFig.how});
  for (const g of report.mix.byCurrency) for (const i of g.items) rows.push({section: L('Mezcla por canal · ', 'Channel mix · ') + g.currency + ' · ' + g.baseLabel, id: `mixamt:${g.currency}:${g.base}:${i.channel}`, label: i.label, scope: g.baseLabel, value: `${i.display} (${pct(i.shareBps)})`, kind: 'observed', coverage: '', how: L('Participación dentro de la misma moneda y la misma base; no se suma entre monedas ni bases.', 'Share within the same currency and the same basis; it is not added across currencies or bases.')});
  for (const f of Object.values(report.quality.figs)) push(L('Calidad de datos', 'Data quality'), f);
  for (const u of report.quality.unaccounted) { push(L('Costo de la mala calidad', 'Cost of poor quality'), u.orderFig); push(L('Costo de la mala calidad', 'Cost of poor quality'), u.refundFig); }
  for (const p of report.projections) for (const pt of p.points) rows.push({section: L('Proyecciones (Estimado)', 'Projections (Estimated)'), id: `${p.id}:${pt.month}`, label: p.label, scope: monthLabel(pt.month), value: `${pt.midDisplay} (${pt.lowDisplay} a ${pt.highDisplay})`, kind: 'estimated', coverage: '', how: p.method});
  for (const a of report.alerts) rows.push({section: L('Alertas', 'Alerts'), id: a.id, label: a.title, scope: a.severity, value: a.detail, kind: a.kind, coverage: '', how: a.how});
  if (report.exposure.state === 'ok') for (const r of report.exposure.rows) rows.push({section: L('Exposición económica (Inferido)', 'Economic exposure (Inferred)'), id: r.id, label: r.label, scope: r.scope, value: r.display, kind: 'inferred', coverage: r.coverage.label, how: r.how});
  else rows.push({section: L('Exposición económica (Inferido)', 'Economic exposure (Inferred)'), id: 'exp:none', label: L('Exposición por problema', 'Exposure per problem'), scope: '', value: L('Sin atestar', 'Not attested'), kind: 'inferred', coverage: '', how: report.exposure.message});
  return rows;
}
