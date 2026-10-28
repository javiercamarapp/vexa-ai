'use client';
import {useEffect, useRef, useState} from 'react';
// Islas de cliente de la landing. Reglas de la política de seguridad: ningún atributo style en el marcado ni script en línea; aquí solo se escriben variables CSS con setProperty
// (CSSOM) y atributos de datos. El movimiento principal es CSS puro (animation-timeline); esto es respaldo para navegadores sin él, cifras que cuentan y tilt.

const CSS_TIMELINE = () => typeof CSS !== 'undefined' && CSS.supports('animation-timeline: view()');
const REDUCIDO = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function contar(el: HTMLElement) {
  const final = el.textContent ?? '', objetivo = Number(el.dataset.contar ?? '0');
  const prefijo = /^[^\d]*/.exec(final)?.[0] ?? '';
  const fmt = new Intl.NumberFormat('en-US');
  const inicio = performance.now(), dur = 1100;
  const paso = (ahora: number) => {
    const p = Math.min(1, (ahora - inicio) / dur), e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
    el.textContent = prefijo + fmt.format(Math.round(objetivo * e));
    if (p < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

export function MovimientoLanding() {
  useEffect(() => {
    const raiz = document.documentElement, limpiar: Array<() => void> = [];
    raiz.setAttribute('data-landing-js', '');
    limpiar.push(() => raiz.removeAttribute('data-landing-js'));
    // Sin preferencia guardada, se sigue al sistema (la app solo lee la preferencia guardada).
    if (!raiz.dataset.theme && window.matchMedia('(prefers-color-scheme: dark)').matches) raiz.dataset.theme = 'dark';
    const reducido = REDUCIDO(), conTimeline = CSS_TIMELINE();
    const el = <T extends Element>(sel: string) => Array.from(document.querySelectorAll<T>(sel));

    // Revelados: con animation-timeline lo hace el CSS; sin él, IntersectionObserver añade la clase «on».
    if (!reducido && !conTimeline) {
      const alto = window.innerHeight;
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } }), {rootMargin: '0px 0px -8% 0px', threshold: 0.08});
      el('.rv').forEach((n) => { if (n.getBoundingClientRect().top < alto) n.classList.add('on', 'ya'); else io.observe(n); });
      limpiar.push(() => io.disconnect());
    }

    // Cifras que cuentan hacia arriba al activarse su paso. Texto final en el HTML; aquí se pone en cero solo lo que aún no se ve.
    const contadores = el<HTMLElement>('[data-contar]');
    if (!reducido) contadores.forEach((c) => { const pref = /^[^\d]*/.exec(c.textContent ?? '')?.[0] ?? ''; c.textContent = pref + '0'; });

    // Centinelas de los pasos: activan el paso (respaldo del CSS) y disparan las cifras del panel activo.
    const pista = document.querySelector<HTMLElement>('[data-pasos]');
    if (pista) {
      const cen = el<HTMLElement>('[data-centinela]'), hechos = new Set<Element>();
      const io = new IntersectionObserver((es) => es.forEach((e) => {
        if (!e.isIntersecting) return;
        const n = (e.target as HTMLElement).dataset.centinela ?? '1';
        pista.dataset.activo = n;
        if (reducido) return;
        pista.querySelectorAll<HTMLElement>(`.panel[data-paso="${n}"] [data-contar]`).forEach((c) => { if (!hechos.has(c)) { hechos.add(c); contar(c); } });
      }), {rootMargin: '-50% 0px -50% 0px'});
      cen.forEach((c) => io.observe(c));
      limpiar.push(() => io.disconnect());
    }
    if (reducido) contadores.forEach((c) => c.removeAttribute('data-contar'));

    // Frase que se rellena palabra por palabra: respaldo con una variable --p escrita desde un único oyente pasivo.
    const frases = el<HTMLElement>('[data-frase]');
    if (!reducido && !conTimeline && frases.length) {
      let esperando = false;
      const medir = () => { esperando = false; const vh = window.innerHeight; frases.forEach((f) => { const r = f.getBoundingClientRect(); f.style.setProperty('--p', String(Math.max(0, Math.min(1, (vh * 0.85 - r.top) / (r.height + vh * 0.3))))); }); };
      const alScroll = () => { if (!esperando) { esperando = true; requestAnimationFrame(medir); } };
      medir();
      window.addEventListener('scroll', alScroll, {passive: true}); window.addEventListener('resize', alScroll);
      limpiar.push(() => { window.removeEventListener('scroll', alScroll); window.removeEventListener('resize', alScroll); });
    }

    // Tilt sutil de tarjeta con puntero fino: variables --rx y --ry.
    if (!reducido && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      el<HTMLElement>('.tilt').forEach((t) => {
        const mover = (ev: PointerEvent) => { const r = t.getBoundingClientRect(); t.style.setProperty('--rx', (((ev.clientY - r.top) / r.height - 0.5) * -5).toFixed(2) + 'deg'); t.style.setProperty('--ry', (((ev.clientX - r.left) / r.width - 0.5) * 5).toFixed(2) + 'deg'); };
        const salir = () => { t.style.removeProperty('--rx'); t.style.removeProperty('--ry'); };
        t.addEventListener('pointermove', mover); t.addEventListener('pointerleave', salir);
        limpiar.push(() => { t.removeEventListener('pointermove', mover); t.removeEventListener('pointerleave', salir); });
      });
    }
    return () => limpiar.forEach((f) => f());
  }, []);
  return null;
}

