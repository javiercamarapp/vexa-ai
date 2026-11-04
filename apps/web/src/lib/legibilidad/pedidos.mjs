// «Pedidos, envíos y devoluciones» de la cobertura de datos. Reglas de producto:
//  - la llave de unión es Order ID + Retailer; Walmart une por PO;
//  - los envíos de Speedship son reemplazos por garantía: la cobertura es de unión, NUNCA un % de ventas;
//  - denominador 0 o retailer desconocido => «n/d», jamás 0 %; desconocido no es cero (null se queda null).
import {porcentaje} from '../formato/es-mx.mjs';
import {mesCorto} from '../formato/idioma.mjs';
export const ORDEN = Object.freeze(['amazon', 'walmart', 'otros', 'unknown']);
const NOMBRE = {amazon: 'Amazon', walmart: 'Walmart', otros: null, unknown: null};
/** Retailer de la vista -> grupo de pantalla. Todo lo que no es Amazon, Walmart ni «unknown» va a «otros». */
export const grupoRetailer = (r) => (r === 'amazon' || r === 'walmart' || r === 'unknown' ? r : 'otros');
export const nombreRetailer = (clave, t) => NOMBRE[clave] ?? (t ? t(clave === 'otros' ? 'tr.datos.pedOtros' : 'tr.datos.pedDesconocido') : clave === 'otros' ? 'Otros' : 'Desconocido');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const suma = (xs) => (xs.some((x) => num(x) === null) ? null : xs.reduce((a, x) => a + x, 0));
/** Cobertura 0..1 -> «37.5 %» o «n/d» cuando no hay denominador (o el retailer es desconocido). Nunca «0 %» por falta de dato. */
export function textoCobertura(ratio, idioma = 'es') {
  const r = num(ratio);
  return r === null ? (idioma === 'en' ? 'n/a' : 'n/d') : porcentaje(r * 100, {idioma});
}
const mes = (d) => (typeof d === 'string' && /^\d{4}-\d{2}/.test(d) ? d.slice(0, 7) : null);
/** Periodo «dic 2025 – mar 2026» (o un solo mes); sin fechas: null (la pantalla dice «Sin periodo»). */
export function textoPeriodo(desde, hasta, idioma = 'es') {
  const a = mes(desde), b = mes(hasta);
  if (!a || !b) return null;
  const x = mesCorto(a, idioma, {anio: true}), y = mesCorto(b, idioma, {anio: true});
  return x && y ? (x === y ? x : `${x} – ${y}`) : null;
}
const rango = (fechas) => { const f = fechas.filter(Boolean).sort(); return f.length ? {desde: f[0], hasta: f.at(-1)} : null; };
const cob = (ligados, denominador, unknown) => (unknown || !(num(denominador) > 0) || num(ligados) === null ? null : ligados / denominador);

/**
 * Une las filas de las vistas por retailer. Entrada: {enlaces, devoluciones, periodoEnvios} (cada parte puede ser null = no disponible).
 * Salida: {estado: 'ok'|'vacio'|'no_disponible', grupos: [{clave, pedidos, envios, devoluciones}]} en orden Amazon, Walmart, otros, desconocido.
 * La cobertura se RECALCULA desde ligados/denominador sumados (no se promedian porcentajes) y es null si el denominador es 0.
 */
export function modeloPedidos(entrada) {
  const {enlaces, devoluciones, periodoEnvios} = entrada ?? {};
  if (!Array.isArray(enlaces) && !Array.isArray(devoluciones)) return {estado: 'no_disponible', grupos: []};
  const por = new Map(ORDEN.map((k) => [k, {clave: k, e: [], p: [], d: [], f: []}]));
  for (const r of enlaces ?? []) { const g = por.get(grupoRetailer(r.retailer)); if (r.entidad === 'envios') { if (r.tipo === 'garantia') g.e.push(r); } // otros tipos de envío no se mezclan bajo la nota de garantía
     else if (r.entidad === 'pedidos') g.p.push(r); }
  for (const r of devoluciones ?? []) por.get(grupoRetailer(r.retailer)).d.push(r);
  for (const r of periodoEnvios ?? []) por.get(grupoRetailer(r.retailer)).f.push(r);
  const grupos = [];
  for (const k of ORDEN) {
    const {e, p, d, f} = por.get(k), unknown = k === 'unknown';
    if (!e.length && !p.length && !d.length) continue;
    const envios = e.length ? (() => {
      const total = suma(e.map((x) => x.total)), ligados = suma(e.map((x) => x.ligados)), denominador = suma(e.map((x) => x.denominador));
      return {total, sinId: suma(e.map((x) => x.sinId)), ligados, denominador, cobertura: cob(ligados, denominador, unknown),
        periodo: rango(f.flatMap((x) => [x.desde, x.hasta]))};
    })() : null;
    const devs = d.length ? (() => {
      const total = suma(d.map((x) => x.devoluciones)), denominador = suma(d.map((x) => x.denominador));
      const conPedido = suma(d.map((x) => x.conPedido)), conEnvio = suma(d.map((x) => x.conEnvio));
      return {total, sinId: suma(d.map((x) => x.sinId)), denominador, conPedido, conEnvio,
        coberturaPedido: cob(conPedido, denominador, unknown), coberturaEnvio: cob(conEnvio, denominador, unknown),
        periodo: rango(d.map((x) => x.mes))};
    })() : null;
    grupos.push({clave: k, pedidos: p.length ? suma(p.map((x) => x.total)) : null, envios, devoluciones: devs});
  }
  // Sin grupos: «vacio» solo si ambas partes se leyeron; si una no se pudo leer no se afirma que no hay nada.
  return {estado: grupos.length ? 'ok' : (enlaces && devoluciones ? 'vacio' : 'no_disponible'), grupos};
}
