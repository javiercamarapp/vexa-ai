// nube.js: motor de nube de puntos de rovaq.ai. Módulo ES del mismo origen, sin dependencias, WebGL1 propio (solo POINTS), sin eval ni wasm, sin estilos en línea.
// Contrato K5 (SPEC 3.5): crearNube(canvas, opciones) devuelve {cargar, mostrar, mezcla, progreso, tema, pausar, reanudar, destruir, estado, nivel}.
// Lee archivos PTS3 (tools/puntos/pts3.mjs). El punto k de un objeto viaja al punto k del siguiente (mismo orden Morton), con retardo por punto, y al llegar
// se condensa en sólido iluminado grano a grano. Colores desde --s-tinta, --s-acento y --s-fondo. Las funciones puras se exportan para las pruebas.
export const NIVELES = {alto: 12000, medio: 7000, bajo: 4500};
const RETARDO = 0.6; // fracción del morfo que ocupa el retardo por punto (SPEC: 0.30; se subió a 0.6 para que la forma se erosione en vez de fundirse de golpe)
const ORDEN = ['alto', 'medio', 'bajo'];
const clamp = (a, b, v) => Math.min(b, Math.max(a, v)), suave = (a, b, v) => { const t = clamp(0, 1, (v - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------- Matemática pura (probada en tests/sitio/nube-matematica.test.mjs) ----------
// Remapeo del progreso del héroe: la cámara se detiene un poco donde está el texto. f(0)=0, f(1)=1, monótona.
export const remapeo = (x, L = 0.35) => { x = clamp(0, 1, x); return (1 - L) * x + L * (4 * (x - 0.5) ** 3 + 0.5); };
// Tiempo propio de un punto dentro del morfo: retardo por semilla (0.30), suavizado y desaceleración 1.7. Misma fórmula que el vertex shader.
export function tiempoPunto(mix, retardo) {
  const m = clamp(0, 1, mix / 0.82), t0 = clamp(0, 1, (m - retardo * RETARDO) / (1 - RETARDO)), t = t0 * t0 * (3 - 2 * t0);
  return 1 - Math.pow(1 - t, 1.7);
}
// Línea de tiempo del cambio de objeto (t de 0 a 1 = 0 a 1000 ms): el sólido saliente se disuelve en 140 ms, el entrante aparece grano a grano de 700 a 980 ms
// y la nube restante se desvanece de 850 a 1000. Devuelve la fracción de granos sólidos y la opacidad de la nube.
export function lineaDeTiempo(t) {
  t = clamp(0, 1, t);
  const sal = 1 - (clamp(0, 1, t / 0.14)) ** 2, ent = clamp(0, 1, (t - 0.7) / 0.28);
  return {solido: t < 0.5 ? sal : ent, fade: 1 - suave(0.85, 1, t)};
}
// Retardo por punto: mezcla de azar y altura de origen (la forma se disuelve de arriba abajo). Misma fórmula que el vertex shader.
export const retardoDe = (azar, y0) => 0.25 * azar + 0.75 * (0.5 - 0.5 * y0);
// Trayectoria de un punto: de p0 a p1 con un remolino suave y apertura hacia su dirección a mitad de vuelo. Devuelve [x, y, z].
export function trayectoria(p0, p1, dir, retardo, mix, apertura = 0.07) {
  const te = tiempoPunto(mix, retardo), sw = Math.sin(Math.PI * te);
  const x = p0[0] + (p1[0] - p0[0]) * te, y = p0[1] + (p1[1] - p0[1]) * te, z = p0[2] + (p1[2] - p0[2]) * te;
  return [x + 0.11 * sw * Math.sin(y * 4 + te * 5) + dir[0] * apertura * sw, y + 0.11 * sw * Math.sin(z * 4 + te * 5 + 1.7) + dir[1] * apertura * sw, z + 0.11 * sw * Math.sin(x * 4 + te * 5 + 3.1) + dir[2] * apertura * sw];
}
// Elige nivel de calidad por capacidad. caps: {ancho, memoria, ahorro, tipoRed}.
export function elegirNivel({ancho = 1440, memoria = 8, ahorro = false, tipoRed = '4g'} = {}) {
  if (ahorro || /2g/.test(tipoRed) || memoria <= 2) return null;
  if (ancho < 760) return 'bajo';
  if (ancho < 1024 || memoria <= 4 || tipoRed === '3g') return 'medio';
  return 'alto';
}
// Regulador por mediana de cuadros: cada 30 muestras, si la mediana supera 20 ms, devuelve true (hay que bajar un nivel).
export class Regulador {
  constructor(n = 30, umbral = 20) { this.n = n; this.umbral = umbral; this.m = []; }
  muestra(ms) { if (!(ms > 0) || ms > 250) return false; this.m.push(ms); if (this.m.length < this.n) return false; const s = this.m.sort((a, b) => a - b), med = s[this.n >> 1]; this.m = []; return med > this.umbral; }
}
// Resorte críticamente amortiguado (k 120, c 22) integrado en pasos pequeños; estable para dt <= 0.05.
export function pasoResorte(e, objetivo, dt, k = 120, c = 22) {
  let x = e.x, v = e.v; const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
  for (let i = 0; i < n; i++) { v += (k * (objetivo - x) - c * v) * h; x += v * h; }
  return {x, v};
}
const hashSeed = (i) => { let a = (i * 2654435761 + 12345) >>> 0; a = Math.imul(a ^ (a >>> 15), 2246822507) >>> 0; a = Math.imul(a ^ (a >>> 13), 3266489909) >>> 0; return ((a ^ (a >>> 16)) >>> 0) / 4294967296; };
// Semillas por punto: dirección unitaria aleatoria (xyz en 0..255) y retardo (w). Deterministas por índice.
export function semillas(n) {
  const s = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { let x, y, z, k = 0; do { x = hashSeed(i * 7 + k++) * 2 - 1; y = hashSeed(i * 7 + k++) * 2 - 1; z = hashSeed(i * 7 + k++) * 2 - 1; } while (x * x + y * y + z * z > 1 && k < 40); s.set([Math.round((x + 1) * 127.5), Math.round((y + 1) * 127.5), Math.round((z + 1) * 127.5), Math.round(hashSeed(i * 7 + 99) * 255)], i * 4); }
  return s;
}

// ---------- Formato PTS3 ----------
const BITS = 10;
const compacta = (v) => { v &= 0x9249249; v = (v | (v >> 2)) & 0x30c30c3; v = (v | (v >> 4)) & 0x300f00f; v = (v | (v >> 8)) & 0x30000ff; v = (v | (v >> 16)) & 0x3ff; return v; };
function deOcta(ex, ey) { let x = ex, y = ey, z = 1 - Math.abs(x) - Math.abs(y); if (z < 0) { const ox = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1), oy = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1); x = ox; y = oy; } const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; }
// Descomprime el cuerpo si lleva la bandera de gzip (DecompressionStream) y decodifica. Devuelve {n, pos (Float32 x3), nor (Float32 x3), lum, rojo, borde}.
export async function decodificarPts3(ab) {
  const u8 = new Uint8Array(ab), dv = new DataView(ab);
  if (u8.length < 16 || String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== 'PTS3') throw new Error('pts3: magia');
  if (dv.getUint16(4, true) !== 1 || u8[6] !== BITS) throw new Error('pts3: versión');
  const n = dv.getUint32(8, true), nPos = dv.getUint32(12, true);
  let cuerpo = u8.subarray(16);
  if (u8[7] & 1) cuerpo = new Uint8Array(await new Response(new Blob([cuerpo]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  if (cuerpo.length !== nPos + n * 3) throw new Error('pts3: tamaño');
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), lum = new Float32Array(n), rojo = new Uint8Array(n), borde = new Uint8Array(n);
  let o = 0, m = 0;
  for (let i = 0; i < n; i++) {
    let d = 0, mul = 1, b;
    do { if (o >= nPos) throw new Error('pts3: varint'); b = cuerpo[o++]; d += (b & 127) * mul; mul *= 128; } while (b & 128);
    m += d; const c = (q) => (q + 0.5) / 512 - 1;
    pos[i * 3] = c(compacta(m)); pos[i * 3 + 1] = c(compacta(m >>> 1)); pos[i * 3 + 2] = c(compacta(m >>> 2));
    nor.set(deOcta((cuerpo[nPos + i] - 31) / 31, (cuerpo[nPos + n + i] - 31) / 31), i * 3);
    const a = cuerpo[nPos + 2 * n + i]; lum[i] = (a & 31) / 31; rojo[i] = (a >> 5) & 1; borde[i] = (a >> 6) & 1;
  }
  return {n, pos, nor, lum, rojo, borde};
}
// Toma m puntos de un modelo con paso uniforme sobre el orden Morton (1 de cada n). Si el modelo tiene menos, repite con un pequeño desplazamiento determinista.
// Devuelve {m, pos: Float32 x3, att: Uint8 x8 [nx, ny, lum, rojo, borde, 0, 0, 0]} listo para subir a la GPU.
export function remuestrear(d, m) {
  const pos = new Float32Array(m * 3), att = new Uint8Array(m * 8);
  for (let j = 0; j < m; j++) {
    const i = Math.min(d.n - 1, Math.floor(j * d.n / m)), rep = d.n < m && j * d.n % m !== 0 && Math.floor(j * d.n / m) === Math.floor((j - 1) * d.n / m);
    for (let k = 0; k < 3; k++) pos[j * 3 + k] = clamp(-1, 1, d.pos[i * 3 + k] + (rep ? (hashSeed(j * 3 + k) - 0.5) * 0.012 : 0));
    const nx = d.nor[i * 3], ny = d.nor[i * 3 + 1], nz = d.nor[i * 3 + 2], l = Math.abs(nx) + Math.abs(ny) + Math.abs(nz) || 1;
    let ex = nx / l, ey = ny / l; if (nz < 0) { const ox = (1 - Math.abs(ey)) * (ex >= 0 ? 1 : -1), oy = (1 - Math.abs(ex)) * (ey >= 0 ? 1 : -1); ex = ox; ey = oy; }
    att.set([Math.round((ex * 0.5 + 0.5) * 255), Math.round((ey * 0.5 + 0.5) * 255), Math.round(d.lum[i] * 255), d.rojo[i] * 255, d.borde[i] * 255], j * 8);
  }
  return {m, pos, att};
}

// ---------- Shaders ----------
const VS = `attribute vec3 aP0, aP1; attribute vec2 aN0, aN1; attribute vec3 aC0, aC1; attribute vec4 aS;
uniform float uMix, uSolid, uTam, uDist, uAsp, uF, uEsc, uDust, uApert; uniform vec2 uRot; uniform vec3 uPtr;
varying vec3 vN; varying vec3 vC; varying float vG, vA, vH;
vec3 octa(vec2 e){ e = e * 2.0 - 1.0; vec3 v = vec3(e, 1.0 - abs(e.x) - abs(e.y)); if (v.z < 0.0) v.xy = (1.0 - abs(v.yx)) * vec2(v.x >= 0.0 ? 1.0 : -1.0, v.y >= 0.0 ? 1.0 : -1.0); return normalize(v); }
void main(){
  vec3 dir = aS.xyz * 2.0 - 1.0;
  float dl = 0.25 * aS.w + 0.75 * (0.5 - 0.5 * aP0.y);
  float m = clamp(uMix / 0.82, 0.0, 1.0), t = clamp((m - dl * 0.6) / 0.4, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t); float te = 1.0 - pow(1.0 - t, 1.7), sw = sin(3.14159265 * te);
  vec3 p = mix(aP0, aP1, te);
  p += 0.11 * sw * vec3(sin(p.y * 4.0 + te * 5.0), sin(p.z * 4.0 + te * 5.0 + 1.7), sin(p.x * 4.0 + te * 5.0 + 3.1)) + dir * uApert * sw;
  float dd = uDust * (0.35 + 0.9 * aS.w); p += dir * dd * 0.9 + vec3(sin(p.y * 3.0 + dd * 4.0), sin(p.z * 3.0 + dd * 4.0 + 1.3), 0.0) * dd * 0.25;
  vec3 n = normalize(mix(octa(aN0), octa(aN1), te) + vec3(0.0001));
  float cy = cos(uRot.x), sy = sin(uRot.x), cx = cos(uRot.y), sx = sin(uRot.y);
  p = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z); p = vec3(p.x, cx * p.y - sx * p.z, sx * p.y + cx * p.z); p *= uEsc;
  n = vec3(cy * n.x + sy * n.z, n.y, -sy * n.x + cy * n.z); n = vec3(n.x, cx * n.y - sx * n.z, sx * n.y + cx * n.z);
  vec2 dv = p.xy - uPtr.xy; float f = uPtr.z * exp(-dot(dv, dv) / 0.1225); p.xy += normalize(dv + 1e-4) * 0.05 * f;
  vec3 cc = mix(aC0, aC1, te); float z = p.z + uDist - 0.07 * cc.z; // las aristas se adelantan un poco para no quedar tapadas por los granos de la cara
  gl_Position = vec4(p.x * uF / uAsp, p.y * uF, (z - 1.0) * 0.12, z);
  float hh = fract(sin(dot(aS.xyz, vec3(12.9898, 78.233, 37.719)) * 43758.5453) * 43758.5453);
  vG = step(hh, uSolid) * (1.0 - clamp(uDust * 2.0, 0.0, 1.0));
  vC = mix(aC0, aC1, te); vN = n; vH = sw;
  vA = (1.0 - 0.45 * clamp(dd, 0.0, 1.0)) * (1.0 - 0.12 * sw);
  gl_PointSize = uTam * mix(1.0 - 0.1 * sw, 2.2 - 0.9 * vC.z, vG) * clamp(uDist / z, 0.8, 1.3) * (1.0 - 0.5 * clamp(dd, 0.0, 1.0));
}`;
const FS = `precision mediump float; uniform vec3 uTinta, uAcento, uSombra, uLuz; uniform float uFade, uAdit;
varying vec3 vN; varying vec3 vC; varying float vG, vA, vH;
void main(){
  vec2 c = gl_PointCoord - 0.5; float r = dot(c, c); if (r > 0.25) discard;
  vec3 nn = normalize(vN), L = normalize(vec3(-0.5, 0.75, 0.55));
  float dif = clamp(dot(nn, L), 0.0, 1.0), ndl = dif * 0.7 + 0.3, rim = pow(1.0 - clamp(abs(nn.z), 0.0, 1.0), 2.4), cara = nn.z > -0.05 ? 1.0 : 0.07;
  float luz = 0.2 + 0.7 * pow(dif, 1.1) * (0.5 + 0.5 * vC.x) + rim * (0.4 + 0.4 * dif) + vC.z * 0.5;
  vec3 solido = mix(uSombra, uLuz, clamp(luz, 0.0, 1.0)); solido = mix(solido, uAcento, vC.y);
  vec3 nube = mix(uTinta * (0.5 + 0.5 * ndl), uAcento, vC.y);
  float aS = smoothstep(0.25, 0.1, r) * cara, aN = smoothstep(0.25, 0.08, r) * vA * uFade;
  vec3 col = mix(nube, solido, vG); float a = clamp(mix(aN, aS, vG), 0.0, 1.0);
  gl_FragColor = vec4(col * a, a * mix(uAdit, 1.0, vG));
}`;

// ---------- Motor ----------
function leeColor(ctx, valor, defecto) { try { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = valor || defecto; ctx.fillRect(0, 0, 1, 1); const d = ctx.getImageData(0, 0, 1, 1).data; return [d[0] / 255, d[1] / 255, d[2] / 255]; } catch { return [0.5, 0.5, 0.5]; } }

export function crearNube(canvas, opciones = {}) {
  const O = {nivel: null, dprMax: 1.5, puntero: false, puntos: 0, modelos: null, ...opciones};
  const est = (e) => { canvas.dataset.estado = e; };
  if (!canvas.hasAttribute('data-nube')) canvas.dataset.nube = '';
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const determinista = !!nav.webdriver;
  let modelos = O.modelos;
  if (!modelos && canvas.dataset.modelos) { try { modelos = JSON.parse(canvas.dataset.modelos); } catch { modelos = null; } }
  const claves = Array.isArray(modelos) ? modelos.map((u, i) => String(i)) : Object.keys(modelos || {});
  const urlDe = (c) => (Array.isArray(modelos) ? modelos[+c] : modelos?.[c]) ?? c;
  const lista = [], porClave = new Map(); // {clave, url, datos, pend}
  let nivel = O.nivel || elegirNivel({ancho: innerWidth, memoria: nav.deviceMemory ?? 8, ahorro: nav.connection?.saveData, tipoRed: nav.connection?.effectiveType}), gl = null, prog = null, u = {}, a = {}, destruida = false;
  const reducido = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const API = {};
  const respaldo = () => { est('respaldo'); const v = () => Promise.resolve(-1); Object.assign(API, {cargar: v, mostrar: v, mezcla() {}, progreso() {}, tema() {}, pausar() {}, reanudar() {}, destruir() {}, estado: 'respaldo', nivel: nivel || 'bajo'}); return API; };
  if (!nivel || reducido) return respaldo();
  try { gl = canvas.getContext('webgl', {alpha: true, antialias: false, depth: true, premultipliedAlpha: true, powerPreference: innerWidth < 760 ? 'low-power' : 'high-performance', failIfMajorPerformanceCaveat: true}); } catch { gl = null; }
  if (!gl) return respaldo();
  est('cargando');

  // estado de la escena
  const S = {de: -1, a: -1, mix: 0, anim: null, dust: 0, esc: 1, rotBase: 0, ptr: {x: 0, y: 0, f: 0, ox: {x: 0, v: 0}, oy: {x: 0, v: 0}, tx: 0, ty: 0}, solido: 1, fade: 1, sucio: true};
  let tema = {tinta: [0.97, 0.97, 0.97], acento: [0.91, 0.14, 0.11], fondo: [0.055, 0.055, 0.063]}, temaFijo = false;
  let visible = false, oculto = typeof document !== 'undefined' && document.hidden, pausadoManual = false, raf = 0, ult = 0, reposo = 0, cuadros = 0, t0 = 0, liberada = false, perdidas = 0, tLibera = 0;
  const reg = new Regulador();
  let bufA = null, bufB = null, bufSem = null, dim = {w: 0, h: 0, dpr: 1, tam: 2, asp: 1, fill: 0.84}, ultPar = '', aux = null;

  const ctx2d = () => aux || (aux = (typeof document !== 'undefined' ? document.createElement('canvas') : null)?.getContext('2d', {willReadFrequently: true}));
  function leeTema() {
    if (temaFijo) return; const cs = getComputedStyle(canvas), c = ctx2d(); if (!c) return;
    const fondo = leeColor(c, cs.getPropertyValue('--s-fondo').trim(), '#0e0e10'), tinta = leeColor(c, cs.getPropertyValue('--s-tinta').trim(), '#f7f7f8'), acento = leeColor(c, cs.getPropertyValue('--s-acento').trim(), '#e8241c');
    tema = {tinta, acento, fondo}; S.sucio = true;
  }
  function uniformesTema() {
    const t = tema, claro = 0.3 * t.fondo[0] + 0.59 * t.fondo[1] + 0.11 * t.fondo[2] > 0.5, mx = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
    // Sobre oscuro: sombra casi del fondo y luz de tinta, mezcla casi aditiva. Sobre claro: sombra de tinta y luz grisácea, mezcla normal.
    const sombra = claro ? t.tinta : mx(t.fondo, t.tinta, 0.12), luz = claro ? mx(t.tinta, t.fondo, 0.62) : t.tinta;
    gl.uniform3fv(u.uTinta, t.tinta); gl.uniform3fv(u.uAcento, t.acento); gl.uniform3fv(u.uSombra, sombra); gl.uniform3fv(u.uLuz, luz); gl.uniform1f(u.uAdit, claro ? 1 : 0.42);
  }
  function compila() {
    const sh = (tipo, src) => { const o = gl.createShader(tipo); gl.shaderSource(o, src); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
    const v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, FS); if (!v || !f) return false;
    prog = gl.createProgram(); gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog); u = {}; a = {};
    for (const k of ['uMix', 'uSolid', 'uTam', 'uDist', 'uAsp', 'uF', 'uEsc', 'uDust', 'uApert', 'uRot', 'uPtr', 'uFade', 'uAdit', 'uTinta', 'uAcento', 'uSombra', 'uLuz']) u[k] = gl.getUniformLocation(prog, k);
    for (const k of ['aP0', 'aP1', 'aN0', 'aN1', 'aC0', 'aC1', 'aS']) a[k] = gl.getAttribLocation(prog, k);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0, 0, 0, 0); return true;
  }
  const nPuntos = () => O.puntos || NIVELES[nivel];
  function subeModelo(m) { // construye los buffers de un modelo para el nivel actual
    const r = remuestrear(m.datos, nPuntos()), mk = (data) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b; };
    if (m.gpu) { gl.deleteBuffer(m.gpu.pos); gl.deleteBuffer(m.gpu.att); }
    m.gpu = {m: r.m, pos: mk(r.pos), att: mk(r.att), cpuPos: r.pos, cpuAtt: r.att, nivel};
  }
  function subeSemillas(n) { if (bufSem) gl.deleteBuffer(bufSem); bufSem = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufSem); gl.bufferData(gl.ARRAY_BUFFER, semillas(n), gl.STATIC_DRAW); S.nSem = n; }
  function asegura(m) { if (m && m.datos && (!m.gpu || m.gpu.nivel !== nivel)) subeModelo(m); }

  function medir() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return false;
    const movil = innerWidth < 760; let dpr = Math.min(window.devicePixelRatio || 1, movil ? 1.25 : O.dprMax); if (nivel === 'bajo') dpr = Math.min(dpr, 1);
    const lado = Math.min(1, (movil ? 1.2e6 : 4e6) / (w * h * dpr * dpr)) ** 0.5, cw = Math.max(1, Math.round(w * dpr * lado)), ch = Math.max(1, Math.round(h * dpr * lado));
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    gl.viewport(0, 0, cw, ch);
    const px = cw / w, objPx = Math.min(h, w) * dim.fill; // píxeles CSS que mide el objeto
    dim = {...dim, w, h, dpr: px, asp: w / h, tam: clamp(1.3, 3.4, 2.2 * objPx / 547) * px}; S.sucio = true; return true;
  }
  function enlaza(A, B) {
    const par = (g, p, n, c) => { gl.bindBuffer(gl.ARRAY_BUFFER, g.pos); gl.enableVertexAttribArray(a[p]); gl.vertexAttribPointer(a[p], 3, gl.FLOAT, false, 12, 0); gl.bindBuffer(gl.ARRAY_BUFFER, g.att); gl.enableVertexAttribArray(a[n]); gl.vertexAttribPointer(a[n], 2, gl.UNSIGNED_BYTE, true, 8, 0); gl.enableVertexAttribArray(a[c]); gl.vertexAttribPointer(a[c], 3, gl.UNSIGNED_BYTE, true, 8, 2); };
    par(A, 'aP0', 'aN0', 'aC0'); par(B, 'aP1', 'aN1', 'aC1'); gl.bindBuffer(gl.ARRAY_BUFFER, bufSem); gl.enableVertexAttribArray(a.aS); gl.vertexAttribPointer(a.aS, 4, gl.UNSIGNED_BYTE, true, 4, 0);
  }
  // Congela la posición actual de cada punto en un "origen" nuevo para que una interrupción no dé saltos.
  function congela() {
    const A = S.de >= 0 ? lista[S.de] : null, B = S.a >= 0 ? lista[S.a] : null; if (!A?.gpu || !B?.gpu || S.mix <= 0 || S.mix >= 1) return;
    const n = A.gpu.m, sem = semillas(n), pos = new Float32Array(n * 3), att = new Uint8Array(n * 8), d = [0, 0, 0], p0 = [0, 0, 0], p1 = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 3; k++) { p0[k] = A.gpu.cpuPos[i * 3 + k]; p1[k] = B.gpu.cpuPos[i * 3 + k]; d[k] = sem[i * 4 + k] / 127.5 - 1; }
      const dl = retardoDe(sem[i * 4 + 3] / 255, p0[1]), r = trayectoria(p0, p1, d, dl, S.mix, S.apert ?? 0.07), fuente = tiempoPunto(S.mix, dl) < 0.5 ? A.gpu.cpuAtt : B.gpu.cpuAtt;
      pos.set(r, i * 3); att.set(fuente.subarray(i * 8, i * 8 + 8), i * 8);
    }
    const mk = (data) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b; };
    if (S.tmp) { gl.deleteBuffer(S.tmp.pos); gl.deleteBuffer(S.tmp.att); }
    S.tmp = {m: n, pos: mk(pos), att: mk(att), cpuPos: pos, cpuAtt: att, nivel}; S.deTmp = true;
  }
  function par() { const A = S.deTmp ? S.tmp : (S.de >= 0 ? lista[S.de]?.gpu : null), B = S.a >= 0 ? lista[S.a]?.gpu : null; return [A || B, B || A]; }

  function dibuja() {
    const [A, B] = par(); if (!A || !B) return; const n = Math.min(A.m, B.m);
    if (S.nSem !== A.m) subeSemillas(A.m);
    enlaza(A, B);
    const r = Math.min(1, dim.asp), dist = 6, F = dist * dim.fill * r, tl = S.anim || S.mixModo ? lineaDeTiempo(S.mix) : {solido: 1, fade: 1};
    const solido = S.mix > 0 && S.mix < 1 ? tl.solido : 1, fade = tl.fade;
    gl.useProgram(prog); uniformesTema();
    const t = determinista ? 0 : (performance.now() - t0) / 1000, deriva = Math.sin(t * 0.286) * 0.35, ptr = S.ptr;
    gl.uniform1f(u.uMix, S.mix); gl.uniform1f(u.uSolid, Math.max(0, solido) * (1 - clamp(0, 1, S.dust * 2))); gl.uniform1f(u.uTam, dim.tam); gl.uniform1f(u.uDist, dist); gl.uniform1f(u.uAsp, dim.asp); gl.uniform1f(u.uF, F);
    gl.uniform1f(u.uEsc, S.esc); gl.uniform1f(u.uDust, S.dust); gl.uniform1f(u.uApert, S.apert ?? 0.07); gl.uniform2f(u.uRot, S.rotBase + deriva + ptr.ox.x, ptr.oy.x + S.dust * 0.2);
    gl.uniform3f(u.uPtr, ptr.px || 0, ptr.py || 0, ptr.f); gl.uniform1f(u.uFade, fade);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.drawArrays(gl.POINTS, 0, n);
  }
  function cuadro(ahora) {
    raf = 0; if (destruida) return; if (!visible || oculto || pausadoManual || liberada) { est('pausada'); return; }
    const dtMs = ult ? ahora - ult : 16.7, activo = !!S.anim || S.mixModo || Math.abs(S.dust - (S.dustPrev ?? S.dust)) > 1e-4 || ptrActivo();
    if (activo) reposo = ahora; const lento = !activo && ahora - reposo > 1500;
    if (lento && dtMs < 31) { raf = requestAnimationFrame(cuadro); return; } // reposo: 30 cuadros por segundo
    ult = ahora; const dt = Math.min(0.05, dtMs / 1000); S.dustPrev = S.dust;
    if (S.anim) { S.anim.t += dtMs / 1000 / S.anim.dur; if (S.anim.t >= 1) { S.mix = 1; S.anim = null; S.de = S.a; S.deTmp = false; S.mix = 0; S.mixModo = false; } else S.mix = S.anim.t; }
    const P = S.ptr; if (!determinista && O.puntero) { P.ox = pasoResorte(P.ox, P.tx * 0.052, dt); P.oy = pasoResorte(P.oy, -P.ty * 0.052, dt); P.f += ((P.dentro ? 1 : 0) - P.f) * (P.dentro ? 0.12 : 0.04); }
    dibuja(); cuadros++; canvas.dataset.cuadros = String(cuadros); canvas.dataset.nivel = nivel; est('activa');
    if (!lento && !determinista && reg.muestra(dtMs) && !S.anim) bajaNivel(); // con webdriver no hay regulador: las capturas no deben degradarse
    if (!destruida && est) raf = requestAnimationFrame(cuadro);
  }
  const ptrActivo = () => O.puntero && (Math.abs(S.ptr.ox.v) > 1e-3 || Math.abs(S.ptr.oy.v) > 1e-3 || S.ptr.f > 0.01);
  function arranca() { if (raf || destruida || !visible || oculto || pausadoManual || liberada || !(S.a >= 0 || S.de >= 0)) return; ult = 0; reposo = performance.now(); raf = requestAnimationFrame(cuadro); }
  function bajaNivel() {
    const i = ORDEN.indexOf(nivel); if (i >= ORDEN.length - 1) { respaldaTodo(); return; }
    nivel = ORDEN[i + 1]; congelaSeguro(); for (const m of lista) m.gpu && (m.gpu.nivel = null); lista.forEach(asegura); S.ua = S.ub = null; subeSemillas(nPuntos()); medir(); canvas.dataset.nivel = nivel;
  }
  const congelaSeguro = () => { S.deTmp = false; if (S.tmp) { S.tmp = null; } };
  function respaldaTodo() { destruye(false); est('respaldo'); }
  function destruye(total) {
    destruida = true; if (raf) cancelAnimationFrame(raf); raf = 0; io?.disconnect(); mo?.disconnect(); ro?.disconnect(); clearTimeout(tLibera);
    document.removeEventListener('visibilitychange', onVis); removeEventListener('pointermove', onPtr);
    try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* sin extensión */ }
    if (total) est('respaldo');
  }

  // ---------- carga y API ----------
  async function cargaModelo(m) {
    if (m.datos) return m; if (!m.pend) m.pend = fetch(m.url, {credentials: 'same-origin'}).then((r) => { if (!r.ok) throw new Error('pts ' + r.status); return r.arrayBuffer(); }).then(decodificarPts3).then((d) => { m.datos = d; return m; });
    await m.pend; return m;
  }
  function resuelve(ref) {
    if (typeof ref === 'number') ref = claves[ref] ?? String(ref);
    if (porClave.has(ref)) return porClave.get(ref);
    const m = {clave: ref, url: urlDe(ref), datos: null, gpu: null, idx: lista.length}; lista.push(m); porClave.set(ref, m); return m;
  }
  API.cargar = async (ref) => { const m = resuelve(ref); await cargaModelo(m); if (destruida) return -1; asegura(m); if (!S.primero) { S.primero = true; S.de = m.idx; S.a = m.idx; S.mix = 0; medir(); leeTema(); subeSemillas(m.gpu.m); S.sucio = true; arranca(); } return m.idx; };
  // Muestra el objeto de forma animada (1000 ms) desde el actual; con {inmediato:true} sin morfo.
  API.mostrar = async (ref, op = {}) => {
    const m = resuelve(ref); await cargaModelo(m); if (destruida) return -1; asegura(m);
    if (!S.primero) { await API.cargar(ref); return m.idx; }
    const actual = S.anim ? S.a : S.de; if (m.idx === actual && !S.anim) return m.idx;
    if (op.inmediato || determinista && op.inmediato !== false && false) { S.anim = null; S.de = S.a = m.idx; S.deTmp = false; S.mix = 0; S.mixModo = false; S.sucio = true; arranca(); return m.idx; }
    if (S.anim || (S.mixModo && S.mix > 0)) congela(); else S.deTmp = false;
    if (!S.deTmp) S.de = actual; S.a = m.idx; S.anim = {t: 0, dur: (op.duracion || 1000) / 1000}; S.mix = 0; S.mixModo = true; S.ua = S.ub = null; arranca(); return m.idx;
  };
  // Control directo por scroll: t de 0 a 1 entre los objetos a y b (índices o claves). Si cambia el par con t intermedio, se congela la posición.
  API.mezcla = (ra, rb, t) => {
    const A = resuelve(ra), B = resuelve(rb); if (!A.gpu || !B.gpu) { Promise.all([cargaModelo(A), cargaModelo(B)]).then(() => { asegura(A); asegura(B); if (!S.primero) { S.primero = true; subeSemillas(A.gpu.m); medir(); leeTema(); } API.mezcla(ra, rb, t); }).catch(() => {}); return; }
    if (S.anim) { S.anim = null; }
    const clave = A.idx + '>' + B.idx; if (clave !== ultPar) { if (S.mixModo && S.mix > 0 && S.mix < 1) congela(); else S.deTmp = false; ultPar = clave; S.ua = S.ub = null; }
    if (!S.deTmp) S.de = A.idx; S.a = B.idx; S.mix = clamp(0, 1, t); S.mixModo = S.mix > 0 && S.mix < 1; if (!S.mixModo) { S.de = S.mix >= 1 ? B.idx : A.idx; S.a = S.de; S.mix = 0; S.deTmp = false; ultPar = ''; S.ua = S.ub = null; }
    S.sucio = true; arranca();
  };
  // Progreso 0 a 1 del héroe en su pista: el sólido se vuelve polvo y el objeto crece (el remapeo detiene la cámara donde está el texto).
  API.progreso = (p) => { const f = remapeo(p); S.dust = Math.max(0, f - 0.04) / 0.96 * 0.9; S.esc = 1 + 0.9 * f; S.rotBase = f * 0.9; S.sucio = true; arranca(); };
  API.tema = (c) => { if (c) { const col = (x) => (typeof x === 'string' ? leeColor(ctx2d(), x, '#888') : x); tema = {tinta: col(c.tinta) || tema.tinta, acento: col(c.acento) || tema.acento, fondo: col(c.fondo) || tema.fondo}; temaFijo = true; } else { temaFijo = false; leeTema(); } S.sucio = true; };
  API.pausar = () => { pausadoManual = true; };
  API.reanudar = () => { pausadoManual = false; arranca(); };
  API.destruir = () => destruye(true);
  Object.defineProperties(API, {estado: {get: () => canvas.dataset.estado}, nivel: {get: () => nivel}});

  // ---------- observadores ----------
  const onVis = () => { oculto = document.hidden; if (oculto) { if (raf) cancelAnimationFrame(raf); raf = 0; est('pausada'); } else arranca(); };
  const onPtr = (e) => {
    if (!O.puntero || !visible) return; const b = canvas.getBoundingClientRect(), nx = ((e.clientX - b.left) / b.width) * 2 - 1, ny = ((e.clientY - b.top) / b.height) * 2 - 1, P = S.ptr;
    P.dentro = nx > -1.1 && nx < 1.1 && ny > -1.1 && ny < 1.1; P.tx = P.dentro ? clamp(-1, 1, nx) : 0; P.ty = P.dentro ? clamp(-1, 1, ny) : 0;
    const dist = 6, F = dist * dim.fill * Math.min(1, dim.asp); P.px = nx * dim.asp * dist / F; P.py = -ny * dist / F; arranca();
  };
  const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver((es) => {
    visible = es[es.length - 1].isIntersecting; clearTimeout(tLibera);
    if (visible) { if (liberada) { liberada = false; gl.getExtension('WEBGL_lose_context')?.restoreContext(); } arranca(); } else { if (raf) cancelAnimationFrame(raf); raf = 0; est('pausada'); tLibera = setTimeout(() => { if (!visible && !destruida) { liberada = true; gl.getExtension('WEBGL_lose_context')?.loseContext(); } }, 60000); }
  }, {rootMargin: '200px'}) : null;
  io?.observe(canvas); if (!io) visible = true;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (medir()) arranca(); }) : null; ro?.observe(canvas);
  const mo = typeof MutationObserver === 'function' ? new MutationObserver(leeTema) : null;
  mo?.observe(document.documentElement, {attributes: true, attributeFilter: ['data-tema', 'data-theme', 'class'], subtree: true});
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', leeTema);
  document.addEventListener('visibilitychange', onVis);
  if (O.puntero && matchMedia('(hover: hover) and (pointer: fine)').matches && !determinista) addEventListener('pointermove', onPtr, {passive: true}); else O.puntero = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (liberada) { est('pausada'); return; } perdidas++; est('respaldo'); if (raf) cancelAnimationFrame(raf); raf = 0; });
  canvas.addEventListener('webglcontextrestored', () => {
    if (destruida || (perdidas > 1 && !liberada)) return; if (!compila()) { respaldaTodo(); return; }
    for (const m of lista) m.gpu = null; bufSem = null; S.ua = S.ub = null; S.deTmp = false; lista.forEach(asegura); const k = lista.find((m) => m.gpu); if (k) subeSemillas(k.gpu.m); medir(); S.sucio = true; est('activa'); arranca();
  });
  if (!compila()) return respaldo();
  t0 = performance.now(); leeTema(); medir();
  if (O.cargar) API.cargar(O.cargar).catch(() => respaldaTodo());
  return API;
}
