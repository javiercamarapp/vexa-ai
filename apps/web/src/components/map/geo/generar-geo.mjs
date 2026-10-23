// Generador de las geometrías del mapa (se corre a mano, no en el build):
//   node generar-geo.mjs us  <states-albers-10m.json> geo-us.mjs
//   node --import tsx generar-geo.mjs mx <mexico-estados-geo.ts> geo-mx.mjs
// Fuentes (versionadas en el encabezado de cada salida):
//  US: us-atlas@3.0.1 states-albers-10m.json (Census TIGER, dominio público), ya proyectado en Albers USA 975x610 con Alaska y Hawái en recuadro.
//  MX: INEGI vía angelnmara/geojson, Mercator fija, viewBox 1000x629, simplificado a 0.7 u (origen: repo propio Likida, src/app/admin/mapa-prospectos/mexico-estados-geo.ts).
// Sin dependencias: decodificador mínimo de TopoJSON + Douglas-Peucker POR ARCO (los arcos compartidos se simplifican una sola vez: sin rendijas entre vecinos).
import fs from 'node:fs';

const FIPS = {'01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI', '56': 'WY'};

function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const pila = [[0, pts.length - 1]];
  while (pila.length) {
    const [a, b] = pila.pop(); let dmax = 0, im = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i]; let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy)); if (d > dmax) { dmax = d; im = i; }
    }
    if (dmax > tol) { keep[im] = 1; pila.push([a, im], [im, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const r1 = n => Math.round(n * 10) / 10;

export function decodificar(topo, tol) {
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
  const arcos = topo.arcs.map(arc => { let x = 0, y = 0; const abs = arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; }); return dp(abs, tol).map(([a, b]) => [r1(a), r1(b)]); });
  const arco = i => (i >= 0 ? arcos[i] : [...arcos[~i]].reverse());
  const anillo = ids => { const out = []; ids.forEach((i, k) => { const p = arco(i); out.push(...(k ? p.slice(1) : p)); }); return out; };
  return { anillo };
}
const camino = pts => 'M' + pts.map(([x, y]) => `${x} ${y}`).join('L') + 'Z';
function bbox(rings) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const r of rings) for (const [x, y] of r) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { bx: r1(x0), by: r1(y0), bw: r1(x1 - x0), bh: r1(y1 - y0), cx: r1((x0 + x1) / 2), cy: r1((y0 + y1) / 2) }; }
const area = r => Math.abs(r.reduce((a, [x, y], i) => { const [x2, y2] = r[(i + 1) % r.length]; return a + (x * y2 - x2 * y); }, 0) / 2);

function salida(nombre, encabezado, geo) {
  return `${encabezado}\nexport const ${nombre} = ${JSON.stringify(geo)};\nexport default ${nombre};\n`;
}

const [modo, entrada, destino] = process.argv.slice(2);
if (modo === 'us') {
  const topo = JSON.parse(fs.readFileSync(entrada, 'utf8')), { anillo } = decodificar(topo, 0.45);
  const regiones = topo.objects.states.geometries.filter(g => FIPS[g.id]).map(g => {
    const polis = g.type === 'Polygon' ? [g.arcs] : g.arcs;
    // Se descartan islotes < 0.8 unidades² (ruido a esta escala) salvo que sea el único anillo.
    let anillos = polis.flatMap(p => p.map(anillo)).filter(r => r.length >= 4);
    const grandes = anillos.filter(r => area(r) >= 0.8); if (grandes.length) anillos = grandes;
    const codigo = FIPS[g.id];
    return { clave: `US-${codigo}`, codigo, ...bbox(anillos), path: anillos.map(camino).join('') };
  }).sort((a, b) => a.codigo.localeCompare(b.codigo));
  const enc = '// GENERADO por geo/generar-geo.mjs: no editar a mano. us-atlas@3.0.1 states-albers-10m (Census TIGER, dominio público), Albers USA 975x610 con Alaska y Hawái en recuadro; simplificado por arco a 0.45 u. Sin teselas, sin red.';
  fs.writeFileSync(destino, salida('GEO_US', enc, { pais: 'US', viewBox: { w: 975, h: 610 }, regiones }));
} else if (modo === 'mx') {
  const m = await import(new URL(entrada, 'file://' + process.cwd() + '/').href);
  const regiones = m.ESTADOS_GEO.map(e => ({ clave: e.id, codigo: e.id.replace('MX-', ''), cx: e.cx, cy: e.cy, bx: e.bx, by: e.by, bw: e.bw, bh: e.bh, path: e.path })).sort((a, b) => a.codigo.localeCompare(b.codigo));
  const enc = '// GENERADO por geo/generar-geo.mjs: no editar a mano. Adaptado del repo propio Likida (src/app/admin/mapa-prospectos/mexico-estados-geo.ts): INEGI vía angelnmara/geojson, Mercator fija, 1000x629, simplificado a 0.7 u.';
  fs.writeFileSync(destino, salida('GEO_MX', enc, { pais: 'MX', viewBox: { w: m.VIEWBOX_ESTADOS.w, h: m.VIEWBOX_ESTADOS.h }, regiones }));
} else { console.error('uso: us|mx <entrada> <salida>'); process.exit(1); }
