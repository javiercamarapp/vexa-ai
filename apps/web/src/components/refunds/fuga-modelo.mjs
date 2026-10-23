// Modelo de presentación de «Fuga de reembolsos»: textos por plantilla (nunca IA libre), formato de dinero y el estimador con candado. Puro y probado.
// Regla: ninguna cifra sin su clase (Observado / Estimado / Inferido), periodo y cobertura. El estimador NO propone valores: sin supuestos tecleados no hay número.
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const USD0 = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0});
const USD2 = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 2});
const NUM = new Intl.NumberFormat('es-MX');
const PCT = new Intl.NumberFormat('es-MX', {maximumFractionDigits: 1});
export const NOMBRE = Object.freeze({amazon: 'Amazon', walmart: 'Walmart', shopify: 'Shopify', bestbuy: 'Best Buy', tienda: 'Tienda propia', lowes: 'Lowe’s', homedepot: 'Home Depot', otro: 'Otro'});
export const ESTADO_TXT = Object.freeze({reembolsado: 'Reembolsado', vencido: 'Más de 180 días', no_reembolsable: 'No reembolsable', rechazado: 'Rechazado', enviado: 'Enviado', otro: 'Otro estado', sin_estado: 'Sin estado'});
export const HOJA_TXT = Object.freeze({reembolsos: 'Reembolsos', garantiaHerramientas: 'Garantía de herramientas', garantiaPartes: 'Garantía de partes', etiquetas: 'Etiquetas de devolución'});

