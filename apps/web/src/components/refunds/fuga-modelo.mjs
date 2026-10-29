// Modelo de presentación de «Fuga de reembolsos»: textos por plantilla (nunca IA libre), formato de dinero y el estimador con candado. Puro y probado.
// Regla: ninguna cifra sin su clase (Observado / Estimado / Inferido), periodo y cobertura. El estimador NO propone valores: sin supuestos tecleados no hay número.
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
import {usd as usdEs, entero, porcentaje as pctEs, dia as diaEs} from '../../lib/formato/es-mx.mjs';
import {formatoNum} from '../../lib/formato/idioma.mjs';
const MESES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Fórmulas del estimador (valores tecleados, no cifras observadas): mismo formato de enteros y decimales que usdEs (idéntico en español e inglés).
// Formato único de dinero (con «US$»): mismas reglas que lib/formato/es-mx.mjs.
const enUS = (dec) => { const f = formatoNum({minimumFractionDigits: dec, maximumFractionDigits: dec}); return {format: v => `${v < 0 ? '−' : ''}US$${f.format(Math.abs(v))}`}; };
const USD0 = enUS(0);
const USD2 = enUS(2);
const NUM = formatoNum();
const PCT = formatoNum({maximumFractionDigits: 1});
export const NOMBRE = Object.freeze({amazon: 'Amazon', walmart: 'Walmart', shopify: 'Shopify', bestbuy: 'Best Buy', tienda: 'Tienda propia', lowes: 'Lowe’s', homedepot: 'Home Depot', otro: 'Otro'});
export const ESTADO_TXT = Object.freeze({reembolsado: 'Reembolsado', vencido: 'Más de 180 días', no_reembolsable: 'No reembolsable', rechazado: 'Rechazado', enviado: 'Enviado', otro: 'Otro estado', sin_estado: 'Sin estado'});
export const HOJA_TXT = Object.freeze({reembolsos: 'Reembolsos', garantiaHerramientas: 'Garantía de herramientas', garantiaPartes: 'Garantía de partes', etiquetas: 'Etiquetas de devolución'});

