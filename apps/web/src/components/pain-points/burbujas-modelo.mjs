// Mapa de burbujas de «Puntos de dolor»: disposición DETERMINISTA (misma entrada → mismas posiciones; sin simulación de fuerzas).
// Radio = raíz del valor (el área es proporcional), 14–64 px (diámetro 28–128), máximo 24 burbujas y el resto en «+N más» por tema, empaquetado voraz en espiral de Arquímedes.
export const R_MIN = 14, R_MAX = 64, MAX_BURBUJAS = 24, SEPARACION = 3, PASO_ANGULO = 0.5, PASO_RADIO = 0.35, PASOS_MAX = 6000, RESTO_R_MAX = 40, ETIQUETA_ALTO = 26, MARGEN = 4;
export const TEMAS_ORDEN = ['devoluciones', 'garantia', 'logistica', 'canales', 'ubicaciones', 'sku'];
/** Valor numérico del punto en el modo elegido, o null si es sin dato (desconocido ≠ 0: jamás una burbuja de tamaño 0). */
export function valorDe(p, modo) {
  if (p.agregado) return null;
  if (modo === 'volumen') return p.volumen && !p.volumen.sinDato && p.volumen.n > 0 ? Number(p.volumen.n) : null;
  return p.dinero && !p.dinero.sinDato && BigInt(p.dinero.minor) > 0n ? Number(BigInt(p.dinero.minor)) / 100 : null;
}
export const radioDe = (v, vmax) => Math.max(R_MIN, Math.min(R_MAX, R_MAX * Math.sqrt(v / vmax)));
/** Rejilla de clusters según el ancho disponible: 3 columnas (≥720), 2 (≥520) o 1. */
export function rejilla(ancho) {
  const cols = ancho >= 720 ? 3 : ancho >= 520 ? 2 : 1, filas = Math.ceil(6 / cols), altoFila = cols === 3 ? 236 : 232;
  return {cols, filas, altoFila, alto: filas * altoFila};
}
function colocar(items, region, centro) {
  const puestas = [], omitidas = [];
  for (const it of items) {
    let ok = null;
    for (let k = 0; k <= PASOS_MAX; k++) {
      const a = k * PASO_ANGULO, rad = k * PASO_RADIO, x = centro.x + rad * Math.cos(a), y = centro.y + rad * Math.sin(a);
      if (x - it.r < region.x0 || x + it.r > region.x1 || y - it.r < region.y0 || y + it.r > region.y1) continue;
      if (puestas.every(q => Math.hypot(q.cx - x, q.cy - y) >= q.r + it.r + SEPARACION)) { ok = {x, y}; break; }
    }
    if (ok) puestas.push({...it, cx: Math.round(ok.x * 100) / 100, cy: Math.round(ok.y * 100) / 100}); else omitidas.push(it);
  }
  return {puestas, omitidas};
}
/**
 * puntos = puntos de dolor del servicio; modo = 'dinero' | 'volumen'; ancho = px disponibles. Devuelve burbujas, «+N más» por tema, sin cifra, omitidas, clusters y escala.
 * Los puntos `agregado` no se dibujan (son totales de otros) y los sin dato van a `sinCifra` (tabla), nunca con tamaño 0.
 */
export function disponerBurbujas({puntos, modo = 'dinero', ancho = 840, temas = TEMAS_ORDEN, maxBurbujas = MAX_BURBUJAS}) {
  const g = rejilla(ancho);
  const todos = puntos.filter(p => !p.agregado).map(p => ({p, v: valorDe(p, modo)}));
  const conValor = todos.filter(x => x.v !== null).sort((a, b) => b.v - a.v || a.p.id.localeCompare(b.p.id));
  const sinCifra = todos.filter(x => x.v === null).map(x => x.p).sort((a, b) => a.id.localeCompare(b.id));
  const vmax = conValor[0]?.v ?? 1;
  const visibles = conValor.slice(0, maxBurbujas), resto = conValor.slice(maxBurbujas);
  const clusters = temas.map((id, i) => {
    const col = i % g.cols, fila = Math.floor(i / g.cols), w = ancho / g.cols;
    const region = {x0: col * w + MARGEN, x1: (col + 1) * w - MARGEN, y0: fila * g.altoFila + ETIQUETA_ALTO, y1: (fila + 1) * g.altoFila - MARGEN};
    return {id, region, centro: {x: (region.x0 + region.x1) / 2, y: (region.y0 + region.y1) / 2}, etiquetaX: region.x0 + 4, etiquetaY: fila * g.altoFila + 16};
  });
  const burbujas = [], masPorTema = [], omitidas = [];
  for (const c of clusters) {
    let propios = visibles.filter(x => x.p.tema === c.id).map(x => ({tipo: 'punto', id: x.p.id, tema: c.id, valor: x.v, r: radioDe(x.v, vmax), minimo: R_MAX * Math.sqrt(x.v / vmax) < R_MIN, clase: x.p.clase}));
    let sobran = resto.filter(x => x.p.tema === c.id).map(x => ({id: x.p.id, valor: x.v}));
    let puestas = [], no = [];
    // Lo que no cabe en el cúmulo se suma a «+N más» y se vuelve a empaquetar (nada desaparece en silencio).
    for (let vuelta = 0; vuelta <= MAX_BURBUJAS; vuelta++) {
      const extra = sobran.length ? [{tipo: 'mas', id: 'mas~' + c.id, tema: c.id, n: sobran.length, ids: sobran.map(x => x.id), valor: sobran.reduce((a, x) => a + x.valor, 0), clase: 'O'}] : [];
      for (const e of extra) e.r = Math.min(RESTO_R_MAX, radioDe(e.valor, vmax));
      const orden = [...extra, ...propios.sort((a, b) => b.r - a.r || a.id.localeCompare(b.id))]; // «+N más» primero: siempre tiene su lugar
      ({puestas, omitidas: no} = colocar(orden, c.region, c.centro));
      const fuera = no.filter(x => x.tipo === 'punto');
      if (!fuera.length) break;
      const menor = fuera.sort((a, b) => a.valor - b.valor || a.id.localeCompare(b.id))[0];
      propios = propios.filter(x => x.id !== menor.id); sobran = [...sobran, {id: menor.id, valor: menor.valor}];
    }
    for (const q of puestas) (q.tipo === 'mas' ? masPorTema : burbujas).push(q);
    omitidas.push(...no);
    c.total = [...propios, ...sobran].reduce((a, x) => a + (x.valor ?? 0), 0);
    c.n = propios.length + sobran.length;
  }
  return {burbujas, masPorTema, sinCifra, omitidas, clusters, ancho, alto: g.alto, cols: g.cols, escala: {vmax, rMin: R_MIN, rMax: R_MAX}, modo};
}
/** Las 8 mayores para la tabla alternativa (siempre visible): por valor del modo, desempate por id. */
export function mayores(puntos, modo = 'dinero', n = 8) {
  return puntos.filter(p => !p.agregado).map(p => ({p, v: valorDe(p, modo)})).filter(x => x.v !== null).sort((a, b) => b.v - a.v || a.p.id.localeCompare(b.p.id)).slice(0, n).map(x => x.p);
}
