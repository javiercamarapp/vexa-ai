// T24: blog y Estado. Tipo Articulo, funciones puras de lectura, publicación solo de artículos con contenido, RSS y sitemap, JSON-LD,
// paridad ES y EN, espejos Markdown y las dos páginas legales que siguen en 404.
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
import { articulo, b, h2, p } from '../../src/content/sitio/ayudas.ts';
import { construirFichas, entradasSitemap, fichasPublicas, metadatosSitio, urlAbsoluta } from '../../src/lib/sitio/metadatos.mjs';
import { grafoDePagina, serializar } from '../../src/lib/sitio/jsonld.mjs';
import { rssXml } from '../../src/lib/sitio/rss.mjs';
import { estadoPagina, hojas } from '../../src/lib/sitio/marcadores.mjs';
import {
  contarPalabras, esFechaIso, fechaLegible, idsEnlazados, minutosDeLectura, palabrasDeArticulo, partirEnlaces, seccionesDe, sinEnlaces, slug, textoPlano,
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
    assert.equal(estadoPagina(ESTADO, { aprobaciones, ctx, tipo: 'institucional' }).publicable, true);
  });
});

describe('artículos con y sin contenido', () => {
  test('cada artículo del registro tiene ficha: con contenido es publicable y sin contenido no, con el motivo', () => {
    assert.equal(articulosRegistro.length, 8);
    for (const reg of articulosRegistro) {
      const ficha = fichas.find((f) => f.id === reg.id);
      const contenido = PAGINAS_INTERNAS.find((x) => x.id === reg.id);
      if (contenido) {
        assert.equal(ficha.publicable, true, `${reg.id}: ${ficha.motivos.join()}`);
        assert.equal(ficha.indexable, true);
        assert.ok(ficha.arbol);
        assert.equal(ficha.pub, contenido.pub);
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
    for (const id of ['blog', 'estado']) for (const l of IDIOMAS) assert.ok(urls.has(urlAbsoluta(rutaDe(id, l))), `${id}.${l}`);
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
  const grafo = (id, lang) => JSON.parse(serializar(grafoDePagina(id, lang, { fichas })));
  const tipos = (g) => g['@graph'].map((n) => n['@type']);

  test('cada página publicada del blog emite JSON válido con contexto y ids únicos que se resuelven', () => {
    for (const f of fichas.filter((x) => (x.tipo === 'articulo' || x.tipo === 'blog-indice' || x.id === 'estado') && x.indexable)) for (const l of IDIOMAS) {
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
    assert.equal(m.openGraph.publishedTime, '2026-11-03');
    assert.equal(m.openGraph.modifiedTime, f.mod);
    assert.equal(m.alternates.types['application/rss+xml'], `${BASE}/blog/rss.xml`);
    const sin = metadatosSitio({ id: 'estado', lang: 'es', titulo: 't', descripcion: 'd', publicado: '2026-11-03' });
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

  test('el contacto de reportes sale del mismo marcador que solicitar-acceso y no se escribe a mano', () => {
    const fuente = fs.readFileSync(path.join(WEB, 'src', 'content', 'sitio', 'paginas', 'estado.ts'), 'utf8');
    assert.ok(!RE_CORREO.test(fuente), 'ningún correo escrito en el archivo');
    assert.match(fuente, /\[CORREO_DE_CONTACTO\]/);
    assert.match(fuente, /\[CONTACT_EMAIL\]/);
    const ficha = fichas.find((f) => f.id === 'estado');
    assert.ok(RE_CORREO.test(JSON.stringify(ficha.arbol)), 'el árbol publicado resuelve el marcador con el contacto del sitio');
    assert.ok(JSON.stringify(ficha.arbol).includes(ctx.contacto));
  });

  test('es publicable y no vende: su descripción SEO no promete la versión en vivo', () => {
    const f = fichas.find((x) => x.id === 'estado');
    assert.equal(f.indexable, true);
    assert.ok(!/en vivo|tiempo real|live|real-time/i.test(`${f.descripcion.es} ${f.descripcion.en}`));
  });
});

describe('espejos Markdown del blog y de Estado', () => {
  const md = (id, l) => espejoMd(fichas.find((f) => f.id === id), l, fichas);

  test('a1 en Markdown: frente con fecha y lectura, subtítulos, cita, lista y su nota; los enlaces a páginas pendientes quedan en texto', () => {
    for (const l of IDIOMAS) {
      const t = md('a1', l);
      assert.match(t, /^---\ntitle: /);
      assert.match(t, /\npublished: 2026-11-03\n/);
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
      assert.ok(t.includes('2026-11-03'));
      assert.ok(t.includes(a1.resumen[l]));
    }
  });

  test('Estado en Markdown no repite el correo: manda al contacto de la página de acceso', () => {
    for (const l of IDIOMAS) {
      const t = md('estado', l);
      assert.ok(!RE_CORREO.test(t));
      assert.match(t, l === 'es' ? /Para reportar un problema, usa el contacto de https:\/\/rovaq\.ai\/solicitar-acceso/ : /To report a problem, use the contact on https:\/\/rovaq\.ai\/en\/request-access/);
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