/** centavos (string|number|bigint) -> «$123,456» (sin decimales) o con decimales. Misma función que Resumen, CFO y Brechas (lib/formato/es-mx.mjs). */
export const usd = (minor, {decimals = false, idioma} = {}) => usdEs(minor, {decimales: decimals, idioma});
export const num = (n, idioma) => entero(n, typeof idioma === 'string' ? idioma : undefined);
export const pct = (p, idioma) => pctEs(p, {idioma: typeof idioma === 'string' ? idioma : undefined});
export const mesCorto = (m, idioma) => { const [y, mo] = String(m).split('-').map(Number), ms = idioma === 'en' ? MESES_EN : MESES; return ms[mo - 1] ? `${ms[mo - 1]} ${String(y).slice(2)}` : String(m); };
export const mesLargo = (m, idioma) => { const [y, mo] = String(m).split('-').map(Number), ms = idioma === 'en' ? MESES_EN : MESES; return ms[mo - 1] ? `${ms[mo - 1]} ${y}` : String(m); };
export const dia = (iso, idioma) => diaEs(iso, typeof idioma === 'string' ? idioma : undefined);
const diaLargo = dia;
// Textos de las plantillas de este módulo puro: español canónico (lo que fijan las pruebas) e inglés. El idioma es siempre opcional y por omisión 'es'.
export const TXT = {
  es: {y: ' y ', concentran: (n, p) => `${n} SKUs concentran el ${p} del dinero devuelto.`, primeros: (b, k, canal, fam, lista) => `${b} Los ${k} primeros son de ${canal} (${fam > 1 ? 'familias' : 'familia'} ${lista}).`,
    reembolsos: 'reembolsos', amazonSin: p => ` ${p} de los de Amazon sin monto.`, sinMonto: n => ` ${n} sin monto.`, noSuman: (l, n) => ` ${l} no se suman (${n} reembolsos).`,
    ventanaDesde: (c, d) => `${c} desde ${d}`, datosHasta: d => ` Datos hasta el ${d}.`, ninguna: 'Ninguna ventana de exportación está marcada como completa', hay: 'Hay ventanas de exportación parciales', ventLinea: (a, l, h) => `${a} (reembolsos: ${l}).${h}`,
    del: (a, b) => `del ${a} al ${b}`, elInicio: 'el inicio', hoy: 'hoy', alTxt: (a, b) => `${a} al ${b}`, noHay: p => `No hay reembolsos cargados en el periodo elegido (${p}).`, eligido: (p, r) => `El periodo elegido es ${p}, pero los reembolsos cargados cubren ${r}.`,
    acum: (rango, bruto, neto, n) => `Acumulado disponible (todo el libro${rango}): ${bruto} brutos${neto} en ${n} reembolsos. Mezcla ventanas distintas por canal; no es el total de un periodo.`, acumNeto: u => ` (${u} sin cancelados)`, acumRango: (a, b) => `, del ${a} al ${b}`,
    etiqueta: r => `Reembolsos ${r}`, sinPeriodo: 'Periodo de los reembolsos no disponible',
    convFrente: (m, n, p, mp, d) => `${m}: ${n} conversaciones cargadas, frente a ${p} en ${mp} (${d} %). Es un conteo de lo cargado; no explica por qué cambió.`, convSolo: (m, n) => `${m}: ${n} conversaciones cargadas. No hay el mismo mes del año anterior para comparar.`,
    refCambio: (c, m, n, i, np, mp, ip) => `${c}, ${m}: ${n} reembolsos (intensidad ${i}) frente a ${np} en ${mp} (${ip}).`, parcial: 'mes parcial', hueco: 'posible hueco de exportación', conversaciones: 'Conversaciones',
    pctRango: 'Escribe un número entre 0 y 100.', pctMax: 'El porcentaje no puede pasar de 100.', montoErr: 'Escribe un monto en dólares, por ejemplo 6.50.'},
  en: {y: ' and ', concentran: (n, p) => `${n} SKUs account for ${p} of the money refunded.`, primeros: (b, k, canal, fam, lista) => `${b} The first ${k} are from ${canal}, ${fam > 1 ? 'families' : 'family'} ${lista}.`,
    reembolsos: 'refunds', amazonSin: p => ` ${p} of the Amazon ones have no amount.`, sinMonto: n => ` ${n} without an amount.`, noSuman: (l, n) => ` ${l} are not added, ${n} refunds.`,
    ventanaDesde: (c, d) => `${c} from ${d}`, datosHasta: d => ` Data through ${d}.`, ninguna: 'No export window is marked as complete', hay: 'There are partial export windows', ventLinea: (a, l, h) => `${a}. Refunds: ${l}.${h}`,
    del: (a, b) => `from ${a} to ${b}`, elInicio: 'the start', hoy: 'today', alTxt: (a, b) => `${a} to ${b}`, noHay: p => `There are no refunds loaded in the chosen period, ${p}.`, eligido: (p, r) => `The chosen period is ${p}, but the loaded refunds cover ${r}.`,
    acum: (rango, bruto, neto, n) => `Cumulative available, whole ledger${rango}: ${bruto} gross${neto} across ${n} refunds. It mixes different windows by channel and is not the total of one period.`, acumNeto: u => `, ${u} excluding cancelled`, acumRango: (a, b) => `, from ${a} to ${b}`,
    etiqueta: r => `Refunds ${r}`, sinPeriodo: 'Refund period not available',
    convFrente: (m, n, p, mp, d) => `${m}: ${n} conversations loaded, against ${p} in ${mp}, ${d}%. This is a count of what was loaded and does not explain why it changed.`, convSolo: (m, n) => `${m}: ${n} conversations loaded. There is no same month of the previous year to compare.`,
    refCambio: (c, m, n, i, np, mp, ip) => `${c}, ${m}: ${n} refunds, intensity ${i}, against ${np} in ${mp}, ${ip}.`, parcial: 'partial month', hueco: 'possible export gap', conversaciones: 'Conversations',
    pctRango: 'Enter a number between 0 and 100.', pctMax: 'The percentage cannot exceed 100.', montoErr: 'Enter an amount in dollars, for example 6.50.'},
};
const T = idioma => TXT[idioma === 'en' ? 'en' : 'es'];
/** Une una lista con coma y la conjunción del idioma: «A, B y C» / «A, B and C». */
const unir = (a, y) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + y + a.at(-1));

/** Frase de concentración por plantilla: «10 SKUs concentran el 59.3 % del dinero devuelto. Los 4 primeros son de Walmart (familias SKUP y SKUS).» */
export function fraseConcentracion(v, idioma) {
  const x = T(idioma);
  const t = v?.titular, top = v?.skus?.top;
  if (!t || t.status !== 'ok' || !top?.length || t.top10?.pct === null) return null;
  const base = x.concentran(top.length, pct(t.top10.pct, idioma));
  const dom = r => r.canales[0]?.canal;
  const canal = dom(top[0]);
  let k = 0; while (k < top.length && dom(top[k]) === canal) k++;
  const fam = [...new Set(top.slice(0, k).map(r => /^[A-Z]+/.exec(r.sku)?.[0]).filter(Boolean))];
  if (k >= 3 && fam.length > 0 && fam.length <= 3) return x.primeros(base, k, NOMBRE[canal] ?? canal, fam.length, unir(fam, x.y));
  return base;
}

