// Nube de puntos de la portada de Rovaq AI: WebGL propio, sin dependencias, módulo del mismo origen (sin scripts en línea ni decodificadores externos).
// Dibuja solo POINTS desde archivos .pts muestreados en build (tools/puntos/muestrear.mjs): morfo entre modelos con retraso por punto, condensación en sólido
// iluminado por normal con disolución grano a grano y un borde de luz fino. Colores desde variables CSS. Pausa fuera de vista, regulador de rendimiento y respaldo estático.
const PI = Math.PI, REDUCIDO = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (a, b, v) => Math.min(b, Math.max(a, v)), suave = (a, b, v) => { const t = clamp(0, 1, (v - a) / (b - a)); return t * t * (3 - 2 * t); };
const VS = `attribute vec3 aP0; attribute vec2 aN0; attribute vec2 aC0; attribute vec3 aP1; attribute vec2 aN1; attribute vec2 aC1; attribute vec4 aS;
uniform float uMix, uSolid, uPx, uTam, uDist, uAsp, uF, uOffY, uTime, uHalo; uniform vec2 uRot;
varying vec4 vC; varying vec3 vN; varying float vG, vA;
vec3 octa(vec2 e){ vec3 v = vec3(e, 1.0 - abs(e.x) - abs(e.y)); if (v.z < 0.0) v.xy = (1.0 - abs(v.yx)) * vec2(v.x >= 0.0 ? 1.0 : -1.0, v.y >= 0.0 ? 1.0 : -1.0); return normalize(v); }
vec2 flags(float f){ float b = f * 255.0, e = step(128.0, b); return vec2((b - e * 128.0) / 127.0, e); }
void main(){
  float m = clamp(uMix / 0.82, 0.0, 1.0), d = aS.w * 0.30, t = clamp((m - d) / 0.70, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t); float te = 1.0 - pow(1.0 - t, 1.7), sw = sin(3.14159265 * t);
  vec3 p = mix(aP0, aP1, te);
  p += 0.11 * sw * vec3(sin(p.y * 4.0 + te * 5.0), sin(p.z * 4.0 + te * 5.0 + 1.7), sin(p.x * 4.0 + te * 5.0 + 3.1)) + aS.xyz * 0.07 * sw;
  vec3 n = normalize(mix(octa(aN0), octa(aN1), te) + vec3(0.0001));
  vec2 f0 = flags(aC0.y), f1 = flags(aC1.y); float red = mix(f0.x, f1.x, te), edge = mix(f0.y, f1.y, te), lum = mix(aC0.x, aC1.x, te);
  float h = fract(aS.x * 7.31 + aS.y * 3.17), halo = step(h, 0.1);
  if (uHalo > 0.5) {
    if (halo < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vC = vec4(0.0); vN = n; vG = 0.0; vA = 0.0; return; }
    float a = uTime * (0.12 + 0.42 * h * 10.0) + aS.z * 6.2831; float r = 1.18 + 0.28 * fract(aS.z * 5.0 + aS.x);
    p = vec3(sin(a) * r * (0.55 + 0.45 * aS.y), p.y * (1.1 + 0.15 * sin(uTime * 0.5 + aS.z * 9.0)) + sin(a * 1.7 + aS.y * 5.0) * 0.12, cos(a) * r * 0.55);
  }
  float cy = cos(uRot.x), sy = sin(uRot.x), cx = cos(uRot.y), sx = sin(uRot.y);
  p = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z); p = vec3(p.x, cx * p.y - sx * p.z, sx * p.y + cx * p.z);
  n = vec3(cy * n.x + sy * n.z, n.y, -sy * n.x + cy * n.z); n = vec3(n.x, cx * n.y - sx * n.z, sx * n.y + cx * n.z);
  p.y += uOffY; float z = p.z + uDist;
  gl_Position = vec4(p.x * uF / uAsp, p.y * uF, (z - 1.0) * 0.12, z);
  float hh = fract(sin(dot(aS.xy, vec2(12.9898, 78.233)) + aS.z * 37.7) * 43758.5453);
  vG = step(hh, uSolid);
  vC = vec4(lum, red, edge, 1.0); vN = n;
  vA = mix(0.5, 1.0, clamp((uDist + 1.1 - z) / 2.2, 0.0, 1.0)) * (1.0 - 0.35 * sw);
  float base = mix(1.0, 1.7, vG) * (1.0 + 0.5 * edge);
  gl_PointSize = base * uTam * clamp(uDist / z, 0.75, 1.35);
}`;
const FS = `precision mediump float; uniform vec3 uTinta, uRojo, uSombra, uLuz; uniform float uFade, uHaloF;
varying vec4 vC; varying vec3 vN; varying float vG, vA;
void main(){
  vec2 c = gl_PointCoord - 0.5; float r = dot(c, c); if (r > 0.25) discard;
  float borde = smoothstep(0.25, 0.1, r);
  vec3 L = normalize(vec3(-0.5, 0.75, 0.55)); vec3 nn = normalize(vN);
  float ndl = clamp(dot(nn, L) * 0.5 + 0.5, 0.0, 1.0), rim = pow(1.0 - clamp(abs(nn.z), 0.0, 1.0), 2.4);
  float luz = smoothstep(0.18, 0.92, ndl) * (0.45 + 0.55 * clamp(vC.x * 1.5, 0.0, 1.0)) + rim * 0.5;
  vec3 solido = mix(uSombra, uLuz, clamp(luz, 0.0, 1.0));
  solido = mix(solido, uRojo, vC.y);
  vec3 linea = mix(uTinta, uRojo, vC.y);
  vec3 nube = mix(uTinta * (0.55 + 0.45 * ndl), uRojo, vC.y);
  vec3 col = mix(nube, mix(solido, linea, vC.z), vG);
  col = mix(col, uTinta, uHaloF);
  float alfa = mix(uFade, 1.0, vG) * vA * borde; if (uHaloF > 0.5) alfa = 0.75 * borde;
  gl_FragColor = vec4(col * alfa, alfa);
}`;

