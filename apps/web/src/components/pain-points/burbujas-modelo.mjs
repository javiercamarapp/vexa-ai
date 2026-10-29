// Mapa de burbujas de «Puntos de dolor»: disposición DETERMINISTA (misma entrada → mismas posiciones; sin simulación de fuerzas).
// UNA escala global de área para todo el mapa: radio = RAÍZ del valor sobre el mayor (r = rMax·√(v/vmax)), igual en todos los cúmulos, sin radio mínimo que infle y sin tope que encoja.
// Los puntos cuyo radio verdadero quede bajo R_UMBRAL (≈2 % del mayor) —y solo ellos— se juntan en UNA burbuja «pequeños» por cúmulo cuya área es su SUMA (misma escala);
// todo lo demás se dibuja individual, nunca escondido en un «+N más». Cada cúmulo crece en alto lo que necesite (no hay región fija donde «no quepa»).
import {usdCorto, num} from './modelo.mjs';
export const R_UMBRAL = 8, R_GRUPO_MIN = 12, SEPARACION = 3, PAD = 6, GAP = 16, ALTO_MIN = 96, PASO_ANGULO = 0.5, PASO_RADIO = 0.35, PASOS_MAX = 6000, CHAR_W = 6.7, LINE_H = 14, FUERA_MAX = 22;
export const TEMAS_ORDEN = ['devoluciones', 'garantia', 'logistica', 'canales', 'ubicaciones', 'sku'];
/** Qué mide cada tema y cómo se relaciona con el dinero devuelto (una línea; el detalle vive en la evidencia). */
export const TEMA_NOTA = {
  devoluciones: 'Reembolsos negados o pendientes: partes del dinero devuelto',
  garantia: 'Solicitudes de garantía: el Tracker no trae monto',
  logistica: 'Hilos lentos y contacto repetido: se miden en casos, no en dinero',
  canales: 'Dinero devuelto por canal, más los pedidos cancelados',
  ubicaciones: 'Casos por estado: aún sin fuente de destino',
  sku: 'Los SKU con más dinero devuelto: otro corte del mismo dinero',
};
export const TEMA_NOTA_EN = {
  devoluciones: 'Denied or pending refunds: parts of the money refunded',
  garantia: 'Warranty requests: the Tracker has no amount',
  logistica: 'Slow threads and repeat contact: measured in cases, not in money',
  canales: 'Money refunded by channel, plus cancelled orders',
  ubicaciones: 'Cases by state: no destination source yet',
  sku: 'SKUs with the most money refunded: another cut of the same money',
};
/** Nota del tema en el idioma pedido (por omisión español). */
export const notaDeTema = (id, idioma) => (idioma === 'en' ? TEMA_NOTA_EN : TEMA_NOTA)[id];
const fin = x => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : null);
/** Valor numérico del punto en el modo elegido (sin descartar agregados), o null si es sin dato / cero / inválido (desconocido ≠ 0: jamás una burbuja de tamaño 0). */
export function valorBruto(p, modo) {
  if (modo === 'volumen') return p.volumen && !p.volumen.sinDato ? fin(Number(p.volumen.n)) : null;
  if (!p.dinero || p.dinero.sinDato) return null;
  try { const m = BigInt(p.dinero.minor); return m > 0n ? fin(Number(m) / 100) : null; } catch { return null; }
}
/** Valor dibujable: los puntos `agregado` son totales de otros y no se dibujan. */
export const valorDe = (p, modo) => (p.agregado ? null : valorBruto(p, modo));
/** 'valor' | 'cero' (medido y es 0: se dice «0», no «Sin dato») | 'sin_dato' (falta, falló o es inválido). */
export function estadoDe(p, modo) {
  if (valorBruto(p, modo) !== null) return 'valor';
  const m = modo === 'volumen' ? p.volumen : p.dinero;
  if (!m || m.sinDato) return 'sin_dato';
  try { const x = modo === 'volumen' ? Number(m.n) : Number(BigInt(m.minor)); return x === 0 ? 'cero' : 'sin_dato'; } catch { return 'sin_dato'; }
}
/** Columnas de cúmulos según el ancho: 3 (≥960), 2 (≥560) o 1; nunca más que cúmulos visibles. */
export function columnas(ancho, k = 6) {
  const base = ancho >= 960 ? 3 : ancho >= 560 ? 2 : 1, cols = Math.max(1, Math.min(base, k));
  return {cols, gap: GAP, colAncho: Math.floor((ancho - GAP * (cols - 1)) / cols)};
}
/** Radio máximo (px) del punto mayor, según el ancho disponible; la misma escala sirve a todos los cúmulos y pestañas de ese ancho. */
export function rMaxDe(ancho) {
  return Math.max(34, Math.min(60, Math.round(columnas(ancho, 6).colAncho * 0.15)));
}
/** Radio verdadero (px) de un valor en la escala global. */
export const radioDe = (v, vmax, rMax) => rMax * Math.sqrt(v / vmax);
/** Dos valores redondos (1-2-5), el grande ≈ la mitad del mayor, para la leyenda de tamaño: [grande, chico] (uno solo si el chico no tendría sentido). */
export function valoresReferencia(vmax, modo = 'dinero') {
  if (!(vmax > 0)) return [];
  const nice = x => { const e = 10 ** Math.floor(Math.log10(x)), m = x / e; return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * e; };
  const grande = nice(vmax / 2), chico = nice(grande / 4);
  return chico < grande && (modo !== 'volumen' || chico >= 1) ? [grande, chico] : [grande];
}
/** Nombre corto para rotular: sin el prefijo «Dinero devuelto · » y antes de «:» o «(». */
export const nombreCorto = n => String(n).replace(/^Dinero devuelto · /, '').split(/[:(]/)[0].trim() || String(n);
/** Parte un texto en hasta `maxLineas` líneas de `max` caracteres (rompe tras espacio o guion); `truncado` si no cupo completo. */
export function partirNombre(t, max, maxLineas = 2) {
  const out = [''];
  let truncado = false;
  for (const w of String(t).split(/(?<=[\s-])/)) {
    const l = out[out.length - 1];
    if ((l + w).trim().length <= max) out[out.length - 1] = l + w; else if (!l.trim() && w.trim().length > max) { out[out.length - 1] = w; truncado = true; } else if (out.length < maxLineas) out.push(w); else { out[out.length - 1] = l + w; truncado = true; }
  }
  return {lineas: out.map(l => l.trim()).filter(Boolean).map(l => (l.length > max ? l.slice(0, Math.max(1, max - 1)) + '…' : l)), truncado: truncado || out.some(l => l.trim().length > max)};
}
/** Rótulo de una burbuja: DENTRO (nombre + valor) solo si cabe entero en el círculo; si no, FUERA (debajo, 2 líneas: nombre y valor). Nada se rotula con texto recortado dentro. */
export function rotular(nombre, valorTxt, r, W) {
  for (const nl of [1, 2]) {
    const H = (nl + 1) * LINE_H;
    if (H / 2 >= r) continue;
    const chord = 2 * Math.sqrt(r * r - (H / 2) ** 2) - 6, max = Math.floor(chord / CHAR_W);
    if (max < 3 || valorTxt.length > max) continue;
    const p = partirNombre(nombre, max, nl);
    if (!p.truncado && p.lineas.length <= nl) return {dentro: true, lineas: p.lineas, valor: valorTxt, w: 0, h: 0};
  }
  const max = Math.max(4, Math.min(FUERA_MAX, Math.floor((W - 2 * PAD) / CHAR_W)));
  const n = String(nombre).length > max ? String(nombre).slice(0, max - 1).trimEnd() + '…' : String(nombre);
  return {dentro: false, lineas: [n], valor: valorTxt, w: Math.ceil(Math.max(n.length, valorTxt.length) * CHAR_W) + 4, h: 2 * LINE_H};
}
const rectDe = a => (a.label && !a.label.dentro ? {x0: a.cx - a.label.w / 2, x1: a.cx + a.label.w / 2, y0: a.cy + a.r + 2, y1: a.cy + a.r + 2 + a.label.h} : null);
const rectCirculo = (q, c, m) => Math.hypot(Math.max(q.x0, Math.min(c.cx, q.x1)) - c.cx, Math.max(q.y0, Math.min(c.cy, q.y1)) - c.cy) < c.r + m;
function choca(a, b) {
  if (Math.hypot(a.cx - b.cx, a.cy - b.cy) < a.r + b.r + SEPARACION) return true;
  const ra = rectDe(a), rb = rectDe(b);
  if (ra && rectCirculo(ra, b, SEPARACION)) return true;
  if (rb && rectCirculo(rb, a, SEPARACION)) return true;
  return !!(ra && rb && ra.x0 < rb.x1 + SEPARACION && rb.x0 < ra.x1 + SEPARACION && ra.y0 < rb.y1 + SEPARACION && rb.y0 < ra.y1 + SEPARACION);
}
function empaquetar(items, W) {
  const puestas = [];
  let minY = Infinity, maxY = -Infinity;
  for (const it of items) {
    let ok = null;
    const ext = Math.max(it.r, (it.label && !it.label.dentro ? it.label.w / 2 : 0)), lo = ext + PAD, hi = W - ext - PAD;
    if (hi >= lo) for (let k = 0; k <= PASOS_MAX && !ok; k++) {
      const a = k * PASO_ANGULO, rad = k * PASO_RADIO, x = Math.min(hi, Math.max(lo, W / 2 + rad * Math.cos(a))), y = rad * Math.sin(a);
      if (puestas.every(q => !choca(q, {...it, cx: x, cy: y}))) ok = {x, y};
    }
    if (!ok) ok = {x: W / 2, y: puestas.length ? maxY + it.r + SEPARACION : 0}; // respaldo: debajo de todo (nada se omite)
    const q = {...it, cx: ok.x, cy: ok.y};
    puestas.push(q);
    minY = Math.min(minY, ok.y - it.r); maxY = Math.max(maxY, ok.y + it.r, rectDe(q)?.y1 ?? -Infinity);
  }
  const alto = Math.max(ALTO_MIN, puestas.length ? maxY - minY + 2 * PAD : 0), dy = puestas.length ? PAD - minY + (alto - (maxY - minY + 2 * PAD)) / 2 : 0;
  return {puestas: puestas.map(q => ({...q, cx: Math.round(q.cx * 100) / 100, cy: Math.round((q.cy + dy) * 100) / 100})), alto: Math.ceil(alto)};
}
const suma = xs => xs.reduce((a, x) => a + x, 0);
const etiquetaPadre = p => (p.agregado ? 'Dinero devuelto' : p.nombre);
/** Conciliación del modo Dinero: suma de las burbujas (con cortes repetidos) vs. dinero sin repetir (totales + puntos independientes). En Volumen no se suma entre cúmulos (unidades distintas). */
export function conciliar(puntos, modo = 'dinero') {
  if (modo !== 'dinero') return {modo, aplica: false, suma: null, sinRepetir: null, items: [], repetido: null};
  const total = suma(puntos.filter(p => !p.agregado).map(p => valorBruto(p, 'dinero') ?? 0));
  const items = puntos.filter(p => valorBruto(p, 'dinero') !== null && (p.agregado || (!p.padre && !(p.solapaCon && p.solapaCon.length))))
    .map(p => ({id: p.id, nombre: etiquetaPadre(p), valor: valorBruto(p, 'dinero')})).sort((a, b) => b.valor - a.valor || a.id.localeCompare(b.id));
  const sinRepetir = suma(items.map(x => x.valor));
  return {modo, aplica: true, suma: total, sinRepetir, items, repetido: Math.max(0, total - sinRepetir)};
}
/**
 * puntos = puntos de dolor a mostrar; modo = 'dinero' | 'volumen'; ancho = px disponibles; temas = cúmulos visibles (en orden);
 * escalaDe = TODOS los puntos (la escala y la conciliación no cambian al filtrar por pestaña).
 * Devuelve cúmulos con burbujas ya colocadas (coordenadas locales de cada cúmulo), los temas vacíos aparte (`vacios`), `sinCifra` (compat: desconocidos), escala y conciliación.
 */
export function disponerBurbujas({puntos, modo = 'dinero', ancho = 840, temas = TEMAS_ORDEN, escalaDe = null, idioma}) {
  const todosLosPuntos = escalaDe ?? puntos;
  const dibujables = puntos.filter(p => !p.agregado);
  const escalaVals = [...todosLosPuntos, ...puntos].filter(p => !p.agregado).map(p => valorBruto(p, modo)).filter(v => v !== null);
  const vmax = escalaVals.length ? Math.max(...escalaVals) : 1;
  const rMaxBase = rMaxDe(ancho);
  const extra = [...new Set(dibujables.map(p => p.tema))].filter(t => !temas.includes(t)).sort();
  const ids = [...temas, ...extra]; // un tema desconocido se agrega al final: ningún punto se pierde
  const porId = new Map(todosLosPuntos.map(p => [p.id, p]));
  const info = ids.map(id => {
    const mios = dibujables.filter(p => p.tema === id).map(p => ({p, v: valorBruto(p, modo)}));
    return {id, mios, con: mios.filter(x => x.v !== null), sin: mios.filter(x => x.v === null && estadoDe(x.p, modo) === 'sin_dato').map(x => x.p), ceros: mios.filter(x => x.v === null && estadoDe(x.p, modo) === 'cero').map(x => x.p)};
  });
  const llenos = info.filter(i => i.con.length), g = columnas(ancho, Math.max(1, llenos.length));
  const rMax = Math.max(18, Math.min(rMaxBase, Math.floor((g.colAncho - 2 * PAD) / 2)));
  const clusters = llenos.map(i => {
    const items = i.con.map(x => ({p: x.p, valor: x.v, r: radioDe(x.v, vmax, rMax)})).sort((a, b) => b.valor - a.valor || a.p.id.localeCompare(b.p.id));
    const vTxt = v => (modo === 'dinero' ? usdCorto(String(Math.round(v * 100)), idioma) : num(v, idioma));
    const grandes = items.filter(x => x.r >= R_UMBRAL).map(x => ({tipo: 'punto', id: x.p.id, tema: i.id, valor: x.valor, r: x.r, clase: x.p.clase, label: rotular(nombreCorto(x.p.nombre), vTxt(x.valor), x.r, g.colAncho)}));
    const unicoChico = items.filter(x => x.r < R_UMBRAL).length === 1 ? items.find(x => x.r < R_UMBRAL) : null; // un solo pequeño no es un grupo: se dibuja él mismo con tamaño mínimo marcado
    const chicos = unicoChico ? [] : items.filter(x => x.r < R_UMBRAL), sumaChicos = suma(chicos.map(x => x.valor));
    const rg = chicos.length ? radioDe(sumaChicos, vmax, rMax) : 0;
    if (unicoChico) { const r = Math.max(R_GRUPO_MIN, unicoChico.r); grandes.push({tipo: 'punto', id: unicoChico.p.id, tema: i.id, valor: unicoChico.valor, r, clase: unicoChico.p.clase, minimo: r > unicoChico.r, label: rotular(nombreCorto(unicoChico.p.nombre), vTxt(unicoChico.valor), r, g.colAncho)}); }
    const rgf = Math.max(R_GRUPO_MIN, rg);
    const grupo = chicos.length ? [{tipo: 'grupo', id: 'grupo~' + i.id, tema: i.id, valor: sumaChicos, r: rgf, minimo: rg < R_GRUPO_MIN, label: rotular(chicos.length + (idioma === 'en' ? ' small' : chicos.length === 1 ? ' pequeño' : ' pequeños'), vTxt(sumaChicos), rgf, g.colAncho), n: chicos.length, ids: chicos.map(x => x.p.id), miembros: chicos.map(x => ({id: x.p.id, nombre: x.p.nombre, valor: x.valor})), clase: 'O'}] : [];
    const {puestas, alto} = empaquetar([...grandes, ...grupo], g.colAncho);
    const unidades = [...new Set(items.map(x => x.p.volumen?.unidad).filter(Boolean))];
    // ¿De qué dinero es parte? Si los puntos del cúmulo cuelgan de un total (padre), cuánto de ese total reparten.
    let reparte = null;
    for (const pid of [...new Set(items.map(x => x.p.padre).filter(Boolean))].sort()) {
      const pp = porId.get(pid), pv = pp ? valorBruto(pp, modo) : null;
      if (!pv) continue;
      const hijos = items.filter(x => x.p.padre === pid), sh = suma(hijos.map(x => x.valor));
      reparte = {padre: pid, etiqueta: etiquetaPadre(pp), suma: sh, total: pv, pct: Math.round(sh * 1000 / pv) / 10, n: hijos.length, otros: items.filter(x => x.p.padre !== pid).map(x => ({id: x.p.id, nombre: x.p.nombre, valor: x.valor}))};
      break;
    }
    return {id: i.id, ancho: g.colAncho, alto, burbujas: puestas, n: items.length, total: suma(items.map(x => x.valor)), unidad: unidades.length === 1 ? unidades[0] : null, unidades, reparte, sinCifra: i.sin, ceros: i.ceros};
  });
  const vacios = info.filter(i => !i.con.length).map(i => ({id: i.id, sinCifra: i.sin, ceros: i.ceros, n: i.mios.length}));
  const sinCifra = dibujables.filter(p => estadoDe(p, modo) === 'sin_dato').sort((a, b) => a.id.localeCompare(b.id));
  const todas = clusters.flatMap(c => c.burbujas);
  return {
    modo, ancho, cols: g.cols, colAncho: g.colAncho, gap: GAP, clusters, vacios, sinCifra,
    burbujas: todas.filter(b => b.tipo === 'punto'), grupos: todas.filter(b => b.tipo === 'grupo'),
    escala: {vmax, rMax, rUmbral: R_UMBRAL, valorUmbral: vmax * (R_UMBRAL / rMax) ** 2, refs: valoresReferencia(vmax, modo).map(v => ({valor: v, r: radioDe(v, vmax, rMax)}))},
    conciliacion: conciliar(todosLosPuntos, modo),
  };
}
/** Las 8 mayores para la tabla alternativa (siempre visible): por valor del modo, desempate por id. */
export function mayores(puntos, modo = 'dinero', n = 8) {
  return puntos.filter(p => !p.agregado).map(p => ({p, v: valorDe(p, modo)})).filter(x => x.v !== null).sort((a, b) => b.v - a.v || a.p.id.localeCompare(b.p.id)).slice(0, n).map(x => x.p);
}
