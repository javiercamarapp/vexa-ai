// Escáneres reutilizables de las pruebas del sitio (T12). No es una prueba: el prefijo _ lo
// deja fuera del glob tests/sitio/*.test.*. Funciones puras, sin dependencias.
import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export function listarArchivos(dir, exts, { omitir = /(^|\/)node_modules(\/|$)/ } = {}) {
  const out = [];
  if (!existsSync(dir)) return out;
  const rec = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (omitir.test(p)) continue;
      statSync(p).isDirectory() ? rec(p) : exts.some((e) => n.endsWith(e)) && out.push(p);
    }
  };
  rec(dir);
  return out.sort();
}

// ---------- Escáner de fuentes (SPEC 9.2) ----------
// Quita comentarios sin tocar las URL de las cadenas ("https://...").
export function sinComentarios(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[\s;,{}()])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
}

export const REGLAS_FUENTE = [
  { id: 'style-atributo', re: /\bstyle\s*=\s*["'`]/, nota: 'atributo style en el marcado' },
  { id: 'style-jsx', re: /\bstyle\s*=\s*\{\{/, nota: 'style={{ }} de JSX' },
  { id: 'set-attribute-style', re: /setAttribute\(\s*['"]style['"]/, nota: "setAttribute('style'); usa style.setProperty" },
  { id: 'inner-html', re: /\.innerHTML\s*=|\binnerHTML\s*:/, nota: 'innerHTML con datos' },
  { id: 'eval', re: /\beval\s*\(/, nota: 'eval(' },
  { id: 'new-function', re: /new\s+Function\s*\(/, nota: 'new Function(' },
  { id: 'document-write', re: /document\.write(ln)?\s*\(/, nota: 'document.write' },
  { id: 'import-externo', re: /\bimport\s*\(\s*['"`]https?:/, nota: 'import() de un host externo' },
  { id: 'webassembly', re: /\bWebAssembly\b/, nota: 'WebAssembly' },
  { id: 'use-client', re: /^\s*['"]use client['"]/m, nota: "'use client' (el sitio es de servidor)" },
  { id: 'dinamico-cookies', re: /\bcookies\s*\(/, nota: 'cookies() vuelve dinámica la ruta' },
  { id: 'dinamico-headers', re: /\bheaders\s*\(\s*\)/, nota: 'headers() vuelve dinámica la ruta' },
  { id: 'dinamico-draft', re: /\bdraftMode\s*\(/, nota: 'draftMode()' },
  { id: 'dinamico-connection', re: /\bconnection\s*\(\s*\)/, nota: 'connection()' },
  { id: 'dinamico-searchparams', re: /\bsearchParams\b/, nota: 'searchParams vuelve dinámica la ruta' },
];

// dangerouslySetInnerHTML solo se permite cuando es para un script ld+json.
export function escanearFuente(texto, archivo = '') {
  const src = sinComentarios(texto);
  const hall = [];
  const lineaDe = (i) => src.slice(0, i).split('\n').length;
  for (const r of REGLAS_FUENTE) {
    const g = new RegExp(r.re.source, r.re.flags.includes('g') ? r.re.flags : r.re.flags + 'g');
    let m;
    while ((m = g.exec(src))) hall.push({ archivo, linea: lineaDe(m.index), regla: r.id, nota: r.nota });
  }
  const g = /dangerouslySetInnerHTML/g;
  let m;
  while ((m = g.exec(src))) {
    const ventana = src.slice(Math.max(0, m.index - 400), m.index + 200);
    if (!/application\/ld\+json/.test(ventana)) hall.push({ archivo, linea: lineaDe(m.index), regla: 'dangerously', nota: 'dangerouslySetInnerHTML fuera de ld+json' });
  }
  return hall;
}

// ---------- Escáner de HTML construido (SPEC 9.2) ----------
export const LISTA_BLANCA_NEXT_POR_DEFECTO = [
  /^self\.__next_f\.push\(/,
  /^\(self\.__next_f\s*=\s*self\.__next_f\s*\|\|\s*\[\]\)\.push\(/,
  /^\(self\.__next_s\s*=/,
  /^\$R[CSVXT]?\(/,
  /^requestAnimationFrame\(function\(\)\{\$RT=/,
  /^\(\$RC=/,
];
const TIPOS_DATOS = /^(application\/ld\+json|application\/json|importmap|speculationrules)$/i;
const HOSTS_PROPIOS = new Set(['rovaq.ai', 'www.rovaq.ai']);

function atributos(tag) {
  const a = {};
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  const cuerpo = tag.replace(/^<\s*[^\s>\/]+/, '').replace(/\/?>$/, '');
  let m;
  while ((m = re.exec(cuerpo))) a[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? true;
  return a;
}
const hostExterno = (u) => {
  if (typeof u !== 'string') return false;
  const t = u.trim();
  if (!/^(https?:)?\/\//i.test(t)) return false;
  try {
    return !HOSTS_PROPIOS.has(new URL(t.startsWith('//') ? 'https:' + t : t).hostname);
  } catch {
    return true;
  }
};

export function escanearHtml(html, { listaBlanca = LISTA_BLANCA_NEXT_POR_DEFECTO, archivo = '' } = {}) {
  const hall = [];
  const aviso = (regla, nota) => hall.push({ archivo, regla, nota });
  const sinScripts = html.replace(/<script\b[\s\S]*?<\/script>/gi, '<script></script>').replace(/<style\b[\s\S]*?<\/style>/gi, '<style></style>');
  // 1. cero style en atributos y cero etiquetas <style> con cuerpo
  const tags = [...sinScripts.matchAll(/<[a-zA-Z][^>]*>/g)].map((m) => m[0]);
  for (const t of tags) if (/\sstyle\s*=/i.test(t)) aviso('style-atributo', `atributo style en ${t.slice(0, 60)}`);
  if (/<style\b[^>]*>[^<]+<\/style>/i.test(html.replace(/<script\b[\s\S]*?<\/script>/gi, ''))) aviso('style-etiqueta', 'etiqueta <style> con cuerpo');
  // 2. scripts
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  for (const s of scripts) {
    const at = atributos('<script ' + s[1] + '>');
    const cuerpo = s[2].trim();
    if (at.src) {
      if (hostExterno(at.src)) aviso('origen-externo', `script src externo ${at.src}`);
      continue;
    }
    if (!cuerpo) continue;
    if (typeof at.type === 'string' && TIPOS_DATOS.test(at.type)) continue;
    if (!listaBlanca.some((re) => re.test(cuerpo))) aviso('script-en-linea', `script en línea fuera de la lista blanca: ${cuerpo.slice(0, 60)}`);
  }
  // 3. origen externo en recursos
  for (const t of tags) {
    const nombre = /^<\s*([a-zA-Z0-9]+)/.exec(t)[1].toLowerCase();
    const at = atributos(t);
    if (nombre === 'link') {
      const rel = String(at.rel || '').toLowerCase();
      if (/canonical|alternate/.test(rel)) continue; // apuntan a rovaq.ai por contrato
      if (hostExterno(at.href)) aviso('origen-externo', `link ${rel} externo ${at.href}`);
    } else if (['img', 'source', 'iframe', 'video', 'audio', 'embed', 'track'].includes(nombre)) {
      for (const k of ['src', 'srcset', 'poster']) if (at[k] && String(at[k]).split(',').some((p) => hostExterno(p.trim().split(/\s+/)[0]))) aviso('origen-externo', `${nombre} ${k} externo ${at[k]}`);
    } else if (nombre === 'form' && hostExterno(at.action)) aviso('origen-externo', `form action externo ${at.action}`);
  }
  if (/url\(\s*['"]?(https?:)?\/\/(?!(www\.)?rovaq\.ai)/i.test(html)) aviso('origen-externo', 'url() externa en CSS');
  // 4. inert
  for (const t of tags) if (/\sinert(\s|=|\/|>)/i.test(t)) aviso('inert', 'atributo inert');
  // 5. un solo h1
  const h1 = (sinScripts.match(/<h1[\s>]/gi) || []).length;
  if (h1 !== 1) aviso('h1', `se esperaba un h1 y hay ${h1}`);
  // 6. canonical absoluto
  const canon = tags.map((t) => ({ t, a: atributos(t) })).filter((x) => /^<link/i.test(x.t) && /canonical/i.test(String(x.a.rel)));
  if (canon.length !== 1) aviso('canonical', `se esperaba un canonical y hay ${canon.length}`);
  else if (!/^https:\/\/rovaq\.ai(\/|$)/.test(String(canon[0].a.href))) aviso('canonical', `canonical no absoluto de rovaq.ai: ${canon[0].a.href}`);
  // 7. img con alt, width y height
  for (const t of tags.filter((x) => /^<img[\s>\/]/i.test(x))) {
    const a = atributos(t);
    for (const k of ['alt', 'width', 'height']) if (a[k] === undefined) aviso('img-atributos', `<img> sin ${k}: ${t.slice(0, 80)}`);
  }
  // 8. lang
  if (!/<html[^>]*\slang\s*=\s*["'](es|en)/i.test(html)) aviso('lang', 'html sin lang es o en');
  return hall;
}

// ---------- CSS del sitio ----------
export function sinComentariosCss(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

// Devuelve el color como { h, s, l } (HSL, s y l en 0-1) o null.
export function aHsl(c) {
  let r, g, b;
  const hex = /^#([0-9a-f]{3,8})$/i.exec(c);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((x) => x + x).join('');
    r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
  } else {
    const rgb = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(c);
    if (rgb) { r = +rgb[1]; g = +rgb[2]; b = +rgb[3]; }
    else {
      const hs = /^hsla?\(\s*([\d.]+)(?:deg)?[ ,]+([\d.]+)%[ ,]+([\d.]+)%/i.exec(c);
      if (hs) return { h: +hs[1] % 360, s: +hs[2] / 100, l: +hs[3] / 100 };
      const nom = { blue: [0, 0, 255], navy: [0, 0, 128], royalblue: [65, 105, 225], dodgerblue: [30, 144, 255], skyblue: [135, 206, 235], steelblue: [70, 130, 180], cornflowerblue: [100, 149, 237], deepskyblue: [0, 191, 255], slateblue: [106, 90, 205], indigo: [75, 0, 130] }[c.toLowerCase()];
      if (!nom) return null;
      [r, g, b] = nom;
    }
  }
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s, l };
}

// Azul = matiz de 195 a 265 grados con saturación de 20 por ciento o más, ni casi blanco ni casi negro.
export function esAzul(c) {
  const x = aHsl(c);
  return !!x && x.s >= 0.2 && x.h >= 195 && x.h <= 265 && x.l > 0.05 && x.l < 0.97;
}

export function coloresDeCss(css) {
  const t = sinComentariosCss(css);
  const out = new Set();
  for (const m of t.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g)) out.add(m[0]);
  for (const m of t.matchAll(/:\s*([a-z]+)\s*[;}]/g)) out.add(m[1]);
  return [...out];
}

export function bloquesReducedMotion(css, valor = 'reduce') {
  const t = sinComentariosCss(css);
  return (t.match(new RegExp(`@media[^{]*prefers-reduced-motion\\s*:\\s*${valor}`, 'gi')) || []).length;
}

// Clases usadas en selectores (no en declaraciones, comentarios, cadenas ni url()).
export function clasesDeSelectores(css) {
  const t = sinComentariosCss(css).replace(/url\([^)]*\)/g, '').replace(/"[^"]*"|'[^']*'/g, '""');
  const clases = new Set();
  const pila = [];
  let prelude = '';
  for (const ch of t) {
    if (ch === '{') {
      const p = prelude.trim();
      const tope = pila[pila.length - 1];
      if (tope === 'regla' || tope === 'kf') pila.push('regla');
      else if (p.startsWith('@')) pila.push(/keyframes/i.test(p) ? 'kf' : 'at');
      else {
        for (const m of p.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) clases.add(m[1]);
        pila.push('regla');
      }
      prelude = '';
    } else if (ch === '}') { pila.pop(); prelude = ''; }
    else if (ch === ';') prelude = '';
    else if (pila[pila.length - 1] !== 'regla') prelude += ch;
  }
  return [...clases].sort();
}
export const rel = relative;
export const leer = (p) => readFileSync(p, 'utf8');
