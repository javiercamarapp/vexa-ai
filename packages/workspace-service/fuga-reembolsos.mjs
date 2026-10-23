// «Fuga de reembolsos»: dinero devuelto por SKU y canal (libro económico), intensidad mensual, dinero negado o atorado (Tracker de Excel) y contacto repetido.
// Solo lectura, acotada al tenant, bajo la sesión y la RLS del usuario. Cada parte corre en su propio SAVEPOINT con tope de tiempo: si una no alcanza responde
// {status:'unavailable'} («No disponible ahora»), JAMÁS 0, y las demás partes siguen. Sin PII: del Tracker solo salen campos categóricos (SKU, motivo y subrazón de un catálogo
// cerrado, canal, estado, monto, fecha); el texto libre, nombres, direcciones y números de orden NUNCA salen.
// Vocabulario de honestidad: «Observado» = hecho del libro o del Tracker; «intensidad» = reembolsos del mes / líneas del mes (NO es tasa por cohorte); el libro no trae cantidad.
import {WorkspaceError} from './contracts.mjs';
import {guarded} from './catalog-overview.mjs';

export const FUGA_BUDGETS_MS = Object.freeze({refunds: 4000, orders: 8000, windows: 2500, tracker: 6000, repeat: 2500, conversations: 2500});
export const SKU_SUFFIX = /(-WM[0-9]+|-[0-9]{3}A-[0-9]{3}|-NEW)$/;
export const TRACKER_SHEETS = Object.freeze({'Refunds': 'reembolsos', 'Warranty Tools': 'garantiaHerramientas', 'Warranty Parts': 'garantiaPartes', 'Return Labels': 'etiquetas'});
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** SKU base: mayúsculas y sin sufijos de Walmart (-WMxx), FBA (-001A-001) ni -NEW. Vacío o PENDING = sin SKU (null). */
export function normalizarSku(raw) {
  const s = String(raw ?? '').trim().toUpperCase();
  if (!s || s === 'PENDING' || s.length > 60) return null;
  return s.replace(SKU_SUFFIX, '') || null;
}
const CANALES = ['amazon', 'walmart', 'shopify', 'bestbuy'];
export const NOMBRE_CANAL = Object.freeze({amazon: 'Amazon', walmart: 'Walmart', shopify: 'Shopify', bestbuy: 'Best Buy', otro: 'Otro'});
/** Canal de una fila del libro por el prefijo de su external_id. */
export function canalDeExterno(id) {
  const s = String(id ?? '');
  if (s.startsWith('amazon|')) return 'amazon';
  if (s.startsWith('walmart|')) return 'walmart';
  if (s.startsWith('gid://shopify/')) return 'shopify';
  if (s.startsWith('mirakl_bestbuy')) return 'bestbuy';
  return 'otro';
}
/** Canal de una fuente por su nombre («Marketplace Walmart · Devoluciones (...)»). */
export function canalDeFuente(name) {
  const n = String(name ?? '').toLowerCase();
  if (n.includes('amazon')) return 'amazon';
  if (n.includes('walmart')) return 'walmart';
  if (n.includes('shopify')) return 'shopify';
  if (n.includes('best buy') || n.includes('bestbuy')) return 'bestbuy';
  return 'otro';
}

// ---- catálogos cerrados del Tracker: lo que no está aquí sale como «Otro» (el texto libre puede traer datos personales) ----
const clave = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim();
const MOTIVOS = new Map([['defective', 'Defectuoso'], ['order', 'Pedido'], ['warranty', 'Garantía'], ['return', 'Devolución'], ['shipping', 'Envío'], ['not as expected', 'No era lo esperado'],
  ['change mind', 'Cambió de opinión'], ['price match', 'Igualación de precio'], ['missing parts', 'Faltan piezas'], ['package lost', 'Paquete perdido'], ['never shipped', 'Nunca se envió'],
  ['wrong item was sent', 'Artículo equivocado'], ['bought by mistake', 'Compra por error'], ['inaccurate website description', 'Descripción incorrecta'], ['item arrived too late', 'Llegó tarde'],
  ['incompatible or not useful', 'Incompatible o inútil']]);
const SUBMOTIVOS = new Map([['tool replacement', 'Reemplazo de herramienta'], ['damaged', 'Dañado'], ['missing parts - new tool', 'Faltan piezas (herramienta nueva)'], ['price adjustment', 'Ajuste de precio'],
  ['confirmation', 'Confirmación'], ['no longer wanted', 'Ya no lo quiere'], ['wrong item received', 'Artículo equivocado'], ['lost in transit', 'Perdido en tránsito'], ['shipment delay', 'Retraso de envío'],
  ['part replacement ot', 'Reemplazo de pieza'], ['delivery not received', 'No recibido'], ['cancel - shipped', 'Cancelar (ya enviado)'], ['performance / quality not adequate', 'Desempeño o calidad'],
  ['battery & charger replacement', 'Reemplazo de batería y cargador'], ['battery replacement', 'Reemplazo de batería'], ['stops working', 'Dejó de funcionar'], ['spare parts', 'Refacciones'], ['unable to deliver', 'No se pudo entregar']]);