/** Botón de tema claro u oscuro: misma preferencia guardada que la app («vexa-theme»). */
export function SelectorTemaLanding({etiqueta}: {etiqueta: string}) {
  const [oscuro, setOscuro] = useState(false);
  useEffect(() => {
    const leer = () => setOscuro(document.documentElement.dataset.theme === 'dark');
    leer();
    const mo = new MutationObserver(leer);
    mo.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
    return () => mo.disconnect();
  }, []);
  function alternar() {
    const siguiente = oscuro ? 'light' : 'dark';
    document.documentElement.dataset.theme = siguiente;
    try { window.localStorage.setItem('vexa-theme', siguiente); } catch { /* la preferencia es opcional */ }
    document.querySelectorAll('meta[name=theme-color]').forEach((m) => m.setAttribute('content', siguiente === 'dark' ? '#0e0e10' : '#ffffff'));
  }
  return <button type="button" className="l-tema" aria-label={etiqueta} aria-pressed={oscuro} onClick={alternar}>
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path className="l-tema-mitad" d="M10 3.5a6.5 6.5 0 0 1 0 13z" fill="currentColor" /></svg>
  </button>;
}

const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;uniform float uT;uniform vec3 uC;
float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),u.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.02;a*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;float asp=uRes.x/uRes.y;
  vec2 p=vec2(uv.x*asp,uv.y)*1.5;
  float f=fbm(p+vec2(uT*.02,-uT*.014))+.3*fbm(p*2.1-vec2(uT*.01));
  float d=abs(fract(f*8.)-.5);
  float linea=1.-smoothstep(.015,.055,d);
  float masc=(.2+.8*smoothstep(.25,1.,uv.x))*smoothstep(.02,.5,uv.y);
  float a=linea*masc*.2;
  gl_FragColor=vec4(uC*a,a);
}`;

/** Fondo de curvas de nivel en una sola tinta, muy tenue. Sin degradados: solo líneas finas que derivan despacio. Un solo cuadro con movimiento reducido, pausa fuera de vista y a 30 cuadros por segundo en táctil. */
export function SombreadoLanding() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const conexion = (navigator as Navigator & {connection?: {saveData?: boolean}}).connection;
    if (conexion?.saveData) return;
    const gl = canvas.getContext('webgl', {antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power'});
    if (!gl) return;
    const sh = (tipo: number, src: string) => { const s = gl.createShader(tipo)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, 'uRes'), uT = gl.getUniformLocation(prog, 'uT'), uC = gl.getUniformLocation(prog, 'uC');
    const reducido = REDUCIDO(), tactil = window.matchMedia('(pointer: coarse)').matches;
    const escala = window.innerWidth < 760 ? 0.5 : 0.6;
    const color = () => { const m = /(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(getComputedStyle(canvas).color); gl.uniform3f(uC, +(m?.[1] ?? 14) / 255, +(m?.[2] ?? 14) / 255, +(m?.[3] ?? 16) / 255); };
    const medir = () => { canvas.width = Math.max(2, Math.round(canvas.clientWidth * escala)); canvas.height = Math.max(2, Math.round(canvas.clientHeight * escala)); gl.viewport(0, 0, canvas.width, canvas.height); gl.uniform2f(uRes, canvas.width, canvas.height); };
    const t0 = performance.now();
    let visible = true, pestana = !document.hidden, raf = 0, ultimo = 0;
    const dibujar = (ahora: number) => { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform1f(uT, reducido ? 0 : (ahora - t0) / 1000); gl.drawArrays(gl.TRIANGLES, 0, 6); };
    const bucle = (ahora: number) => {
      raf = 0;
      if (!visible || !pestana || reducido) return;
      if (!tactil || ahora - ultimo > 32) { ultimo = ahora; dibujar(ahora); }
      raf = requestAnimationFrame(bucle);
    };
    const arrancar = () => { if (!raf && visible && pestana && !reducido) raf = requestAnimationFrame(bucle); };
    medir(); color(); dibujar(t0);
    canvas.setAttribute('data-listo', '');
    const io = new IntersectionObserver((es) => { visible = es[0]?.isIntersecting ?? true; arrancar(); });
    io.observe(canvas);
    const alVisibilidad = () => { pestana = !document.hidden; arrancar(); };
    document.addEventListener('visibilitychange', alVisibilidad);
    let temporizador = 0;
    const alRedimensionar = () => { window.clearTimeout(temporizador); temporizador = window.setTimeout(() => { medir(); dibujar(performance.now()); }, 150); };
    window.addEventListener('resize', alRedimensionar);
    const mo = new MutationObserver(() => { color(); dibujar(performance.now()); });
    mo.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
    arrancar();
    return () => { if (raf) cancelAnimationFrame(raf); io.disconnect(); mo.disconnect(); window.clearTimeout(temporizador); document.removeEventListener('visibilitychange', alVisibilidad); window.removeEventListener('resize', alRedimensionar); };
  }, []);
  return <canvas ref={ref} className="l-shader" aria-hidden="true" />;
}