/** Línea de cobertura de reembolsos: «Amazon 3,272 · Walmart 3,107 · Shopify 26 reembolsos. 23 % de los de Amazon sin monto. CAD y MXN no se suman (…).» */
export function lineaCobertura(v, idioma) {
  const x = T(idioma), t = v?.titular; if (!t || t.status !== 'ok') return '';
  const partes = Object.entries(t.canales).map(([c, y]) => `${NOMBRE[c] ?? c} ${num(y.n, idioma)}`);
  let s = `${partes.join(' · ')} ${x.reembolsos}.`;
  const a = t.canales.amazon;
  if (a && a.sinMonto > 0 && a.n > 0) s += x.amazonSin(Math.round((a.sinMonto * 100) / a.n) + (idioma === 'en' ? '%' : ' %'));
  else if (t.sinMonto > 0) s += x.sinMonto(num(t.sinMonto, idioma));
  if (t.otrasMonedas?.length) s += x.noSuman(t.otrasMonedas.map(o => o.currency).join(x.y), num(t.otrasMonedas.reduce((a2, o) => a2 + o.n, 0), idioma));
  return s;
}

/** Cobertura de ventanas en UNA línea (no un aviso): «Ventanas de exportación parciales —reembolsos de Amazon desde 1 oct 2025, de Walmart desde 4 jul 2026—; datos hasta el 5 oct 2026.» */
export function lineaVentanas(v, idioma) {
  const x = T(idioma);
  const r = (v?.ventanas ?? []).filter(w => w.tipo === 'refund' && ['amazon', 'walmart', 'shopify'].includes(w.canal));
  if (!r.length) return '';
  const lista = r.map(w => x.ventanaDesde(NOMBRE[w.canal], diaLargo(w.inicio, idioma))).join(', ');
  const cortes = (v.ventanas ?? []).map(w => w.corte).filter(Boolean).sort();
  const hasta = cortes.length ? x.datosHasta(diaLargo(cortes.at(-1), idioma)) : '';
  return x.ventLinea(v.todasParciales ? x.ninguna : x.hay, lista, hasta);
}

/**
 * Periodo del titular, SIEMPRE explícito: el rango real de los reembolsos contados («del 1 ago 2026 al 20 sep 2026»), la ventana de cada canal
 * («Walmart desde 4 jul 2026») y, si el periodo pedido no coincide con lo que hay en los datos, una línea que lo dice.
 * El `acumulado` (todo el libro) NO se muestra junto a un periodo elegido: dos titulares con ventanas distintas en la misma pantalla se contradicen. Con filtro activo
 * el modelo devuelve `acumulado:null` y `acumuladoOmitido:true`; el enlace «Ver todo el libro» quita el filtro. Sin filtro el acumulado es el mismo titular y tampoco se repite.
 */
