#!/usr/bin/env node
// Espejos Markdown, llms.txt y llms-full.txt del sitio público (T2). Todo sale de publicar() sobre el contenido de T11, el mismo origen del HTML:
// ninguna detección por User-Agent y ningún texto que el HTML no tenga (no es cloaking). Solo entran las páginas publicables; las pendientes de revisión no tienen espejo.
//
// Uso (desde la raíz del repositorio, Node 22.18 o posterior):
//   node tools/sitio/generar-md.mjs              escribe los archivos de public/ y la sección md de public/s/manifest.json
//   node tools/sitio/generar-md.mjs --verificar  no escribe: sale con 1 si lo que hay en disco no coincide con lo que se generaría
//   node tools/sitio/generar-md.mjs --fechas     recalcula apps/web/config/sitio/fechas.json desde git (fecha del último commit del archivo de contenido de cada página)
//
// Salidas
//   public/index.md y public/en/index.md                    espejo de la portada (nombres estables; host-routing ya los sirve)
//   public/s/md/<idioma>/<id>.<hash8>.md                    espejo de cada página publicable; con hash en el nombre y declarados en manifest.md (contrato K3)
//   public/llms.txt, public/llms-full.txt, public/en/...    índice y contenido completo, en español y en inglés
//   public/.well-known/security.txt                         solo si [CORREO_DE_SEGURIDAD] y [FECHA_DE_REVISION] existen; mientras no, no se publica
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { brotliCompressSync, constants as zc } from 'node:zlib';
import { plantillaSecurityTxt } from '../../apps/web/config/sitio/agentic.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WEB = join(REPO, 'apps', 'web');
const PUB = join(WEB, 'public');
const CONTENIDO = join(WEB, 'src', 'content', 'sitio');
const ARCHIVO_FECHAS = join(WEB, 'config', 'sitio', 'fechas.json');
const MANIFEST = join(PUB, 's', 'manifest.json');
const BASE = 'https://rovaq.ai';
const IDIOMAS = ['es', 'en'];

const sha = (b) => createHash('sha256').update(b).digest('hex');
const imp = (ruta) => import(pathToFileURL(ruta).href);

// ---------------------------------------------------------------- carga

/** Carga el contenido, las aprobaciones, las fechas y las funciones puras. Sin Next: los .ts se importan directo (Node 22.18 o posterior). */
export async function cargarSitio({ ctx } = {}) {
  const { LANDING } = await imp(join(CONTENIDO, 'landing.ts'));
  const { PAGINAS_INTERNAS } = await imp(join(CONTENIDO, 'paginas', 'index.ts'));
  const M = await imp(join(WEB, 'src', 'lib', 'sitio', 'marcadores.mjs'));
  const S = await imp(join(WEB, 'src', 'lib', 'sitio', 'metadatos.mjs'));
  const aprobaciones = JSON.parse(readFileSync(join(CONTENIDO, 'aprobaciones.json'), 'utf8'));
  const fechas = existsSync(ARCHIVO_FECHAS) ? JSON.parse(readFileSync(ARCHIVO_FECHAS, 'utf8')) : {};
  const contexto = ctx ?? M.contextoPorDefecto();
  const fichas = S.construirFichas({ landing: LANDING, paginas: PAGINAS_INTERNAS, aprobaciones, fechas, ctx: contexto });
  return { LANDING, PAGINAS_INTERNAS, M, S, aprobaciones, fechas, fichas, ctx: contexto };
}

// ---------------------------------------------------------------- fechas desde git

