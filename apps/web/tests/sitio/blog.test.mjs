// T24: blog y Estado. Tipo Articulo, funciones puras de lectura, publicación solo de artículos con contenido, RSS y sitemap, JSON-LD,
// paridad ES y EN, espejos Markdown y las dos páginas legales que siguen en 404. T32-Y: Estado se publica, a7 queda fuera del lanzamiento.
// Se corre con: node --test apps/web/tests/sitio/blog.test.mjs   (Node 22.18 o superior importa los .ts directamente)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarSitio, espejoMd } from '../../../../tools/sitio/generar-md.mjs';
import { PAGINAS, porId, rutaDe } from '../../src/content/sitio/registro.mjs';
import { PAGINAS_INTERNAS } from '../../src/content/sitio/paginas/index.ts';
import { ARTICULOS_A } from '../../src/content/sitio/paginas/blog-a.ts';
import { ARTICULOS_B } from '../../src/content/sitio/paginas/blog-b.ts';
import { ARTICULO_A1, BLOG_INDICE } from '../../src/content/sitio/paginas/blog.ts';
import { ESTADO } from '../../src/content/sitio/paginas/estado.ts';
import { FECHA_CONTENIDO } from '../../src/content/sitio/fecha-contenido.mjs';
import { articulo, b, h2, p } from '../../src/content/sitio/ayudas.ts';
import { construirFichas, entradasSitemap, fichasPublicas, metadatosSitio, urlAbsoluta } from '../../src/lib/sitio/metadatos.mjs';
import { grafoDePagina, serializar } from '../../src/lib/sitio/jsonld.mjs';
import { rssXml } from '../../src/lib/sitio/rss.mjs';
import { estadoPagina, hojas } from '../../src/lib/sitio/marcadores.mjs';
import {
  contarPalabras, esFechaIso, fechaLegible, idsEnlazados, minutosDeLectura, palabrasDeArticulo, partirEnlaces, partirNegrita, seccionesDe, sinEnlaces, sinNegrita, slug, textoPlano,
} from '../../src/lib/sitio/articulos.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(aqui, '..', '..');
const BASE = 'https://rovaq.ai';
const IDIOMAS = ['es', 'en'];
const sitio = await cargarSitio();
const { fichas, aprobaciones, LANDING, ctx } = sitio;
const fechas = JSON.parse(fs.readFileSync(path.join(WEB, 'config', 'sitio', 'fechas.json'), 'utf8'));
const articulosRegistro = PAGINAS.filter((x) => x.tipo === 'articulo');
const articulosConContenido = PAGINAS_INTERNAS.filter((x) => porId(x.id)?.tipo === 'articulo');
/** Los que salen en el lanzamiento: a7 queda pendiente de revisión (Responsable A y un abogado), con su texto escrito. */
const articulosPublicados = articulosConContenido.filter((x) => x.estado === 'publicable');
const ID_FUERA = 'a7';
const RE_CORREO = /[\w.+-]+@[\w-]+\.[\w.-]+/;

/** Un artículo mínimo y válido para probar la publicación con ids que aún no tienen contenido real. */
function articuloDePrueba(id, extra = {}) {
  return articulo({
    id,
    pub: '2026-11-04',
    seo: { titulo: b('Titulo de prueba | Rovaq AI', 'Test title | Rovaq AI'), descripcion: b('Descripcion de prueba', 'Test description') },
    h1: b(`Artículo ${id}`, `Article ${id}`),
    subtitulo: b('Bajada', 'Standfirst'),
    resumen: b('Resumen de prueba.', 'Test summary.'),
    relacionados: [],
    bloques: [p('Uno dos tres.', 'One two three.'), h2('Sección', 'Section'), p('Cuatro cinco.', 'Four five.')],
    ...extra,
  });
}
const fichasCon = (...extras) => construirFichas({ landing: LANDING, paginas: [...PAGINAS_INTERNAS, ...extras], aprobaciones, fechas, ctx });
/** Estado se publica (decisión de Javier, T32-Y): las fichas reales ya lo incluyen. */
const ESTADO_LISTO = ESTADO;
const fichasEstadoListo = () => fichas;

describe('funciones puras de lectura', () => {
  test('el tiempo de lectura se deriva del cuerpo: 200 palabras por minuto, hacia arriba, mínimo 1', () => {
    const n = (k) => [p(Array.from({ length: k }, () => 'palabra').join(' '), Array.from({ length: k }, () => 'word').join(' '))];
    assert.equal(minutosDeLectura(n(1), 'es'), 1);
    assert.equal(minutosDeLectura(n(200), 'es'), 1);
    assert.equal(minutosDeLectura(n(201), 'en'), 2);
    assert.equal(minutosDeLectura(n(1000), 'es'), 5);
    assert.equal(minutosDeLectura([], 'es'), 1);
  });

  test('las palabras no cuentan la sintaxis de enlace ni los signos sueltos', () => {
    assert.equal(contarPalabras('uno — dos , tres'), 3);
    assert.equal(sinEnlaces('mira la {{hoy|pantalla Hoy}} ahora'), 'mira la pantalla Hoy ahora');
    assert.deepEqual(idsEnlazados('a {{hoy|x}} y {{a2|y}}'), ['hoy', 'a2']);
    assert.deepEqual(partirEnlaces('a {{hoy|x}} b'), [{ texto: 'a ' }, { id: 'hoy', texto: 'x' }, { texto: ' b' }]);
    assert.equal(palabrasDeArticulo([p('mira {{hoy|la pantalla Hoy}} ya', 'x')], 'es'), 5);
    assert.equal(textoPlano([p('a {{hoy|b}}', 'c')], 'es'), 'a b');
  });

  test('las anclas de sección son estables, sin acentos y únicas', () => {
    assert.equal(slug('Cómo se lee un Pareto de reembolsos'), 'como-se-lee-un-pareto-de-reembolsos');
    assert.equal(slug('¿¡?!'), 'seccion');
    const bloques = [h2('Qué es', 'What'), p('x', 'y'), h2('Qué es', 'What'), h2('Otra', 'Other')];
    assert.deepEqual(seccionesDe(bloques, 'es').map((s) => s.id), ['que-es', 'que-es-2', 'otra']);
  });

  test('la fecha legible es la misma en cualquier zona horaria del build', () => {
    assert.equal(fechaLegible('2026-11-03', 'es'), '3 de noviembre de 2026');
    assert.equal(fechaLegible('2026-11-03', 'en'), 'November 3, 2026');
    assert.throws(() => fechaLegible('no-es-fecha', 'es'));
    assert.ok(esFechaIso('2026-11-03') && !esFechaIso('2026-13-03') && !esFechaIso('2026-02-30') && !esFechaIso('3/11/2026') && !esFechaIso(undefined));
  });
});