export const motivoDe = raw => (raw ? MOTIVOS.get(clave(raw)) ?? 'Otro' : null);
export const submotivoDe = raw => (raw ? SUBMOTIVOS.get(clave(raw)) ?? 'Otro (texto libre omitido)' : null);
/** Estado del reembolso en el Tracker. «Allen passed it on…» y otros textos libres caen en 'otro' sin conservar el texto. */
export function estadoDeTracker(raw) {
  const k = clave(raw);
  if (!k) return 'sin_estado';
  if (k === 'refunded' || k === 'refunded by amazon') return 'reembolsado';
  if (k === 'older than 180 days') return 'vencido';
  if (k === 'can not refund' || k === 'cannot refund') return 'no_reembolsable';
  if (k === 'rejected') return 'rechazado';
  if (k === 'submitted') return 'enviado';
  return 'otro';
}
export const ESTADOS_NEGADOS = Object.freeze(['vencido', 'no_reembolsable', 'rechazado']);
export function retailerDe(raw) {
  const k = clave(raw);
  if (!k) return null;
  if (k.startsWith('amazon')) return 'amazon';
  if (k.startsWith('walmart')) return 'walmart';
  if (k.startsWith('best buy')) return 'bestbuy';
  if (k.startsWith('clientex')) return 'tienda';
  if (k.startsWith('lowes') || k.startsWith('lowe')) return 'lowes';
  if (k.startsWith('home depot')) return 'homedepot';
  return 'otro';
}
/** «46353.0» (serie de Excel) -> '2026-11-27'; solo fechas razonables (2020 hasta hoy). Si no, null: nunca se inventa una fecha. */
export function fechaExcel(raw, hoy = new Date()) {
  const t = String(raw ?? '').trim();
  let d = null;
  if (/^\d{5}(\.\d+)?$/.test(t)) d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(t)) * 86400000);
  else if (/^\d{4}-\d{2}-\d{2}/.test(t)) d = new Date(t.slice(0, 10) + 'T00:00:00Z');
  if (!d || Number.isNaN(d.getTime()) || d.getUTCFullYear() < 2020 || d.getTime() > hoy.getTime()) return null;
  return d.toISOString().slice(0, 10);
}
/** Monto del Tracker en centavos (moneda NO declarada: se rotula «supuesto USD»). */
export function montoMinor(raw) {
  const t = String(raw ?? '').replace(/[^0-9.]/g, '');
  if (!t || !/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Math.round(Number(t) * 100);
  return Number.isFinite(n) ? n : null;
}
const pick = (o, names) => { for (const n of names) if (o[n]) return o[n]; return null; };
/** Fila cruda del Tracker (objeto nombre-de-columna -> texto) -> fila categórica sin PII. */
export function filaDeTracker(sheetName, fila, o, hoy = new Date()) {
  return {
    hoja: TRACKER_SHEETS[sheetName] ?? null, fila: Number(fila),
    sku: normalizarSku(pick(o, ['SKU', 'Tool SKU', 'Part SKU', 'P_SKU'])),
    motivo: motivoDe(pick(o, ['Contact_reason', 'Contact Reason'])), submotivo: submotivoDe(o.Subreason),
    retailer: retailerDe(o.Retailer), estado: estadoDeTracker(o.Status),
    montoMinor: sheetName === 'Refunds' ? montoMinor(o.Amount) : null,
    fecha: fechaExcel(pick(o, ['Request_date', 'Request Date']), hoy),
  };
}

// ---- agregadores puros (probados sin base de datos) ----
const big = v => BigInt(String(v ?? '0').split('.')[0] || '0');
const usdMinor = (rows, exp = 2) => rows.filter(r => r.currency === 'USD' && Number(r.exponent) === exp);

/** rows = grupos del libro {ch,sku,month,status,currency,exponent,n,sinMonto,amount}. */
export function armarReembolsos(rows) {
  const por = {amazon: null, walmart: null, shopify: null, bestbuy: null, otro: null};
  const canal = c => (por[c] ??= {n: 0, usdBrutoMinor: 0n, usdNetoMinor: 0n, sinMonto: 0, cancelados: 0, canceladosUsdMinor: 0n, conSku: 0});
  const otras = new Map();
  const skus = new Map(); // sku -> {sku, canales:{c:{n,usd,usdNeto}}, n, usd, usdNeto}
  const mensual = new Map(); // canal|mes -> {n, cancelados}
  const skuMes = new Map(); // sku|canal|mes -> {n, usd}
  for (const r of rows) {
    const n = Number(r.n), amount = big(r.amount);
    if (r.currency !== 'USD' || Number(r.exponent) !== 2) {
      const k = r.currency + ':' + r.exponent, o = otras.get(k) ?? {currency: r.currency, exponent: Number(r.exponent), n: 0, amountMinor: 0n};
      o.n += n; o.amountMinor += amount; otras.set(k, o); continue;
    }
    const c = canal(r.ch), cancelado = r.status === 'cancelled';
    c.n += n; c.usdBrutoMinor += amount; c.sinMonto += Number(r.sinMonto);
    if (cancelado) { c.cancelados += n; c.canceladosUsdMinor += amount; } else c.usdNetoMinor += amount;
    const m = mensual.get(r.ch + '|' + r.month) ?? {canal: r.ch, mes: r.month, n: 0, cancelados: 0}; m.n += n; if (cancelado) m.cancelados += n; mensual.set(r.ch + '|' + r.month, m);
    const sku = normalizarSku(r.sku);
    if (!sku) continue;
    c.conSku += n;
    const s = skus.get(sku) ?? {sku, canales: {}, n: 0, usdBrutoMinor: 0n, usdNetoMinor: 0n};
    const sc = s.canales[r.ch] ?? {n: 0, usdBrutoMinor: 0n, usdNetoMinor: 0n};
    sc.n += n; sc.usdBrutoMinor += amount; if (!cancelado) sc.usdNetoMinor += amount;
    s.canales[r.ch] = sc; s.n += n; s.usdBrutoMinor += amount; if (!cancelado) s.usdNetoMinor += amount; skus.set(sku, s);
    const km = sku + '|' + r.ch + '|' + r.month, sm = skuMes.get(km) ?? {sku, canal: r.ch, mes: r.month, n: 0, usdBrutoMinor: 0n}; sm.n += n; sm.usdBrutoMinor += amount; skuMes.set(km, sm);
  }
  return {por, otras: [...otras.values()], skus: [...skus.values()], mensual: [...mensual.values()], skuMes: [...skuMes.values()]};
}

/** orders = grupos {kind:'sku'|'mes'|'total', ch, sku, month, n, revised}. Líneas = filas del libro (el libro no trae cantidad). */
export function armarLineas(rows) {
  const porSku = new Map(), porMes = new Map();
  let total = 0, revisadas = 0;
  for (const r of rows) {
    const n = Number(r.n);
    if (r.kind === 'total') { total = n; revisadas = Number(r.revised); }
    else if (r.kind === 'sku') { const sku = normalizarSku(r.sku); if (!sku) continue; const k = sku + '|' + r.ch; porSku.set(k, (porSku.get(k) ?? 0) + n); }
    else if (r.kind === 'mes') porMes.set(r.ch + '|' + r.month, n);
  }
  return {porSku, porMes, total, revisadas};
}

/** Ranking de SKUs con líneas vendidas (mismo SKU base, ambos canales), % del total y % acumulado. */
export function rankingSkus({skus, lineas, totalBrutoMinor}) {
  const orden = [...skus].sort((a, b) => (b.usdBrutoMinor > a.usdBrutoMinor ? 1 : b.usdBrutoMinor < a.usdBrutoMinor ? -1 : a.sku.localeCompare(b.sku)));
  let acum = 0n;
  return orden.map((s, i) => {
    acum += s.usdBrutoMinor;
    let lineasSku = 0, hay = false;
    const canales = Object.entries(s.canales).map(([c, v]) => {
      const l = lineas ? lineas.porSku.get(s.sku + '|' + c) ?? 0 : null;
      if (l !== null) { lineasSku += l; hay = true; }
      return {canal: c, n: v.n, usdBrutoMinor: String(v.usdBrutoMinor), usdNetoMinor: String(v.usdNetoMinor), lineas: l};
    }).sort((a, b) => Number(BigInt(b.usdBrutoMinor) - BigInt(a.usdBrutoMinor)));
    return {pos: i + 1, sku: s.sku, n: s.n, usdBrutoMinor: String(s.usdBrutoMinor), usdNetoMinor: String(s.usdNetoMinor), canales, lineas: hay ? lineasSku : null,
      acumPct: totalBrutoMinor > 0n ? Number((acum * 10000n) / totalBrutoMinor) / 100 : null};
  });
}

const addMes = (m, d) => { const [y, mo] = m.split('-').map(Number); const t = new Date(Date.UTC(y, mo - 1 + d, 1)); return t.toISOString().slice(0, 7); };
const primerDia = m => m + '-01', finMes = m => addMes(m, 1) + '-01';
const mesesEntre = (a, b) => { const out = []; for (let m = a; m <= b; m = addMes(m, 1)) out.push(m); return out; };

/**
 * Intensidad mensual por canal (reembolsos del mes / líneas del mes) con la calidad de cada mes:
 *  parcial = la ventana de exportación no cubre el mes completo (o es el último mes con datos: puede estar cortado);
 *  posible_hueco = las líneas del mes caen por debajo de la mitad del mes previo (suele ser un hueco de exportación, no una caída real).
 */
export function armarIntensidad({mensual, lineas, ventanas, canales = ['amazon', 'walmart']}) {
  const out = {};
  for (const c of canales) {
    const refunds = new Map(mensual.filter(m => m.canal === c).map(m => [m.mes, m]));
    const delCanal = [...lineas.porMes.keys()].filter(k => k.startsWith(c + '|')).map(k => k.slice(c.length + 1));
    const meses = [...new Set([...refunds.keys(), ...delCanal])].sort();
    if (!meses.length) { out[c] = {meses: []}; continue; }
    const vR = ventanas.find(v => v.canal === c && v.tipo === 'refund'), vO = ventanas.find(v => v.canal === c && v.tipo === 'order');
    const ultimo = meses.at(-1);
    const dentro = (v, m) => !v || !v.inicio || !v.fin || (primerDia(m) >= v.inicio.slice(0, 10) && finMes(m) <= addDia(v.fin.slice(0, 10)));
    // Antes de que empiece el libro de reembolsos del canal, 0 reembolsos sería un cero falso: esos meses no se muestran.
    const desde = vR?.inicio ? vR.inicio.slice(0, 7) : meses[0];
    out[c] = {meses: mesesEntre(meses[0], ultimo).filter(m => m >= desde).map(m => {
      const l = lineas.porMes.get(c + '|' + m) ?? 0, r = refunds.get(m)?.n ?? 0, canc = refunds.get(m)?.cancelados ?? 0, prev = lineas.porMes.get(c + '|' + addMes(m, -1)) ?? 0;
      let calidad = 'completo';
      if (!dentro(vR, m) || !dentro(vO, m) || m === ultimo) calidad = 'parcial';
      if (l > 0 && prev > 0 && l < prev / 2) calidad = 'posible_hueco';
      return {mes: m, reembolsos: r, cancelados: canc, lineas: l, intensidadPct: l > 0 ? Math.round((r * 1000) / l) / 10 : null, calidad};
    }).filter(f => f.lineas > 0 || f.reembolsos > 0)};
  }
  return out;
}
const addDia = iso => new Date(Date.parse(iso + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);

/** Intensidad de un canal sin los reembolsos cancelados, sobre los meses indicados (p. ej. jul-sep de Walmart). */
export function sinCancelados(meses) {
  const l = meses.reduce((a, m) => a + m.lineas, 0), r = meses.reduce((a, m) => a + m.reembolsos, 0), c = meses.reduce((a, m) => a + m.cancelados, 0);
  return {reembolsos: r, cancelados: c, lineas: l, conPct: l > 0 ? Math.round((r * 1000) / l) / 10 : null, sinPct: l > 0 ? Math.round(((r - c) * 1000) / l) / 10 : null};
}

/** Tracker: agregados de «Reembolsos» (dinero negado o atorado) y por SKU. filas = filaDeTracker(...). */
export function armarTracker(filas) {
  const ref = filas.filter(f => f.hoja === 'reembolsos' && (f.estado !== 'sin_estado' || f.motivo));
  const estados = {reembolsado: 0, vencido: 0, no_reembolsable: 0, rechazado: 0, enviado: 0, otro: 0, sin_estado: 0};
  const porMotivo = new Map();
  let montoMinor = 0, conMonto = 0;
  const montoPorEstado = {reembolsado: 0, vencido: 0, no_reembolsable: 0, rechazado: 0, enviado: 0, otro: 0, sin_estado: 0};
  for (const f of ref) {
    estados[f.estado]++;
    const m = f.motivo ?? 'Sin motivo', o = porMotivo.get(m) ?? {motivo: m, n: 0, montoMinor: 0, reembolsados: 0, negados: 0, otros: 0, sinMonto: 0};
    o.n++; if (f.montoMinor === null) o.sinMonto++; else { o.montoMinor += f.montoMinor; montoMinor += f.montoMinor; conMonto++; montoPorEstado[f.estado] += f.montoMinor; }
    if (f.estado === 'reembolsado') o.reembolsados++; else if (ESTADOS_NEGADOS.includes(f.estado)) o.negados++; else o.otros++;
    porMotivo.set(m, o);
  }
  const negados = ref.filter(f => ESTADOS_NEGADOS.includes(f.estado));
  const cola = negados.map(f => ({fila: f.fila, estado: f.estado, sku: f.sku, motivo: f.motivo, submotivo: f.submotivo, retailer: f.retailer, montoMinor: f.montoMinor, fecha: f.fecha}))
    .sort((a, b) => String(a.fecha ?? '9999').localeCompare(String(b.fecha ?? '9999')) || a.fila - b.fila).slice(0, 500);
  const bySku = {};
  for (const f of filas) {
    if (!f.sku || !f.hoja) continue;
    const s = bySku[f.sku] ??= {hojas: {}, motivos: {}, submotivos: {}, retailer: {}, estados: {}, reembolsosMonto: 0, reembolsosConMonto: 0};
    s.hojas[f.hoja] = (s.hojas[f.hoja] ?? 0) + 1;
    if (f.motivo) s.motivos[f.motivo] = (s.motivos[f.motivo] ?? 0) + 1;
    if (f.submotivo) s.submotivos[f.submotivo] = (s.submotivos[f.submotivo] ?? 0) + 1;
    if (f.retailer) s.retailer[f.retailer] = (s.retailer[f.retailer] ?? 0) + 1;
    if (f.hoja === 'reembolsos') { s.estados[f.estado] = (s.estados[f.estado] ?? 0) + 1; if (f.montoMinor !== null) { s.reembolsosMonto += f.montoMinor; s.reembolsosConMonto++; } }
  }
  return {
    filasReembolsos: ref.length, estados, montoMinor, conMonto, montoPorEstado, negados: negados.length,
    porMotivo: [...porMotivo.values()].sort((a, b) => b.n - a.n || a.motivo.localeCompare(b.motivo)),
    cola, colaTruncada: negados.length > cola.length, bySku,
    totalFilasConSku: filas.filter(f => f.sku && f.hoja).length,
  };
}

const NOTAS_FIJAS = Object.freeze({
  intensidad: 'Intensidad mensual (reembolsos del mes entre líneas del mes), no una tasa por cohorte. Las ventanas de exportación son parciales y el libro no trae cantidad por línea.',
  tracker: 'Muestra del Tracker de Excel, no el total de reembolsos. Monto sin moneda declarada: se supone USD.',
});

export function createRefundLeakRepository({database, now = () => new Date(), budgets = FUGA_BUDGETS_MS}) {
  return {
    /** @param {{dateStart?:string|null,dateEnd?:string|null}} q  corte opcional por fecha efectiva ([inicio, fin)). */
    async get({dateStart = null, dateEnd = null} = {}) {
      for (const d of [dateStart, dateEnd]) if (d !== null && !(typeof d === 'string' && DAY.test(d) && Number.isFinite(Date.parse(d + 'T00:00:00Z')))) throw new WorkspaceError('refunds_input_invalid', 400);
      if (dateStart && dateEnd && dateStart >= dateEnd) throw new WorkspaceError('refunds_input_invalid', 400);
      const hoy = now();
      return database.transaction('read', async s => {
        const cut = [dateStart ? dateStart + 'T00:00:00Z' : null, dateEnd ? dateEnd + 'T00:00:00Z' : null];
        const dl = k => Date.now() + budgets[k];
        const SKU3 = "regexp_replace(upper(split_part(external_id,'|',3)),'(-WM[0-9]+|-[0-9]{3}A-[0-9]{3}|-NEW)$','')";
        const SKU4 = "regexp_replace(upper(split_part(external_id,'|',4)),'(-WM[0-9]+|-[0-9]{3}A-[0-9]{3}|-NEW)$','')";
        const CH = "CASE WHEN external_id LIKE 'amazon|%' THEN 'amazon' WHEN external_id LIKE 'walmart|%' THEN 'walmart' WHEN external_id LIKE 'gid://shopify/%' THEN 'shopify' WHEN external_id LIKE 'mirakl_bestbuy%' THEN 'bestbuy' ELSE 'otro' END";
        const reembolsos = await guarded(s, dl('refunds'), 'fuga_refunds', async () => (await s.query(
          `SELECT ${CH} AS ch, ${SKU4} AS sku, to_char(effective_at AT TIME ZONE 'UTC','YYYY-MM') AS month, status, currency, exponent::int AS exponent, count(*)::int AS n,
             count(*) FILTER (WHERE amount_minor IS NULL)::int AS "sinMonto", coalesce(sum(amount_minor),0)::text AS amount
           FROM public.economic_ledger_entries e
           WHERE tenant_id=$1 AND kind='refund' AND ($2::timestamptz IS NULL OR effective_at>=$2) AND ($3::timestamptz IS NULL OR effective_at<$3)
             AND NOT EXISTS (SELECT 1 FROM public.economic_ledger_entries l2 WHERE l2.tenant_id=e.tenant_id AND l2.entity_id=e.entity_id AND l2.revision>e.revision)
           GROUP BY 1,2,3,4,5,6 LIMIT 20000`, [s.tenantId, ...cut])).rows);

        const pedidosSql = (ultima) => `SELECT CASE WHEN GROUPING(ch)=1 THEN 'total' WHEN GROUPING(month)=1 THEN 'sku' ELSE 'mes' END AS kind, ch, sku, month, count(*)::int AS n, count(*) FILTER (WHERE revision>1)::int AS revised
           FROM (SELECT ${CH} AS ch, ${SKU3} AS sku, to_char(effective_at AT TIME ZONE 'UTC','YYYY-MM') AS month, revision FROM public.economic_ledger_entries e
             WHERE tenant_id=$1 AND kind='order' AND currency='USD' AND exponent=2 AND ($2::timestamptz IS NULL OR effective_at>=$2) AND ($3::timestamptz IS NULL OR effective_at<$3)
             ${ultima ? 'AND NOT EXISTS (SELECT 1 FROM public.economic_ledger_entries l2 WHERE l2.tenant_id=e.tenant_id AND l2.entity_id=e.entity_id AND l2.revision>e.revision)' : ''}) x
           WHERE ch IN ('amazon','walmart') GROUP BY GROUPING SETS ((ch,sku),(ch,month),()) LIMIT 20000`;
        let pedidos = await guarded(s, dl('orders'), 'fuga_orders', async () => (await s.query(pedidosSql(false), [s.tenantId, ...cut])).rows);
        // Si hay revisiones posteriores, solo cuenta la última de cada línea (camino más lento); si no alcanza el tiempo, las líneas quedan «no disponibles».
        if (pedidos && pedidos.some(r => r.kind === 'total' && Number(r.revised) > 0)) pedidos = await guarded(s, dl('orders'), 'fuga_orders2', async () => (await s.query(pedidosSql(true), [s.tenantId, ...cut])).rows);

        const fuentes = await guarded(s, dl('windows'), 'fuga_windows', async () => (await s.query(
          `SELECT DISTINCT ON (source_id) source_id, name, evidence_type, complete, window_start, window_end, watermark, active
           FROM public.economic_source_versions WHERE tenant_id=$1 ORDER BY source_id, version DESC`, [s.tenantId])).rows);

        const trackerRows = await guarded(s, dl('tracker'), 'fuga_tracker', async () => (await s.query(
          `WITH hdr AS (SELECT DISTINCT sheet_name, (c->>'col')::int AS col, c->>'v' AS name FROM public.tracker_row_revisions r, jsonb_array_elements(r.cells) c
              WHERE r.tenant_id=$1 AND r.ticket_state='header' AND r.sheet_name = ANY($2::text[])
                AND c->>'v' IN ('SKU','Tool SKU','Part SKU','P_SKU','Contact_reason','Contact Reason','Subreason','Retailer','Status','Amount','Request_date','Request Date')),
            latest AS (SELECT DISTINCT ON (sheet_name,row_number) sheet_name,row_number,cells FROM public.tracker_row_revisions
              WHERE tenant_id=$1 AND ticket_state<>'header' AND sheet_name = ANY($2::text[]) ORDER BY sheet_name,row_number,created_at DESC)
           SELECT l.sheet_name AS sheet, l.row_number AS fila, jsonb_object_agg(h.name, btrim(c->>'v')) FILTER (WHERE btrim(coalesce(c->>'v',''))<>'') AS o
           FROM latest l CROSS JOIN LATERAL jsonb_array_elements(l.cells) c JOIN hdr h ON h.sheet_name=l.sheet_name AND h.col=(c->>'col')::int
           GROUP BY 1,2 LIMIT 20000`, [s.tenantId, Object.keys(TRACKER_SHEETS)])).rows);

        const repetido = await guarded(s, dl('repeat'), 'fuga_repeat', async () => (await s.query(
          `SELECT refreshed_at, source_watermark, contacts, contacts_ge2_90, contacts_ge3_90, linked_tickets, repeat_tickets_90, total_tickets, by_category FROM public.contact_repeat_summary WHERE tenant_id=$1`, [s.tenantId])).rows[0] ?? false);

        const convs = await guarded(s, dl('conversations'), 'fuga_convs', async () => {
          const st = (await s.query("SELECT refreshed_at FROM public.summary_refresh_state WHERE tenant_id=$1 AND summary='conversation_monthly'", [s.tenantId])).rows[0];
          if (!st) return false;
          return {refreshedAt: st.refreshed_at, meses: (await s.query("SELECT to_char(month,'YYYY-MM') AS month, n FROM public.conversation_monthly WHERE tenant_id=$1 ORDER BY month LIMIT 2000", [s.tenantId])).rows.map(r => ({mes: r.month, n: Number(r.n)}))};
        });

        const ventanas = (fuentes ?? []).filter(f => f.active !== false && ['order_export', 'payment_ledger'].includes(f.evidence_type)).map(f => ({
          canal: canalDeFuente(f.name), tipo: f.evidence_type === 'payment_ledger' ? 'refund' : 'order', completa: Boolean(f.complete),
          inicio: f.window_start ? new Date(f.window_start).toISOString() : null, fin: f.window_end ? new Date(f.window_end).toISOString() : null, corte: f.watermark ? new Date(f.watermark).toISOString() : null,
        }));

        // ---- titular y ranking ----
        const R = reembolsos ? armarReembolsos(reembolsos) : null;
        const L = pedidos ? armarLineas(pedidos) : null;
        let titular = {status: 'unavailable'}, skus = {status: 'unavailable', items: []}, intensidad = {status: 'unavailable'};
        if (R) {
          let bruto = 0n, neto = 0n, canc = 0n, sinMonto = 0, n = 0;
          for (const c of Object.values(R.por)) if (c) { bruto += c.usdBrutoMinor; neto += c.usdNetoMinor; canc += c.canceladosUsdMinor; sinMonto += c.sinMonto; n += c.n; }
          const rank = rankingSkus({skus: R.skus, lineas: L, totalBrutoMinor: bruto});
          const top = rank.slice(0, 10), topUsd = top.reduce((a, r) => a + BigInt(r.usdBrutoMinor), 0n);
          const canalOut = c => R.por[c] ? {n: R.por[c].n, usdBrutoMinor: String(R.por[c].usdBrutoMinor), usdNetoMinor: String(R.por[c].usdNetoMinor), sinMonto: R.por[c].sinMonto, cancelados: R.por[c].cancelados, conSku: R.por[c].conSku} : null;
          titular = {
            status: n === 0 ? 'empty' : 'ok', class: 'observed', currency: 'USD', exponent: 2, n,
            usdBrutoMinor: String(bruto), usdNetoMinor: String(neto), canceladosUsdMinor: String(canc), sinMonto,
            canales: Object.fromEntries(CANALES.map(c => [c, canalOut(c)]).filter(([, v]) => v)),
            otrasMonedas: R.otras.map(o => ({currency: o.currency, exponent: o.exponent, n: o.n, amountMinor: String(o.amountMinor)})),
            top10: {n: top.length, usdBrutoMinor: String(topUsd), pct: bruto > 0n ? Number((topUsd * 1000n) / bruto) / 10 : null},
          };
          const walmartRank = rank.filter(r => r.canales.some(c => c.canal === 'walmart'));
          const detalleSkus = new Set(rank.slice(0, 25).map(r => r.sku));
          skus = {status: rank.length ? 'ok' : 'empty', class: 'observed', top, total: rank.length, sinSku: {n: n - Object.values(R.por).reduce((a, c) => a + (c?.conSku ?? 0), 0)},
            walmart: walmartRank.map(r => { const w = r.canales.find(c => c.canal === 'walmart'); return {sku: r.sku, n: w.n, usdBrutoMinor: w.usdBrutoMinor, usdNetoMinor: w.usdNetoMinor, lineas: w.lineas}; }),
            lineasStatus: L ? 'ok' : 'unavailable',
            detalleMensual: R.skuMes.filter(m => detalleSkus.has(m.sku)).map(m => ({sku: m.sku, canal: m.canal, mes: m.mes, n: m.n, usdBrutoMinor: String(m.usdBrutoMinor)})).sort((a, b) => a.sku.localeCompare(b.sku) || a.mes.localeCompare(b.mes) || a.canal.localeCompare(b.canal))};
          if (L) {
            const bloques = armarIntensidad({mensual: R.mensual, lineas: L, ventanas});
            const walmart = bloques.walmart?.meses ?? [];
            intensidad = {status: 'ok', class: 'observed', nota: NOTAS_FIJAS.intensidad, canales: bloques,
              walmartSinCancelados: walmart.length ? sinCancelados(walmart) : null,
              bestBuy: {reembolsosEnElLibro: R.por.bestbuy?.n ?? 0}};
          }
        }

        // ---- Tracker ----
        let tracker = {status: 'unavailable'};
        if (trackerRows) {
          const filas = trackerRows.map(r => filaDeTracker(r.sheet, r.fila, r.o ?? {}, hoy)).filter(f => f.hoja);
          const t = armarTracker(filas);
          tracker = {status: t.filasReembolsos ? 'ok' : 'empty', class: 'observed', nota: NOTAS_FIJAS.tracker, currencyAssumed: 'USD', ...t};
          const enRanking = new Set(skus.status === 'ok' ? skus.top.map(r => r.sku).concat(skus.walmart.map(w => w.sku)) : []);
          tracker.bySku = Object.fromEntries(Object.entries(t.bySku).filter(([k]) => enRanking.has(k)));
          tracker.skusConFilas = Object.keys(t.bySku).length;
        }

        // ---- contacto repetido ----
        let contactoRepetido = {status: 'unavailable'};
        if (repetido === false) contactoRepetido = {status: 'not_computed', note: 'El resumen de contacto repetido todavía no se ha calculado para esta organización.'};
        else if (repetido) {
          const c = Number(repetido.contacts), bind = repetido.source_watermark ? new Date(repetido.source_watermark).toISOString() : null;
          contactoRepetido = {status: c > 0 ? 'ok' : 'empty', class: 'observed', refreshedAt: new Date(repetido.refreshed_at).toISOString(), corte: bind,
            contactos: c, contactosDosOMas90: Number(repetido.contacts_ge2_90), contactosTresOMas90: Number(repetido.contacts_ge3_90),
            pctDosOMas: c > 0 ? Math.round((Number(repetido.contacts_ge2_90) * 1000) / c) / 10 : null, pctTresOMas: c > 0 ? Math.round((Number(repetido.contacts_ge3_90) * 1000) / c) / 10 : null,
            ticketsVinculados: Number(repetido.linked_tickets), ticketsTotales: Number(repetido.total_tickets), ticketsQueRepiten90: Number(repetido.repeat_tickets_90),
            pctSinVincular: Number(repetido.total_tickets) > 0 ? Math.round(((Number(repetido.total_tickets) - Number(repetido.linked_tickets)) * 1000) / Number(repetido.total_tickets)) / 10 : null,
            porCategoria: (Array.isArray(repetido.by_category) ? repetido.by_category : []).filter(x => !/^Other: Retailer notifications/i.test(String(x.category))).slice(0, 6)
              .map(x => ({categoria: String(x.category), clientes: Number(x.customers), repiten: Number(x.repeaters), pct: Number(x.customers) > 0 ? Math.round((Number(x.repeaters) * 1000) / Number(x.customers)) / 10 : null}))};
        }

        // ---- qué cambió: solo meses completos y sin huecos ----
        const cambios = armarCambios({intensidad: intensidad.status === 'ok' ? intensidad.canales : null, conversaciones: convs || null});

        return {
          generatedAt: hoy.toISOString(), scope: {dateStart, dateEnd, currency: 'USD'}, class: 'observed',
          ventanas, todasParciales: ventanas.length > 0 && ventanas.every(v => !v.completa),
          titular, skus, intensidad, tracker, contactoRepetido, cambios,
          parts: {refunds: reembolsos ? 'ok' : 'unavailable', orders: pedidos ? 'ok' : 'unavailable', windows: fuentes ? 'ok' : 'unavailable', tracker: trackerRows ? 'ok' : 'unavailable', repeat: repetido === false ? 'not_computed' : repetido ? 'ok' : 'unavailable', conversations: convs === false ? 'not_computed' : convs ? 'ok' : 'unavailable'},
        };
      });
    },
  };
}

/** «Qué cambió»: solo meses completos y sin hueco; se compara el último mes válido con el anterior (reembolsos) y con el mismo mes del año previo (conversaciones). */
export function armarCambios({intensidad, conversaciones}) {
  const out = {reembolsos: [], conversaciones: null, excluidos: []};
  if (intensidad) for (const [canal, b] of Object.entries(intensidad)) {
    const meses = b.meses ?? [];
    for (const m of meses) if (m.calidad !== 'completo') out.excluidos.push({canal, mes: m.mes, motivo: m.calidad});
    const validos = meses.filter(m => m.calidad === 'completo' && m.intensidadPct !== null);
    const [ult, prev] = [validos.at(-1), validos.at(-2)];
    if (ult && prev && addMes(prev.mes, 1) === ult.mes) out.reembolsos.push({canal, mes: ult.mes, previo: prev.mes, reembolsos: ult.reembolsos, reembolsosPrevio: prev.reembolsos, intensidadPct: ult.intensidadPct, intensidadPrevioPct: prev.intensidadPct});
  }
  if (conversaciones?.meses?.length) {
    const meses = conversaciones.meses, ultimoMes = meses.at(-1).mes;
    const validos = meses.filter(m => m.mes < ultimoMes && m.mes < hoyMes(conversaciones.refreshedAt)); // el último mes de la serie puede estar cortado
    const ult = validos.at(-1), anterior = ult && meses.find(m => m.mes === addMes(ult.mes, -12));
    if (ult) out.conversaciones = {mes: ult.mes, n: ult.n, mesAnioPrevio: anterior?.mes ?? null, nAnioPrevio: anterior?.n ?? null, excluido: ultimoMes};
    if (conversaciones.meses.at(-1)) out.excluidos.push({canal: 'conversaciones', mes: ultimoMes, motivo: 'parcial'});
  }
  return out;
}
const hoyMes = iso => new Date(iso ?? Date.now()).toISOString().slice(0, 7);
export const etiquetaMes = m => { const [y, mo] = String(m).split('-').map(Number); return MESES[mo - 1] ? `${MESES[mo - 1]} ${y}` : m; };