function css(el, nombre, defecto) { return getComputedStyle(el).getPropertyValue(nombre).trim() || defecto; }
function color(txt) { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = '#000'; c.fillStyle = txt; const h = c.fillStyle; const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }

async function cargaPts(url, paso) {
  const ab = await (await fetch(url)).arrayBuffer(), dv = new DataView(ab);
  if (new TextDecoder().decode(new Uint8Array(ab, 0, 4)) !== 'PTS2') throw new Error('pts');
  const n = dv.getUint32(8, true), salida = Math.floor(n / paso), buf = new Uint8Array(salida * 10), src = new Uint8Array(ab, 16);
  for (let i = 0; i < salida; i++) buf.set(src.subarray(i * paso * 10, i * paso * 10 + 10), i * 10);
  return {n: salida, buf};
}

class Nube {
  constructor(canvas) {
    this.c = canvas; this.tipo = canvas.dataset.nube; this.urls = (canvas.dataset.pts || '').split(',').filter(Boolean);
    this.movil = innerWidth < 760 || (navigator.deviceMemory && navigator.deviceMemory <= 4) || navigator.connection?.saveData;
    this.paso = this.movil ? 4 : 1; this.dpr = Math.min(devicePixelRatio || 1, this.movil ? 1.5 : 2); this.cuadros = 0; this.tiempos = []; this.vis = false; this.listo = false;
    this.cp = 0; this.mix = 0; this.ptr = {x: 0, y: 0, sx: 0, sy: 0}; this.t0 = performance.now(); this.ult = this.t0; this.solid = 0; this.solidDest = 1; this.seg = -1;
    this.estado('cargando');
    const gl = this.gl = canvas.getContext('webgl', {alpha: true, antialias: false, powerPreference: this.movil ? 'low-power' : 'high-performance', failIfMajorPerformanceCaveat: true});
    if (!gl) { this.estado('respaldo'); return; }
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.listo = false; this.estado('respaldo'); });
    this.prog = this.programa(); if (!this.prog) { this.estado('respaldo'); return; }
    gl.useProgram(this.prog); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0, 0, 0, 0);
    this.u = {}; for (const k of ['uMix', 'uSolid', 'uPx', 'uTam', 'uDist', 'uAsp', 'uF', 'uOffY', 'uTime', 'uHalo', 'uHaloF', 'uRot', 'uTinta', 'uRojo', 'uSombra', 'uLuz', 'uFade']) this.u[k] = gl.getUniformLocation(this.prog, k);
    this.a = {}; for (const k of ['aP0', 'aN0', 'aC0', 'aP1', 'aN1', 'aC1', 'aS']) this.a[k] = gl.getAttribLocation(this.prog, k);
    this.colores(); this.medir();
    new ResizeObserver(() => this.medir()).observe(canvas);
    new MutationObserver(() => this.colores()).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.colores());
    new IntersectionObserver((es) => { this.vis = es[0].isIntersecting; this.arranca(); }, {rootMargin: '60px'}).observe(canvas);
    document.addEventListener('visibilitychange', () => this.arranca());
    const host = canvas.closest('.visor') || canvas;
    if (!this.movil) { host.addEventListener('pointermove', (e) => { const b = host.getBoundingClientRect(); this.ptr.x = ((e.clientX - b.left) / b.width - 0.5) * 2; this.ptr.y = ((e.clientY - b.top) / b.height - 0.5) * 2; }); host.addEventListener('pointerleave', () => { this.ptr.x = this.ptr.y = 0; }); }
  }
  estado(e) { this.c.dataset.estado = e; }
  programa() {
    const gl = this.gl, sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
    const v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, FS); if (!v || !f) return null;
    const p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p); return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
  }
  colores() {
    if (!this.gl) return; const gl = this.gl, c = this.c; gl.useProgram(this.prog);
    gl.uniform3fv(this.u.uTinta, color(css(c, '--l-ink', '#0e0e10'))); gl.uniform3fv(this.u.uRojo, color(css(c, '--l-red', '#e8241c')));
    gl.uniform3fv(this.u.uSombra, color(css(c, '--n-sombra', '#0e0e10'))); gl.uniform3fv(this.u.uLuz, color(css(c, '--n-luz', '#8c8c93'))); this.sucio = true;
  }
  medir() {
    const w = this.c.clientWidth, h = this.c.clientHeight; if (!w || !h) return;
    const lado = Math.min(1, 1.2e6 / (w * h * this.dpr * this.dpr)) ** 0.5; this.c.width = Math.round(w * this.dpr * lado); this.c.height = Math.round(h * this.dpr * lado);
    this.gl.viewport(0, 0, this.c.width, this.c.height); this.asp = w / h; this.sucio = true;
  }
  async carga() {
    const gl = this.gl; this.bufs = []; let rnd = 12345; const r = () => { rnd = (rnd * 1664525 + 1013904223) >>> 0; return rnd / 4294967296; };
    for (const u of this.urls) {
      const {n, buf} = await cargaPts(u, this.paso); this.n = n; const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW); this.bufs.push(b);
      if (!this.sem) { const s = new Uint8Array(n * 4); for (let i = 0; i < n; i++) { let x, y, z; do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; } while (x * x + y * y + z * z > 1); s.set([Math.round((x + 1) * 127.5), Math.round((y + 1) * 127.5), Math.round((z + 1) * 127.5), Math.floor(i / n * 255)], i * 4); } this.sem = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.sem); gl.bufferData(gl.ARRAY_BUFFER, s, gl.STATIC_DRAW); }
      if (this.bufs.length === 1) { this.listo = true; this.estado('activa'); this.arranca(); }
    }
  }
  enlaza(i, j) {
    const gl = this.gl, a = this.a;
    const par = (b, p, nn, cc) => { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(a[p]); gl.vertexAttribPointer(a[p], 3, gl.SHORT, true, 10, 0); gl.enableVertexAttribArray(a[nn]); gl.vertexAttribPointer(a[nn], 2, gl.BYTE, true, 10, 6); gl.enableVertexAttribArray(a[cc]); gl.vertexAttribPointer(a[cc], 2, gl.UNSIGNED_BYTE, true, 10, 8); };
    par(this.bufs[i], 'aP0', 'aN0', 'aC0'); par(this.bufs[j], 'aP1', 'aN1', 'aC1');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sem); gl.enableVertexAttribArray(this.a.aS); gl.vertexAttribPointer(this.a.aS, 4, gl.UNSIGNED_BYTE, true, 4, 0);
  }
  arranca() { if (this.raf || !this.listo || !this.vis || document.hidden) return; this.ult = performance.now(); this.estado('activa'); this.raf = requestAnimationFrame((t) => this.cuadro(t)); }
  cuadro(ahora) {
    this.raf = 0; if (!this.vis || document.hidden) { this.estado('pausada'); return; }
    const dt = clamp(0, 0.05, (ahora - this.ult) / 1000), k = (v) => 1 - Math.exp(-dt * v), t = (ahora - this.t0) / 1000;
    const minimo = this.movil || this.reg ? 33 : 0; // móvil y nivel bajo: 30 cuadros por segundo
    if (minimo && ahora - this.ult < minimo - 2) { this.raf = requestAnimationFrame((x) => this.cuadro(x)); return; }
    this.ult = ahora; const P = this.ptr; P.sx += (P.x - P.sx) * k(4); P.sy += (P.y - P.sy) * k(4);
    let rotY, rotX, a = 0, b = 0, solido, mezcla = 0;
    if (this.tipo === 'nucleo') {
      const p = clamp(0, 1, Number(this.c.dataset.p || 0)); this.solid += (this.solidDest - this.solid) * k(1.6); solido = this.solid;
      rotY = t * 0.12 + P.sx * 0.3; rotX = P.sy * 0.1; const host = this.c.closest('.visor'); if (host) { host.style.setProperty('--ry', (Math.sin(t * 0.4) * 7 + P.sx * 10 + p * 26).toFixed(2) + 'deg'); host.style.setProperty('--rx', (P.sy * -6 - p * 4).toFixed(2) + 'deg'); }
    } else {
      this.cp += (clamp(0, 1, Number(this.c.dataset.c || 0)) * 3 - this.cp) * k(5); const c = this.cp, sg = Math.min(this.bufs.length - 2, Math.floor(c)), u = c - sg, dist = Math.min(u, 1 - u);
      if (this.bufs.length < 2) { solido = 1; a = b = 0; } else { a = sg; b = sg + 1; solido = 1 - suave(0.04, 0.3, dist); mezcla = clamp(0, 1, (u - 0.2) / 0.6); }
      rotY = c * 0.9 + t * 0.14 + P.sx * 0.35; rotX = Math.sin(c * PI) * 0.12 + P.sy * 0.1;
    }
    const gl = this.gl; gl.useProgram(this.prog); if (this.seg !== a * 10 + b) { this.enlaza(a, b); this.seg = a * 10 + b; }
    const asp = this.asp, dist = (this.tipo === 'pasos' ? 5.7 : 7.2) / Math.min(1, asp * 1.15); this.u && null;
    gl.uniform1f(this.u.uMix, mezcla); gl.uniform1f(this.u.uSolid, solido); gl.uniform1f(this.u.uTam, 1.15 * (this.c.width / (this.c.clientWidth || 1)) * (this.movil ? 1.5 : 1));
    gl.uniform1f(this.u.uDist, dist); gl.uniform1f(this.u.uAsp, asp); gl.uniform1f(this.u.uF, 4.0); gl.uniform1f(this.u.uTime, t); gl.uniform1f(this.u.uHalo, this.tipo === 'nucleo' ? 1 : 0); gl.uniform1f(this.u.uHaloF, this.tipo === 'nucleo' ? 1 : 0); gl.uniform1f(this.u.uOffY, this.movil && this.tipo === 'pasos' ? -0.28 : 0); gl.uniform2f(this.u.uRot, rotY, rotX);
    gl.uniform1f(this.u.uFade, 0.95 * suave(0.0, 0.2, 1 - solido) + 0.0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.drawArrays(gl.POINTS, 0, this.n);
    this.cuadros++; this.c.dataset.cuadros = String(this.cuadros); this.c.dataset.nivel = this.reg ? 'bajo' : this.movil ? 'movil' : 'alto';
    this.tiempos.push(dt * 1000); if (this.tiempos.length === 30) { const m = [...this.tiempos].sort((x, y) => x - y)[15]; this.tiempos = []; if (m > 20 && !this.reg) { this.reg = true; this.dpr = 1; this.medir(); } else if (m > 40 && this.reg) { this.estado('respaldo'); return; } }
    this.raf = requestAnimationFrame((x) => this.cuadro(x));
  }
}

function webgl() { try { const c = document.createElement('canvas'); return !!c.getContext('webgl'); } catch { return false; } }
const sinDatos = navigator.connection?.saveData || ['slow-2g', '2g'].includes(navigator.connection?.effectiveType);
if (!REDUCIDO && !sinDatos && webgl()) {
  window.__nube = [];
  document.querySelectorAll('canvas[data-nube]').forEach((c) => {
    const crear = () => { const n = new Nube(c); window.__nube.push(n); if (n.gl) n.carga().catch(() => n.estado('respaldo')); };
    if (c.dataset.nube === 'nucleo') crear(); else new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { io.disconnect(); crear(); } }, {rootMargin: '900px 0px'}).observe(c);
  });
} else document.querySelectorAll('canvas[data-nube]').forEach((c) => { c.dataset.estado = 'respaldo'; });