describe('estado de publicación de un artículo', () => {
  const estado = (a) => estadoPagina(a, { aprobaciones, ctx, tipo: 'articulo' });
  test('un artículo completo se publica y uno sin fecha, sin resumen, sin cuerpo o con autor distinto no', () => {
    assert.equal(estado(articuloDePrueba('a2')).publicable, true);
    assert.match(estado({ ...articuloDePrueba('a2'), pub: undefined }).motivos.join(), /fecha de publicación/);
    assert.match(estado({ ...articuloDePrueba('a2'), pub: '2026-02-30' }).motivos.join(), /fecha de publicación/);
    assert.match(estado({ ...articuloDePrueba('a2'), mod: 'ayer' }).motivos.join(), /modificación/);
    assert.match(estado({ ...articuloDePrueba('a2'), resumen: undefined }).motivos.join(), /resumen/);
    assert.match(estado({ ...articuloDePrueba('a2'), bloques: [] }).motivos.join(), /cuerpo/);
    assert.match(estado({ ...articuloDePrueba('a2'), autor: 'Ana Pérez' }).motivos.join(), /autor/);
  });
  test('un artículo pendiente de revisión no se publica aunque esté completo', () => {
    const e = estado({ ...articuloDePrueba('a2'), estado: 'pendiente-de-revision', pendiente: 'Espera la revisión de Javier' });
    assert.equal(e.publicable, false);
  });
  test('la misma exigencia no se aplica a las demás páginas: sin tipo articulo no se pide fecha', () => {
    assert.equal(estadoPagina(ESTADO_LISTO, { aprobaciones, ctx, tipo: 'institucional' }).publicable, true);
  });
  test('Estado es publicable y ya no lleva motivo pendiente', () => {
    assert.equal(ESTADO.estado, 'publicable');
    assert.ok(!('pendiente' in ESTADO));
    assert.equal(estadoPagina(ESTADO, { aprobaciones, ctx, tipo: 'institucional' }).publicable, true);
  });
  test('a7 queda pendiente de revisión con su motivo, aunque su texto esté completo', () => {
    const a7 = articulosConContenido.find((x) => x.id === ID_FUERA);
    assert.equal(a7.estado, 'pendiente-de-revision');
    assert.match(a7.pendiente, /revisión de Responsable A y de un abogado/);
    assert.equal(estado(a7).publicable, false);
  });
});

describe('artículos con y sin contenido', () => {
  test('cada artículo del registro tiene ficha: con contenido es publicable y sin contenido no, con el motivo', () => {
    assert.equal(articulosRegistro.length, 8);
    for (const reg of articulosRegistro) {
      const ficha = fichas.find((f) => f.id === reg.id);
      const contenido = PAGINAS_INTERNAS.find((x) => x.id === reg.id);
      if (contenido && contenido.estado === 'publicable') {
        assert.equal(ficha.publicable, true, `${reg.id}: ${ficha.motivos.join()}`);
        assert.equal(ficha.indexable, true);
        assert.ok(ficha.arbol);
        assert.equal(ficha.pub, contenido.pub);
      } else if (contenido) {
        assert.equal(reg.id, ID_FUERA, 'solo a7 está escrito y pendiente');
        assert.equal(ficha.publicable, false);
        assert.equal(ficha.indexable, false);
        assert.equal(ficha.arbol, null);
        assert.match(ficha.motivos.join(), /revisión de Responsable A y de un abogado/);
      } else {
        assert.equal(ficha.publicable, false, reg.id);
        assert.equal(ficha.indexable, false);
        assert.equal(ficha.arbol, null);
        assert.deepEqual(ficha.motivos, ['sin contenido escrito']);
      }
    }
  });

  test('a1 existe y los artículos de los redactores viven en archivos separados con los ids que les tocan', () => {
    assert.ok(PAGINAS_INTERNAS.some((x) => x.id === 'a1'));
    assert.deepEqual(ARTICULOS_A.map((x) => x.id).filter((id) => !['a2', 'a3', 'a4', 'a5'].includes(id)), [], 'blog-a.ts solo admite a2 a a5');
    assert.deepEqual(ARTICULOS_B.map((x) => x.id).filter((id) => !['a6', 'a7', 'a8'].includes(id)), [], 'blog-b.ts solo admite a6 a a8');
    const ids = PAGINAS_INTERNAS.map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length, 'ningún id repetido entre archivos');
  });

  test('un artículo registrado sin contenido no aparece ni en el índice, ni en el RSS, ni en el sitemap, ni en los espejos', () => {
    const sin = articulosRegistro.filter((r) => !PAGINAS_INTERNAS.some((x) => x.id === r.id));
    if (sin.length === 0) return; // cuando los ocho tengan contenido, esta comprobación ya no tiene qué vigilar
    const md = IDIOMAS.map((l) => espejoMd(fichas.find((f) => f.id === 'blog'), l, fichas)).join('\n');
    const rss = IDIOMAS.map((l) => rssXml({ lang: l, fichas })).join('\n');
    const mapa = entradasSitemap(fichas).map((e) => e.url).join('\n');
    for (const r of sin) for (const l of IDIOMAS) {
      const url = urlAbsoluta(r[l].ruta);
      assert.ok(!md.includes(url) && !rss.includes(url) && !mapa.includes(url), `${r.id}.${l} filtrado`);
    }
  });

  test('un artículo con contenido y fecha válida entra a los listados; sin fecha, no', () => {
    const con = articuloDePrueba('a2');
    const sinFecha = { ...articuloDePrueba('a3'), pub: undefined };
    const f = fichasCon(con, sinFecha);
    assert.equal(f.find((x) => x.id === 'a2').indexable, true);
    assert.equal(f.find((x) => x.id === 'a3').indexable, false);
    assert.match(f.find((x) => x.id === 'a3').motivos.join(), /fecha de publicación/);
    const mapa = entradasSitemap(f).map((e) => e.url);
    assert.ok(mapa.includes(urlAbsoluta(rutaDe('a2', 'es'))) && mapa.includes(urlAbsoluta(rutaDe('a2', 'en'))));
    assert.ok(!mapa.includes(urlAbsoluta(rutaDe('a3', 'es'))));
  });

  test('sin mod propio, la modificación de un artículo es su publicación; nunca anterior', () => {
    for (const f of fichas.filter((x) => x.tipo === 'articulo' && x.indexable)) assert.ok(f.mod >= f.pub, `${f.id}: mod ${f.mod} antes de pub ${f.pub}`);
    const f = fichasCon(articuloDePrueba('a2')).find((x) => x.id === 'a2');
    assert.equal(f.mod, '2026-11-04');
  });
});

