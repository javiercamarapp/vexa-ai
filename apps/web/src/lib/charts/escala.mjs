// Escalas y formatos de las gráficas: aritmética pura, sin DOM ni React, para poder probarla.
// Todo número que sale en un eje, una etiqueta directa o un tooltip pasa por aquí.

const compacto = new Intl.NumberFormat('es-MX', {notation: 'compact', maximumFractionDigits: 1});
const entero = new Intl.NumberFormat('es-MX', {maximumFractionDigits: 0});
const unDecimal = new Intl.NumberFormat('es-MX', {minimumFractionDigits: 1, maximumFractionDigits: 1});

/** «2.1 M», «337.9 mil», «842». Los negativos conservan el signo; no finitos -> «—». */
export function compactEs(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return Math.abs(n) < 1000 ? entero.format(Math.round(n * 10) / 10) : compacto.format(n).replace(/\s/g, ' ');
}

/** Pasos «agradables»: el máximo del eje es uno de estos × 10^k y su mitad también es redonda. */
const PASOS = [1, 1.2, 1.6, 2, 3, 4, 5, 6, 8, 10];

/** Eje de 3 marcas [0, mitad, tope] con tope >= max. `integer` fuerza marcas enteras (conteos pequeños). */
export function niceScale(max, {integer = false} = {}) {
  const m = Number.isFinite(max) && max > 0 ? max : 0;
  if (m === 0) return {max: integer ? 2 : 1, ticks: integer ? [0, 1, 2] : [0, 0.5, 1]};
  const exp = Math.floor(Math.log10(m));
  for (let k = exp; k <= exp + 1; k++) {
    for (const p of PASOS) {
      const top = Math.round(p * 10 ** k * 1e9) / 1e9;
      if (top < m - 1e-9) continue;
      const mid = top / 2;
      if (integer && (!Number.isInteger(top) || !Number.isInteger(mid))) continue;
      return {max: top, ticks: [0, mid, top]};
    }
  }
  return {max: m, ticks: [0, m / 2, m]};
}

/** ¿Todos los valores son enteros y pequeños? Entonces el eje no debe mostrar «0.5». */
export const esConteoPequeno = (values) => { const v = values.filter((x) => typeof x === 'number' && Number.isFinite(x)); return v.length > 0 && v.every(Number.isInteger) && Math.max(...v) <= 12; };

export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** «2026-10» -> «oct». Entrada inválida se devuelve igual. */
export const mesAbrev = (key) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(String(key)) ? MESES[Number(String(key).slice(5)) - 1] : String(key));

/** Geometría de columnas: relación barra/hueco ≈ 0.6, ancho máximo 22 px, mínimo 3 px. */
export function geometriaColumnas(n, plotW, {ratio = 0.6, max = 22, min = 3} = {}) {
  const slot = plotW / Math.max(1, n);
  const bw = Math.max(min, Math.min(max, slot * ratio));
  return {slot, bw, offset: (slot - bw) / 2};
}

/** Cada cuántas columnas poner etiqueta de eje X para que no se pisen (minPx por etiqueta). */
export const cadaCuantas = (n, plotW, minPx = 30) => Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / minPx))));

/**
 * Variación contra el mes anterior SOLO entre meses completos con dato.
 * modo 'pct' = cambio relativo; 'pp' = diferencia de una tasa en puntos (bps -> pp).
 * Devuelve null si no es comparable (parcial, sin dato, base 0).
 */
export function variacionVsAnterior(puntos, i, modo = 'pct') {
  const a = puntos[i - 1], b = puntos[i];
  if (!a || !b || i < 1) return null;
  if (a.partial || b.partial || a.value === null || b.value === null || a.value === undefined || b.value === undefined) return null;
  if (modo === 'pp') { const d = (b.value - a.value) / 100; return {dir: d > 0 ? 'up' : d < 0 ? 'down' : 'flat', texto: signo(d) + unDecimal.format(Math.abs(d)) + ' pp'}; }
  if (!(a.value > 0)) return null;
  const d = ((b.value - a.value) / a.value) * 100;
  return {dir: d > 0.05 ? 'up' : d < -0.05 ? 'down' : 'flat', texto: signo(d) + unDecimal.format(Math.abs(d)) + ' %'};
}
const signo = (d) => (Math.abs(d) < 0.05 ? '' : d > 0 ? '+' : '−');

/** Índices con etiqueta directa: el máximo y el último mes completo (si están a <3 columnas, solo el último). */
export function indicesEtiquetados(puntos) {
  let max = -1, ultimo = -1;
  puntos.forEach((p, i) => { if (p.value === null || p.value === undefined || p.partial) return; if (max < 0 || p.value > puntos[max].value) max = i; ultimo = i; });
  const out = [];
  if (max >= 0 && !(ultimo >= 0 && Math.abs(max - ultimo) < 3 && max !== ultimo)) out.push(max);
  if (ultimo >= 0 && !out.includes(ultimo)) out.push(ultimo);
  return out;
}

/** Posición horizontal del tooltip: centrado en x, sin salirse de [pad, ancho - pad]. */
export const posicionTooltip = (x, ancho, mitadTip = 90, pad = 4) => Math.min(Math.max(x, mitadTip + pad), Math.max(mitadTip + pad, ancho - mitadTip - pad));


/** Coloca un tooltip de w×h junto a un punto (ax, ay) en coordenadas de VENTANA y devuelve su esquina (x, y) dentro del viewport, con `margen` de holgura.
 *  modo «lado»: a la derecha del punto (se voltea a la izquierda si no cabe); verticalmente arranca en `ty` (o a ay - 8) y se acota al viewport.
 *  modo «arriba»: centrado sobre el punto (se voltea debajo si no cabe arriba); `sep` es la distancia al punto.
 *  Nunca devuelve una caja fuera de [margen, vw - margen] × [margen, vh - margen] mientras el viewport la admita. */
export function colocarTooltip({ax, ay, w, h, vw, vh, modo = 'lado', sep = 14, margen = 8, ty}) {
  const acota = (v, min, max) => Math.max(min, Math.min(v, Math.max(min, max)));
  if (modo === 'arriba') {
    const x = acota(ax - w / 2, margen, vw - margen - w);
    const arriba = ay - sep - h;
    const abajo = ay + sep;
    const bajar = arriba < margen && abajo + h <= vh - margen;
    return {x, y: acota(bajar ? abajo : arriba, margen, vh - margen - h), lado: 'centro', vertical: bajar ? 'abajo' : 'arriba'};
  }
  const derecha = ax + sep + w <= vw - margen;
  const izquierda = ax - sep - w >= margen;
  const aLaIzq = !derecha && izquierda;
  const x = acota(aLaIzq ? ax - sep - w : ax + sep, margen, vw - margen - w);
  return {x, y: acota(ty ?? ay - 8, margen, vh - margen - h), lado: aLaIzq ? 'izquierda' : 'derecha', vertical: 'lado'};
}