/** centavos (string|number|bigint) -> «[omitido: dato de cliente]» (sin decimales) o con decimales. */
export function usd(minor, {decimals = false} = {}) {
  if (minor === null || minor === undefined || minor === '') return '—';
  const v = Number(BigInt(String(minor).split('.')[0])) / 100;
  return (decimals ? USD2 : USD0).format(v);
}
export const num = n => (n === null || n === undefined ? '—' : NUM.format(n));
export const pct = p => (p === null || p === undefined ? '—' : PCT.format(p) + ' %');
export const mesCorto = m => { const [y, mo] = String(m).split('-').map(Number); return MESES[mo - 1] ? `${MESES[mo - 1]} ${String(y).slice(2)}` : String(m); };
export const mesLargo = m => { const [y, mo] = String(m).split('-').map(Number); return MESES[mo - 1] ? `${MESES[mo - 1]} ${y}` : String(m); };
const diaLargo = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? '')); return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}` : null; };
export const dia = diaLargo;

/** Frase de concentración por plantilla: «10 SKUs concentran el 59.3 % del dinero devuelto. Los 4 primeros son de Walmart (familias SKUP y SKUS).» */
export function fraseConcentracion(v) {
  const t = v?.titular, top = v?.skus?.top;
  if (!t || t.status !== 'ok' || !top?.length || t.top10?.pct === null) return null;
  const base = `${top.length} SKUs concentran el ${pct(t.top10.pct)} del dinero devuelto.`;
  const dom = r => r.canales[0]?.canal;
  const canal = dom(top[0]);
  let k = 0; while (k < top.length && dom(top[k]) === canal) k++;
  const fam = [...new Set(top.slice(0, k).map(r => /^[A-Z]+/.exec(r.sku)?.[0]).filter(Boolean))];
  if (k >= 3 && fam.length > 0 && fam.length <= 3) return `${base} Los ${k} primeros son de ${NOMBRE[canal] ?? canal} (${fam.length > 1 ? 'familias' : 'familia'} ${fam.join(fam.length > 2 ? ', ' : ' y ').replace(/, ([^,]*)$/, ' y $1')}).`;
  return base;
}

/** Línea de cobertura de reembolsos: «Amazon 3,272 · Walmart 3,107 · Shopify 26 reembolsos. 23 % de los de Amazon sin monto. CAD y MXN no se suman (…).» */
export function lineaCobertura(v) {
  const t = v?.titular; if (!t || t.status !== 'ok') return '';
  const partes = Object.entries(t.canales).map(([c, x]) => `${NOMBRE[c] ?? c} ${num(x.n)}`);
  let s = `${partes.join(' · ')} reembolsos.`;
  const a = t.canales.amazon;
  if (a && a.sinMonto > 0 && a.n > 0) s += ` ${Math.round((a.sinMonto * 100) / a.n)} % de los de Amazon sin monto.`;
  else if (t.sinMonto > 0) s += ` ${num(t.sinMonto)} sin monto.`;
  if (t.otrasMonedas?.length) s += ` ${t.otrasMonedas.map(o => o.currency).join(' y ')} no se suman (${num(t.otrasMonedas.reduce((a2, o) => a2 + o.n, 0))} reembolsos).`;
  return s;
}

/** Cobertura de ventanas en UNA línea (no un aviso): «Ventanas de exportación parciales —reembolsos de Amazon desde 1 oct 2025, de Walmart desde 4 jul 2026—; datos hasta el 5 oct 2026.» */
export function lineaVentanas(v) {
  const r = (v?.ventanas ?? []).filter(w => w.tipo === 'refund' && ['amazon', 'walmart', 'shopify'].includes(w.canal));
  if (!r.length) return '';
  const lista = r.map(w => `${NOMBRE[w.canal]} desde ${diaLargo(w.inicio)}`).join(', ');
  const cortes = (v.ventanas ?? []).map(w => w.corte).filter(Boolean).sort();
  const hasta = cortes.length ? ` Datos hasta el ${diaLargo(cortes.at(-1))}.` : '';
  return `${v.todasParciales ? 'Ninguna ventana de exportación está marcada como completa' : 'Hay ventanas de exportación parciales'} (reembolsos: ${lista}).${hasta}`;
}

/** Frases de «Qué cambió» por plantilla; solo meses completos. */
export function frasesCambios(v) {
  const c = v?.cambios; if (!c) return [];
  const out = [];
  if (c.conversaciones) {
    const x = c.conversaciones;
    if (x.nAnioPrevio !== null && x.nAnioPrevio > 0) {
      const d = Math.round(((x.n - x.nAnioPrevio) * 100) / x.nAnioPrevio);
      out.push({clave: 'conversaciones', texto: `${mesLargo(x.mes)}: ${num(x.n)} conversaciones cargadas, frente a ${num(x.nAnioPrevio)} en ${mesLargo(x.mesAnioPrevio)} (${d > 0 ? '+' : ''}${d} %). Es un conteo de lo cargado; no explica por qué cambió.`});
    } else out.push({clave: 'conversaciones', texto: `${mesLargo(x.mes)}: ${num(x.n)} conversaciones cargadas. No hay el mismo mes del año anterior para comparar.`});
  }
  for (const r of c.reembolsos ?? []) out.push({clave: 'ref-' + r.canal, texto: `${NOMBRE[r.canal] ?? r.canal}, ${mesLargo(r.mes)}: ${num(r.reembolsos)} reembolsos (intensidad ${pct(r.intensidadPct)}) frente a ${num(r.reembolsosPrevio)} en ${mesLargo(r.previo)} (${pct(r.intensidadPrevioPct)}).`});
  return out;
}
const MOTIVO_EXCLUIDO = {parcial: 'mes parcial', posible_hueco: 'posible hueco de exportación'};
export const excluidosTexto = v => (v?.cambios?.excluidos ?? []).filter(e => e.motivo in MOTIVO_EXCLUIDO).map(e => `${e.canal === 'conversaciones' ? 'Conversaciones' : NOMBRE[e.canal] ?? e.canal} ${mesLargo(e.mes)} (${MOTIVO_EXCLUIDO[e.motivo]})`);

// ---- estimador con candado ----
/** Acepta «30», «30 %», «0.3» no (ambiguo): solo porcentaje 0-100. Devuelve {ok,valor}|{vacio}|{error}. */
export function porcentaje(texto) {
  const t = String(texto ?? '').trim().replace('%', '').replace(',', '.').trim();
  if (t === '') return {vacio: true};
  if (!/^\d+(\.\d+)?$/.test(t)) return {error: 'Escribe un número entre 0 y 100.'};
  const n = Number(t);
  return n > 100 ? {error: 'El porcentaje no puede pasar de 100.'} : {ok: true, valor: n};
}
export function dinero(texto) {
  const t = String(texto ?? '').trim().replace(/[$\s,]/g, '');
  if (t === '') return {vacio: true};
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return {error: 'Escribe un monto en dólares, por ejemplo 6.50.'};
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
