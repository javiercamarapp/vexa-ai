// «Brechas de ingreso» (/gaps): dónde gano, dónde pierdo y dónde podría ganar más. TODO es INGRESO BRUTO (jamás margen, utilidad ni ganancia: cliente piloto no comparte costo por producto).
// Lee SOLO insight_* precalculados (packages/insights/reader*.mjs); nada se agrega en vivo contra las tablas grandes. Cada parte puede quedar 'unavailable' («No disponible ahora»), JAMÁS 0.
// Clases: Observado (hecho del libro/Tracker), Estimado (solo con supuestos tecleados por el usuario, en el navegador), Inferido (regla sobre datos observados; se rotula «regla»).
// Reglas de honestidad: sin sumar monedas (USD aparte de CAD/MXN); meses parciales o con hueco de exportación nunca entran a una comparación mes contra mes; la intensidad de reembolso
// (reembolsos del mes / ingreso del mismo mes) NO es tasa por cohorte; las familias de producto SOLO se cruzan con ventas cuando existe un mapa familia -> SKU (prefijo); nunca se mezclan familias sin mapa.
import {readOrderRevenueMonth, readComplaintFamilyMonth, readFamilyPairs, readAnalysisProgress} from '../insights/reader-brechas.mjs';
import {readRefundBySkuMonth, readTrackerRefundStatus} from '../insights/reader.mjs';
export {recomendacionDeBrecha} from './brechas-recomendacion.mjs';

/** Parámetros de las reglas. Son umbrales de trabajo declarados (no hallazgos); la pantalla los muestra en «Cómo se calculó». */
export const UMBRALES = Object.freeze({
  topN: 10,
  minIngresoCruceUsd: 5000,      // ingreso del SKU/canal en los meses con cruce para que su intensidad cuente como señal
  minLineasCruce: 30,            // y líneas vendidas en esos meses
  minReembolsosCruce: 15,        // reembolsos en esos meses
  multiplicadorMediana: 2,       // «muy superior»: intensidad >= 2 × mediana del canal
  minCrecimientoPct: 10,         // «ingreso creciente»: +10 % o más mes contra mes (entre meses completos)
  minLineasCrecimiento: 20,      // líneas del SKU en el mes previo para que el crecimiento no sea ruido de base pequeña
  minParConversaciones: 30,      // cross-selling: conversaciones que mencionan las dos familias
  minAvanceCrossPct: 50,         // y solo con el análisis del histórico al menos a la mitad
});
const UMBRAL_USD_MINOR = BigInt(UMBRALES.minIngresoCruceUsd) * 100n;

export const NOMBRE_CANAL = Object.freeze({amazon: 'Amazon', walmart: 'Walmart', shopify: 'Shopify', bestbuy: 'Best Buy', otro: 'Otro'});
export const MOTIVO_TRACKER = Object.freeze({defective: 'Defectuoso', order: 'Pedido', warranty: 'Garantía', return: 'Devolución', shipping: 'Envío', not_as_expected: 'No era lo esperado', change_mind: 'Cambió de opinión',
  price_match: 'Igualación de precio', otro: 'Otro', sin_motivo: 'Sin motivo'});
const NEGADOS = ['vencido', 'no_reembolsable', 'rechazado'];
const ESTADOS = ['reembolsado', 'vencido', 'no_reembolsable', 'rechazado', 'enviado', 'otro', 'sin_estado'];

const B = v => BigInt(String(v ?? '0').split('.')[0] || '0');
/** a/b en % con un decimal (BigInt, sin flotantes en el dinero). null si b <= 0. */
const pct1 = (a, b) => (b > 0n ? Number((a * 1000n) / b) / 10 : null);
const dec1 = n => Math.round(n * 10) / 10;
const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0n);
const addMes = (m, d) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo - 1 + d, 1)).toISOString().slice(0, 7); };
const finDeMes = m => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).getUTCDate(); };
const USD0 = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0});
const fUsd = minor => USD0.format(Number(B(minor)) / 100);
const fNum = n => new Intl.NumberFormat('es-MX').format(n);
const mediana = xs => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Familias de producto <-> SKU. Familia `cod:<PREFIJO>` = prefijo alfabético del código de modelo (mismo criterio que packages/ai-scale/producto-familias.mjs, rama rediseno-ia).
// Un SKU base se mapea a `cod:` + sus primeras 2 a 6 letras. Prefijos de UNA letra (M, S, L...) son ambiguos y NO se mapean. Las familias `cat:<categoría>` (cortacésped, batería...)
// no tienen mapa a SKU (no hay catálogo de categorías): se muestran aparte y JAMÁS se cruzan con ventas.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function familiaDeSku(sku) {
  const m = /^([A-Z]{2,6})(?=$|[-0-9])/.exec(String(sku ?? '').toUpperCase());
  return m ? 'cod:' + m[1] : null;
}
export const esFamiliaCodigo = f => /^cod:[A-Za-z0-9_-]{1,24}$/.test(String(f));
export const esFamiliaCategoria = f => /^cat:[A-Za-z0-9_-]{1,24}$/.test(String(f));
export const NOMBRE_CATEGORIA = Object.freeze({cortacesped: 'Cortacésped', desbrozadora: 'Desbrozadora', motosierra: 'Motosierra', sopladora: 'Sopladora', hidrolavadora: 'Hidrolavadora', generador: 'Generador', taladro: 'Taladro',
  sierra: 'Sierra', setos: 'Cortasetos', cultivador: 'Cultivador', nieve: 'Quitanieves', bateria: 'Batería', cargador: 'Cargador', cuchilla: 'Cuchilla', bujia: 'Bujía', carburador: 'Carburador', cadena_barra: 'Cadena y barra',
  aceite_combustible: 'Aceite y combustible'});
