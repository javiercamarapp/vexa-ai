#!/usr/bin/env node
// T10: geometría de referencia del hilo (SPEC 3.6) y su tabla de 33 fotogramas.
//
// El hilo es UN solo path con siete anclas que viaja por los márgenes laterales de S3 a S10 y cruza de un carril al otro
// en los espacios vacíos entre secciones, con curvas S de tangentes verticales. Es estrictamente monótono en Y.
//
// DECISIÓN (documentada en T10-NOTAS.md): el path y la tabla se calculan EN EL CLIENTE con ResizeObserver a partir de
// las posiciones reales del marcado (las secciones cambian de alto con el ancho, con las fuentes y con el idioma, y una
// tabla de build solo sería exacta a 1440). inicio.js lleva una copia mínima de `trazar` y `tabla`; este archivo es la
// implementación de referencia y la prueba (movimiento.test.mjs) exige que ambas den exactamente el mismo `d` y la misma
// tabla con las medidas versionadas. Este archivo además:
//   - mide las secciones reales con el arnés CDP (--medir URL) y guarda tools/sitio/hilo-medidas.json,
//   - escribe la salida versionada y determinista tools/sitio/hilo-referencia.json (d, longitud, 33 fotogramas, anclas),
//   - imprime los keyframes CSS equivalentes si se piden (--css), por si el CSS nativo vuelve a ser preferible.
//
// Uso: node tools/sitio/genera-hilo.mjs [--medir URL] [--verificar] [--css]
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RUTA_MEDIDAS = join(AQUI, 'hilo-medidas.json');
export const RUTA_REFERENCIA = join(AQUI, 'hilo-referencia.json');

/** Constantes de la spec 3.6. */
export const HILO = {
  cuadros: 33, // fotogramas de la tabla
  contenedor: 1072, // ancho del contenedor; margen de 184 a 1440, carril en la mitad del margen (92)
  carrilMin: 20, // a 1100 px o menos el carril es único y recto a 20 px del borde
  cruce: {antes: 130, despues: 30}, // el cruce abarca de (borde - 130) a (borde + 30)
  compensacion: 56, // los nodos van en el relleno de la sección, 56 px bajo el borde superior
  piso: 150, // la nota 04 queda 56 px sobre el borde inferior de S6
};

/** Siete anclas: sección, referencia vertical, carril. Las dos de S6 comparten carril; los cruces caen en el borde superior de la sección entrante. */
export const ANCLAS = [
  {id: 1, seccion: 'problema', desde: 'top', carril: 'izq'},
  {id: 2, seccion: 'valor', desde: 'top', carril: 'der'},
  {id: 3, seccion: 'pantallas', desde: 'top', carril: 'izq'},
  {id: 4, seccion: 'pantallas', desde: 'fin', carril: 'izq'},
  {id: 5, seccion: 'seguridad', desde: 'top', carril: 'der'},
  {id: 6, seccion: 'integraciones', desde: 'top', carril: 'izq'},
  {id: 7, seccion: 'cierre', desde: 'top', carril: 'der'},
];

/** Los cruces: borde superior de la sección entrante y carril de destino. */
export const CRUCES = [
  {seccion: 'valor', a: 'der'},
  {seccion: 'modulos', a: 'izq'},
  {seccion: 'seguridad', a: 'der'},
  {seccion: 'integraciones', a: 'izq'},
  {seccion: 'cierre', a: 'der'},
];

const r2 = (n) => Math.round(n * 100) / 100;
const r4 = (n) => Math.round(n * 10000) / 10000;

/** Carriles en x para un ancho de página. */
export function carriles(ancho, contenedor = HILO.contenedor) {
  const izq = Math.max(HILO.carrilMin, (ancho - contenedor) / 4);
  return {izq, der: ancho - izq};
}

