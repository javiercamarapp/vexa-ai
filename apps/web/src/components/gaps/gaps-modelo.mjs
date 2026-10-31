// Presentación de «Brechas de ingreso»: textos por plantilla (nunca IA libre) y formato. Reutiliza el formato de «Fuga de reembolsos».
// Regla: TODO es ingreso bruto; la palabra margen/utilidad/ganancia no aparece en ninguna cifra. Cada cifra con su clase, periodo y cobertura.
import {NOMBRE, usd, num, pct, mesCorto, mesLargo, dia} from '../refunds/fuga-modelo.mjs';
import {porcentaje as porcentajeEs} from '../../lib/formato/es-mx.mjs';
export {NOMBRE, usd, num, pct, mesCorto, mesLargo, dia};
export {porcentaje, dinero, estimar, formulaA, usdNum} from '../refunds/fuga-modelo.mjs';

export const TIPO_REC = Object.freeze({revisar_proveedor: 'Revisar con proveedor', empujar: 'Empujar', revisar_canal: 'Revisar en un canal', cross_sell: 'Venta cruzada'});
export const CALIDAD_TXT = Object.freeze({completo: 'Mes completo', parcial: 'Mes parcial', posible_hueco: 'Posible hueco de exportación'});
export const variacion = p => porcentajeEs(p, {conSigno: true});

/** Periodo del titular, siempre explícito: rango real del libro y ventana de cada canal. */
export function periodoIngresos(v) {
  const i = v?.ingresos; if (!i || i.status !== 'ok') return null;
  const rango = i.rango?.desde ? `del ${dia(i.rango.desde)} al ${dia(i.rango.hasta)}` : null;
  const ventanas = i.canales.filter(c => c.desde).map(c => `${NOMBRE[c.canal] ?? c.canal} desde ${dia(c.desde)}`);
  return {etiqueta: rango ? `Ingreso ${rango}` : 'Periodo del ingreso no disponible', ventanas, linea: `Ventanas de exportación parciales (cada canal empieza en una fecha distinta): ${ventanas.join(', ')}. No es un año completo ni comparable entre canales.`};
}
/** Cobertura del titular en una línea. */
export function lineaCobertura(v) {
  const i = v?.ingresos; if (!i || i.status !== 'ok') return '';
  const partes = i.canales.map(c => `${NOMBRE[c.canal] ?? c.canal} ${num(c.lineas)}`).join(' · ');
  let s = `${num(i.lineas)} líneas de pedido en USD (${partes}). El libro trae una fila por línea, no unidades.`;
  if (i.sinSkuPct !== null && i.sinSkuPct > 0) s += ` ${pct(i.sinSkuPct)} del ingreso es de canales sin SKU del vendedor (Shopify, Best Buy): cuenta en el total, no en el ranking por SKU.`;
  if (i.otrasMonedas.length) s += ` ${i.otrasMonedas.map(o => o.currency).join(' y ')} no se suman (${num(i.otrasMonedas.reduce((a, o) => a + o.lineas, 0))} líneas).`;
  if (i.revision > 0) s += ` ${num(i.revision)} líneas USD vienen marcadas «a revisar» en el origen (reembolsadas) y siguen incluidas.`;
  return s;
}
/** Frase de concentración del ingreso. */
export function fraseConcentracionIngreso(v) {
  const r = v?.ranking; if (!r || r.status !== 'ok' || r.top10Pct === null || r.top10Pct === undefined) return null;
  const n = Math.min(10, r.items.length), sig = r.items.slice(0, n);
  const familias = [...new Set(sig.slice(0, 3).map(x => x.familia?.slice(4)).filter(Boolean))];
  return `${n} SKUs concentran el ${pct(r.top10Pct)} del ingreso bruto.${familias.length ? ` Los tres primeros son de ${familias.length > 1 ? 'las líneas' : 'la línea'} ${familias.join(familias.length > 2 ? ', ' : ' y ').replace(/, ([^,]*)$/, ' y $1')}.` : ''}`;
}
/** Concentración de lo devuelto (ancla: 10 SKUs = 59.3 %). */
export function fraseConcentracionReembolsos(v) {
  const c = v?.concentracion; if (!c || c.status !== 'ok' || c.top10Pct === null || c.top10Pct === undefined) return null;
  return `10 SKUs concentran el ${pct(c.top10Pct)} del dinero devuelto (de ${num(c.skusConReembolso)} SKUs con reembolsos).`;
}
/** «Qué cambió»: mes contra mes por canal, solo con el último par de meses completos. */
export function frasesMesContraMes(v) {
  const g = v?.crecimiento; if (!g || g.status !== 'ok') return [];
  return Object.entries(g.pares ?? {}).filter(([, p]) => p).map(([c, p]) => `${NOMBRE[c] ?? c}: se compara ${mesLargo(p.mes)} con ${mesLargo(p.previo)}, los dos últimos meses completos.`);
}
export const mesesExcluidos = v => (v?.ingresos?.status === 'ok' ? v.ingresos.calidad.filter(q => q.calidad !== 'completo').map(q => `${NOMBRE[q.canal] ?? q.canal} ${mesLargo(q.mes)} (${q.calidad === 'parcial' ? 'mes parcial' : 'posible hueco de exportación'})`) : []);
/** Texto del avance del análisis del histórico. */
export function textoAvance(f, idioma = 'es') {
  const p = f?.progreso, en = idioma === 'en';
  if (!p) return en ? 'Progress is not available right now.' : 'El avance no está disponible ahora.';
  if (p.objetivo === null || p.avancePct === null) return en ? `${num(p.v2)} conversations analyzed with the new analysis.` : `${num(p.v2)} conversaciones analizadas con el análisis nuevo.`;
  return en ? `${num(p.v2)} of ${num(p.objetivo)} history conversations analyzed (${pct(p.avancePct)}).` : `${num(p.v2)} de ${num(p.objetivo)} conversaciones del histórico analizadas (${pct(p.avancePct)}).`;
}