/** Etiqueta legible de una familia: «Línea SKUP» o «Categoría: Batería». */
export const etiquetaFamilia = f => (esFamiliaCodigo(f) ? 'Línea ' + f.slice(4) : esFamiliaCategoria(f) ? 'Categoría: ' + (NOMBRE_CATEGORIA[f.slice(4)] ?? f.slice(4)) : String(f));
const ACCESORIOS = new Set(['cat:bateria', 'cat:cargador', 'cat:cuchilla', 'cat:bujia', 'cat:carburador', 'cat:cadena_barra', 'cat:aceite_combustible']);

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Calidad de los meses del libro (por canal): parcial = el mes empieza tarde (día > 3) o es el último y termina antes de su fin - 2 días; posible_hueco = líneas < la mitad del mes previo.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function calidadMeses(rows) {
  const por = new Map();
  for (const r of rows) {
    const k = r.channel + '|' + r.month, o = por.get(k) ?? {canal: r.channel, mes: r.month, lineas: 0, desde: r.firstDay, hasta: r.lastDay};
    o.lineas += r.n; if (r.firstDay && (!o.desde || r.firstDay < o.desde)) o.desde = r.firstDay; if (r.lastDay && (!o.hasta || r.lastDay > o.hasta)) o.hasta = r.lastDay; por.set(k, o);
  }
  const canales = new Map();
  for (const o of por.values()) (canales.get(o.canal) ?? canales.set(o.canal, []).get(o.canal)).push(o);
  const out = new Map();
  for (const [canal, ms] of canales) {
    ms.sort((a, b) => a.mes.localeCompare(b.mes));
    ms.forEach((m, i) => {
      const prev = ms[i - 1]?.mes === addMes(m.mes, -1) ? ms[i - 1] : null;
      let calidad = 'completo';
      if (i === 0 && m.desde && Number(m.desde.slice(8, 10)) > 3) calidad = 'parcial';
      if (i === ms.length - 1 && m.hasta && Number(m.hasta.slice(8, 10)) < finDeMes(m.mes) - 2) calidad = 'parcial';
      if (calidad === 'completo' && prev && m.lineas < prev.lineas / 2) calidad = 'posible_hueco';
      out.set(canal + '|' + m.mes, {...m, calidad});
    });
  }
  return out;
}
/** Último par de meses consecutivos y completos de un canal ({previo, mes}) o null. */
export function parDeMesesCompletos(calidad, canal) {
  const ms = [...calidad.values()].filter(m => m.canal === canal && m.calidad === 'completo').map(m => m.mes).sort();
  for (let i = ms.length - 1; i > 0; i--) if (addMes(ms[i - 1], 1) === ms[i]) return {previo: ms[i - 1], mes: ms[i]};
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Ingresos
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function armarIngresos(rows) {
  const usd = rows.filter(r => r.currency === 'USD' && r.exponent === 2);
  const otras = new Map();
  for (const r of rows) if (!(r.currency === 'USD' && r.exponent === 2)) { const o = otras.get(r.currency) ?? {currency: r.currency, exponent: r.exponent, lineas: 0, activoMinor: 0n}; o.lineas += r.n; o.activoMinor += B(r.amountMinor) - B(r.cancelledMinor); otras.set(r.currency, o); }
  const calidad = calidadMeses(rows);
  const canales = {}, skus = new Map(), celdas = new Map(), meses = new Map();
  let activo = 0n, cancelado = 0n, lineas = 0, canceladas = 0, revision = 0, sinSkuActivo = 0n, revisionMinor = 0n;
  for (const r of usd) {
    const act = B(r.amountMinor) - B(r.cancelledMinor), canc = B(r.cancelledMinor);
    activo += act; cancelado += canc; lineas += r.n; canceladas += r.nCancelled; revision += r.nReview; revisionMinor += B(r.reviewMinor);
    const c = canales[r.channel] ??= {canal: r.channel, lineas: 0, canceladas: 0, activoMinor: 0n, canceladoMinor: 0n, desde: r.firstDay, hasta: r.lastDay, conSku: 0n};
    c.lineas += r.n; c.canceladas += r.nCancelled; c.activoMinor += act; c.canceladoMinor += canc; if (r.firstDay < c.desde) c.desde = r.firstDay; if (r.lastDay > c.hasta) c.hasta = r.lastDay;
    const mk = meses.get(r.month) ?? meses.set(r.month, {mes: r.month, canales: {}, totalMinor: 0n}).get(r.month);
    const mc = mk.canales[r.channel] ??= {activoMinor: 0n, lineas: 0, calidad: calidad.get(r.channel + '|' + r.month)?.calidad ?? 'completo'}; mc.activoMinor += act; mc.lineas += r.n; mk.totalMinor += act;
    if (!r.sku) { sinSkuActivo += act; continue; }
    c.conSku += act;
    const s = skus.get(r.sku) ?? {sku: r.sku, familia: familiaDeSku(r.sku), lineas: 0, canceladas: 0, activoMinor: 0n, canceladoMinor: 0n, canales: {}};
    s.lineas += r.n; s.canceladas += r.nCancelled; s.activoMinor += act; s.canceladoMinor += canc;
    const sc = s.canales[r.channel] ??= {lineas: 0, activoMinor: 0n}; sc.lineas += r.n; sc.activoMinor += act; skus.set(r.sku, s);
    const ck = r.sku + '|' + r.channel + '|' + r.month, cell = celdas.get(ck) ?? {sku: r.sku, canal: r.channel, mes: r.month, lineas: 0, activoMinor: 0n}; cell.lineas += r.n; cell.activoMinor += act; celdas.set(ck, cell);
  }
  return {activo, cancelado, lineas, canceladas, revision, revisionMinor, sinSkuActivo, canales, skus: [...skus.values()], celdas: [...celdas.values()], meses: [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes)), otras: [...otras.values()], calidad,
    pares: Object.fromEntries(Object.keys(canales).map(c => [c, parDeMesesCompletos(calidad, c)]))};
}