/** Y de cada ancla en coordenadas de la zona. */
export function posicionesAncla(m) {
  return ANCLAS.map((a) => {
    const s = m.secciones[a.seccion];
    const y = a.desde === 'top' ? s.top + HILO.compensacion : s.top + s.alto - HILO.compensacion;
    return {...a, y: r2(y)};
  });
}

/**
 * Segmentos del path: lista de [x0, y0, x1, y1, tipo] con tipo 'r' recta o 'c' cúbica S de tangentes verticales.
 * Parte del carril izquierdo en y 0, termina en la base de la zona sobre el carril final.
 */
export function segmentos(m) {
  const {izq, der} = carriles(m.ancho, m.contenedor);
  const x = {izq, der};
  const seg = [];
  let carril = 'izq', y = 0;
  for (const c of CRUCES) {
    const borde = m.secciones[c.seccion].top;
    const ya = borde - HILO.cruce.antes, yb = borde + HILO.cruce.despues;
    if (ya > y) seg.push([x[carril], y, x[carril], ya, 'r']);
    seg.push([x[carril], ya, x[c.a], yb, 'c']);
    carril = c.a; y = yb;
  }
  seg.push([x[carril], y, x[carril], m.alto, 'r']);
  return seg;
}

/** Cadena `d` del path, redondeada a 2 decimales. */
export function trazar(m) {
  const seg = segmentos(m);
  let d = `M${r2(seg[0][0])} ${r2(seg[0][1])}`;
  for (const [x0, y0, x1, y1, t] of seg) {
    if (t === 'r') d += `L${r2(x1)} ${r2(y1)}`;
    else {
      const h = (y1 - y0) / 2;
      d += `C${r2(x0)} ${r2(y0 + h)} ${r2(x1)} ${r2(y1 - h)} ${r2(x1)} ${r2(y1)}`;
    }
  }
  return d;
}

const N_MUESTRAS = 64;
/** Punto de una cúbica S (vertical-vertical) en el parámetro t. */
function bez(x0, y0, x1, y1, t) {
  const h = (y1 - y0) / 2, u = 1 - t;
  const b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
  return [(b0 + b1) * x0 + (b2 + b3) * x1, b0 * y0 + b1 * (y0 + h) + b2 * (y1 - h) + b3 * y1];
}

/** Polilínea densa del path (64 muestras por cúbica) con el largo acumulado. Es monótona en Y. */
export function polilinea(m) {
  const pts = [];
  for (const [x0, y0, x1, y1, t] of segmentos(m)) {
    if (!pts.length) pts.push([x0, y0]);
    if (t === 'r') pts.push([x1, y1]);
    else for (let i = 1; i <= N_MUESTRAS; i++) pts.push(bez(x0, y0, x1, y1, i / N_MUESTRAS));
  }
  const acum = [0];
  for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return {pts, acum, largo: acum[acum.length - 1]};
}

/**
 * Tabla de fotogramas: para 33 fracciones iguales de la altura Y/H, la fracción de LONGITUD de arco alcanzada.
 * dashoffset = 1 - s. x e y son la posición de la cabeza en coordenadas de la zona.
 */
export function tabla(m, n = HILO.cuadros) {
  const {pts, acum, largo} = polilinea(m);
  const filas = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const y = (m.alto * k) / (n - 1);
    while (j < pts.length - 2 && pts[j + 1][1] < y) j++;
    const [xa, ya] = pts[j], [xb, yb] = pts[j + 1];
    const f = yb === ya ? 0 : Math.min(1, Math.max(0, (y - ya) / (yb - ya)));
    const s = (acum[j] + f * (acum[j + 1] - acum[j])) / largo;
    filas.push({p: r4(k / (n - 1)), s: r4(s), x: r2(xa + f * (xb - xa)), y: r2(y)});
  }
  return filas;
}

