// T2: SEO del sitio público. Metadatos, hreflang, Open Graph, JSON-LD, sitemap, robots por host y RSS.
// Todo con node:test sobre las funciones puras y el contenido real (sin servidor): correr con  node --test tests/sitio/seo.test.mjs  (Node 22.18 o posterior).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarSitio } from '../../../../tools/sitio/generar-md.mjs';
import {
  ALT_SOCIAL, HREFLANG, THEME_COLOR, alternos, entradasSitemap, fichasPublicas, metadatosSitio, rutaEspejo, urlAbsoluta, urlSocial, viewportSitio,
} from '../../src/lib/sitio/metadatos.mjs';
import { LOGO_CUADRADO, LOGO_HORIZONTAL, grafoDePagina, serializar } from '../../src/lib/sitio/jsonld.mjs';
import { rssXml } from '../../src/lib/sitio/rss.mjs';
import { BOTS_BLOQUEADOS, BOTS_BUSQUEDA_Y_AGENTES, BOTS_ENTRENAMIENTO, DISALLOW_SITIO, robotsParaHost } from '../../config/sitio/agentic.mjs';
import { estadoPagina } from '../../src/lib/sitio/marcadores.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(aqui, '..', '..');
const BASE = 'https://rovaq.ai';
const sitio = await cargarSitio();
const { fichas, PAGINAS_INTERNAS, aprobaciones, M } = sitio;
const publicas = fichasPublicas(fichas);
const IDIOMAS = ['es', 'en'];
const largo = (s) => [...s].length;
const RE_CORREO = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PROHIBIDAS = JSON.parse(fs.readFileSync(path.join(aqui, 'prohibidas.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(WEB, 'public', 's', 'manifest.json'), 'utf8'));

function conjunto(f, lang) {
  return metadatosSitio({ id: f.id, lang, titulo: f.titulo[lang], descripcion: f.descripcion[lang], indexable: f.indexable, espejo: rutaEspejo(f.id, lang, manifest.md) });
}

describe('fichas y estado de publicación', () => {
  test('una ficha por página del registro, con la portada siempre publicable', () => {
    assert.equal(fichas.length, 34);
    assert.equal(new Set(fichas.map((f) => f.id)).size, 34);
    assert.equal(fichas.find((f) => f.id === 'inicio').indexable, true);
  });
  test('indexable coincide con estadoPagina de T11 y las pendientes no llevan árbol', () => {
    for (const f of fichas.filter((x) => x.id !== 'inicio')) {
      const contenido = PAGINAS_INTERNAS.find((p) => (p.id.split('/').pop()) === f.id || p.id === f.id);
      const esperado = contenido ? estadoPagina(contenido, { aprobaciones, ctx: sitio.ctx }).publicable : false;
      assert.equal(f.indexable, esperado, f.id);
      assert.equal(f.arbol !== null, esperado, `${f.id}: árbol solo si es publicable`);
      if (!esperado) assert.ok(f.motivos.length > 0, `${f.id}: una página no publicable explica por qué`);
    }
  });
  test('hay páginas publicables y páginas pendientes (el sitemap tiene algo que excluir)', () => {
    assert.ok(publicas.length >= 2);
    assert.ok(fichas.some((f) => !f.indexable));
  });
});

describe('títulos y descripciones', () => {
  test('título de 50 a 60 caracteres; la portada de 45 a 60 (decidido: posventa mide 47 y 45)', () => {
    const malos = [];
    for (const f of publicas) for (const l of IDIOMAS) {
      const n = largo(f.titulo[l]);
      if (n < (f.id === 'inicio' ? 45 : 50) || n > 60) malos.push(`${f.id}.${l}: ${n}`);
    }
    assert.deepEqual(malos, []);
  });
  test('el título de la portada es el de posventa decidido', () => {
    const t = fichas.find((f) => f.id === 'inicio').titulo;
    assert.equal(t.es, 'Rovaq AI | Inteligencia de ingresos de posventa');
    assert.equal(largo(t.es), 47);
    assert.equal(t.en, 'Rovaq AI | Post-Purchase Revenue Intelligence');
    assert.equal(largo(t.en), 45);
  });
  test('descripción de 140 a 155 caracteres', () => {
    const malas = [];
    for (const f of publicas) for (const l of IDIOMAS) {
      const n = largo(f.descripcion[l]);
      if (n < 140 || n > 155) malas.push(`${f.id}.${l}: ${n}`);
    }
    assert.deepEqual(malas, []);
  });
  test('ningún título ni descripción se repite dentro de un idioma, y los metadatos los usan tal cual', () => {
    for (const l of IDIOMAS) for (const campo of ['titulo', 'descripcion']) {
      const vistos = new Set(publicas.map((f) => f[campo][l]));
      assert.equal(vistos.size, publicas.length, `${campo} repetido en ${l}`);
    }
    for (const f of publicas) for (const l of IDIOMAS) {
      const m = conjunto(f, l);
      assert.equal(m.title.absolute, f.titulo[l]);
      assert.equal(m.description, f.descripcion[l]);
      assert.equal(m.openGraph.title, f.titulo[l]);
      assert.equal(m.twitter.description, f.descripcion[l]);
    }
  });
});

describe('canonical y hreflang', () => {
  test('canonical absoluto, propio de cada idioma y sin barra final salvo el origen pelado', () => {
    for (const f of publicas) for (const l of IDIOMAS) {
      const c = conjunto(f, l).alternates.canonical;
      assert.match(c, /^https:\/\/rovaq\.ai(\/|\/[^?#\s]*[^/?#\s])$/, `${f.id}.${l}: ${c}`);
      assert.equal(c, urlAbsoluta(f.ruta[l]));
      assert.ok(!c.includes('?') && !c.includes('#'));
    }
    assert.equal(conjunto(fichas[0], 'es').alternates.canonical, `${BASE}/`);
    assert.equal(conjunto(fichas[0], 'en').alternates.canonical, `${BASE}/en`);
  });
  test('hreflang es-MX, en y x-default, recíprocos: cada idioma lista a los dos y se incluye a sí mismo', () => {
    for (const f of publicas) {
      const es = conjunto(f, 'es').alternates, en = conjunto(f, 'en').alternates;
      assert.deepEqual(es.languages, en.languages, `${f.id}: los dos idiomas declaran el mismo conjunto`);
      assert.deepEqual(Object.keys(es.languages).sort(), ['en', 'es-MX', 'x-default']);
      assert.equal(es.languages['es-MX'], es.canonical, `${f.id}: el español se incluye a sí mismo`);
      assert.equal(en.languages.en, en.canonical, `${f.id}: el inglés se incluye a sí mismo`);
      assert.equal(es.languages['x-default'], es.languages['es-MX']);
    }
  });
  test('una página no indexable declara solo su canonical, sin hreflang hacia una página que no se indexa', () => {
    const pendiente = fichas.find((f) => !f.indexable);
    const m = metadatosSitio({ id: pendiente.id, lang: 'es', titulo: 'x', descripcion: 'y', indexable: false });
    assert.ok(m.alternates.canonical.startsWith(BASE));
    assert.equal(m.alternates.languages, undefined);
    assert.equal(m.alternates.types, undefined, 'sin espejo Markdown');
    assert.equal(m.robots.index, false);
    assert.equal(m.robots.follow, false);
  });
  test('los hreflang del sitemap son los mismos de los metadatos', () => {
    for (const e of entradasSitemap(fichas)) {
      const f = publicas.find((x) => IDIOMAS.some((l) => urlAbsoluta(x.ruta[l]) === e.url));
      assert.deepEqual(e.alternates.languages, alternos(f));
    }
  });
});

describe('Open Graph, Twitter, robots, íconos y tema', () => {
  test('Open Graph por idioma y por página, con imagen social de 1200 por 630', () => {
    for (const f of publicas) for (const l of IDIOMAS) {
      const og = conjunto(f, l).openGraph, otro = l === 'es' ? 'en' : 'es';
      assert.equal(og.url, urlAbsoluta(f.ruta[l]));
      assert.equal(og.locale, l === 'es' ? 'es_MX' : 'en_US');
      assert.deepEqual(og.alternateLocale, [otro === 'es' ? 'es_MX' : 'en_US']);
      assert.equal(og.siteName, 'Rovaq AI');
      assert.equal(og.images.length, 1);
      assert.deepEqual([og.images[0].url, og.images[0].width, og.images[0].height], [urlSocial(l), 1200, 630]);
      assert.equal(og.images[0].alt, ALT_SOCIAL[l]);
    }
    assert.equal(urlSocial('es'), `${BASE}/og/es.png`);
  });
  test('Twitter: summary_large_image con la misma imagen', () => {
    for (const f of publicas) for (const l of IDIOMAS) {
      const t = conjunto(f, l).twitter;
      assert.equal(t.card, 'summary_large_image');
      assert.equal(t.images[0].url, urlSocial(l));
    }
  });
  test('robots por estado de publicación: index con vista previa grande si se publica, noindex si no', () => {
    const r = conjunto(publicas[0], 'es').robots;
    assert.equal(r.index, true);
    assert.equal(r.googleBot['max-image-preview'], 'large');
    assert.equal(metadatosSitio({ id: 'estado', lang: 'en', titulo: 't', descripcion: 'd', indexable: false }).robots.index, false);
  });
  test('texto alternativo social sin cifras ni superlativos', () => {
    for (const l of IDIOMAS) assert.doesNotMatch(ALT_SOCIAL[l], /\d|!|\(|\)/);
  });
  test('íconos y manifest declarados existen en public/', () => {
    const m = conjunto(publicas[0], 'es');
    for (const i of [...m.icons.icon, ...m.icons.apple]) assert.ok(fs.existsSync(path.join(WEB, 'public', i.url.slice(1))), i.url);
    const mf = JSON.parse(fs.readFileSync(path.join(WEB, 'public', 'sitio.webmanifest'), 'utf8'));
    assert.equal(m.manifest, '/sitio.webmanifest');
    assert.ok(!('shortcuts' in mf), 'el manifest del sitio no lleva atajos a la app');
    for (const i of mf.icons) assert.ok(fs.existsSync(path.join(WEB, 'public', i.src.slice(1))), i.src);
  });
  test('theme-color claro y oscuro, con los valores de los tokens', () => {
    assert.deepEqual(viewportSitio.themeColor.map((c) => c.media), ['(prefers-color-scheme: light)', '(prefers-color-scheme: dark)']);
    const tokens = fs.readFileSync(path.join(WEB, 'src', 'styles', 'sitio', 'tokens.css'), 'utf8');
    assert.match(tokens, new RegExp(`--s-c-tinta:\\s*${THEME_COLOR.oscuro}`, 'i'));
    assert.match(tokens, new RegExp(`--s-c-hueso:\\s*${THEME_COLOR.claro}`, 'i'), 'el claro es el hueso de los tokens');
  });
  test('el layout del sitio exporta viewport y las páginas conectan metadatos y JSON-LD', () => {
    const lee = (r) => fs.readFileSync(path.join(WEB, r), 'utf8');
    assert.match(lee('src/app/(sitio)/sitio/[lang]/layout.tsx'), /export const viewport = viewportSitio/);
    for (const r of ['src/app/(sitio)/sitio/[lang]/page.tsx', 'src/app/(sitio)/sitio/[lang]/[...ruta]/page.tsx']) {
      assert.match(lee(r), /<JsonLd /);
      assert.match(lee(r), /metadatosPagina\(/);
    }
    assert.doesNotMatch(lee('src/components/sitio/shell/metadatos.ts'), /TODO-T2/);
  });
});

describe('JSON-LD', () => {
  const faqDe = (f, l) => (f.arbol?.faq?.items ?? []).map((x) => ({ q: x.q[l], a: x.a[l] }));
  const grafo = (id, l) => grafoDePagina(id, l, { fichas, faq: id === 'inicio' ? faqDe(fichas[0], l) : [] });

  test('la portada lleva Organization, WebSite, WebPage, SoftwareApplication y FAQPage', () => {
    for (const l of IDIOMAS) {
      const g = grafo('inicio', l);
      assert.equal(g['@context'], 'https://schema.org');
      assert.deepEqual(g['@graph'].map((n) => n['@type']), ['Organization', 'WebSite', 'WebPage', 'SoftwareApplication', 'FAQPage']);
    }
  });
  test('las demás páginas llevan Organization, WebPage (o su subtipo) y BreadcrumbList con la cadena real', () => {
    for (const f of publicas.filter((x) => x.id !== 'inicio')) for (const l of IDIOMAS) {
      const g = grafo(f.id, l)['@graph'];
      assert.equal(g[0]['@type'], 'Organization');
      assert.ok(['WebPage', 'AboutPage', 'ContactPage'].includes(g[1]['@type']), f.id);
      const miga = g.find((n) => n['@type'] === 'BreadcrumbList');
      const items = miga.itemListElement;
      assert.equal(items[0].item, `${BASE}${l === 'es' ? '/' : '/en'}`.replace(/\/en$/, '/en'));
      assert.equal(items.at(-1).item, urlAbsoluta(f.ruta[l]));
      assert.deepEqual(items.map((i) => i.position), items.map((_, i) => i + 1));
      assert.equal(g[1].breadcrumb['@id'], miga['@id']);
    }
  });
  test('ids únicos por grafo y estables entre idiomas', () => {
    for (const f of publicas) for (const l of IDIOMAS) {
      const ids = grafo(f.id, l)['@graph'].map((n) => n['@id']).filter(Boolean);
      assert.equal(new Set(ids).size, ids.length, `${f.id}.${l}`);
    }
    const a = grafo('inicio', 'es')['@graph'][0]['@id'], b = grafo('inicio', 'en')['@graph'][0]['@id'];
    assert.equal(a, b);
    assert.equal(a, `${BASE}/#organizacion`);
  });
  test('FAQPage: las preguntas son las visibles, con texto idéntico, y quedan fuera las que llevan un correo', () => {
    for (const l of IDIOMAS) {
      const visibles = faqDe(fichas[0], l);
      assert.ok(visibles.length >= 9, 'la portada publica las nueve preguntas');
      const faq = grafo('inicio', l)['@graph'].find((n) => n['@type'] === 'FAQPage');
      const esperadas = visibles.filter(({ q, a }) => !RE_CORREO.test(`${q} ${a}`));
      assert.ok(esperadas.length < visibles.length, 'hay una pregunta con el buzón: debe quedar fuera');
      assert.deepEqual(faq.mainEntity.map((x) => [x.name, x.acceptedAnswer.text]), esperadas.map((x) => [x.q, x.a]));
    }
  });
  test('Organization: logotipo con la altura real del archivo y sin correo ni contactPoint', () => {
    const png = fs.readFileSync(path.join(WEB, 'public', LOGO_HORIZONTAL.ruta.slice(1)));
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [LOGO_HORIZONTAL.ancho, LOGO_HORIZONTAL.alto]);
    const sq = fs.readFileSync(path.join(WEB, 'public', LOGO_CUADRADO.ruta.slice(1)));
    assert.deepEqual([sq.readUInt32BE(16), sq.readUInt32BE(20)], [LOGO_CUADRADO.ancho, LOGO_CUADRADO.alto]);
    const org = grafo('inicio', 'es')['@graph'][0];
    assert.equal(org.logo.height, 512);
    assert.equal(org.image.height, 167);
    assert.ok(!('email' in org) && !('contactPoint' in org));
  });
  test('SoftwareApplication con la descripción verdadera: la de la portada, sin precios ni valoraciones', () => {
    for (const l of IDIOMAS) {
      const app = grafo('inicio', l)['@graph'].find((n) => n['@type'] === 'SoftwareApplication');
      assert.equal(app.description, fichas[0].descripcion[l]);
      assert.equal(app.applicationCategory, 'BusinessApplication');
      for (const prohibido of ['offers', 'aggregateRating', 'review', 'price', 'featureList']) assert.ok(!(prohibido in app), prohibido);
    }
  });
  test('ningún grafo trae ofertas, valoraciones, reseñas, precios, nombre anterior ni correo; todo se serializa sin cerrar el script', () => {
    for (const f of publicas) for (const l of IDIOMAS) {
      const texto = serializar(grafo(f.id, l));
      assert.doesNotMatch(texto, /"offers"|aggregateRating|"@type":"Review"|"price"|"priceCurrency"/);
      assert.doesNotMatch(texto, /vexa/i, 'nombre anterior');
      assert.doesNotMatch(texto, RE_CORREO, `${f.id}.${l}: correo`);
      assert.ok(!texto.includes('</'), 'se escapa <');
      assert.doesNotThrow(() => JSON.parse(texto));
    }
  });
  test('ningún grafo contiene una afirmación prohibida (las 45 y las adicionales)', () => {
    const ctx = new RegExp(PROHIBIDAS.contextoSeguro, PROHIBIDAS.banderas);
    // Misma ventana que contenido.test.mjs: la oración de la coincidencia y sus vecinas.
    const oraciones = (t) => [...t.matchAll(/[^.!?\n]+[.!?]?/gu)].map((m) => ({ ini: m.index, fin: m.index + m[0].length, texto: m[0] }));
    const todas = [...PROHIBIDAS.afirmaciones.filter((a) => a.regla !== 'estructural'), ...PROHIBIDAS.adicionales];
    const malas = [];
    for (const f of publicas) for (const l of IDIOMAS) {
      const g = grafo(f.id, l)['@graph'];
      // Solo el texto: nombres y descripciones, no URLs.
      // Pregunta y respuesta forman una unidad: las preguntas que se responden con No no afirman nada.
      const textos = g.flatMap((n) => [n.name, n.description, n.headline, ...(n.mainEntity ?? []).map((q) => `${q.name} ${q.acceptedAnswer.text}`)]).filter(Boolean);
      const esPar = (t) => (g.find((n) => n.mainEntity)?.mainEntity ?? []).some((q) => t === `${q.name} ${q.acceptedAnswer.text}`);
      for (const t of textos) for (const a of todas) for (const p of a.patrones) {
        for (const m of t.matchAll(new RegExp(p, PROHIBIDAS.banderas.includes('g') ? PROHIBIDAS.banderas : `${PROHIBIDAS.banderas}g`))) {
          if (a.regla === 'negada') {
            if (esPar(t) && ctx.test(t)) continue; // una pregunta que se responde con una negación no afirma lo que nombra
            const os = oraciones(t), i = os.findIndex((x) => m.index >= x.ini && m.index < x.fin);
            if (i >= 0 && ctx.test(os.slice(Math.max(0, i - 1), i + 2).map((x) => x.texto).join(' '))) continue;
          }
          malas.push(`${f.id}.${l} #${a.n ?? a.id}: ${m[0]}`);
        }
      }
    }
    assert.deepEqual(malas, []);
  });
  test('un artículo sin fecha de publicación no emite BlogPosting', () => {
    const falso = { id: 'a1', tipo: 'articulo', padre: 'blog', indexable: true, ruta: { es: '/blog/x', en: '/en/blog/x' }, titulo: { es: 'T', en: 'T' }, descripcion: { es: 'D', en: 'D' }, h1: { es: 'H', en: 'H' }, mod: '2026-10-28', pub: null };
    const inicio = fichas[0];
    assert.throws(() => grafoDePagina('a1', 'es', { fichas: [inicio, falso] }), /fecha de publicación/);
    const con = { ...falso, pub: '2026-10-20', etiqueta: 'Producto' };
    const g = grafoDePagina('a1', 'es', { fichas: [inicio, con] })['@graph'];
    const art = g.find((n) => n['@type'] === 'BlogPosting');
    assert.equal(art.datePublished, '2026-10-20');
    assert.deepEqual(art.author, { '@id': `${BASE}/#organizacion` });
  });
});

describe('sitemap', () => {
  const entradas = entradasSitemap(fichas);
  test('dos entradas por página publicable y ninguna de una página pendiente', () => {
    assert.equal(entradas.length, publicas.length * 2);
    const urls = new Set(entradas.map((e) => e.url));
    for (const f of fichas) for (const l of IDIOMAS) assert.equal(urls.has(urlAbsoluta(f.ruta[l])), f.indexable, `${f.id}.${l}`);
  });
  test('lastmod real: fecha del contenido con formato ISO, no futura y estable entre llamadas', () => {
    const hoy = new Date().toISOString().slice(0, 10);
    for (const e of entradas) {
      assert.match(e.lastModified, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(e.lastModified <= hoy, `${e.url} con fecha futura`);
    }
    assert.deepEqual(entradasSitemap(fichas), entradas);
    const fuente = fs.readFileSync(path.join(WEB, 'src', 'app', 'sitemap.ts'), 'utf8');
    assert.doesNotMatch(fuente, /new Date\(/, 'sitemap.ts no calcula fechas');
  });
  test('fechas.json trae una fecha por página publicable y viene de git', () => {
    const fechas = JSON.parse(fs.readFileSync(path.join(WEB, 'config', 'sitio', 'fechas.json'), 'utf8'));
    for (const f of publicas) assert.match(fechas[f.id] ?? '', /^\d{4}-\d{2}-\d{2}$/, f.id);
  });
  test('cada entrada declara es-MX, en y x-default', () => {
    for (const e of entradas) assert.deepEqual(Object.keys(e.alternates.languages).sort(), ['en', 'es-MX', 'x-default']);
  });
  test('en app.rovaq.ai no hay sitemap (la fuente devuelve una lista vacía fuera del sitio)', () => {
    const fuente = fs.readFileSync(path.join(WEB, 'src', 'app', 'sitemap.ts'), 'utf8');
    assert.match(fuente, /if\(!ES_HOST_LANDING\(.*\)\)return \[\]/);
  });
});

describe('robots por host', () => {
  const planas = (rules) => rules.flatMap((r) => [r.userAgent].flat().map((ua) => ({ ua, allow: [r.allow ?? []].flat(), disallow: [r.disallow ?? []].flat() })));
  test('rovaq.ai: abre el sitio y cierra solo lo interno, y anuncia su sitemap', () => {
    for (const host of ['rovaq.ai', 'www.rovaq.ai', 'rovaq.ai:3000']) {
      const r = robotsParaHost(host, BASE);
      assert.equal(r.sitemap, `${BASE}/sitemap.xml`);
      const comodin = planas(r.rules).find((x) => x.ua === '*');
      assert.deepEqual(comodin.allow, ['/']);
      assert.deepEqual(comodin.disallow, ['/sitio/', '/api/', '/_next/data/']);
    }
  });
  test('los activos de /s/ y /og/ no se bloquean: Google debe cargar scripts, imágenes y la imagen social', () => {
    const r = robotsParaHost('rovaq.ai', BASE);
    for (const x of planas(r.rules).filter((p) => p.ua !== 'Bytespider')) {
      for (const ruta of ['/s/nube.js', '/s/img/hero.webp', '/og/es.png', '/landing/', '/vendor/lenis.js', '/producto/hoy', '/']) {
        assert.ok(!x.disallow.some((d) => ruta.startsWith(d)), `${x.ua} bloquea ${ruta}`);
      }
    }
    assert.deepEqual([...DISALLOW_SITIO], ['/sitio/', '/api/', '/_next/data/']);
  });
  test('política explícita por rastreador: búsqueda, agentes y entrenamiento permitidos; Bytespider cerrado', () => {
    const p = planas(robotsParaHost('rovaq.ai', BASE).rules);
    for (const bot of [...BOTS_BUSQUEDA_Y_AGENTES, ...BOTS_ENTRENAMIENTO]) {
      const x = p.find((q) => q.ua === bot);
      assert.ok(x, `${bot} sin regla`);
      assert.deepEqual(x.allow, ['/']);
      assert.ok(x.disallow.includes('/api/'));
    }
    for (const bot of BOTS_BLOQUEADOS) assert.deepEqual(p.find((q) => q.ua === bot).disallow, ['/']);
    const todos = p.map((q) => q.ua);
    assert.equal(new Set(todos).size, todos.length, 'rastreador repetido');
  });
  test('app.rovaq.ai y cualquier otro host: Disallow / y sin sitemap', () => {
    for (const host of ['app.rovaq.ai', 'rovaq-ai.vercel.app', 'localhost:3000', '', null, undefined]) {
      const r = robotsParaHost(host, BASE);
      assert.deepEqual(r.rules, [{ userAgent: '*', disallow: '/' }], String(host));
      assert.equal(r.sitemap, undefined);
    }
  });
  test('robots.ts delega en la decisión pura y usa el host reenviado', () => {
    const fuente = fs.readFileSync(path.join(WEB, 'src', 'app', 'robots.ts'), 'utf8');
    assert.match(fuente, /robotsParaHost\(h\.get\('x-forwarded-host'\)\?\?h\.get\('host'\)/);
  });
});

describe('RSS 2.0', () => {
  test('canal válido y vacío mientras no haya artículos publicados, en los dos idiomas', () => {
    for (const l of IDIOMAS) {
      const xml = rssXml({ lang: l, fichas });
      assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss version="2.0" xmlns:atom="http:\/\/www.w3.org\/2005\/Atom">/);
      assert.match(xml, new RegExp(`<language>${HREFLANG[l].toLowerCase()}</language>`));
      assert.match(xml, new RegExp(`<atom:link href="${BASE}${l === 'es' ? '' : '/en'}/blog/rss.xml" rel="self" type="application/rss\\+xml" />`));
      assert.ok(!xml.includes('<item>'), 'sin artículos no hay items');
      assert.match(xml, /<lastBuildDate>[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} 00:00:00 GMT<\/lastBuildDate>/);
      assert.match(xml, /<\/channel>\n<\/rss>\n$/);
    }
  });
  test('con un blog y un artículo publicados emite el item con fecha RFC 822 y escapa el texto', () => {
    const blog = { id: 'blog', tipo: 'blog-indice', indexable: true, ruta: { es: '/blog', en: '/en/blog' }, titulo: { es: 'B', en: 'B' }, descripcion: { es: 'Blog & noticias', en: 'Blog' }, h1: { es: 'B', en: 'B' }, mod: '2026-10-28' };
    const art = { id: 'a1', tipo: 'articulo', indexable: true, ruta: { es: '/blog/x', en: '/en/blog/x' }, titulo: { es: 'T', en: 'T' }, descripcion: { es: 'Uno <dos>', en: 'D' }, h1: { es: 'Título "x"', en: 'H' }, pub: '2026-10-20', etiqueta: 'Producto' };
    const xml = rssXml({ lang: 'es', fichas: [fichas[0], blog, art] });
    assert.match(xml, /<pubDate>Tue, 20 Oct 2026 00:00:00 GMT<\/pubDate>/);
    assert.match(xml, /<title>Título &quot;x&quot;<\/title>/);
    assert.match(xml, /<description>Uno &lt;dos&gt;<\/description>/);
    assert.match(xml, /<guid isPermaLink="true">https:\/\/rovaq\.ai\/blog\/x<\/guid>/);
    assert.match(xml, /<description>Blog &amp; noticias<\/description>/);
  });
  test('los artículos pendientes no entran al canal', () => {
    const pendiente = { id: 'a2', tipo: 'articulo', indexable: false, ruta: { es: '/blog/y', en: '/en/blog/y' }, titulo: { es: 'T', en: 'T' }, descripcion: { es: 'D', en: 'D' }, h1: { es: 'H', en: 'H' }, pub: '2026-10-20' };
    assert.ok(!rssXml({ lang: 'es', fichas: [...fichas, pendiente] }).includes('<item>'));
  });
  test('las dos rutas del canal existen como route handlers estáticos', () => {
    for (const r of ['src/app/(sitio)/blog/rss.xml/route.ts', 'src/app/(sitio)/en/blog/rss.xml/route.ts']) {
      const f = fs.readFileSync(path.join(WEB, r), 'utf8');
      assert.match(f, /force-static/);
      assert.match(f, /application\/rss\+xml/);
    }
  });
});

describe('imagen social y 404', () => {
  test('la ruta de la imagen social genera es.png y en.png en el build y no pone texto prohibido', () => {
    const f = fs.readFileSync(path.join(WEB, 'src', 'app', '(sitio)', 'og', '[archivo]', 'route.tsx'), 'utf8');
    assert.match(f, /generateStaticParams/);
    assert.match(f, /force-static/);
    assert.match(f, /width: 1200, height: 630/);
    assert.doesNotMatch(f, /style=\{\{[^}]*#E8241C|ROVAQ\.rojo\}[^<]*<\/div>/);
    // El único rojo es el punto del logotipo.
    assert.equal((f.match(/ROVAQ\.rojo/g) ?? []).length, 1);
  });
  test('el 404 del sitio es noindex', () => {
    const f = fs.readFileSync(path.join(WEB, 'src', 'app', '(sitio)', 'sitio', '[lang]', 'not-found.tsx'), 'utf8');
    assert.match(f, /robots: \{index: false/);
  });
  test('el contenido de la imagen sale de la portada publicada, sin cifras', () => {
    for (const l of IDIOMAS) {
      const titulo = sitio.LANDING.seo.pagina.titulo[l].split(' | ')[1];
      const apoyo = sitio.LANDING.seo.pagina.descripcion[l].split('. ')[1];
      assert.doesNotMatch(`${titulo} ${apoyo}`, /\d|!|\(|\)/);
    }
  });
});

describe('correo y marcadores', () => {
  test('el buzón de contacto no aparece en JSON-LD, humans.txt, sitio.webmanifest ni security.txt; y security.txt no se publica sin buzón y fecha', () => {
    const contacto = M.contextoPorDefecto().contacto;
    assert.ok(RE_CORREO.test(contacto));
    for (const r of ['public/humans.txt', 'public/sitio.webmanifest']) assert.ok(!fs.readFileSync(path.join(WEB, r), 'utf8').includes(contacto), r);
    assert.ok(!fs.existsSync(path.join(WEB, 'public', '.well-known', 'security.txt')), 'security.txt espera [CORREO_DE_SEGURIDAD] y [FECHA_DE_REVISION]');
    assert.equal(M.contextoPorDefecto().seguridad, null);
    assert.equal(M.contextoPorDefecto().fechaRevision, null);
  });
});
