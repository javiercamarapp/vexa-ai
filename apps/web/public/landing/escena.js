// Escena 3D de la portada de Rovaq AI. Módulo del mismo origen (sin scripts en línea, sin decodificadores wasm).
// Dos escenas sobre canvas con data-escena3d: «nucleo» (objeto héroe que gira lento y reacciona al puntero) y «pasos» (cuatro objetos que cambian al hacer scroll).
// Se renderiza solo mientras el canvas está a la vista, con un máximo de pixel ratio 2, y el HTML conserva una imagen estática de respaldo.
import * as THREE from '/vendor/three/three.module.min.js';
import {GLTFLoader} from '/vendor/three/GLTFLoader.js';
import {RoomEnvironment} from '/vendor/three/RoomEnvironment.js';

const REDUCIDO = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (a, b, v) => Math.min(b, Math.max(a, v));
const suave = (x) => x * x * (3 - 2 * x);
const oscuro = () => document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);

function sombraTextura() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(0,0,0,0.55)'); r.addColorStop(0.5, 'rgba(0,0,0,0.2)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const VS = `
attribute vec3 aDesde; attribute vec3 aHasta; attribute vec2 aDeC; attribute vec2 aHaC; attribute vec4 aDir;
uniform float uMix; uniform float uPx; uniform float uTam;
varying vec2 vC; varying float vA;
void main(){
  float m = clamp(uMix / 0.82, 0.0, 1.0);
  float d = aDir.w * 0.30;
  float t = clamp((m - d) / 0.70, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  float te = 1.0 - pow(1.0 - t, 1.7);
  vec3 p = mix(aDesde, aHasta, te) + aDir.xyz * sin(3.14159265 * t) * 0.55;
  vC = mix(aDeC, aHaC, te);
  vA = 1.0 - 0.4 * sin(3.14159265 * t);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uTam * uPx * (9.0 / -mv.z);
}`;
const FS = `
precision mediump float;
uniform vec3 uTinta; uniform vec3 uRojo; uniform float uFade;
varying vec2 vC; varying float vA;
void main(){
  vec2 c = gl_PointCoord - 0.5; float r = dot(c, c); if (r > 0.25) discard;
  vec3 col = mix(uTinta * (0.62 + 0.38 * vC.x), uRojo, vC.y);
  gl_FragColor = vec4(col, uFade * vA * smoothstep(0.25, 0.12, r));
}`;

/** Muestrea n puntos sobre la superficie de un grupo ya normalizado, ponderando por área de triángulo; devuelve posiciones y un par luminancia/rojez sacado de la textura. */
function muestrea(raiz, n) {
  raiz.updateMatrixWorld(true);
  const tris = [], v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  raiz.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry, pos = g.attributes.position, uv = g.attributes.uv, idx = g.index, img = o.material.map && o.material.map.image;
    let datos = null, W = 0, H = 0;
    if (img) { const cv = document.createElement('canvas'); W = cv.width = 256; H = cv.height = 256; const cx = cv.getContext('2d', {willReadFrequently: true}); cx.drawImage(img, 0, 0, 256, 256); datos = cx.getImageData(0, 0, 256, 256).data; }
    const num = idx ? idx.count / 3 : pos.count / 3;
    for (let f = 0; f < num; f++) {
      const ia = idx ? idx.getX(f * 3) : f * 3, ib = idx ? idx.getX(f * 3 + 1) : f * 3 + 1, ic = idx ? idx.getX(f * 3 + 2) : f * 3 + 2, ids = [ia, ib, ic];
      ids.forEach((k, j) => v[j].set(pos.getX(k), pos.getY(k), pos.getZ(k)).applyMatrix4(o.matrixWorld));
      const area = new THREE.Vector3().subVectors(v[1], v[0]).cross(new THREE.Vector3().subVectors(v[2], v[0])).length() * 0.5;
      tris.push({a: v[0].clone(), b: v[1].clone(), c: v[2].clone(), area, uv: uv ? ids.map((k) => [uv.getX(k), uv.getY(k)]) : null, datos, W, H});
    }
  });
  const acum = new Float32Array(tris.length); let total = 0; tris.forEach((t, i) => { total += t.area; acum[i] = total; });
  const P = new Float32Array(n * 3), C = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const x = Math.random() * total; let lo = 0, hi = acum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (acum[m] < x) lo = m + 1; else hi = m; }
    const t = tris[lo]; let r1 = Math.random(), r2 = Math.random(); if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
    const w0 = 1 - r1 - r2;
    P[i * 3] = t.a.x * w0 + t.b.x * r1 + t.c.x * r2; P[i * 3 + 1] = t.a.y * w0 + t.b.y * r1 + t.c.y * r2; P[i * 3 + 2] = t.a.z * w0 + t.b.z * r1 + t.c.z * r2;
    let lum = 0.5, roj = 0;
    if (t.uv && t.datos) {
      const u = t.uv[0][0] * w0 + t.uv[1][0] * r1 + t.uv[2][0] * r2, vv = t.uv[0][1] * w0 + t.uv[1][1] * r1 + t.uv[2][1] * r2;
      const px = Math.min(t.W - 1, Math.max(0, Math.floor((u - Math.floor(u)) * t.W))), py = Math.min(t.H - 1, Math.max(0, Math.floor((vv - Math.floor(vv)) * t.H))), k = (py * t.W + px) * 4;
      const R = t.datos[k] / 255, G = t.datos[k + 1] / 255, B = t.datos[k + 2] / 255;
      lum = 0.3 * R + 0.59 * G + 0.11 * B; roj = Math.min(1, Math.max(0, (R - Math.max(G, B) - 0.18) * 3));
    }
    C[i * 2] = Math.min(1, lum * 1.4); C[i * 2 + 1] = roj;
  }
  return {P, C};
}