/** Ranking por ingreso activo (sin cancelados) con participación y % acumulado sobre el ingreso TOTAL (incluye canales sin SKU), y crecimiento mes contra mes del canal principal. */
export function rankingIngresos(I) {
  const orden = [...I.skus].sort((a, b) => (b.activoMinor > a.activoMinor ? 1 : b.activoMinor < a.activoMinor ? -1 : a.sku.localeCompare(b.sku)));
  const celda = new Map(I.celdas.map(c => [c.sku + '|' + c.canal + '|' + c.mes, c]));
  let acum = 0n;
  return orden.map((s, i) => {
    acum += s.activoMinor;
    const canales = Object.entries(s.canales).map(([canal, v]) => ({canal, lineas: v.lineas, activoMinor: String(v.activoMinor)})).sort((a, b) => Number(B(b.activoMinor) - B(a.activoMinor)));
    const principal = canales[0]?.canal, par = principal ? I.pares[principal] : null;
    let crecimiento = null;
    if (par) {
      const a = celda.get(`${s.sku}|${principal}|${par.mes}`), p = celda.get(`${s.sku}|${principal}|${par.previo}`);
      if (p && p.lineas >= UMBRALES.minLineasCrecimiento && p.activoMinor > 0n) crecimiento = {canal: principal, mes: par.mes, previo: par.previo, activoMinor: String(a?.activoMinor ?? 0n), previoMinor: String(p.activoMinor), pct: dec1(Number(((a?.activoMinor ?? 0n) - p.activoMinor) * 10000n / p.activoMinor) / 100)};
    }
    return {pos: i + 1, sku: s.sku, familia: s.familia, lineas: s.lineas, canceladas: s.canceladas, activoMinor: String(s.activoMinor), canceladoMinor: String(s.canceladoMinor),
      participacionPct: pct1(s.activoMinor, I.activo), acumPct: pct1(acum, I.activo), canales, crecimiento};
  });
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Reembolsos y cruce con ingreso (mismo SKU, canal y mes). «Intensidad», no tasa por cohorte.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function armarReembolsos(rows) {
  const usd = rows.filter(r => r.currency === 'USD' && r.exponent === 2);
  const otras = new Map(); for (const r of rows) if (!(r.currency === 'USD' && r.exponent === 2)) { const o = otras.get(r.currency) ?? {currency: r.currency, n: 0}; o.n += r.n; otras.set(r.currency, o); }
  let bruto = 0n, activo = 0n, n = 0, nCanc = 0, sinMonto = 0;
  const skus = new Map(), celdas = new Map(), canales = {}, primerMes = {};
  for (const r of usd) {
    const act = B(r.activeMinor), g = B(r.amountMinor);
    bruto += g; activo += act; n += r.n; nCanc += r.nCancelled; sinMonto += r.n - r.nKnown;
    const c = canales[r.channel] ??= {n: 0, brutoMinor: 0n, activoMinor: 0n}; c.n += r.n; c.brutoMinor += g; c.activoMinor += act;
    if (!primerMes[r.channel] || r.month < primerMes[r.channel]) primerMes[r.channel] = r.month;
    if (!r.sku) continue;
    const s = skus.get(r.sku) ?? {sku: r.sku, n: 0, brutoMinor: 0n, activoMinor: 0n, canales: {}}; s.n += r.n; s.brutoMinor += g; s.activoMinor += act;
    const sc = s.canales[r.channel] ??= {n: 0, brutoMinor: 0n, activoMinor: 0n}; sc.n += r.n; sc.brutoMinor += g; sc.activoMinor += act; skus.set(r.sku, s);
    const ck = r.sku + '|' + r.channel + '|' + r.month, cell = celdas.get(ck) ?? {sku: r.sku, canal: r.channel, mes: r.month, n: 0, activoMinor: 0n}; cell.n += r.n; cell.activoMinor += act; celdas.set(ck, cell);
  }
  const orden = [...skus.values()].sort((a, b) => (b.brutoMinor > a.brutoMinor ? 1 : b.brutoMinor < a.brutoMinor ? -1 : a.sku.localeCompare(b.sku)));
  const top10 = orden.slice(0, UMBRALES.topN), top10Minor = sum(top10, x => x.brutoMinor);
  return {n, nCanc, sinMonto, brutoMinor: bruto, activoMinor: activo, canales, primerMes, otras: [...otras.values()], skus: orden, celdas: [...celdas.values()], top10Pct: pct1(top10Minor, bruto), top10: top10.map(x => x.sku)};
}

/**
 * Cruza reembolsos con ingreso del MISMO sku × canal × mes. Un mes cuenta solo si el libro de pedidos del canal lo tiene completo y el libro de reembolsos ya había empezado.
 * Devuelve la intensidad por sku×canal (reembolsos sin cancelados / ingreso, en los meses con cruce), la mediana por canal y la cobertura del cruce.
 */
export function cruzar(I, R) {
  const ref = new Map(R.celdas.map(c => [c.sku + '|' + c.canal + '|' + c.mes, c]));
  const acc = new Map();
  let refCruzaMinor = 0n, refTotalMinor = 0n, refTotalN = 0, refCruzaN = 0;
  for (const c of R.celdas) { refTotalMinor += c.activoMinor; refTotalN += c.n; }
  for (const o of I.celdas) {
    const q = I.calidad.get(o.canal + '|' + o.mes);
    if (!q || q.calidad !== 'completo' || o.mes < (R.primerMes[o.canal] ?? '9999')) continue;
    const k = o.sku + '|' + o.canal, a = acc.get(k) ?? {sku: o.sku, canal: o.canal, reembolsos: 0, reembolsoMinor: 0n, lineas: 0, ingresoMinor: 0n, meses: []};
    a.lineas += o.lineas; a.ingresoMinor += o.activoMinor; a.meses.push(o.mes);
    const c = ref.get(k + '|' + o.mes); if (c) { a.reembolsos += c.n; a.reembolsoMinor += c.activoMinor; refCruzaN += c.n; refCruzaMinor += c.activoMinor; }
    acc.set(k, a);
  }
  const filas = [...acc.values()].filter(a => a.ingresoMinor > 0n).map(a => ({...a, intensidadPct: pct1(a.reembolsoMinor, a.ingresoMinor), intensidadLineasPct: a.lineas ? dec1((a.reembolsos * 100) / a.lineas) : null,
    significativa: a.ingresoMinor >= UMBRAL_USD_MINOR && a.lineas >= UMBRALES.minLineasCruce && a.reembolsos >= UMBRALES.minReembolsosCruce}));
  const medianaCanal = {};
  for (const c of new Set(filas.map(f => f.canal))) { const m = mediana(filas.filter(f => f.canal === c && f.significativa).map(f => f.intensidadPct)); if (m !== null) medianaCanal[c] = dec1(m); }
  return {filas, medianaCanal, cobertura: {reembolsosCruzados: refCruzaN, reembolsosTotales: refTotalN, usdCruzadoMinor: refCruzaMinor, usdTotalMinor: refTotalMinor, pct: pct1(refCruzaMinor, refTotalMinor)}};
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Tracker (catálogo cerrado; monto sin moneda declarada: se supone USD)
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function armarTracker(t) {
  const estados = Object.fromEntries(ESTADOS.map(e => [e, {n: 0, nMonto: 0, montoMinor: 0n}]));
  const motivos = new Map(), canales = new Map();
  for (const r of t.rows) {
    const e = estados[r.status] ?? estados.otro; e.n += r.n; e.nMonto += r.nAmount; e.montoMinor += B(r.amountMinor);
    const neg = NEGADOS.includes(r.status), m = motivos.get(r.reason) ?? {motivo: r.reason, etiqueta: MOTIVO_TRACKER[r.reason] ?? 'Otro', n: 0, negados: 0, reembolsados: 0, negadosMinor: 0n};
    m.n += r.n; if (neg) { m.negados += r.n; m.negadosMinor += B(r.amountMinor); } if (r.status === 'reembolsado') m.reembolsados += r.n; motivos.set(r.reason, m);
    if (neg) { const c = canales.get(r.retailer) ?? {canal: r.retailer, negados: 0, negadosMinor: 0n}; c.negados += r.n; c.negadosMinor += B(r.amountMinor); canales.set(r.retailer, c); }
  }
  const negados = sum(NEGADOS, e => BigInt(estados[e].n)), negadosMinor = sum(NEGADOS, e => estados[e].montoMinor), negadosMonto = NEGADOS.reduce((a, e) => a + estados[e].nMonto, 0);
  return {total: t.total, estados: Object.fromEntries(Object.entries(estados).map(([k, v]) => [k, {n: v.n, nMonto: v.nMonto, montoMinor: String(v.montoMinor)}])), negados: Number(negados), negadosMinor: String(negadosMinor), negadosConMonto: negadosMonto,
    motivos: [...motivos.values()].sort((a, b) => b.n - a.n).map(m => ({...m, negadosMinor: String(m.negadosMinor)})), canales: [...canales.values()].sort((a, b) => b.negados - a.negados).map(c => ({...c, negadosMinor: String(c.negadosMinor)}))};
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Ventas vs quejas por familia de producto
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * complaints = filas {month, family, n} de insight_complaint_family_month ('*' = conversaciones analizadas con la taxonomía v2; '+' = con alguna familia).
 * Cruza SOLO familias `cod:` con mapa a SKU, en los meses en que hay análisis Y el libro de pedidos está completo en TODOS los canales donde la familia vende.
 * Tasa = conversaciones que mencionan la familia por cada 100 líneas vendidas de esa familia en esos mismos meses. «Quejas» = conversaciones de soporte que mencionan la familia (no todas son quejas).
 */
export function armarFamilias({I, complaints, progress}) {
  const base = {progreso: progress?.availability === 'ready' ? {v2: progress.v2, objetivo: progress.objetivo, avancePct: progress.avancePct, conFamilias: progress.conFamilias, cargadas: progress.conversacionesCargadas} : null};
  if (!complaints || complaints.availability === 'unavailable' || complaints.availability === 'timeout') return {...base, status: 'unavailable', filas: [], categorias: []};
  const filas = complaints.availability === 'ready' || complaints.availability === 'partial' ? complaints.rows : [];
  const analizadas = filas.filter(r => r.family === '*'), conFam = filas.filter(r => r.family === '+');
  const totalAnalizadas = analizadas.reduce((a, r) => a + r.n, 0);
  if (!totalAnalizadas) return {...base, status: 'pendiente', filas: [], categorias: []};
  const mesesAnalisis = new Set(analizadas.map(r => r.month));
  // familias de código con mapa a SKU
  const lineasPorFam = new Map(), ingresoPorFam = new Map(), skusPorFam = new Map();
  for (const c of I.celdas) {
    const f = familiaDeSku(c.sku); if (!f) continue;
    const q = I.calidad.get(c.canal + '|' + c.mes); if (!q || q.calidad !== 'completo' || !mesesAnalisis.has(c.mes)) continue;
    lineasPorFam.set(f, (lineasPorFam.get(f) ?? 0) + c.lineas); ingresoPorFam.set(f, (ingresoPorFam.get(f) ?? 0n) + c.activoMinor);
  }
  for (const s of I.skus) if (s.familia) (skusPorFam.get(s.familia) ?? skusPorFam.set(s.familia, new Set()).get(s.familia)).add(s.sku);
  const quejasPorFam = new Map();
  for (const r of filas) if (r.family !== '*' && r.family !== '+') quejasPorFam.set(r.family, (quejasPorFam.get(r.family) ?? 0) + r.n);
  const ingresoTotalFamilias = [...I.skus].filter(s => s.familia).reduce((a, s) => a + s.activoMinor, 0n);
  const filasOut = [...skusPorFam.keys()].filter(f => lineasPorFam.has(f) || quejasPorFam.has(f)).map(f => {
    const lineas = lineasPorFam.get(f) ?? 0, q = quejasPorFam.get(f) ?? 0;
    return {familia: f, etiqueta: etiquetaFamilia(f), skus: skusPorFam.get(f).size, lineas, ingresoMinor: String(ingresoPorFam.get(f) ?? 0n), conversaciones: q, por100: lineas >= UMBRALES.minLineasCruce ? dec1((q * 100) / lineas) : null};
  }).sort((a, b) => Number(B(b.ingresoMinor) - B(a.ingresoMinor)));
  const rangoIng = [...filasOut].sort((a, b) => Number(B(b.ingresoMinor) - B(a.ingresoMinor))).map(f => f.familia), rangoQ = [...filasOut].sort((a, b) => b.conversaciones - a.conversaciones).map(f => f.familia);
  filasOut.forEach(f => { f.posIngreso = rangoIng.indexOf(f.familia) + 1; f.posQuejas = rangoQ.indexOf(f.familia) + 1; });
  const sinMapa = [...quejasPorFam.entries()].filter(([f]) => esFamiliaCodigo(f) && !skusPorFam.has(f)).map(([f, n]) => ({familia: f, etiqueta: etiquetaFamilia(f), conversaciones: n})).sort((a, b) => b.conversaciones - a.conversaciones);
  const categorias = [...quejasPorFam.entries()].filter(([f]) => esFamiliaCategoria(f)).map(([f, n]) => ({familia: f, etiqueta: etiquetaFamilia(f), conversaciones: n})).sort((a, b) => b.conversaciones - a.conversaciones);
  const conFamTotal = conFam.reduce((a, r) => a + r.n, 0);
  return {...base, status: base.progreso && base.progreso.avancePct !== null && base.progreso.avancePct < 100 ? 'parcial' : 'ok', filas: filasOut, sinMapa, categorias, meses: [...mesesAnalisis].sort(),
    cobertura: {analizadas: totalAnalizadas, conFamilia: conFamTotal, conFamiliaPct: totalAnalizadas ? dec1((conFamTotal * 100) / totalAnalizadas) : null, ingresoConMapaPct: pct1(ingresoTotalFamilias, I.activo)}};
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Recomendaciones con evidencia (reglas, sin IA)
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const nc = c => NOMBRE_CANAL[c] ?? c;
export function generarRecomendaciones({ranking, cruce, familias, pares, progress, I}) {
  const out = [], rankPor = new Map(ranking.map(r => [r.sku, r]));
  const cobertura = `Cruce de ${fNum(cruce.cobertura.reembolsosCruzados)} de ${fNum(cruce.cobertura.reembolsosTotales)} reembolsos (${cruce.cobertura.pct === null ? 'n/d' : cruce.cobertura.pct + ' % del dinero devuelto'}) con el ingreso del mismo SKU, canal y mes; solo meses completos.`;
  const ventana = 'Ventanas de exportación parciales; la intensidad no es tasa por cohorte.';
  const sig = cruce.filas.filter(f => f.significativa);
  // R1: revisar con proveedor/canal = intensidad >= 2 × mediana del canal
  for (const f of sig) {
    const med = cruce.medianaCanal[f.canal]; if (med === undefined || med <= 0 || f.intensidadPct < med * UMBRALES.multiplicadorMediana) continue;
    const r = rankPor.get(f.sku);
    out.push({id: `revisar:${f.sku}:${f.canal}`, tipo: 'revisar_proveedor', sku: f.sku, canal: f.canal, titulo: `Revisar ${f.sku} en ${nc(f.canal)} con el proveedor y el canal`,
      accion: `Pedir al proveedor y a ${nc(f.canal)} una revisión de ${f.sku}: calidad del producto, descripción de la ficha y motivo de las devoluciones.`,
      porque: `Más de ${UMBRALES.multiplicadorMediana} veces la intensidad de reembolso típica del canal, con ingreso alto: devuelve ${f.intensidadPct} % de lo que vende frente a ${med} % de la mediana de ${nc(f.canal)}.`,
      evidencia: [`${fNum(f.reembolsos)} reembolsos por ${fUsd(f.reembolsoMinor)} (sin cancelados) frente a ${fUsd(f.ingresoMinor)} de ingreso bruto en los mismos meses (${f.meses.length} meses).`, `Intensidad ${f.intensidadPct} % contra mediana del canal ${med} %.`, r ? `Posición ${r.pos} por ingreso (${r.participacionPct} % del total).` : 'Sin posición en el ranking.'],
      cobertura: `${cobertura} ${ventana}`, impacto: {clase: 'observed', usdMinor: String(f.reembolsoMinor), texto: `${fUsd(f.reembolsoMinor)} de ingreso bruto devuelto en juego (Observado). Cuánto se podría recuperar solo se estima con tus supuestos.`},
      baseMinor: String(f.reembolsoMinor), prioridad: Number(f.reembolsoMinor / 100n)});
  }
  // R2: empujar = ingreso creciente (entre meses completos) con intensidad igual o menor a la mediana del canal
  for (const r of ranking) {
    const g = r.crecimiento; if (!g || g.pct < UMBRALES.minCrecimientoPct) continue;
    const f = cruce.filas.find(x => x.sku === r.sku && x.canal === g.canal); if (!f || !f.significativa) continue;
    const med = cruce.medianaCanal[g.canal]; if (med === undefined || f.intensidadPct > med) continue;
    const delta = B(g.activoMinor) - B(g.previoMinor);
    out.push({id: `empujar:${r.sku}:${g.canal}`, tipo: 'empujar', sku: r.sku, canal: g.canal, titulo: `Empujar ${r.sku} en ${nc(g.canal)}`,
      accion: `Darle más exposición a ${r.sku} en ${nc(g.canal)} (inventario, publicidad o lugar en la ficha) y vigilar que la devolución siga baja.`,
      porque: `Su ingreso crece ${g.pct} % entre ${g.previo} y ${g.mes} (meses completos) y devuelve ${f.intensidadPct} %, no más que la mediana del canal (${med} %).`,
      evidencia: [`${fUsd(g.previoMinor)} en ${g.previo} y ${fUsd(g.activoMinor)} en ${g.mes} (ingreso bruto, sin cancelados).`, `${fNum(f.reembolsos)} reembolsos en ${f.meses.length} meses con cruce; intensidad ${f.intensidadPct} %.`],
      cobertura: `${cobertura} ${ventana}`, impacto: {clase: 'observed', usdMinor: String(delta), texto: `${fUsd(delta)} más de ingreso bruto mensual ya observado entre ${g.previo} y ${g.mes}. Cuánto más se podría ganar solo se estima con tus supuestos.`},
      baseMinor: String(delta > 0n ? delta : 0n), prioridad: Number(delta / 100n) / 2});
  }
  // R3: no ofrecer en un mercado = misma SKU, intensidad >= 2 × mediana en un canal y <= mediana en otro (con ingreso significativo en ambos)
  for (const f of sig) {
    const med = cruce.medianaCanal[f.canal]; if (med === undefined || med <= 0 || f.intensidadPct < med * UMBRALES.multiplicadorMediana) continue;
    const otro = sig.find(x => x.sku === f.sku && x.canal !== f.canal && cruce.medianaCanal[x.canal] !== undefined && x.intensidadPct <= cruce.medianaCanal[x.canal]); if (!otro) continue;
    out.push({id: `canal:${f.sku}:${f.canal}`, tipo: 'revisar_canal', sku: f.sku, canal: f.canal, titulo: `Evaluar si ${f.sku} conviene en ${nc(f.canal)}`,
      accion: `Revisar con ${nc(f.canal)} si seguir ofreciendo ${f.sku} ahí, o cambiar su ficha y empaque, antes de retirarlo.`,
      porque: `En ${nc(f.canal)} devuelve ${f.intensidadPct} % y en ${nc(otro.canal)} ${otro.intensidadPct} %: el mismo SKU se comporta distinto según el canal.`,
      evidencia: [`${nc(f.canal)}: ${fNum(f.reembolsos)} reembolsos, ${fUsd(f.reembolsoMinor)}; ingreso ${fUsd(f.ingresoMinor)}.`, `${nc(otro.canal)}: ${fNum(otro.reembolsos)} reembolsos, ${fUsd(otro.reembolsoMinor)}; ingreso ${fUsd(otro.ingresoMinor)}.`],
      cobertura: `${cobertura} ${ventana} «Mercado» = canal de venta; aún no hay geografía.`, impacto: {clase: 'observed', usdMinor: String(f.reembolsoMinor), texto: `${fUsd(f.reembolsoMinor)} de ingreso bruto devuelto en ${nc(f.canal)} (Observado); el ingreso que se perdería al retirarlo no se estima sin tus supuestos.`},
      baseMinor: String(f.reembolsoMinor), prioridad: Number(f.reembolsoMinor / 100n) * 0.9});
  }
  // R4: cross-selling = accesorio mencionado junto a una línea de modelo (solo con product_families y análisis avanzado)
  if (pares?.length && progress?.availability === 'ready' && (progress.avancePct ?? 0) >= UMBRALES.minAvanceCrossPct) {
    for (const p of pares) {
      if (p.n < UMBRALES.minParConversaciones) continue;
      const [modelo, acc] = esFamiliaCodigo(p.a) && ACCESORIOS.has(p.b) ? [p.a, p.b] : esFamiliaCodigo(p.b) && ACCESORIOS.has(p.a) ? [p.b, p.a] : [null, null]; if (!modelo) continue;
      const fam = familias?.filas?.find(x => x.familia === modelo); if (!fam) continue;
      const accTxt = etiquetaFamilia(acc).replace('Categoría: ', '').toLowerCase(), lineaTxt = 'línea ' + modelo.slice(4);
      out.push({id: `cross:${modelo}:${acc}`, tipo: 'cross_sell', sku: null, canal: null, titulo: `Ofrecer ${accTxt} con la ${lineaTxt}`,
        accion: `Armar una campaña de venta cruzada: ${accTxt} para quienes compran la ${lineaTxt}.`,
        porque: `${fNum(p.n)} conversaciones de soporte mencionan la ${lineaTxt} y ${accTxt} a la vez.`,
        evidencia: [`${fNum(p.n)} conversaciones con ambas menciones (análisis al ${progress.avancePct} %).`, `Línea ${modelo.slice(4)}: ${fUsd(fam.ingresoMinor)} de ingreso bruto en ${fNum(fam.lineas)} líneas.`],
        cobertura: `Solo conversaciones ya analizadas (${progress.avancePct} % del histórico); la mención no prueba que el cliente comprara el accesorio.`, impacto: {clase: 'observed', usdMinor: fam.ingresoMinor, texto: `Base observada: ${fUsd(fam.ingresoMinor)} de ingreso bruto de la ${lineaTxt} sobre la que se vendería. El ingreso extra solo se estima con tus supuestos.`},
        baseMinor: fam.ingresoMinor, prioridad: Number(B(fam.ingresoMinor) / 100n) / 20});
    }
  }
  return out.sort((a, b) => b.prioridad - a.prioridad || a.id.localeCompare(b.id)).slice(0, 12).map(({prioridad, ...r}) => r);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Vista completa
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const ok = r => r && (r.availability === 'ready' || r.availability === 'partial');
const frescura = r => (ok(r) ? {refreshedAt: r.meta?.refreshedAt ?? null, sourceWatermark: r.meta?.sourceWatermark ?? null, partial: Boolean(r.meta?.partial)} : null);
const s2 = o => JSON.parse(JSON.stringify(o, (_, v) => (typeof v === 'bigint' ? String(v) : v)));

/** Arma la vista a partir de las lecturas ya hechas (puro: lo prueban fixtures y la base real por igual). */
export function armarVista({ordenes, reembolsos, tracker, quejas, pares, progreso, ahora = new Date()}) {
  const partes = {ordenes: ordenes?.availability ?? 'unavailable', reembolsos: reembolsos?.availability ?? 'unavailable', tracker: tracker?.availability ?? 'unavailable', quejas: quejas?.availability ?? 'unavailable', progreso: progreso?.availability ?? 'unavailable'};
  const I = ok(ordenes) ? armarIngresos(ordenes.rows) : null;
  const R = ok(reembolsos) ? armarReembolsos(reembolsos.rows) : null;
  const ranking = I ? rankingIngresos(I) : [];
  const cruce = I && R ? cruzar(I, R) : null;
  const familias = I ? armarFamilias({I, complaints: quejas, progress: progreso}) : {status: 'unavailable', filas: [], categorias: [], progreso: progreso?.availability === 'ready' ? progreso : null};
  const T = ok(tracker) ? armarTracker(tracker) : null;
  const recs = I && R && cruce ? generarRecomendaciones({ranking, cruce, familias, pares: ok(pares) ? pares.pairs : [], progress: progreso, I}) : [];
  const vista = {
    generatedAt: ahora.toISOString(), currency: 'USD', class: 'observed', partes, frescura: {ordenes: frescura(ordenes), reembolsos: frescura(reembolsos), tracker: frescura(tracker), quejas: frescura(quejas)},
    umbrales: UMBRALES,
    ingresos: !I ? {status: 'unavailable'} : !I.lineas ? {status: 'empty'} : {status: 'ok', class: 'observed', activoMinor: I.activo, canceladoMinor: I.cancelado, brutoConCanceladosMinor: I.activo + I.cancelado, lineas: I.lineas, canceladas: I.canceladas,
      canceladasPct: dec1((I.canceladas * 100) / I.lineas), revision: I.revision, revisionMinor: I.revisionMinor, sinSkuMinor: I.sinSkuActivo, sinSkuPct: pct1(I.sinSkuActivo, I.activo),
      canales: Object.values(I.canales).sort((a, b) => (b.activoMinor > a.activoMinor ? 1 : -1)).map(c => ({...c, participacionPct: pct1(c.activoMinor, I.activo), conSkuPct: pct1(c.conSku, c.activoMinor)})),
      rango: {desde: Object.values(I.canales).map(c => c.desde).sort()[0], hasta: Object.values(I.canales).map(c => c.hasta).sort().at(-1)},
      otrasMonedas: I.otras.map(o => ({...o})), pares: I.pares,
      meses: I.meses.map(m => ({mes: m.mes, totalMinor: m.totalMinor, canales: m.canales})), calidad: [...I.calidad.values()].map(q => ({canal: q.canal, mes: q.mes, calidad: q.calidad, lineas: q.lineas}))},
    ranking: !I ? {status: 'unavailable', items: []} : {status: ranking.length ? 'ok' : 'empty', total: ranking.length, items: ranking.slice(0, 50), top10Pct: ranking.length ? ranking[Math.min(UMBRALES.topN, ranking.length) - 1].acumPct : null},
    crecimiento: !I ? {status: 'unavailable', items: []} : {status: 'ok', pares: I.pares, items: ranking.filter(r => r.crecimiento).sort((a, b) => b.crecimiento.pct - a.crecimiento.pct).slice(0, 10).map(r => ({sku: r.sku, ...r.crecimiento}))},
    perdidas: {
      reembolsos: !R ? {status: 'unavailable'} : !R.n ? {status: 'empty'} : {status: 'ok', class: 'observed', n: R.n, canceladosN: R.nCanc, sinMonto: R.sinMonto, brutoMinor: R.brutoMinor, activoMinor: R.activoMinor, top10Pct: R.top10Pct, top10: R.top10,
        canales: Object.entries(R.canales).map(([c, v]) => ({canal: c, ...v})), otrasMonedas: R.otras, inicioPorCanal: R.primerMes},
      cancelaciones: !I ? {status: 'unavailable'} : {status: 'ok', class: 'observed', lineas: I.canceladas, pct: dec1((I.canceladas * 100) / Math.max(1, I.lineas)), canceladoMinor: I.cancelado},
      tracker: !T ? {status: 'unavailable'} : T.total ? {status: 'ok', class: 'observed', ...T, supuestoMoneda: 'USD'} : {status: 'empty'},
    },
    intensidad: !cruce ? {status: 'unavailable', filas: []} : {status: 'ok', class: 'observed', filas: [...cruce.filas].sort((a, b) => Number(b.ingresoMinor - a.ingresoMinor)).slice(0, 40).map(f => ({...f, meses: f.meses.length})), medianaCanal: cruce.medianaCanal,
      cobertura: cruce.cobertura, nota: 'Intensidad, no tasa por cohorte: reembolsos del mes entre ingreso del mismo mes, mismo SKU y canal. Los reembolsos de un mes pueden venir de compras anteriores.'},
    concentracion: !R ? {status: 'unavailable'} : {status: 'ok', top10Pct: R.top10Pct, top10: R.top10, skusConReembolso: R.skus.length},
    familias, recomendaciones: {status: I && R ? 'ok' : 'unavailable', items: recs},
  };
  return s2(vista);
}

export function createRevenueGapsRepository({database, now = () => new Date()}) {
  return {
    async get() {
      return database.transaction('read', async s => {
        const ordenes = await readOrderRevenueMonth(s);
        const reembolsos = await readRefundBySkuMonth(s, {top: 50});
        const tracker = await readTrackerRefundStatus(s);
        const quejas = await readComplaintFamilyMonth(s);
        const pares = await readFamilyPairs(s);
        const progreso = await readAnalysisProgress(s);
        return armarVista({ordenes, reembolsos, tracker, quejas, pares, progreso, ahora: now()});
      });
    },
  };
}