/** Fecha AAAA-MM-DD del último commit que tocó un archivo, o null si no hay historia. */
function fechaGit(archivo) {
  try {
    const salida = execFileSync('git', ['log', '-1', '--format=%cs', '--', archivo], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return salida || null;
  } catch { return null; }
}
/** Fecha real de contenido por página: la del último commit del archivo que la define (portada: landing.ts; resto: el archivo de paginas/ que declara su id). */
export async function calcularFechas() {
  const hoy = new Date().toISOString().slice(0, 10);
  const { PAGINAS_INTERNAS, S } = await cargarSitio();
  const fuentes = readdirSync(join(CONTENIDO, 'paginas')).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
  const textos = new Map(fuentes.map((f) => [f, readFileSync(join(CONTENIDO, 'paginas', f), 'utf8')]));
  const salida = { inicio: fechaGit(join(CONTENIDO, 'landing.ts')) ?? hoy };
  for (const p of PAGINAS_INTERNAS) {
    const archivo = fuentes.find((f) => textos.get(f).includes(`id: '${p.id}'`));
    salida[S.idRegistroDe(p.id)] = (archivo && fechaGit(join(CONTENIDO, 'paginas', archivo))) || salida.inicio;
  }
  return Object.fromEntries(Object.entries(salida).sort(([a], [b]) => a.localeCompare(b)));
}

// ---------------------------------------------------------------- texto

const hoja = (h, lang) => (h && typeof h === 'object' && typeof h[lang] === 'string' ? h[lang] : typeof h === 'string' ? h : '');
const esHoja = (h) => h && typeof h === 'object' && typeof h.es === 'string' && typeof h.en === 'string';
const lista = (x) => (Array.isArray(x) ? x : []);
const RE_CORREO = /[\w.+-]+@[\w-]+\.[\w.-]+/;

/** El buzón de contacto no se repite en los archivos para agentes: se sustituye por la página de solicitud de acceso. */
function sinCorreo(texto, lang, urlAcceso) {
  const t = texto
    .replace(new RegExp(`Escríbenos a ${RE_CORREO.source}`, 'g'), `Solicita acceso en ${urlAcceso}`)
    .replace(new RegExp(`Write to us at ${RE_CORREO.source}`, 'g'), `Request access at ${urlAcceso}`)
    .replace(new RegExp(`\\s*Si tu correo[^.]*?, escribe a ${RE_CORREO.source}\\.`, 'g'), '')
    .replace(new RegExp(`\\s*If your email[^.]*?, write to ${RE_CORREO.source}\\.`, 'g'), '');
  return t;
}

/** Contexto de render: idioma, URL de cada página publicable y redacción del correo. */
function crearRender(fichas, lang) {
  const porId = new Map(fichas.map((f) => [f.id, f]));
  const porRutaEs = new Map(fichas.map((f) => [f.ruta.es, f]));
  const abs = (f) => (f.ruta[lang] === '/' ? BASE : `${BASE}${f.ruta[lang]}`);
  const acceso = porId.get('solicitar-acceso');
  const urlAcceso = acceso?.indexable ? abs(acceso) : abs(porId.get('inicio'));
  const t = (h) => sinCorreo(hoja(h, lang), lang, urlAcceso).replace(/\s+/g, ' ').trim();
  /** Enlace a una página publicable a partir de una hoja de rutas { es, en }; null si la página no se publica. */
  const enlace = (href) => {
    const f = porRutaEs.get(hoja(href, 'es'));
    return f?.indexable ? { f, url: abs(f) } : null;
  };
  return { lang, porId, abs, t, enlace, urlAcceso };
}

const ETIQ = {
  es: { mas: 'Más páginas de este sitio', ejemplo: 'Datos de ejemplo', actualizado: 'Contenido actualizado' },
  en: { mas: 'More pages on this site', ejemplo: 'Example data', actualizado: 'Content updated' },
};

function item(it, r) {
  if (esHoja(it)) return `- ${r.t(it)}`;
  const nombre = r.t(it.t ?? it.n ?? it.nombre ?? '');
  const d = r.t(it.d ?? it.texto ?? '');
  const ve = it.ve ? ` ${r.t(it.ve)}` : '';
  if (nombre && d) return `- ${nombre}. ${d}${ve}`;
  return `- ${nombre || d}`;
}

/** Cuerpo Markdown de la portada, desde su árbol ya publicado. */
function cuerpoPortada(f, r) {
  const a = f.arbol, t = r.t, out = [];
  const h2 = (x) => { if (x) out.push('', `## ${x}`, ''); };
  const p = (x) => { if (x) out.push(x, ''); };
  const ul = (xs) => { for (const x of xs) out.push(item(x, r)); out.push(''); };
  out.push(`# ${t(a.hero.titulo)}`, '');
  p(t(a.hero.eyebrow)); p(t(a.hero.subtitulo)); p(t(a.hero.limite));
  out.pop(); // la última línea vacía la repone h2
  h2(t(a.puente.titulo)); p(t(a.puente.texto)); ul(lista(a.puente.reglas));
  h2(t(a.problema.titulo)); p(t(a.problema.apoyo));
  for (const c of lista(a.problema.columnas)) out.push(`- ${t(c.t)}. ${t(c.d)}`);
  out.push('');
  h2(t(a.valor.titulo));
  h2(t(a.clases.titulo));
  for (const c of lista(a.clases.items)) out.push(`- ${t(c.nombre)}. ${t(c.d)}`);
  out.push('');
  p(`${t(a.clases.reglaEtiqueta)}. ${t(a.clases.regla)}`);
  h2(t(a.modulos.titulo)); p(t(a.modulos.apoyo));
  for (const m of lista(a.modulos.items)) out.push(`- ${t(m.titulo)}. ${t(m.texto)} ${t(m.limite)}`);
  out.push('');
  h2(t(a.pantallas.titulo)); p(t(a.pantallas.apoyo));
  for (const s of lista(a.pantallas.items)) {
    const l = r.enlace(s.href);
    out.push(`- ${l ? `[${t(s.t)}](${l.url})` : t(s.t)}. ${t(s.pregunta)} ${t(s.d)}`);
  }
  out.push('');
  h2(t(a.puestos.titulo));
  for (const s of lista(a.puestos.items)) out.push(`- ${t(s.t)}. ${t(s.d)} ${t(s.ve)}`);
  out.push('');
  p(t(a.puestos.lideres.titulo)); p(t(a.puestos.cierre));
  h2(t(a.seguridad.titulo));
  p(`${t(a.seguridad.hayEtiqueta)}.`); ul(lista(a.seguridad.hay));
  p(`${t(a.seguridad.noHayEtiqueta)}.`); ul(lista(a.seguridad.noHay));
  if (a.seguridad.fecha) p(t(a.seguridad.fecha));
  h2(t(a.limites.titulo)); p(t(a.limites.subtitulo)); ul(lista(a.limites.items)); p(t(a.limites.cierre));
  h2(t(a.integraciones.titulo)); p(t(a.integraciones.subtitulo));
  p(`${t(a.integraciones.hoyEtiqueta)}.`);
  for (const x of lista(a.integraciones.hoy)) out.push(`- ${t(x.n)}. ${t(x.d)}`);
  out.push('');
  p(`${t(a.integraciones.rutaEtiqueta)}.`); ul(lista(a.integraciones.ruta)); p(t(a.integraciones.posicion));
  h2(t(a.faq.titulo));
  for (const q of lista(a.faq.items)) { out.push(`### ${t(q.q)}`, '', t(q.a), ''); }
  out.pop();
  h2(t(a.cierre.titulo)); p(t(a.cierre.texto)); p(t(a.cierre.precio));
  p(`${r.lang === 'es' ? 'Solicitar acceso' : 'Request access'}: ${r.urlAcceso}`);
  return out;
}

/** Cuerpo Markdown de una página interna, desde su árbol publicado. */
function cuerpoPagina(f, r) {
  const a = f.arbol, t = r.t, out = [`# ${t(a.h1)}`, '', t(a.subtitulo), ''];
  for (const b of lista(a.bloques)) {
    const tit = b.titulo ? t(b.titulo) : '';
    if (b.tipo === 'texto') {
      if (tit) out.push(`## ${tit}`, '');
      out.push(t(b.texto), '');
    } else if (b.tipo === 'preguntas') {
      if (tit) out.push(`## ${tit}`, '');
      for (const q of lista(b.items)) out.push(`### ${t(q.q)}`, '', t(q.a), '');
    } else if (b.tipo === 'matriz') {
      if (tit) out.push(`## ${tit}`, '');
      const cols = lista(b.columnas).map((c) => t(c));
      out.push(`| | ${cols.join(' | ')} |`, `| --- | ${cols.map(() => '---').join(' | ')} |`);
      for (const fila of lista(b.filas)) out.push(`| ${t(fila.t)} | ${lista(fila.celdas).map((c) => t(c)).join(' | ')} |`);
      out.push('');
    } else if (b.tipo === 'enlaces') {
      const filas = lista(b.items).map((it) => ({ it, l: r.enlace(it.href) })).filter((x) => x.l);
      if (filas.length === 0) continue;
      if (tit) out.push(`## ${tit}`, '');
      for (const { it, l } of filas) out.push(`- [${t(it.t)}](${l.url})${it.d ? `: ${t(it.d)}` : ''}`);
      out.push('');
    } else if (['lista', 'limites', 'tarjetas', 'principios', 'cifras', 'sellos'].includes(b.tipo)) {
      if (tit) out.push(`## ${tit}`, '');
      for (const it of lista(b.items)) out.push(item(it, r));
      out.push('');
    } else {
      throw new Error(`BLOQUE_DESCONOCIDO_EN_MD: ${b.tipo} (${f.id})`);
    }
  }
  if (a.rotulo) out.push(`_${t(a.rotulo)}_`, '');
  return out;
}

function frente(f, lang, r, extra = {}) {
  const otro = lang === 'es' ? 'en' : 'es';
  const filas = {
    title: f.titulo[lang],
    description: f.descripcion[lang],
    url: r.abs(f),
    canonical_url: r.abs(f),
    alternate_language_url: f.ruta[otro] === '/' ? BASE : `${BASE}${f.ruta[otro]}`,
    language: lang === 'es' ? 'es-MX' : 'en',
    type: f.id === 'inicio' ? 'landing' : f.tipo,
    ...(f.mod ? { last_modified: f.mod } : {}),
    robots: 'noindex',
    ...extra,
  };
  return ['---', ...Object.entries(filas).map(([k, v]) => `${k}: ${String(v).replace(/\n/g, ' ')}`), '---', ''].join('\n');
}

/** Espejo Markdown completo de una página (frente más cuerpo). */
export function espejoMd(f, lang, fichas) {
  const r = crearRender(fichas, lang);
  const cuerpo = f.id === 'inicio' ? cuerpoPortada(f, r) : cuerpoPagina(f, r);
  const otras = fichas.filter((x) => x.indexable && x.id !== f.id && x.id !== 'inicio');
  const mas = f.id === 'inicio' && otras.length ? ['', `## ${ETIQ[lang].mas}`, '', ...otras.map((x) => `- [${x.h1[lang]}](${r.abs(x)})`), ''] : [];
  return `${frente(f, lang, r)}\n${[...cuerpo, ...mas].join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

// ---------------------------------------------------------------- llms.txt y llms-full.txt

const SECCIONES_LLMS = {
  es: [['Producto', (f) => f.tipo === 'indice' && f.id === 'producto' || f.tipo === 'producto'], ['Casos de uso', (f) => f.id === 'casos-de-uso' || f.tipo === 'rol'], ['Empresa y contacto', (f) => ['institucional', 'contacto', 'legal'].includes(f.tipo)], ['Blog', (f) => f.tipo === 'blog-indice' || f.tipo === 'articulo']],
  en: [['Product', (f) => f.tipo === 'indice' && f.id === 'producto' || f.tipo === 'producto'], ['Use cases', (f) => f.id === 'casos-de-uso' || f.tipo === 'rol'], ['Company and contact', (f) => ['institucional', 'contacto', 'legal'].includes(f.tipo)], ['Blog', (f) => f.tipo === 'blog-indice' || f.tipo === 'articulo']],
};

function resumen(fichas, lang) {
  const inicio = fichas.find((f) => f.id === 'inicio'), a = inicio.arbol, r = crearRender(fichas, lang);
  return `${r.t(a.seo.pagina.descripcion)} ${r.t(a.hero.limite)}`;
}

/** llms.txt de un idioma: H1, cita con el resumen, secciones H2 con enlaces absolutos a URLs que responden 200. */
export function llmsTxt(fichas, lang, espejos) {
  const r = crearRender(fichas, lang), inicio = fichas.find((f) => f.id === 'inicio'), a = inicio.arbol;
  const L = lang === 'es'
    ? { notas: 'Notas para quien cite este sitio.', portada: 'Portada en Markdown', html: 'Portada en HTML', full: 'Contenido completo en un solo archivo', fullD: 'La portada y cada página publicada, en texto plano.', otro: 'Home in English', otroD: 'The same site in English.', opc: 'Opcional', mapa: 'Mapa del sitio', mapaD: 'URLs públicas con fecha de última modificación.', ref: 'Referencia completa' }
    : { notas: 'Notes for anyone citing this site.', portada: 'Home page in Markdown', html: 'Home page in HTML', full: 'Full content in a single file', fullD: 'The home page and every published page, in plain text.', otro: 'Versión en español', otroD: 'El mismo sitio en español.', opc: 'Optional', mapa: 'Sitemap', mapaD: 'Public URLs with their last-modified date.', ref: 'Full reference' };
  const reglas = lista(a.puente.reglas).map((x) => r.t(x)).join(' ');
  const out = ['# Rovaq AI', '', `> ${resumen(fichas, lang)}`, '', `${L.notas} ${reglas} ${r.t(a.cierre.precio)}`, ''];
  out.push(`## ${lang === 'es' ? 'Portada' : 'Home'}`, '', `- [${L.portada}](${BASE}${espejos('inicio', lang)}): ${r.t(a.hero.subtitulo)}`, `- [${L.html}](${BASE}${lang === 'es' ? '' : '/en'}): ${lang === 'es' ? 'La página tal como se ve en el navegador.' : 'The page as it appears in the browser.'}`, '');
  for (const [titulo, filtro] of SECCIONES_LLMS[lang]) {
    const filas = fichas.filter((f) => f.indexable && f.id !== 'inicio' && filtro(f));
    if (filas.length === 0) continue;
    out.push(`## ${titulo}`, '');
    for (const f of filas) {
      const ruta = espejos(f.id, lang);
      if (!ruta) continue;
      out.push(`- [${f.h1[lang]}](${BASE}${ruta}): ${f.descripcion[lang]}`);
    }
    out.push('');
  }
  const ruta = (l) => (l === 'es' ? '/llms-full.txt' : '/en/llms-full.txt');
  out.push(`## ${L.ref}`, '', `- [${L.full}](${BASE}${ruta(lang)}): ${L.fullD}`, `- [${L.otro}](${BASE}${lang === 'es' ? '/en/llms.txt' : '/llms.txt'}): ${L.otroD}`, '');
  out.push(`## ${L.opc}`, '', `- [${L.mapa}](${BASE}/sitemap.xml): ${L.mapaD}`, '');
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

/** llms-full.txt: resumen, la portada completa y cada página publicada, con los encabezados bajados un nivel. */
export function llmsFullTxt(fichas, lang) {
  const r = crearRender(fichas, lang), publicas = fichas.filter((f) => f.indexable);
  const mod = publicas.map((f) => f.mod).filter(Boolean).sort().at(-1);
  const bajar = (md) => md.split('\n').map((l) => (/^#{1,5} /.test(l) ? `#${l}` : l)).join('\n');
  const cuerpo = (f) => {
    const md = espejoMd(f, lang, fichas);
    return md.slice(md.indexOf('\n---\n', 4) + 5).trim();
  };
  const out = ['# Rovaq AI', '', `> ${resumen(fichas, lang)}`, ''];
  if (mod) out.push(`${ETIQ[lang].actualizado}: ${mod}.`, '');
  const inicio = publicas.find((f) => f.id === 'inicio');
  out.push('---', '', bajar(cuerpo(inicio)), '');
  for (const f of publicas.filter((x) => x.id !== 'inicio')) out.push('---', '', `Fuente: ${r.abs(f)}`, '', bajar(cuerpo(f)), '');
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

// ---------------------------------------------------------------- conjunto de archivos

const hash8 = (s) => sha(s).slice(0, 8);
const ordenar = (x) => (Array.isArray(x) ? x.map(ordenar) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, ordenar(x[k])])) : x);
const brotli = (b) => brotliCompressSync(b, { params: { [zc.BROTLI_PARAM_QUALITY]: 11, [zc.BROTLI_PARAM_MODE]: zc.BROTLI_MODE_TEXT } }).length;

/**
 * Todo lo que esta herramienta produce, sin tocar el disco:
 *   archivos  Map ruta relativa a public/ -> contenido (espejos con hash, index.md, llms*)
 *   md        sección md del manifest { 'es/hoy': { url, bytes, sha256, brotli } }
 */
export function producir({ fichas, ctx }) {
  const archivos = new Map(), md = {};
  const publicas = fichas.filter((f) => f.indexable);
  for (const f of publicas) {
    for (const lang of IDIOMAS) {
      const texto = espejoMd(f, lang, fichas);
      if (f.id === 'inicio') { archivos.set(lang === 'es' ? 'index.md' : 'en/index.md', texto); continue; }
      const nombre = `s/md/${lang}/${f.id}.${hash8(texto)}.md`;
      archivos.set(nombre, texto);
      const buf = Buffer.from(texto);
      md[`${lang}/${f.id}`] = { url: `/${nombre}`, bytes: buf.length, sha256: sha(buf), brotli: brotli(buf), hash: hash8(texto) };
    }
  }
  const espejos = (id, lang) => (id === 'inicio' ? (lang === 'es' ? '/index.md' : '/en/index.md') : md[`${lang}/${id}`]?.url ?? null);
  for (const lang of IDIOMAS) {
    archivos.set(lang === 'es' ? 'llms.txt' : 'en/llms.txt', llmsTxt(fichas, lang, espejos));
    archivos.set(lang === 'es' ? 'llms-full.txt' : 'en/llms-full.txt', llmsFullTxt(fichas, lang));
  }
  // security.txt (RFC 9116) solo se publica cuando existen el buzón de seguridad y la fecha de revisión: hoy ninguno de los dos.
  if (ctx?.seguridad && ctx?.fechaRevision) archivos.set('.well-known/security.txt', plantillaSecurityTxt({ correo: ctx.seguridad, expira: ctx.fechaRevision, base: BASE }));
  return { archivos, md, espejos };
}

function listarMd() {
  const dir = join(PUB, 's', 'md');
  if (!existsSync(dir)) return [];
  const rec = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? rec(p) : [p]; });
  return rec(dir).map((p) => relative(PUB, p).split('\\').join('/'));
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--fechas')) {
    const fechas = await calcularFechas();
    writeFileSync(ARCHIVO_FECHAS, `${JSON.stringify(fechas, null, 1)}\n`);
    console.log(`fechas.json: ${Object.keys(fechas).length} páginas`);
    return;
  }
  const { fichas, ctx } = await cargarSitio();
  const { archivos, md } = producir({ fichas, ctx });
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const manifestNuevo = ordenar({ ...manifest, md });
  const textoManifest = `${JSON.stringify(manifestNuevo, null, 1)}\n`;
  const diferencias = [];
  for (const [ruta, texto] of archivos) {
    const p = join(PUB, ruta);
    if (!existsSync(p) || readFileSync(p, 'utf8') !== texto) diferencias.push(ruta);
  }
  for (const ruta of listarMd()) if (!archivos.has(ruta)) diferencias.push(`${ruta} (sobra)`);
  if (readFileSync(MANIFEST, 'utf8') !== textoManifest) diferencias.push('s/manifest.json (sección md)');
  if (!archivos.has('.well-known/security.txt') && existsSync(join(PUB, '.well-known', 'security.txt'))) diferencias.push('.well-known/security.txt (no debe publicarse sin buzón y fecha)');
  if (args.has('--verificar')) {
    if (diferencias.length) { console.error(`Desfasado respecto al contenido:\n  ${diferencias.join('\n  ')}\nCorrer: node tools/sitio/generar-md.mjs`); process.exit(1); }
    console.log(`OK: ${archivos.size} archivos al día.`);
    return;
  }
  for (const ruta of listarMd()) if (!archivos.has(ruta)) rmSync(join(PUB, ruta));
  for (const [ruta, texto] of archivos) { mkdirSync(dirname(join(PUB, ruta)), { recursive: true }); writeFileSync(join(PUB, ruta), texto); }
  writeFileSync(MANIFEST, textoManifest);
  console.log(`Escritos ${archivos.size} archivos y la sección md del manifest (${Object.keys(md).length} entradas).`);
  if (diferencias.some((d) => d.startsWith('.well-known/security.txt'))) console.log('Aviso: public/.well-known/security.txt existe y no debería publicarse todavía (retirarlo con git rm).');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