class Escena {
  constructor(canvas, urls, tipo) {
    this.canvas = canvas; this.tipo = tipo; this.urls = urls; this.grupos = []; this.visible = false; this.listo = false;
    this.cur = 0; this.dest = 0; this.ptr = {x: 0, y: 0, sx: 0, sy: 0}; this.t0 = performance.now(); this.ultimo = this.t0; this.sig = '';
    const r = this.r = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true, powerPreference: 'high-performance'});
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0; r.outputColorSpace = THREE.SRGBColorSpace;
    r.setClearColor(0x000000, 0);
    this.escena = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r);
    this.entorno = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
    this.escena.environment = this.entorno;
    this.cam = new THREE.PerspectiveCamera(26, 1, 0.1, 60);
    this.clave = new THREE.DirectionalLight(0xffffff, 3); this.clave.position.set(3, 5, 4);
    this.lateral = new THREE.DirectionalLight(0xffffff, 1.5); this.lateral.position.set(5, 0.5, 2);
    this.borde = new THREE.DirectionalLight(0xffffff, 1.6); this.borde.position.set(-4, 2.5, -3);
    this.relleno = new THREE.HemisphereLight(0xffffff, 0x888890, 0.5);
    this.escena.add(this.clave, this.borde, this.lateral, this.relleno);
    this.texSombra = sombraTextura();
    this.tema();
    new MutationObserver(() => { this.tema(); this.sig = ''; }).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
    new ResizeObserver(() => this.medir()).observe(canvas);
    new IntersectionObserver((es) => { this.visible = es[0].isIntersecting; this.arranca(); }, {rootMargin: '80px'}).observe(canvas);
    document.addEventListener('visibilitychange', () => this.arranca());
    {
      const host = canvas.closest('.visor') || canvas;
      host.addEventListener('pointermove', (e) => { const b = host.getBoundingClientRect(); this.ptr.x = ((e.clientX - b.left) / b.width - 0.5) * 2; this.ptr.y = ((e.clientY - b.top) / b.height - 0.5) * 2; });
      host.addEventListener('pointerleave', () => { this.ptr.x = 0; this.ptr.y = 0; });
    }
    this.medir();
  }
  tema() {
    const o = oscuro();
    this.escena.environmentIntensity = o ? 1.0 : 1.0;
    this.clave.intensity = o ? 3.6 : 2.6; this.borde.intensity = o ? 5.5 : 2.2; this.lateral.intensity = o ? 3 : 1.2;
    this.r.toneMappingExposure = o ? 1.4 : 1.05; this.relleno.intensity = o ? 1.3 : 0.6;
    this.grupos.forEach((g) => { if (g.userData.sombra) g.userData.sombra.material.opacity = o ? 0.5 : 0.75; });
  }
  medir() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight; if (!w || !h) return;
    this.r.setSize(w, h, false); this.cam.aspect = w / h;
    this.cam.position.set(0, 0.25, 10.5 * Math.max(1, 1 / this.cam.aspect * 0.95)); this.cam.lookAt(0, 0, 0);
    this.cam.updateProjectionMatrix(); this.sig = '';
  }
  async carga() {
    const gl = new GLTFLoader();
    const gltfs = await Promise.all(this.urls.map((u) => gl.loadAsync(u)));
    gltfs.forEach((g, i) => {
      const modelo = g.scene, caja = new THREE.Box3().setFromObject(modelo), tam = caja.getSize(new THREE.Vector3()), c = caja.getCenter(new THREE.Vector3());
      const e = (this.tipo === 'nucleo' ? 4.3 : 3.5) / Math.max(tam.x, tam.y, tam.z);
      modelo.position.sub(c); const grupo = new THREE.Group(); const interior = new THREE.Group(); interior.add(modelo); interior.scale.setScalar(e); grupo.add(interior);
      const sombra = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({map: this.texSombra, transparent: true, depthWrite: false, opacity: 0.75}));
      sombra.rotation.x = -Math.PI / 2; sombra.position.y = -2.15; grupo.userData.sombra = sombra; grupo.userData.interior = interior; grupo.userData.base = (i * 0.9) % 6.28;
      this.escena.add(grupo); grupo.userData.sombra = sombra; this.grupos.push(grupo);
      if (this.tipo === 'nucleo') this.escena.add(sombra); else if (i === 0) { this.escena.add(sombra); this.sombraPasos = sombra; }
      modelo.traverse((o) => { if (o.isMesh) { const m = o.material; m.envMapIntensity = 1.5; if ('roughness' in m) m.roughness = clamp(0.28, 0.6, m.roughness); if ('metalness' in m) m.metalness = Math.min(m.metalness, 0.55); if (o.material.map) o.material.map.anisotropy = 4; } });
    });
    if (this.tipo === 'pasos') this.construyeNube();
    this.tema(); this.listo = true; this.canvas.setAttribute('data-listo', ''); this.arranca();
  }
  construyeNube() {
    const n = window.innerWidth < 760 ? 4500 : 11000;
    this.muestras = this.grupos.map((g) => muestrea(g, n));
    this.rig = new THREE.Group(); this.escena.add(this.rig);
    this.grupos.forEach((g) => { this.escena.remove(g); this.rig.add(g); g.position.set(0, 0, 0); g.scale.setScalar(1); g.rotation.set(0, 0, 0); });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.atr = {desde: new THREE.BufferAttribute(new Float32Array(n * 3), 3), hasta: new THREE.BufferAttribute(new Float32Array(n * 3), 3), deC: new THREE.BufferAttribute(new Float32Array(n * 2), 2), haC: new THREE.BufferAttribute(new Float32Array(n * 2), 2)};
    const dir = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { let x, y, z; do { x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1; } while (x * x + y * y + z * z > 1); dir.set([x, y, z, Math.random()], i * 4); }
    geo.setAttribute('aDesde', this.atr.desde); geo.setAttribute('aHasta', this.atr.hasta); geo.setAttribute('aDeC', this.atr.deC); geo.setAttribute('aHaC', this.atr.haC); geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 4));
    this.mat = new THREE.ShaderMaterial({vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, uniforms: {uMix: {value: 0}, uPx: {value: this.r.getPixelRatio()}, uTam: {value: 2.7}, uTinta: {value: new THREE.Color(0x0e0e10)}, uRojo: {value: new THREE.Color(0xe8241c)}, uFade: {value: 0}}});
    this.puntos = new THREE.Points(geo, this.mat); this.puntos.frustumCulled = false; this.rig.add(this.puntos);
    this.seg = -1; this.cp = 0; this.colores();
    new MutationObserver(() => this.colores()).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  }
  colores() {
    if (!this.mat) return;
    const c = getComputedStyle(this.canvas).getPropertyValue('--l-ink').trim() || (oscuro() ? '#f4f4f5' : '#0e0e10');
    this.mat.uniforms.uTinta.value.set(c); this.mat.uniforms.uRojo.value.set(getComputedStyle(this.canvas).getPropertyValue('--l-red').trim() || '#e8241c');
  }
  asignaSegmento(s) {
    this.seg = s; const a = this.muestras[s], b = this.muestras[s + 1];
    this.atr.desde.array.set(a.P); this.atr.hasta.array.set(b.P); this.atr.deC.array.set(a.C); this.atr.haC.array.set(b.C);
    Object.values(this.atr).forEach((x) => { x.needsUpdate = true; });
  }
  arranca() {
    if (this.raf || !this.listo || !this.visible || document.hidden) return;
    this.ultimo = performance.now(); this.raf = requestAnimationFrame((t) => this.cuadro(t));
  }
  cuadro(ahora) {
    this.raf = 0;
    if (!this.visible || document.hidden) return;
    const dt = clamp(0, 0.05, (ahora - this.ultimo) / 1000); this.ultimo = ahora; const t = (ahora - this.t0) / 1000;
    const k = (v) => 1 - Math.exp(-dt * v);
    let dibujar = true;
    if (this.tipo === 'nucleo') {
      const p = clamp(0, 1, Number(this.canvas.dataset.p || 0)), P = this.ptr;
      P.sx += (P.x - P.sx) * k(4); P.sy += (P.y - P.sy) * k(4);
      const g = this.grupos[0], i = g.userData.interior;
      g.rotation.y = t * 0.28 + P.sx * 0.6 + p * Math.PI * 0.8; g.rotation.x = P.sy * 0.18 + p * 0.12;
      g.position.y = Math.sin(t * 0.9) * 0.07 - p * 0.5; i.scale.setScalar(i.scale.x); g.scale.setScalar(1 - p * 0.18);
      g.userData.sombra.scale.setScalar(1 - p * 0.2 + Math.sin(t * 0.9) * 0.02);
    } else {
      const objetivo = clamp(0, 1, Number(this.canvas.dataset.c || 0)) * 3;
      this.cp += (objetivo - this.cp) * k(5);
      const c = this.cp, sg = Math.min(2, Math.floor(c)), u = c - sg, dist = Math.min(u, 1 - u), P = this.ptr;
      if (sg !== this.seg) this.asignaSegmento(sg);
      const cerca = Math.round(c);
      this.grupos.forEach((g, n) => { const w = n === cerca ? 1 - suave(clamp(0, 1, (Math.abs(c - n) - 0.04) / 0.24)) : 0; g.visible = w > 0.01; g.traverse((o) => { if (o.isMesh) { o.material.transparent = w < 0.999; o.material.opacity = w; o.material.depthWrite = w > 0.6; } }); });
      this.mat.uniforms.uFade.value = suave(clamp(0, 1, (dist - 0.03) / 0.2)) * 0.95;
      this.mat.uniforms.uMix.value = clamp(0, 1, (u - 0.2) / 0.6);
      this.rig.rotation.y = c * 0.9 + t * 0.14 + P.sx * 0.35; this.rig.rotation.x = Math.sin(c * Math.PI) * 0.12 + P.sy * 0.1;
      this.rig.position.y = Math.sin(t * 0.8) * 0.05;
      this.sombraPasos.scale.setScalar(0.9 + 0.1 * Math.sin(c * Math.PI * 2));
    }
    if (dibujar) this.r.render(this.escena, this.cam);
    this.raf = requestAnimationFrame((x) => this.cuadro(x));
  }
}

function webglDisponible() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }

if (!REDUCIDO && webglDisponible()) {
  const cargas = [];
  document.querySelectorAll('canvas[data-escena3d]').forEach((c) => {
    const tipo = c.dataset.escena3d, urls = (c.dataset.modelos || '').split(',').filter(Boolean);
    if (!urls.length) return;
    const crear = () => { const e = new Escena(c, urls, tipo); cargas.push(e); e.carga().catch(() => { c.removeAttribute('data-listo'); }); };
    if (tipo === 'nucleo') crear();
    else new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { io.disconnect(); crear(); } }, {rootMargin: '900px 0px'}).observe(c);
  });
  window.__rovaq3d = {escenas: cargas};
}
