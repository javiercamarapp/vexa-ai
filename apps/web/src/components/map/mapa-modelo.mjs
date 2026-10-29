// Modelo del «Mapa de problemas»: cuadrículas de mosaicos (cartogramas) de EE. UU. y México, rampa de 5 pasos y textos. Sin red, sin librerías, sin direcciones.
import {ESTADOS_US, ESTADOS_MX} from '../../../../../packages/workspace-service/geo-estado.mjs';

/** [código, columna, fila]. Un mosaico por estado: cartograma, no mapa a escala. */
export const MOSAICOS_US = Object.freeze([['AK', 0, 0], ['ME', 10, 0], ['WI', 5, 1], ['VT', 9, 1], ['NH', 10, 1], ['WA', 0, 2], ['ID', 1, 2], ['MT', 2, 2], ['ND', 3, 2], ['MN', 4, 2], ['IL', 5, 2], ['MI', 6, 2], ['NY', 8, 2], ['MA', 9, 2],
  ['OR', 0, 3], ['NV', 1, 3], ['WY', 2, 3], ['SD', 3, 3], ['IA', 4, 3], ['IN', 5, 3], ['OH', 6, 3], ['PA', 7, 3], ['NJ', 8, 3], ['CT', 9, 3], ['RI', 10, 3],
  ['CA', 0, 4], ['UT', 1, 4], ['CO', 2, 4], ['NE', 3, 4], ['MO', 4, 4], ['KY', 5, 4], ['WV', 6, 4], ['VA', 7, 4], ['MD', 8, 4], ['DE', 9, 4],
  ['AZ', 1, 5], ['NM', 2, 5], ['KS', 3, 5], ['AR', 4, 5], ['TN', 5, 5], ['NC', 6, 5], ['SC', 7, 5], ['DC', 8, 5], ['OK', 3, 6], ['LA', 4, 6], ['MS', 5, 6], ['AL', 6, 6], ['GA', 7, 6], ['HI', 0, 7], ['TX', 3, 7], ['FL', 8, 7]]);
export const MOSAICOS_MX = Object.freeze([['BCN', 0, 0], ['SON', 1, 0], ['CHH', 2, 0], ['COA', 3, 0], ['NLE', 4, 0], ['TAM', 5, 0], ['BCS', 0, 1], ['SIN', 1, 1], ['DUR', 2, 1], ['ZAC', 3, 1], ['SLP', 4, 1],
  ['NAY', 1, 2], ['JAL', 2, 2], ['AGU', 3, 2], ['GUA', 4, 2], ['QUE', 5, 2], ['HID', 6, 2], ['VER', 7, 2], ['COL', 1, 3], ['MIC', 2, 3], ['MEX', 3, 3], ['CMX', 4, 3], ['MOR', 5, 3], ['TLA', 6, 3], ['PUE', 7, 3],
  ['GRO', 3, 4], ['OAX', 7, 4], ['TAB', 8, 4], ['CAM', 9, 4], ['YUC', 10, 4], ['CHP', 8, 5], ['ROO', 10, 5]]);
export const PAISES = Object.freeze({US: {nombre: 'Estados Unidos', mosaicos: MOSAICOS_US, nombres: ESTADOS_US, columnas: 11, filas: 8}, MX: {nombre: 'México', mosaicos: MOSAICOS_MX, nombres: ESTADOS_MX, columnas: 11, filas: 6}});

/** Paso de la rampa 0..5: 0 = sin casos visibles; 1..5 según la fracción del máximo (escala lineal, 5 pasos iguales). */
export function pasoDeRampa(n, max) {
  if (!n || n <= 0 || !max) return 0;
  return Math.min(5, Math.max(1, Math.ceil((n / max) * 5)));
}
/** Límites de cada paso, para la leyenda. */
export function limitesRampa(max) {
  if (!max) return [];
  return [1, 2, 3, 4, 5].map(p => ({paso: p, desde: p === 1 ? 1 : Math.floor(((p - 1) * max) / 5) + 1, hasta: Math.floor((p * max) / 5)})).filter(l => l.desde <= l.hasta);
}
export const num = n => (n == null ? '—' : Number(n).toLocaleString('en-US'));
export const pctTxt = (p, idioma) => (p == null ? '—' : String(p) + (idioma === 'en' ? '%' : ' %'));