export function periodoDelTitular(v, idioma) {
  const x = T(idioma), t = v?.titular; if (!t || t.status !== 'ok') return null;
  const r = t.rango, pedido = v.scope?.dateStart || v.scope?.dateEnd ? v.scope : null;
  const rango = r?.desde && r?.hasta ? x.del(diaLargo(r.desde, idioma), diaLargo(r.hasta, idioma)) : null;
  const ventanas = Object.entries(t.canales ?? {}).filter(([, c]) => c?.desde).map(([k, c]) => x.ventanaDesde(NOMBRE[k] ?? k, diaLargo(c.desde, idioma)));
  let nota = null;
  if (pedido) {
    const ini = pedido.dateStart, finIncl = pedido.dateEnd ? new Date(Date.parse(pedido.dateEnd + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10) : null;
    const pedidoTxt = x.alTxt(ini ? diaLargo(ini, idioma) : x.elInicio, finIncl ? diaLargo(finIncl, idioma) : x.hoy);
    const cortoInicio = ini && r?.desde && r.desde > ini, cortoFin = finIncl && r?.hasta && r.hasta < finIncl;
    if (!r) nota = x.noHay(pedidoTxt);
    else if (cortoInicio || cortoFin) nota = x.eligido(pedidoTxt, rango);
  }
  const a = v.acumulado?.status === 'ok' ? v.acumulado : null;
  const acumulado = a && !pedido ? {texto: x.acum(a.rango ? x.acumRango(diaLargo(a.rango.desde, idioma), diaLargo(a.rango.hasta, idioma)) : '', usd(a.usdBrutoMinor, {idioma}), a.usdNetoMinor != null ? x.acumNeto(usd(a.usdNetoMinor, {decimals: true, idioma})) : '', num(a.n, idioma)), usdBrutoMinor: a.usdBrutoMinor, distinto: false} : null;
  return {rango, etiqueta: rango ? x.etiqueta(rango) : x.sinPeriodo, ventanas, nota, pedido: Boolean(pedido), acumulado, acumuladoOmitido: Boolean(pedido && a)};
}

/** Frases de «Qué cambió» por plantilla; solo meses completos. */
export function frasesCambios(v, idioma) {
  const x0 = T(idioma), c = v?.cambios; if (!c) return [];
  const out = [];
  if (c.conversaciones) {
    const x = c.conversaciones;
    if (x.nAnioPrevio !== null && x.nAnioPrevio > 0) {
      const d = Math.round(((x.n - x.nAnioPrevio) * 100) / x.nAnioPrevio);
      out.push({clave: 'conversaciones', texto: x0.convFrente(mesLargo(x.mes, idioma), num(x.n, idioma), num(x.nAnioPrevio, idioma), mesLargo(x.mesAnioPrevio, idioma), (d > 0 ? '+' : '') + d)});
    } else out.push({clave: 'conversaciones', texto: x0.convSolo(mesLargo(x.mes, idioma), num(x.n, idioma))});
  }
  for (const r of c.reembolsos ?? []) out.push({clave: 'ref-' + r.canal, texto: x0.refCambio(NOMBRE[r.canal] ?? r.canal, mesLargo(r.mes, idioma), num(r.reembolsos, idioma), pct(r.intensidadPct, idioma), num(r.reembolsosPrevio, idioma), mesLargo(r.previo, idioma), pct(r.intensidadPrevioPct, idioma))});
  return out;
}
const MOTIVO_EXCLUIDO = {parcial: 'parcial', posible_hueco: 'hueco'};
export const excluidosTexto = (v, idioma) => { const x = T(idioma); return (v?.cambios?.excluidos ?? []).filter(e => e.motivo in MOTIVO_EXCLUIDO).map(e => `${e.canal === 'conversaciones' ? x.conversaciones : NOMBRE[e.canal] ?? e.canal} ${mesLargo(e.mes, idioma)} (${x[MOTIVO_EXCLUIDO[e.motivo]]})`); };

// ---- estimador con candado ----
/** Acepta «30», «30 %», «0.3» no (ambiguo): solo porcentaje 0-100. Devuelve {ok,valor}|{vacio}|{error}. */
export function porcentaje(texto, idioma) {
  const t = String(texto ?? '').trim().replace('%', '').replace(',', '.').trim();
  if (t === '') return {vacio: true};
  if (!/^\d+(\.\d+)?$/.test(t)) return {error: T(idioma).pctRango};
  const n = Number(t);
  return n > 100 ? {error: T(idioma).pctMax} : {ok: true, valor: n};
}
export function dinero(texto, idioma) {
  const t = String(texto ?? '').trim().replace(/[$\s,]/g, '');
  if (t === '') return {vacio: true};
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return {error: T(idioma).montoErr};
  return {ok: true, valor: Number(t)};
}
/**
 * Estima SOLO con supuestos tecleados. Dos bloques independientes:
 *  A) dinero recuperable por reclamo = base observada (USD sin cancelados) × % atribuible a proveedor × % recuperable;
 *  B) costo del contacto repetido evitable = tickets que repiten × costo por contacto × % evitable.
 * Cada bloque devuelve null si falta cualquiera de sus supuestos: jamás se rellena un valor por defecto.
 */
export function estimar({baseUsdMinor, ticketsRepiten, pctProveedor, pctRecuperable, costoContacto, pctEvitable}) {
  const ok = x => x && x.ok === true;
  const A = baseUsdMinor !== null && baseUsdMinor !== undefined && ok(pctProveedor) && ok(pctRecuperable)
    ? {valorUsd: (Number(BigInt(String(baseUsdMinor).split('.')[0])) / 100) * (pctProveedor.valor / 100) * (pctRecuperable.valor / 100), baseUsd: Number(BigInt(String(baseUsdMinor).split('.')[0])) / 100, pctProveedor: pctProveedor.valor, pctRecuperable: pctRecuperable.valor} : null;
  const B = ticketsRepiten !== null && ticketsRepiten !== undefined && ok(costoContacto) && ok(pctEvitable)
    ? {valorUsd: ticketsRepiten * costoContacto.valor * (pctEvitable.valor / 100), tickets: ticketsRepiten, costo: costoContacto.valor, pctEvitable: pctEvitable.valor} : null;
  return {A, B};
}
export const formulaA = a => `${USD0.format(a.baseUsd)} × ${PCT.format(a.pctProveedor)} % × ${PCT.format(a.pctRecuperable)} %`;
export const formulaB = b => `${NUM.format(b.tickets)} tickets × ${USD2.format(b.costo)} × ${PCT.format(b.pctEvitable)} %`;
export const usdNum = v => USD0.format(v);