describe('RSS y sitemap solo con lo publicable', () => {
  const publicados = fichas.filter((f) => f.tipo === 'articulo' && f.indexable);

  test('el RSS lista exactamente los artículos publicables, del más reciente al más antiguo, con su resumen', () => {
    for (const l of IDIOMAS) {
      const xml = rssXml({ lang: l, fichas });
      const guids = [...xml.matchAll(/<guid isPermaLink="true">([^<]+)<\/guid>/g)].map((m) => m[1]);
      assert.deepEqual(guids.sort(), publicados.map((f) => urlAbsoluta(f.ruta[l])).sort());
      for (const f of publicados) assert.ok(xml.includes(f.resumen[l].replace(/&/g, '&amp;')), `${f.id}: el item lleva el resumen`);
    }
    const f2 = fichasCon(articuloDePrueba('a2', { pub: '2026-12-01' }), articuloDePrueba('a3', { pub: undefined }));
    const xml = rssXml({ lang: 'es', fichas: f2 });
    const orden = [...xml.matchAll(/<guid isPermaLink="true">https:\/\/rovaq\.ai([^<]+)<\/guid>/g)].map((m) => m[1]);
    assert.equal(orden[0], rutaDe('a2', 'es'), 'el más reciente va primero');
    assert.ok(!xml.includes(rutaDe('a3', 'es')), 'un artículo sin fecha no entra');
    assert.match(xml, /<lastBuildDate>Tue, 01 Dec 2026 00:00:00 GMT<\/lastBuildDate>/);
  });

  test('el canal apunta al índice del blog y lo describe', () => {
    const xml = rssXml({ lang: 'es', fichas });
    assert.match(xml, new RegExp(`<channel>\\n    <title>Blog de Rovaq AI</title>\\n    <link>${BASE}/blog</link>`));
    assert.ok(xml.includes(BLOG_INDICE.seo.descripcion.es));
  });

  test('el sitemap incluye cada artículo publicable en los dos idiomas con hreflang y fecha, y ninguno pendiente', () => {
    const entradas = entradasSitemap(fichas);
    const urls = new Set(entradas.map((e) => e.url));
    for (const f of fichas.filter((x) => x.tipo === 'articulo')) for (const l of IDIOMAS) assert.equal(urls.has(urlAbsoluta(f.ruta[l])), f.indexable, `${f.id}.${l}`);
    for (const l of IDIOMAS) assert.ok(urls.has(urlAbsoluta(rutaDe('blog', l))), `blog.${l}`);
    for (const l of IDIOMAS) assert.ok(urls.has(urlAbsoluta(rutaDe('estado', l))), `estado.${l} en el sitemap`);
    for (const l of IDIOMAS) assert.ok(!urls.has(urlAbsoluta(rutaDe(ID_FUERA, l))), `${ID_FUERA}.${l} fuera del sitemap`);
    for (const e of entradas.filter((x) => publicados.some((f) => IDIOMAS.some((l) => urlAbsoluta(f.ruta[l]) === x.url)))) {
      assert.deepEqual(Object.keys(e.alternates.languages).sort(), ['en', 'es-MX', 'x-default']);
      assert.match(e.lastModified, /^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test('fechas.json trae una fecha para el índice del blog, Estado y cada artículo con contenido', () => {
    for (const id of ['blog', 'estado', ...articulosConContenido.map((x) => x.id)]) assert.match(fechas[id] ?? '', /^\d{4}-\d{2}-\d{2}$/, id);
  });
});

describe('el aviso de privacidad y los términos siguen sin contenido', () => {
  test('no tienen página escrita, no son publicables ni indexables y no están en el sitemap', () => {
    for (const id of ['aviso-de-privacidad', 'terminos']) {
      assert.ok(!PAGINAS_INTERNAS.some((x) => x.id === id), `${id} no debe tener contenido hasta que lo apruebe el abogado`);
      const f = fichas.find((x) => x.id === id);
      assert.equal(f.publicable, false);
      assert.equal(f.indexable, false);
      assert.deepEqual(f.motivos, ['sin contenido escrito']);
      const mapa = entradasSitemap(fichas).map((e) => e.url);
      for (const l of IDIOMAS) assert.ok(!mapa.includes(urlAbsoluta(rutaDe(id, l))));
    }
  });
});

describe('JSON-LD de blog, artículos y Estado', () => {
  const listas = fichasEstadoListo();
  const grafo = (id, lang) => JSON.parse(serializar(grafoDePagina(id, lang, { fichas: listas })));
  const tipos = (g) => g['@graph'].map((n) => n['@type']);

  test('cada página publicada del blog emite JSON válido con contexto y ids únicos que se resuelven', () => {
    for (const f of fichasEstadoListo().filter((x) => (x.tipo === 'articulo' || x.tipo === 'blog-indice' || x.id === 'estado') && x.indexable)) for (const l of IDIOMAS) {
      const g = grafo(f.id, l);
      assert.equal(g['@context'], 'https://schema.org');
      const ids = g['@graph'].map((n) => n['@id']).filter(Boolean);
      assert.equal(new Set(ids).size, ids.length, `${f.id}.${l}: @id repetidos`);
      const texto = JSON.stringify(g);
      for (const m of texto.matchAll(/"@id":"([^"]+)"/g)) assert.ok(m[1].startsWith(BASE), `${f.id}.${l}: @id fuera del sitio ${m[1]}`);
      assert.ok(!RE_CORREO.test(texto), `${f.id}.${l}: ni un correo en el JSON-LD`);
      assert.ok(!/"@type":"(?:Person|Offer|AggregateRating|Review)"/.test(texto), `${f.id}.${l}: sin personas, ofertas ni reseñas`);
    }
  });

  test('un artículo es un BlogPosting con fecha, autor y editor de la organización, y nunca una persona', () => {
    for (const f of fichas.filter((x) => x.tipo === 'articulo' && x.indexable)) for (const l of IDIOMAS) {
      const g = grafo(f.id, l)['@graph'];
      const post = g.find((n) => n['@type'] === 'BlogPosting');
      assert.ok(post, `${f.id}.${l}`);
      assert.match(post.datePublished, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(post.dateModified >= post.datePublished);
      assert.equal(post.headline, f.h1[l]);
      assert.ok(post.headline.length <= 110, 'el titular de un BlogPosting no pasa de 110 caracteres');
      assert.equal(post.inLanguage, l === 'es' ? 'es-MX' : 'en');
      assert.deepEqual(post.author, { '@id': `${BASE}/#organizacion` });
      assert.deepEqual(post.publisher, { '@id': `${BASE}/#organizacion` });
      assert.ok(g.some((n) => n['@id'] === post.author['@id']), 'el autor existe en el grafo');
      assert.equal(post.wordCount, f.palabras[l]);
      assert.equal(post.timeRequired, `PT${f.lectura[l]}M`);
      assert.equal(post.mainEntityOfPage, urlAbsoluta(f.ruta[l]));
      assert.ok(g.some((n) => n['@type'] === 'BreadcrumbList'));
    }
  });

  test('el índice es un Blog; Estado es una WebPage corriente, sin subtipo ni artículo', () => {
    for (const l of IDIOMAS) {
      assert.ok(tipos(grafo('blog', l)).includes('Blog'));
      const e = tipos(grafo('estado', l));
      assert.ok(e.includes('WebPage') && !e.includes('Blog') && !e.includes('BlogPosting') && !e.includes('AboutPage') && !e.includes('ContactPage'));
    }
  });

  test('sin fecha de publicación no se emite BlogPosting', () => {
    const f = fichasCon(articuloDePrueba('a2', { pub: undefined }));
    assert.throws(() => grafoDePagina('a2', 'es', { fichas: f }), /fecha de publicación/);
  });

  test('Open Graph de un artículo: tipo article con fecha de publicación y modificación', () => {
    const f = fichas.find((x) => x.id === 'a1');
    const m = metadatosSitio({ id: 'a1', lang: 'es', titulo: f.titulo.es, descripcion: f.descripcion.es, publicado: f.pub, modificado: f.mod });
    assert.equal(m.openGraph.type, 'article');
    assert.equal(m.openGraph.publishedTime, FECHA_CONTENIDO);
    assert.equal(m.openGraph.modifiedTime, f.mod);
    assert.equal(m.alternates.types['application/rss+xml'], `${BASE}/blog/rss.xml`);
    const sin = metadatosSitio({ id: 'estado', lang: 'es', titulo: 't', descripcion: 'd', publicado: FECHA_CONTENIDO });
    assert.equal(sin.openGraph.publishedTime, undefined, 'solo los artículos llevan fechas de artículo');
  });
});

describe('paridad ES y EN y forma de cada artículo', () => {
  const textos = (x) => hojas(x).map((h) => h.hoja);

  test('toda hoja de las páginas nuevas trae los dos idiomas con texto, y los mismos enlaces internos', () => {
    for (const pag of [BLOG_INDICE, ESTADO, ...articulosConContenido]) {
      for (const { ruta, hoja } of hojas(pag, pag.id)) {
        for (const l of IDIOMAS) assert.ok(hoja[l].trim().length > 0, `${ruta}.${l} vacía`);
        assert.deepEqual(idsEnlazados(hoja.es), idsEnlazados(hoja.en), `${ruta}: enlaces distintos entre idiomas`);
      }
    }
  });

  test('cada bloque del cuerpo trae sus dos idiomas, también cada elemento de una lista', () => {
    for (const a of articulosConContenido) for (const bl of a.bloques) {
      if (bl.items) {
        assert.ok(bl.items.length > 0, `${a.id}: lista vacía`);
        for (const it of bl.items) assert.ok(it.es && it.en, `${a.id}: elemento sin un idioma`);
      } else assert.ok(bl.texto?.es && bl.texto?.en, `${a.id}: bloque ${bl.tipo} sin un idioma`);
    }
  });

  test('cada artículo: de 900 a 1300 palabras por idioma, y los dos idiomas no difieren más de una cuarta parte', () => {
    for (const a of articulosConContenido) {
      const n = Object.fromEntries(IDIOMAS.map((l) => [l, palabrasDeArticulo(a.bloques, l)]));
      for (const l of IDIOMAS) assert.ok(n[l] >= 900 && n[l] <= 1300, `${a.id}.${l}: ${n[l]} palabras`);
      assert.ok(Math.abs(n.es - n.en) / Math.max(n.es, n.en) < 0.25, `${a.id}: ${n.es} contra ${n.en}`);
    }
  });

  test('cada artículo: autor organización, fecha ISO, resumen en dos idiomas, tres o más h2 con anclas únicas y relacionados que existen en el registro', () => {
    for (const a of articulosConContenido) {
      assert.equal(a.autor, 'organizacion', a.id);
      assert.ok(esFechaIso(a.pub), a.id);
      if (a.mod) assert.ok(esFechaIso(a.mod) && a.mod >= a.pub, `${a.id}: mod`);
      assert.ok(a.resumen.es.length > 80 && a.resumen.en.length > 80, `${a.id}: resumen`);
      for (const l of IDIOMAS) {
        const s = seccionesDe(a.bloques, l);
        assert.ok(s.filter((x) => x.nivel === 2).length >= 3, `${a.id}.${l}: al menos tres h2`);
        assert.equal(new Set(s.map((x) => x.id)).size, s.length, `${a.id}.${l}: anclas repetidas`);
      }
      assert.ok(Array.isArray(a.relacionados) && a.relacionados.length >= 1, `${a.id}: relacionados`);
      for (const id of a.relacionados) assert.ok(porId(id), `${a.id}: relacionado desconocido ${id}`);
      assert.ok(!a.relacionados.includes(a.id), `${a.id}: no se relaciona consigo mismo`);
      const enlaces = a.bloques.flatMap((bl) => [...(bl.items ?? []), ...(bl.texto ? [bl.texto] : [])]).flatMap((h) => idsEnlazados(h.es));
      for (const id of enlaces) assert.ok(porId(id), `${a.id}: enlace interno a ${id}, que no está en el registro`);
    }
  });

  test('cada artículo: a lo más una cita destacada y una nota Lo que no afirmamos, y esa nota va al final', () => {
    for (const a of articulosConContenido) {
      assert.ok(a.bloques.filter((x) => x.tipo === 'cita').length <= 1, `${a.id}: más de una cita`);
      const notas = a.bloques.filter((x) => x.tipo === 'no-afirmamos');
      assert.ok(notas.length <= 1, `${a.id}: más de una nota`);
      if (notas.length) assert.equal(a.bloques.at(-1).tipo, 'no-afirmamos', `${a.id}: la nota va al final`);
    }
    assert.equal(ARTICULO_A1.bloques.at(-1).tipo, 'no-afirmamos', 'a1 lleva su sección Lo que no afirmamos');
  });

  test('los artículos no nombran personas, clientes ni correos, y no usan cifras con porcentaje inventadas', () => {
    for (const a of articulosConContenido) {
      const todo = textos(a).map((h) => `${h.es} ${h.en}`).join(' ');
      assert.ok(!RE_CORREO.test(todo), `${a.id}: correo`);
      assert.ok(!/\d\s?%|\bpor ciento\b|\bpercent\b/i.test(todo), `${a.id}: porcentaje`);
      assert.ok(!/[()!¡\[\]]/.test(todo), `${a.id}: paréntesis, exclamaciones o corchetes`);
    }
  });

  test('a1, el índice y Estado no nombran marcas de marketplace ni de fuentes (el guardia de datos de cliente de la raíz corre aparte)', () => {
    const nuevos = ['blog.ts', 'estado.ts'].map((n) => fs.readFileSync(path.join(WEB, 'src', 'content', 'sitio', 'paginas', n), 'utf8')).join('\n');
    assert.ok(!/mercado libre|walmart|amazon|shopify|hubspot/i.test(nuevos), 'sin marcas');
  });
});

describe('Estado', () => {
  test('explica qué publica y dice expresamente que no es un SLA ni un compromiso de disponibilidad', () => {
    const todo = (l) => hojas(ESTADO).map((h) => h.hoja[l]).join(' ');
    assert.match(todo('es'), /acuerdo de nivel de servicio/);
    assert.match(todo('es'), /compromiso de disponibilidad/);
    assert.match(todo('en'), /service level agreement/);
    assert.match(todo('en'), /availability commitment/);
    assert.match(todo('es'), /rovaq\.ai\/api\/health\/version/);
  });

  test('el contacto manda a la página de solicitud de acceso: ningún correo ni marcador en el archivo, así el HTML y el espejo dicen lo mismo', () => {
    const fuente = fs.readFileSync(path.join(WEB, 'src', 'content', 'sitio', 'paginas', 'estado.ts'), 'utf8');
    assert.ok(!RE_CORREO.test(fuente), 'ningún correo escrito en el archivo');
    assert.ok(!/\[CORREO_DE_CONTACTO\]|\[CONTACT_EMAIL\]/.test(hojas(ESTADO).map((h) => `${h.hoja.es} ${h.hoja.en}`).join(' ')), 'ningún marcador en el texto');
    const enlaces = ESTADO.bloques.find((x) => x.tipo === 'enlaces');
    assert.ok(enlaces.items.some((it) => it.href.es === rutaDe('solicitar-acceso', 'es') && it.href.en === rutaDe('solicitar-acceso', 'en')));
    assert.ok(enlaces.items.some((it) => it.href.es === rutaDe('confianza-de-los-datos', 'es')));
  });

  test('su título y su h1 no prometen un estado en vivo y aclaran que el campo status no mide el funcionamiento', () => {
    const todo = hojas(ESTADO).map((h) => `${h.hoja.es} ${h.hoja.en}`).join(' ');
    assert.ok(!/en vivo|tiempo real/i.test(`${ESTADO.seo.titulo.es} ${ESTADO.h1.es} ${ESTADO.seo.descripcion.es}`.replace('no muestra ese valor en vivo', '')));
    assert.ok(!/^Estado del servicio/.test(ESTADO.h1.es) && !/Service status/.test(ESTADO.h1.en));
    assert.match(todo, /campo llamado status/);
    assert.match(todo, /field named status/);
  });

  test('SE PUBLICA: ficha indexable, en sitemap, llms, espejos, manifest y pie, y fuera del RSS (no es un artículo)', () => {
    const f = fichas.find((x) => x.id === 'estado');
    assert.equal(f.publicable, true);
    assert.equal(f.indexable, true);
    assert.ok(f.arbol);
    assert.ok(fichasPublicas(fichas).some((x) => x.id === 'estado'));
    const mapa = entradasSitemap(fichas).map((e) => e.url).join('\n');
    const rss = IDIOMAS.map((l) => rssXml({ lang: l, fichas })).join('\n');
    for (const l of IDIOMAS) {
      assert.ok(mapa.includes(urlAbsoluta(rutaDe('estado', l))), `sitemap ${l}`);
      assert.ok(!rss.includes(rutaDe('estado', l)), `RSS ${l}: no es un artículo`);
    }
    const pub = path.join(WEB, 'public');
    const manifest = JSON.parse(fs.readFileSync(path.join(pub, 's', 'manifest.json'), 'utf8'));
    assert.ok(Object.keys(manifest.md).some((k) => k.includes('estado')) || JSON.stringify(manifest.md).includes('estado'), 'espejo de Estado en el manifest');
    for (const l of IDIOMAS) assert.ok(fs.readdirSync(path.join(pub, 's', 'md', l)).some((n) => n.startsWith('estado.')), `archivo espejo de Estado ${l}`);
    for (const archivo of ['llms.txt', 'en/llms.txt']) {
      const t = fs.readFileSync(path.join(pub, archivo), 'utf8');
      assert.ok(t.includes(`https://rovaq.ai/s/md/${archivo.startsWith('en/') ? 'en' : 'es'}/estado.`), `${archivo} enlaza el espejo de Estado`);
    }
    for (const archivo of ['llms-full.txt', 'en/llms-full.txt']) assert.match(fs.readFileSync(path.join(pub, archivo), 'utf8'), /health\/version/, `${archivo} trae su contenido`);
  });

  test('su texto sigue siendo honesto: no es un SLA, status ok no mide el funcionamiento y no promete tiempos de respuesta', () => {
    const todo = (l) => hojas(ESTADO).map((h) => h.hoja[l]).join(' ');
    assert.match(todo('es'), /no mide el funcionamiento del servicio y no debe leerse como un indicador de salud/);
    assert.match(todo('en'), /does not measure how the service is performing and should not be read as a health indicator/);
    assert.match(todo('es'), /no fija un tiempo de respuesta/);
    assert.match(todo('en'), /does not set a response time/);
    assert.ok(!/\d\s?%|99[.,]9|uptime/i.test(`${todo('es')} ${todo('en')}`), 'sin porcentajes de disponibilidad');
  });

  test('ningún artículo del blog ni su índice enlaza o relaciona Estado (no es contenido editorial)', () => {
    for (const a of articulosConContenido) assert.ok(!idsEnlazados(textoPlano(a.bloques, 'es')).includes('estado') && !a.relacionados.includes('estado'), a.id);
  });

  test('con el HTML y el espejo iguales: mismo texto de contacto, sin correo', () => {
    const f = fichas.find((x) => x.id === 'estado');
    assert.ok(!RE_CORREO.test(JSON.stringify(f.arbol)), 'ningún correo en el árbol publicado');
    for (const l of IDIOMAS) {
      const t = espejoMd(f, l, fichas);
      assert.ok(!RE_CORREO.test(t));
      // El texto del contacto en el espejo es el del HTML, palabra por palabra.
      const contacto = l === 'es' ? 'Para reportar un problema, usa el contacto de la página de solicitud de acceso, que aparece al final de esta página.' : 'To report a problem, use the contact on the request access page, linked at the end of this page.';
      assert.ok(t.includes(contacto), `${l}: espejo con el texto del HTML`);
      assert.ok(hojas(ESTADO).some((h) => h.hoja[l].includes(contacto)), `${l}: el HTML dice lo mismo`);
      assert.ok(t.includes(`](${urlAbsoluta(rutaDe('solicitar-acceso', l))})`), `${l}: enlaza solicitar acceso`);
    }
  });
});


describe('espejos Markdown del blog y de Estado', () => {
  const md = (id, l) => espejoMd(fichas.find((f) => f.id === id), l, fichas);

  test('a1 en Markdown: frente con fecha y lectura, subtítulos, cita, lista y su nota; los enlaces a páginas pendientes quedan en texto', () => {
    for (const l of IDIOMAS) {
      const t = md('a1', l);
      assert.match(t, /^---\ntitle: /);
      assert.match(t, new RegExp(`\\npublished: ${FECHA_CONTENIDO}\\n`));
      assert.match(t, /\nauthor: Rovaq AI\n/);
      assert.match(t, /\nreading_time_minutes: \d+\n/);
      assert.match(t, /\n## /);
      assert.match(t, /\n> /);
      assert.match(t, /\n- /);
      assert.match(t, new RegExp(`\\n## ${l === 'es' ? 'Lo que no afirmamos' : 'What we do not claim'}\\n`));
      assert.ok(!t.includes('{{') && !t.includes('}}'), 'la sintaxis de enlace no llega al espejo');
      assert.ok(!RE_CORREO.test(t));
    }
  });

  test('el índice del blog en Markdown lista los artículos publicables con su fecha y su resumen', () => {
    for (const l of IDIOMAS) {
      const t = md('blog', l);
      const a1 = fichas.find((f) => f.id === 'a1');
      assert.ok(t.includes(`](${urlAbsoluta(a1.ruta[l])})`));
      assert.ok(t.includes(FECHA_CONTENIDO));
      assert.ok(t.includes(a1.subtitulo[l]), 'la tarjeta lleva el subtítulo corto');
      assert.ok(!t.includes(a1.resumen[l]), 'no el resumen largo');
    }
  });

});

describe('infraestructura vacía lista para los redactores', () => {
  test('blog-a.ts y blog-b.ts existen, exportan listas y están registrados en el índice de páginas', () => {
    assert.ok(Array.isArray(ARTICULOS_A) && Array.isArray(ARTICULOS_B));
    const idx = fs.readFileSync(path.join(WEB, 'src', 'content', 'sitio', 'paginas', 'index.ts'), 'utf8');
    assert.match(idx, /\.\.\.ARTICULOS_A/);
    assert.match(idx, /\.\.\.ARTICULOS_B/);
  });
  test('fichasPublicas no incluye ningún artículo sin contenido', () => {
    const ids = new Set(PAGINAS_INTERNAS.map((x) => x.id));
    for (const f of fichasPublicas(fichas).filter((x) => x.tipo === 'articulo')) assert.ok(ids.has(f.id), f.id);
  });
});

describe('T28: enlaces vivos, fecha única, índice y énfasis', () => {
  const idsPublicables = new Set(fichas.filter((f) => f.indexable).map((f) => f.id));
  const enlacesEnTexto = (a) => a.bloques.flatMap((bl) => [...(bl.items ?? []), ...(bl.texto ? [bl.texto] : [])]).flatMap((h) => [...idsEnlazados(h.es), ...idsEnlazados(h.en)]);

  test('ningún artículo enlaza ni relaciona una página que no se publica, y cada uno trae al menos un relacionado publicable', () => {
    for (const a of articulosPublicados) {
      for (const id of a.relacionados) assert.ok(idsPublicables.has(id), `${a.id}: relacionado no publicable ${id}`);
      for (const id of enlacesEnTexto(a)) assert.ok(idsPublicables.has(id), `${a.id}: enlace en el texto a una página no publicable ${id}`);
      assert.ok(a.relacionados.filter((id) => idsPublicables.has(id)).length >= 1, `${a.id}: sin relacionados publicables`);
    }
  });

  test('los siete artículos publicados se enlazan entre sí: cada uno recibe al menos un enlace de otro, y ninguno enlaza ni nombra a7', () => {
    assert.equal(articulosPublicados.length, 7);
    assert.deepEqual(articulosPublicados.map((a) => a.id).sort(), ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a8']);
    const recibidos = new Map(articulosPublicados.map((a) => [a.id, 0]));
    for (const a of articulosPublicados) {
      assert.ok(!a.relacionados.includes(ID_FUERA) && !enlacesEnTexto(a).includes(ID_FUERA), `${a.id}: enlaza ${ID_FUERA}`);
      const t = hojas(a, a.id).map((h) => `${h.hoja.es} ${h.hoja.en}`).join(' ');
      assert.ok(!/que-afirmamos-sobre-seguridad|what-we-claim-about-security|artículo sobre seguridad|article on security/i.test(t), `${a.id}: nombra el artículo de seguridad`);
    }
    for (const a of articulosPublicados) for (const id of new Set([...a.relacionados, ...enlacesEnTexto(a)])) if (recibidos.has(id) && id !== a.id) recibidos.set(id, recibidos.get(id) + 1);
    for (const [id, n] of recibidos) assert.ok(n >= 1, `${id}: nadie lo enlaza`);
  });

  test('ningún artículo nombra ni promete una página pendiente de revisión', () => {
    const prohibidas = /hoja de ruta|roadmap|casos de uso|use cases|integraciones|integrations|fuentes e importaciones|sources and imports|seguridad y privacidad|security and privacy|pantalla de problemas|problems screen/i;
    for (const a of articulosConContenido) for (const { ruta, hoja } of hojas(a, a.id)) {
      if (ruta.endsWith('.condicion')) continue;
      for (const l of IDIOMAS) assert.ok(!prohibidas.test(sinEnlaces(hoja[l])), `${ruta}.${l}: nombra una página pendiente: ${hoja[l].match(prohibidas)?.[0]}`);
    }
  });

  test('a7 queda fuera de todo: ni ficha indexable, ni índice, RSS, sitemap, llms, espejos, manifest ni enlaces', () => {
    const f = fichas.find((x) => x.id === ID_FUERA);
    assert.equal(f.indexable, false);
    assert.equal(f.arbol, null);
    const mapa = entradasSitemap(fichas).map((e) => e.url).join('\n');
    const rss = IDIOMAS.map((l) => rssXml({ lang: l, fichas })).join('\n');
    const indice = IDIOMAS.map((l) => espejoMd(fichas.find((x) => x.id === 'blog'), l, fichas)).join('\n');
    const pub = path.join(WEB, 'public');
    const manifest = JSON.stringify(JSON.parse(fs.readFileSync(path.join(pub, 's', 'manifest.json'), 'utf8')).md);
    for (const l of IDIOMAS) {
      const ruta = rutaDe(ID_FUERA, l);
      for (const todo of [mapa, rss, indice]) assert.ok(!todo.includes(ruta), `${ID_FUERA}.${l} en un listado`);
      assert.ok(!fs.readdirSync(path.join(pub, 's', 'md', l)).some((n) => n.startsWith(`${ID_FUERA}.`)), `espejo de ${ID_FUERA} ${l}`);
    }
    assert.ok(!manifest.includes(`"${ID_FUERA}`) && !manifest.includes(`/${ID_FUERA}.`), 'manifest');
    for (const archivo of ['llms.txt', 'llms-full.txt', 'en/llms.txt', 'en/llms-full.txt', 'index.md', 'en/index.md']) {
      const t = fs.readFileSync(path.join(pub, archivo), 'utf8');
      for (const l of IDIOMAS) assert.ok(!t.includes(rutaDe(ID_FUERA, l)) && !t.includes(`/${ID_FUERA}.`), `${archivo} nombra ${ID_FUERA}`);
      assert.ok(!/qué afirmamos y qué no afirmamos sobre seguridad|what we claim and what we do not claim about security/i.test(t), `${archivo} nombra el artículo de seguridad`);
    }
  });

  test('una sola constante de fecha: todos los artículos la usan y ningún archivo de contenido la escribe a mano', () => {
    assert.match(FECHA_CONTENIDO, /^\d{4}-\d{2}-\d{2}$/);
    for (const a of articulosConContenido) assert.equal(a.pub, FECHA_CONTENIDO, a.id);
    assert.equal(FECHA_CONTENIDO, '2026-10-31', 'el despliegue es el 31 de octubre de 2026');
    const dir = path.join(WEB, 'src', 'content', 'sitio', 'paginas');
    for (const n of fs.readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
      const fuente = fs.readFileSync(path.join(dir, n), 'utf8');
      assert.ok(!/pub:\s*'\d{4}-\d{2}-\d{2}'/.test(fuente), `${n}: pub escrito a mano`);
      assert.ok(!fuente.includes(`'${FECHA_CONTENIDO}'`), `${n}: la fecha del contenido escrita a mano`);
    }
    for (const n of ['blog.ts', 'blog-a.ts', 'blog-b.ts']) assert.match(fs.readFileSync(path.join(dir, n), 'utf8'), /import \{ FECHA_CONTENIDO \}/, n);
    const datos = fs.readFileSync(path.join(WEB, 'src', 'components', 'sitio', 'shell', 'datos.ts'), 'utf8');
    assert.match(datos, /\.filter\(\(a\) => a\.pub <= FECHA_CONTENIDO\)/, 'el índice HTML filtra por la fecha del contenido');
  });

  test('el índice en Markdown lista solo artículos con fecha menor o igual a la del contenido', () => {
    const futuro = articuloDePrueba('a2', { pub: '2999-01-01' });
    const hacia = fichasCon();
    const conFuturo = construirFichas({ landing: LANDING, paginas: PAGINAS_INTERNAS.map((x) => (x.id === 'a2' ? futuro : x)), aprobaciones, fechas, ctx });
    const antes = espejoMd(hacia.find((f) => f.id === 'blog'), 'es', hacia);
    const despues = espejoMd(conFuturo.find((f) => f.id === 'blog'), 'es', conFuturo);
    const a2 = rutaDe('a2', 'es');
    assert.ok(antes.includes(a2));
    assert.ok(!despues.includes(a2), 'un artículo con fecha posterior no entra al índice');
    assert.ok(despues.includes(rutaDe('a1', 'es')));
  });

  test('el índice del blog no repite las tarjetas en una lista de temas sin enlaces: trae enlaces al producto, todos a páginas publicables', () => {
    assert.ok(!BLOG_INDICE.bloques.some((x) => x.tipo === 'lista'), 'sin lista Temas');
    const enlaces = BLOG_INDICE.bloques.find((x) => x.tipo === 'enlaces');
    assert.ok(enlaces.items.length >= 2);
    for (const it of enlaces.items) for (const l of IDIOMAS) {
      const reg = PAGINAS.find((r) => r[l].ruta === it.href[l]);
      assert.ok(reg && idsPublicables.has(reg.id), `${it.href[l]} no es publicable`);
    }
  });

  test('una sola fuente de fecha: ningún pub ni mod es posterior a FECHA_CONTENIDO, y el mod del índice es la mayor pub listada', () => {
    for (const a of articulosConContenido) {
      assert.ok(a.pub <= FECHA_CONTENIDO, `${a.id}: pub ${a.pub} posterior a la constante`);
      if (a.mod) assert.ok(a.mod <= FECHA_CONTENIDO, `${a.id}: mod ${a.mod} posterior a la constante`);
    }
    for (const f of fichas.filter((x) => x.indexable)) {
      if (f.pub) assert.ok(f.pub <= FECHA_CONTENIDO, `${f.id}: pub`);
      if (f.mod) assert.ok(f.mod <= FECHA_CONTENIDO, `${f.id}: mod ${f.mod} posterior a la constante`);
    }
    const maxPub = articulosPublicados.map((a) => a.pub).filter((d) => d <= FECHA_CONTENIDO).sort().at(-1);
    assert.equal(fichas.find((x) => x.id === 'blog').mod, maxPub);
    const futuro = articuloDePrueba('a2', { pub: '2999-01-01' });
    const conFuturo = construirFichas({ landing: LANDING, paginas: PAGINAS_INTERNAS.map((x) => (x.id === 'a2' ? futuro : x)), aprobaciones, fechas, ctx });
    assert.ok(conFuturo.find((x) => x.id === 'blog').mod <= FECHA_CONTENIDO, 'un artículo futuro no mueve la fecha del índice');
    // Y la constante misma no puede quedar atrás de lo que dice git: fechas.json sale del historial.
    for (const [id, d] of Object.entries(fechas)) assert.ok(d <= FECHA_CONTENIDO, `fechas.json ${id}: ${d} posterior a FECHA_CONTENIDO`);
  });

  test('el énfasis de rótulo **texto** se parte, se quita del texto plano y no cambia el conteo de palabras', () => {
    assert.deepEqual(partirNegrita('a **b** c'), [{ texto: 'a ', negrita: false }, { texto: 'b', negrita: true }, { texto: ' c', negrita: false }]);
    assert.equal(sinNegrita('**Por canal.** Muestra'), 'Por canal. Muestra');
    assert.equal(palabrasDeArticulo([p('**Por canal.** Muestra', 'x')], 'es'), 3);
    assert.equal(textoPlano([p('**Por canal.** Muestra', 'x')], 'es'), 'Por canal. Muestra');
    // Los asteriscos van siempre en pareja y nunca quedan sueltos en el texto de un artículo.
    for (const a of articulosConContenido) for (const { ruta, hoja } of hojas(a, a.id)) for (const l of IDIOMAS) {
      assert.ok(!/\*/.test(sinNegrita(hoja[l])), `${ruta}.${l}: asterisco suelto`);
    }
  });

  test('los artículos no comparten el arranque ni el cierre, ni repiten la frase de la IA en su caja', () => {
    const arranque = (a, l) => a.bloques.find((x) => x.tipo === 'p').texto[l].slice(0, 40);
    for (const l of IDIOMAS) assert.equal(new Set(articulosConContenido.map((a) => arranque(a, l))).size, articulosConContenido.length);
    for (const a of articulosConContenido) for (const bl of a.bloques.filter((x) => x.tipo === 'p')) assert.ok(!/^Este artículo|^This article/.test(bl.texto.es) && !/^This article/.test(bl.texto.en), `${a.id}: "Este artículo" al arranque de un párrafo`);
    const cajas = articulosConContenido.flatMap((a) => a.bloques.filter((x) => x.tipo === 'no-afirmamos').flatMap((x) => x.items.map((it) => it.es)));
    const frases = ['Cuando la inteligencia artificial interviene, clasifica y redacta', 'No tratamos un dato desconocido como'];
    for (const f of frases) assert.ok(cajas.filter((c) => c.includes(f)).length <= 1, `la caja repite: ${f}`);
    const titulos = articulosConContenido.flatMap((a) => a.bloques.filter((x) => x.tipo === 'h2').map((x) => x.texto.es));
    assert.equal(new Set(titulos).size, titulos.length, 'ningún h2 repetido entre artículos');
  });

  test('a4 no afirma nada sobre datos personales del lector, a5 declara la cobertura de HubSpot y a4 dice siempre en el servidor', () => {
    const a4 = articulosConContenido.find((x) => x.id === 'a4');
    const a5 = articulosConContenido.find((x) => x.id === 'a5');
    const cuerpo4 = a4.bloques.filter((x) => x.tipo !== 'no-afirmamos');
    const t4 = textoPlano(cuerpo4, 'es') + textoPlano(cuerpo4, 'en');
    assert.ok(!/datos personales|personal data/i.test(t4), 'a4 sin afirmaciones sobre datos personales en el cuerpo');
    const caja4 = a4.bloques.find((x) => x.tipo === 'no-afirmamos').items.map((it) => it.es).join(' ');
    assert.match(caja4, /No describimos aquí qué datos personales ve cada puesto/);
    assert.ok(!/cada vez que se pide|every time it is requested/.test(t4));
    assert.match(textoPlano(a4.bloques, 'es'), /siempre en el servidor/);
    assert.match(textoPlano(a4.bloques, 'en'), /always on the server/);
    const caja5 = a5.bloques.find((x) => x.tipo === 'no-afirmamos').items.map((it) => it.es).join(' ');
    assert.match(caja5, /cobertura se limita a lo que expone su API/);
    assert.match(textoPlano(a5.bloques, 'es'), /la cobertura se limita a lo que expone la API de HubSpot/);
  });

  test('a2 no sobreafirma: sin libro que no borra, sin absoluto sobre todo el sitio y con la excepción de la retención', () => {
    const a2 = articulosConContenido.find((x) => x.id === 'a2');
    for (const l of IDIOMAS) {
      const t = textoPlano(a2.bloques, l);
      assert.ok(!/no borra|deletes nothing|ninguna parte|nowhere|bajo cada número|under every important number/i.test(t), l);
    }
    assert.match(textoPlano(a2.bloques, 'es'), /retención/);
    assert.match(textoPlano(a2.bloques, 'en'), /retention/);
  });

  test('a7 no llama verificadas a sus prácticas y declara al menos un desconocido real', () => {
    const a7 = articulosConContenido.find((x) => x.id === 'a7');
    assert.ok(!/verificad[ao]s?\b/i.test(textoPlano(a7.bloques, 'es')), 'es');
    assert.ok(!/verified (practices|means)/i.test(textoPlano(a7.bloques, 'en')), 'en');
    assert.match(textoPlano(a7.bloques, 'es'), /encabezados de seguridad/);
  });
});

describe('T32-Y: viñetas, rol, vocabulario y afirmaciones de IA', () => {
  const css = fs.readFileSync(path.join(WEB, 'src', 'components', 'sitio', 'shell', 'paginas.css'), 'utf8');
  const bloque = (selector) => {
    const i = css.indexOf(`\n${selector} {`);
    assert.ok(i >= 0, `falta ${selector}`);
    return css.slice(css.indexOf('{', i), css.indexOf('}', i));
  };

  test('M1: las listas con viñeta dibujan su marcador y la tabla de contenido numera, con colores existentes', () => {
    assert.match(bloque('.s-art__lista:not(.s-art__lista--num)'), /list-style:\s*disc/);
    assert.match(bloque('.s-art__lista--num'), /list-style:\s*decimal/);
    assert.match(bloque('.s-art__toc ol'), /list-style:\s*decimal/);
    assert.match(bloque('.s-art__lista li::marker'), /color:\s*var\(--s-apagado\)/);
    assert.match(bloque('.s-art__toc li::marker'), /color:\s*var\(--s-apagado\)/);
    assert.match(css, /\.s-art__lista \{[^}]*padding-left:\s*var\(--s-e24\)/, 'sangría para que el marcador no se recorte');
    const base = fs.readFileSync(path.join(WEB, 'src', 'styles', 'sitio', 'base.css'), 'utf8');
    assert.match(base, /ul,\s*ol\s*\{[^}]*list-style:\s*none/, 'el reinicio global que esta regla compensa sigue ahí');
  });

  test('el rol se llama como en la interfaz: Administrador del espacio / Workspace administrator, Lectura / Read-only', () => {
    const es = fs.readFileSync(path.join(WEB, 'src', 'lib', 'i18n', 'es.ts'), 'utf8');
    const en = fs.readFileSync(path.join(WEB, 'src', 'lib', 'i18n', 'en.ts'), 'utf8');
    const rol = (src, k) => src.match(new RegExp(`'shell\\.rol\\.${k}': '([^']+)'`))[1];
    assert.equal(rol(es, 'owner'), 'Administrador del espacio');
    assert.equal(rol(en, 'owner'), 'Workspace administrator');
    assert.equal(rol(es, 'viewer'), 'Lectura');
    assert.equal(rol(en, 'viewer'), 'Read-only');
    const caso = PAGINAS_INTERNAS.find((x) => x.id === 'casos-de-uso/propietario');
    assert.match(caso.h1.es, /^Administrador del espacio/);
    assert.match(caso.h1.en, /^Workspace administrator/);
    const lectura = PAGINAS_INTERNAS.find((x) => x.id === 'casos-de-uso/lector');
    assert.match(lectura.h1.es, /^Lectura/);
    assert.match(lectura.h1.en, /^Read-only/);
    assert.equal(porId('propietario').es.ruta, '/casos-de-uso/propietario', 'las rutas no cambian');
    assert.equal(porId('lector').en.ruta, '/en/use-cases/viewer', 'las rutas no cambian');
  });

  test('ningún texto público llama Propietario/Owner ni Lector/Viewer al puesto (rutas e ids aparte)', () => {
    const quitar = (t) => t
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/\/(?:en\/)?(?:casos-de-uso|use-cases)\/\S*/g, ' ')
      .replace(/casos-de-uso\/(?:propietario|lector)/g, ' ')
      .replace(/\{\{(?:propietario|lector)\|/g, '{{ ')
      .replace(/'(?:propietario|lector)'|"(?:propietario|lector)"|CASO_(?:PROPIETARIO|LECTOR)/g, ' ')
      .replace(/lectores de pantalla|screen readers?/gi, ' ')
      .replace(/\.(?:propietario|lector)\.[0-9a-f]{8}\.md/g, ' ');
    const archivos = [
      path.join(WEB, 'src', 'content', 'sitio', 'landing.ts'),
      ...fs.readdirSync(path.join(WEB, 'src', 'content', 'sitio', 'paginas')).filter((n) => n.endsWith('.ts')).map((n) => path.join(WEB, 'src', 'content', 'sitio', 'paginas', n)),
      path.join(WEB, '..', '..', 'tools', 'sitio', 'revision.mjs'),
      ...['llms.txt', 'llms-full.txt', 'en/llms.txt', 'en/llms-full.txt', 'index.md', 'en/index.md'].map((n) => path.join(WEB, 'public', n)),
      ...IDIOMAS.flatMap((l) => fs.readdirSync(path.join(WEB, 'public', 's', 'md', l)).map((n) => path.join(WEB, 'public', 's', 'md', l, n))),
    ];
    const malos = [];
    for (const a of archivos) {
      const t = quitar(fs.readFileSync(a, 'utf8'));
      for (const m of t.matchAll(/.{0,30}(?:propietari|\bowners?\b|\blectora?e?s?\b|\bviewers?\b).{0,30}/gi)) malos.push(`${path.basename(a)}: ${m[0].trim()}`);
    }
    assert.deepEqual(malos, []);
  });

  test('M5: los calcos del español que señaló el juez no vuelven al inglés', () => {
    const calcos = /has lived the same scene|we have it plainly|has a worse cost than|This split is not a brake|A surplus screen|The thesis is the opposite one|It is the one who|Reads with read-only access|dismissing without criteria|adult conversation|It disciplines us|Almost every team has lived|any month against any month/i;
    for (const a of articulosConContenido) for (const { ruta, hoja } of hojas(a, a.id)) assert.ok(!calcos.test(hoja.en), `${ruta}: ${hoja.en.match(calcos)?.[0]}`);
    const a5 = articulosConContenido.find((x) => x.id === 'a5');
    const en5 = textoPlano(a5.bloques, 'en') + ' ' + a5.seo.titulo.en + a5.h1.en;
    assert.ok(!/\b(?:the|a|each|every|before asking for a|approving the|support during the|which) load\b|load after load/i.test(en5), 'load como sustantivo en a5');
  });

  test('M6: a5 dice exportaciones, no exportes, y no sugiere cargar conversaciones por archivo', () => {
    const a5 = articulosConContenido.find((x) => x.id === 'a5');
    for (const t of [a5.seo.titulo.es, a5.h1.es, textoPlano(a5.bloques, 'es')]) assert.ok(!/exportes?\b/i.test(t), 'exporte(s) en a5');
    assert.match(a5.seo.titulo.es, /exportaciones/);
    assert.match(a5.h1.es, /exportaciones/);
    const pasos5 = a5.bloques.find((x) => x.tipo === 'pasos').items.map((i) => i.es).join(' ');
    assert.ok(!/pedidos, reembolsos, conversaciones/.test(pasos5));
    assert.match(pasos5, /conversaciones no se cargan por archivo/);
    assert.equal(porId('a5').es.ruta, '/blog/exportes-de-marketplace-ya-son-datos', 'el slug no cambia');
  });

  test('M3: a3 describe la IA como capacidad, sin garantizar citas ni afirmar que agrupe hoy, y trae la salvedad de Finanzas', () => {
    const a3 = articulosConContenido.find((x) => x.id === 'a3');
    for (const l of IDIOMAS) {
      const t = textoPlano(a3.bloques, l);
      assert.ok(!/cada grupo conserva sus citas|each group keeps its quotes/i.test(t), l);
      assert.ok(!/qué hace hoy la IA|what AI does today/i.test(t), l);
      assert.ok(!/mensaje a un proveedor|message to a supplier/i.test(t), `${l}: borrador a proveedor sin respaldo en el producto`);
    }
    assert.match(textoPlano(a3.bloques, 'es'), /habilita por organización, se procesa por lotes y una persona la revisa/);
    assert.match(textoPlano(a3.bloques, 'es'), /modo de Finanzas tiene su propio motor y no afirmamos que sea solo de reglas/);
    assert.match(textoPlano(a3.bloques, 'en'), /Finance mode has its own engine and we do not claim it is rules only/);
  });

  test('L1 a L3: Sin dato nunca cero no se repite, los cierres varían y las cajas de a2 y a4 no rellenan', () => {
    const frase = /nunca como cero|nunca cero|never zero|never as zero/i;
    const conFrase = articulosPublicados.filter((a) => frase.test(textoPlano(a.bloques, 'es')) || frase.test(textoPlano(a.bloques, 'en'))).map((a) => a.id);
    assert.ok(conFrase.length <= 3, `la frase aparece en ${conFrase.join()}`);
    const cierres = articulosPublicados.map((a) => a.bloques.filter((x) => x.tipo !== 'no-afirmamos').at(-1)?.tipo);
    assert.ok(cierres.filter((t) => t === 'pasos').length <= 1 || articulosPublicados.filter((a) => a.bloques.at(-3)?.tipo === 'pasos').length <= 4);
    const cierreConPasos = articulosPublicados.filter((a) => a.bloques.some((x) => x.tipo === 'pasos')).map((a) => a.id);
    assert.ok(cierreConPasos.length <= 4, `bloques de pasos en ${cierreConPasos.join()}`);
    const a2 = articulosConContenido.find((x) => x.id === 'a2');
    const caja2 = a2.bloques.find((x) => x.tipo === 'no-afirmamos').items.map((it) => it.es);
    assert.equal(caja2.filter((c) => /certificaci/i.test(c)).length, 1, 'a2 dice una sola vez que no hay certificaciones en su caja');
    const caja4 = articulosConContenido.find((x) => x.id === 'a4').bloques.find((x) => x.tipo === 'no-afirmamos').items.map((it) => it.es);
    assert.ok(!caja4.some((c) => /certificaci/i.test(c) && /dos pasos/i.test(c)), 'a4 no mezcla certificaciones y 2FA');
  });

  test('L6: ningún artículo publicado promete con «planeado» ni «hoja de ruta»', () => {
    for (const a of articulosPublicados) for (const { ruta, hoja } of hojas(a, a.id)) for (const l of IDIOMAS) assert.ok(!/planead[oa]s?|\bplanned\b|roadmap|hoja de ruta/i.test(sinEnlaces(hoja[l])), `${ruta}.${l}`);
  });

  test('L2: ningún artículo afirma que el administrador del espacio «ve todas las pantallas»', () => {
    for (const a of articulosPublicados) for (const l of IDIOMAS) assert.ok(!/ve todas las pantallas|sees all screens/i.test(textoPlano(a.bloques, l)), `${a.id}.${l}`);
  });
});