/** Salida completa y determinista. */
export function generar(m) {
  const {largo} = polilinea(m);
  return {
    version: 1,
    ancho: m.ancho,
    alto: m.alto,
    contenedor: m.contenedor,
    d: trazar(m),
    largo: r2(largo),
    anclas: posicionesAncla(m).map(({id, seccion, carril, y}) => ({id, seccion, carril, y})),
    tabla: tabla(m),
  };
}

/** Keyframes CSS equivalentes para animation-timeline (opcional). */
export function keyframesCss(t) {
  const f = (clave) => t.map((r) => `  ${r4(r.p * 100)}% { ${clave(r)} }`).join('\n');
  return `@keyframes s-hilo-trazo {\n${f((r) => `stroke-dashoffset: ${r4(1 - r.s)};`)}\n}\n`;
}

/** Medidas por defecto: las alturas de la spec 6 a 1440 por 900, relativas al inicio de S3. */
export const MEDIDAS_SPEC = {
  ancho: 1440,
  contenedor: 1072,
  alto: 13450,
  secciones: {
    problema: {top: 0, alto: 1050},
    valor: {top: 1050, alto: 1450},
    modulos: {top: 2500, alto: 4500},
    pantallas: {top: 7000, alto: 1300},
    puestos: {top: 8300, alto: 1000},
    seguridad: {top: 9300, alto: 2100},
    integraciones: {top: 11400, alto: 1500},
    cierre: {top: 12900, alto: 1550},
  },
};

export function leerMedidas() {
  return existsSync(RUTA_MEDIDAS) ? JSON.parse(readFileSync(RUTA_MEDIDAS, 'utf8')) : MEDIDAS_SPEC;
}

const texto = (o) => JSON.stringify(o, null, 1) + '\n';

/** Mide las secciones reales con el arnés CDP a 1440 por 900 (necesita la Mac con poca carga y un servidor en marcha). */
async function medir(url) {
  const {conSesion, dormir} = await import('./cdp/navegador.mjs');
  let m = null;
  await conSesion({vp: '1440', esquema: 'dark', movimiento: 'no-preference', webgl: true, etiqueta: 'genera-hilo'}, async ({page}) => {
    await page.goto(url, {waitUntil: 'load'});
    await dormir(2800);
    m = await page.evaluate(() => {
      const zona = document.querySelector('.s-hilo-zona');
      const z = zona.getBoundingClientRect();
      const y0 = z.top + scrollY;
      const o = {ancho: document.documentElement.clientWidth, contenedor: Math.round(document.querySelector('.s-contenedor').getBoundingClientRect().width), alto: Math.round(z.height), secciones: {}};
      for (const s of zona.querySelectorAll(':scope > section')) {
        const r = s.getBoundingClientRect();
        // La escena fija del paso 5 mide su pista, no su sección: es la sección completa.
        o.secciones[s.id === 'modulos' ? 'modulos' : s.dataset.seccion] = {top: Math.round(r.top + scrollY - y0), alto: Math.round(r.height)};
      }
      return o;
    });
  });
  return m;
}

async function principal() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--medir');
  if (i >= 0) {
    const m = await medir(args[i + 1]);
    writeFileSync(RUTA_MEDIDAS, texto(m));
    console.log('medidas guardadas en', RUTA_MEDIDAS, JSON.stringify(m.secciones));
  }
  const salida = texto(generar(leerMedidas()));
  if (args.includes('--verificar')) {
    const actual = existsSync(RUTA_REFERENCIA) ? readFileSync(RUTA_REFERENCIA, 'utf8') : '';
    if (actual !== salida) { console.error('hilo-referencia.json no coincide con las medidas: corre genera-hilo.mjs sin --verificar'); process.exit(1); }
    console.log('hilo-referencia.json al día');
    return;
  }
  writeFileSync(RUTA_REFERENCIA, salida);
  console.log('escrito', RUTA_REFERENCIA);
  if (args.includes('--css')) console.log(keyframesCss(tabla(leerMedidas())));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) principal().catch((e) => { console.error(e); process.exit(1); });