export function textoCobertura(c) {
  if (!c) return 'No disponible ahora.';
  return `${num(c.interpretables)} de ${num(c.filas)} filas del Tracker traen dirección interpretable (${num(c.conDireccion)} traen alguna dirección; ${pctTxt(c.pctInterpretablesDeDireccion)} de ellas se pudo leer).`;
}
export function textoOcultos(o) {
  if (!o || !o.estados) return null;
  return `${num(o.estados)} ${o.estados === 1 ? 'estado con menos' : 'estados con menos'} de ${o.minimo} casos ${o.estados === 1 ? 'no se muestra' : 'no se muestran'} por separado (${num(o.casos)} casos): protege la privacidad de los clientes.`;
}
/** Tabla accesible equivalente: una fila por estado visible. */
export function filasTabla(estados, total, idioma) {
  return estados.map(e => ({clave: e.clave, estado: e.nombre, pais: e.pais === 'US' ? (idioma === 'en' ? 'United States' : 'Estados Unidos') : (idioma === 'en' ? 'Mexico' : 'México'), casos: e.n, pct: total > 0 ? Math.round((e.n * 1000) / total) / 10 : null}));
}
export const MENSAJE_COMPLETO = 'Para un mapa completo se necesita la dirección de envío de cada pedido: se activa al conectar Amazon, Walmart y Shopify (ver guía de accesos).';
export function resumenEstado(e) {
  if (!e) return 'Elige un estado para ver sus casos, motivos y retailers.';
  return `${e.nombre}: ${num(e.n)} ${e.n === 1 ? 'caso' : 'casos'}.`;
}

// ── Mapa con geometrías reales: cámara, color y textos (funciones puras; la pantalla solo las llama). ──
/** Proporción (ancho, alto) del viewBox de cada país: reserva el espacio antes de cargar la geometría (sin salto de layout). */
export const VISTA_PAIS = Object.freeze({US: {w: 975, h: 610}, MX: {w: 1000, h: 629}});
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 16;
const entre = (v, a, b) => Math.min(b, Math.max(a, v));

/** Mantiene el mapa cubriendo el visor: sin márgenes vacíos al arrastrar. Con k = 1 la cámara queda en el origen. */
export function limitarCamara(cam, vb) {
  const k = entre(cam.k, ZOOM_MIN, ZOOM_MAX);
  return {k, x: entre(cam.x, vb.w - k * vb.w, 0), y: entre(cam.y, vb.h - k * vb.h, 0)};
}
/** Cámara que encuadra una región (bbox) en el centro del visor; zoom máximo 8 para no pixelar un estado diminuto. */
export function camaraParaRegion(r, vb, {margen = 1.6, kMax = 8} = {}) {
  if (!r) return {x: 0, y: 0, k: 1};
  const k = entre(Math.min(vb.w / (r.bw * margen), vb.h / (r.bh * margen)), 1.6, kMax);
  return limitarCamara({k, x: vb.w / 2 - k * r.cx, y: vb.h / 2 - k * r.cy}, vb);
}
/** Zoom anclado al punto (px, py) en unidades del viewBox: el punto bajo el cursor no se mueve. */
export function zoomEnPunto(cam, px, py, factor, vb) {
  const k2 = entre(cam.k * factor, ZOOM_MIN, ZOOM_MAX);
  if (k2 === 1) return {x: 0, y: 0, k: 1};
  return limitarCamara({k: k2, x: px - ((px - cam.x) * k2) / cam.k, y: py - ((py - cam.y) * k2) / cam.k}, vb);
}
/** Estado visual de una región: con dato (paso 1..5) o «sin dato» (nunca cero). */
export function estadoRegion(d, max) {
  if (!d || !(d.n > 0)) return {tipo: 'sin-dato', paso: 0};
  return {tipo: 'dato', paso: pasoDeRampa(d.n, max)};
}
/** ¿Cabe la etiqueta (código) dentro de la región al zoom k? (bbox en unidades del viewBox) */
export function cabeEtiqueta(r, k) {
  return r.bw * k >= 30 && r.bh * k >= 20;
}
/** Texto del tooltip y del aria-label: una sola fuente para que lo visible y lo leído coincidan. Sin dato nunca dice 0. */
export function textoRegion(nombre, d, total) {
  if (!d || !(d.n > 0)) return `${nombre}: sin dato (menos de 5 casos o sin lectura)`;
  const pct = total > 0 ? ` · ${pctTxt(Math.round((d.n * 1000) / total) / 10)}` : '';
  return `${nombre}: ${num(d.n)} ${d.n === 1 ? 'caso' : 'casos'}${pct}`;
}
/** Une la geometría con los datos visibles: una entrada por región, en el orden de la geometría. */
export function regionesPintadas(geo, datos, max) {
  return geo.regiones.map(r => ({r, d: datos.get(r.clave) ?? null, ...estadoRegion(datos.get(r.clave), max)}));
}
export const NOTA_PROVISIONAL = 'Provisional: fuente Tracker, no todos los tickets traen dirección; mapa real cuando se conecten Amazon, Walmart y Shopify.';
export const TEXTO_MES = 'Mes: no disponible. El Tracker no trae la fecha del caso por estado; aparece cuando se conecten los pedidos con estado de envío.';
