// Shell, logo, renderizador de bloques y despachador del sitio (T7). Los componentes son TSX: un proceso hijo con `node --import tsx`
// los renderiza con react-dom/server (tests/sitio/_render-shell.tsx) y esta prueba revisa el HTML con los escáneres de T12.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { escanearHtml, escanearFuente, listarArchivos, leer, rel } from './_escaner.mjs';
import { PAGINAS, RUTAS, rutaDe, idDeRuta } from '../../src/content/sitio/registro.mjs';
import { FECHA_CONTENIDO } from '../../src/content/sitio/fecha-contenido.mjs';
import { PAGINAS_INTERNAS } from '../../src/content/sitio/paginas/index.ts';

const ARTICULOS = PAGINAS_INTERNAS.filter((x) => /^a\d$/.test(x.id) && x.estado === 'publicable');
import { LOGOS } from '../../../../packages/workspace-service/marca.mjs';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const salida = execFileSync(process.execPath, ['--import', 'tsx', '--import', join(WEB, 'tests', 'sitio', '_css-nulo.mjs'), join(WEB, 'tests', 'sitio', '_render-shell.tsx')], { cwd: WEB, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, NODE_NO_WARNINGS: '1' } });
const R = JSON.parse(salida.toString('utf8'));

const hrefs = (html) => [...html.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map((m) => m[1]);
// Los canales RSS del blog son archivos, no páginas del registro: los enlaza el índice del blog.
const CANALES_RSS = new Set(['/blog/rss.xml', '/en/blog/rss.xml']);
const internos = (html) => hrefs(html).filter((h) => h.startsWith('/') && !CANALES_RSS.has(h));
const publicables = new Set(PAGINAS.filter((p) => R.estados[p.id]).flatMap((p) => [p.es.ruta, p.en.ruta]));
const noPublicables = PAGINAS.filter((p) => !R.estados[p.id]).flatMap((p) => [p.es.ruta, p.en.ruta]);

test('el despachador pregenera las 33 páginas internas por idioma y el centinela', () => {
  assert.equal(R.params.length, 33 * 2 + 2);
  const rutas = R.params.filter((p) => p.ruta[0] !== '__404').map((p) => (p.lang === 'en' ? '/en/' : '/') + p.ruta.join('/'));
  assert.deepEqual([...rutas].sort(), RUTAS.filter((r) => r !== '/' && r !== '/en').sort());
  assert.equal(R.params.filter((p) => p.ruta[0] === '__404').length, 2);
});

test('toda ruta resuelta por el despachador existe en el registro y su idioma coincide', () => {
  for (const c of R.casos.filter((x) => x.nombre.startsWith('pagina:'))) {
    assert.equal(idDeRuta(rutaDe(c.id, c.lang))?.id, c.id);
  }
});

test('las páginas no publicables devuelven el 404 propio (notFound) y las publicables se rinden', () => {
  const renderizadas = R.casos.filter((c) => c.nombre.startsWith('pagina:')).map((c) => c.id).sort();
  const esperadas = PAGINAS.filter((p) => R.estados[p.id] && p.id !== 'inicio').flatMap((p) => [p.id, p.id]).sort();
  assert.deepEqual(renderizadas, esperadas);
  // El centinela __404 ya no lanza notFound: se rinde como página completa (el middleware la sirve con estado 404). Lanzan solo las páginas pendientes.
  assert.equal(R.noPublicablesLanzan, R.params.length - esperadas.length - 2);
  assert.ok(R.noPublicablesLanzan >= 2, 'las páginas pendientes lanzan notFound');
  assert.deepEqual(R.casos.filter((c) => c.nombre.startsWith('centinela:')).map((c) => c.lang).sort(), ['en', 'es']);
});

for (const c of R.casos) {
  test(`HTML limpio y válido: ${c.nombre}`, () => {
    // 404 sin canonical por diseño (noindex); el resto lleva el canonical de metadatosPagina.
    const hall = escanearHtml(c.html, { archivo: c.nombre }).filter((h) => !((c.nombre.startsWith('404') || c.nombre.startsWith('centinela')) && h.regla === 'canonical'));
    assert.deepEqual(hall.map((h) => `${h.regla}: ${h.nota}`), []);
    assert.equal((c.html.match(/<h1[\s>]/g) || []).length, 1, 'un solo h1');
    assert.ok(!/\sstyle\s*=/.test(c.html), 'cero style');
    // T2 añadió el JSON-LD de cada página: el único script permitido en el marcado de componentes es de datos (application/ld+json).
    assert.ok(!/<script(?![^>]*type="application\/ld\+json")/.test(c.html), 'cero scripts en el marcado de componentes salvo JSON-LD');
    assert.ok(!/\sinert\b/.test(c.html), 'cero inert');
    assert.ok(!/\[[A-Z_]{3,}\]/.test(c.html), 'ningún marcador entre corchetes');
    assert.ok(!/[!¡]/.test(c.html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ')), 'sin exclamaciones en el texto');
    assert.match(c.html, /<a class="s-saltar" href="#contenido">/);
    assert.match(c.html, /<main id="contenido"/);
  });

  test(`enlaces internos válidos contra el registro y sin rutas no publicables: ${c.nombre}`, () => {
    for (const h of internos(c.html)) {
      assert.ok(RUTAS.includes(h), `enlace fuera del registro: ${h}`);
      assert.ok(publicables.has(h), `enlace a una ruta no publicable: ${h}`);
    }
    for (const h of hrefs(c.html)) assert.ok(h.startsWith('/') || h.startsWith('#') || h.startsWith('mailto:'), `href inesperado ${h}`);
  });

  test(`selector de idioma con hreflang y aria-current: ${c.nombre}`, () => {
    const sel = [...c.html.matchAll(/<a href="([^"]*)" hrefLang="(es|en)" lang="(?:es|en)"([^>]*)>(ES|EN)<\/a>/gi)];
    assert.equal(sel.length, 4, 'dos enlaces en la barra y dos en el panel móvil');
    for (const [, href, hl, resto, texto] of sel) {
      assert.equal(texto.toLowerCase(), hl);
      const actual = hl === c.lang;
      assert.equal(/aria-current="true"/.test(resto), actual, `aria-current solo en el idioma de la página (${hl})`);
      if (c.id) assert.equal(href, rutaDe(c.id, hl), 'la ruta del otro idioma sale del registro');
      else assert.equal(href, hl === 'en' ? '/en' : '/');
    }
  });
}

test('los menús y el pie solo contienen páginas publicables y no emiten grupos vacíos', () => {
  for (const lang of ['es', 'en']) {
    for (const g of R.menus[lang]) {
      assert.ok(g.items.length > 0);
      for (const it of g.items) {
        assert.ok(publicables.has(it.href), it.href);
        assert.ok(!noPublicables.includes(it.href), it.href);
      }
      if (g.indice) assert.ok(publicables.has(g.indice));
    }
    for (const c of R.pie[lang]) {
      assert.ok(c.items.length > 0);
      for (const it of c.items) assert.ok(publicables.has(it.href), it.href);
    }
  }
  // Los idiomas ofrecen las mismas páginas.
  assert.equal(R.menus.es.flatMap((g) => g.items).length, R.menus.en.flatMap((g) => g.items).length);
});

test('el rótulo legal y la línea de derechos no salen mientras falten razón social y fecha', () => {
  const inicio = R.casos.find((c) => c.nombre === 'inicio:es').html;
  assert.ok(!/©|Última revisión|Last reviewed/.test(inicio));
});

test('la nota de revisión pendiente solo aparece en el estado no publicable', () => {
  assert.match(R.notaPendiente, /role="note"[^>]*>Pendiente de revisión/);
  assert.ok(!/Pendiente de revisión/.test(R.sinNota));
  assert.ok(!R.casos.some((c) => /Pendiente de revisión|Pending review/.test(c.html)));
});

test('una hoja MATIZ lleva su nivel y su condición en el marcado', () => {
  const hoy = R.casos.find((c) => c.nombre === 'pagina:es:hoy').html;
  assert.match(hoy, /data-nivel="matiz" data-condicion="\d+"/);
});

test('metadatos: canonical absoluto y hreflang con rutas del registro', () => {
  for (const lang of ['es', 'en']) {
    const m = R[`meta:${lang}`];
    // T2 sustituyó los metadatos provisionales: hreflang es-MX, en y x-default, y el origen pelado sin barra final (como lo escribe Next).
    assert.equal(m.alternates.canonical, 'https://rovaq.ai' + (lang === 'en' ? '/en' : ''));
    assert.equal(m.alternates.languages['es-MX'], 'https://rovaq.ai');
    assert.equal(m.alternates.languages.en, 'https://rovaq.ai/en');
    assert.equal(m.alternates.languages['x-default'], 'https://rovaq.ai');
  }
});

test('logo: SVG sin style, formas rellenas del kit y el punto rojo como único color', () => {
  const kit = LOGOS.horizontal;
  for (const [nombre, html] of Object.entries(R.logos)) {
    assert.ok(!/\sstyle\s*=/.test(html), `${nombre} sin style`);
    assert.ok(!/stroke=/.test(html.replace(/class="s-marca__contorno"/g, '')) || nombre === 'pie', `${nombre} sin trazo`);
    assert.ok(!/<text|<image|<img/.test(html), 'formas propias, sin texto ni imagen');
    const colores = new Set([...html.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]));
    for (const c of colores) assert.ok(['currentColor', '#FFFFFF', '#0E0E10', '#E8241C'].includes(c), `${nombre} color ${c}`);
    assert.equal((html.match(/#E8241C/g) || []).length, nombre === 'doble' ? 2 : 1, `${nombre}: un punto rojo por copia`);
  }
  assert.match(R.logos.auto, /fill="currentColor"/);
  assert.match(R.logos.neg, /fill="#FFFFFF"/);
  assert.match(R.logos.pos, /fill="#0E0E10"/);
  assert.match(R.logos.doble, /s-logo__negativo/);
  assert.match(R.logos.doble, /s-logo__positivo/);
  assert.match(R.logos.auto, /role="img" aria-label="Rovaq"/);
  assert.match(R.logos.doble, /aria-hidden="true"/);
  // Las formas coinciden con el kit de marca.
  for (const d of kit.tinta) assert.ok(R.logos.auto.includes(` d="${d}"`));
  assert.ok(R.logos.auto.includes(`viewBox="${kit.viewBox}"`));
  assert.ok(R.logos.neg.includes(`viewBox="${LOGOS.simbolo.viewBox}"`));
  // El anillo es una forma cerrada rellena, no un trazo.
  assert.match(kit.tinta[0], /Z$/);
});

test('marca del pie: relleno, contorno con pathLength 1 y punto, decorativa', () => {
  const pie = R.logos.pie;
  assert.match(pie, /class="s-pie__marca"/);
  assert.match(pie, /aria-hidden="true"/);
  assert.equal((pie.match(/class="s-marca__contorno" pathLength="1"/g) || []).length, LOGOS.horizontal.tinta.length);
  assert.match(pie, /<g class="s-marca__relleno">/);
  assert.match(pie, /class="s-marca__punto"/);
});

test('fuentes de los componentes del sitio sin hallazgos de los escáneres', () => {
  const archivos = [
    ...listarArchivos(join(WEB, 'src', 'components', 'sitio', 'shell'), ['.ts', '.tsx']),
    join(WEB, 'src', 'components', 'sitio', 'cuerpo.tsx'),
    join(WEB, 'src', 'components', 'sitio', 'logo-sitio.tsx'),
    // La imagen social (next/og) exige style={{ }} y genera un PNG, no HTML: queda fuera del escáner de style.
    ...listarArchivos(join(WEB, 'src', 'app', '(sitio)'), ['.ts', '.tsx']).filter((f) => !/\/\(sitio\)\/og\//.test(f)),
  ];
  const hall = archivos.flatMap((f) => escanearFuente(leer(f), rel(WEB, f)));
  assert.deepEqual(hall.map((h) => `${h.archivo}:${h.linea} ${h.regla}`), []);
});

test('las rutas del sitio son estáticas: force-static y dynamicParams false en layout y despachador', () => {
  for (const f of ['layout.tsx', 'page.tsx', '[...ruta]/page.tsx']) {
    const src = readFileSync(join(WEB, 'src', 'app', '(sitio)', 'sitio', '[lang]', f), 'utf8');
    assert.match(src, /dynamic = 'force-static'/, f);
    assert.match(src, /dynamicParams = false/, f);
    assert.ok(!/cookies\(|headers\(/.test(src), f);
  }
});

// ---- T24: blog y Estado en el despachador
// R.lanzados guarda las rutas internas del despachador: en inglés sin el prefijo /en.
const claveLanzada = (lang, ruta) => `${lang}:${lang === 'en' ? ruta.replace(/^\/en/, '') : ruta}`;
test('el aviso de privacidad y los términos siguen devolviendo el 404 propio, en los dos idiomas', () => {
  for (const id of ['aviso-de-privacidad', 'terminos']) {
    assert.equal(R.estados[id], false, `${id} no es publicable`);
    for (const lang of ['es', 'en']) assert.ok(R.lanzados.includes(claveLanzada(lang, rutaDe(id, lang))), `${id}.${lang} lanza notFound`);
    assert.ok(!R.casos.some((c) => c.id === id), `${id} no se rinde`);
  }
});

test('un artículo sin contenido da 404 y uno con contenido se rinde: a1 sí, y el índice y Estado también', () => {
  const conContenido = new Set(['a1']);
  for (const reg of PAGINAS.filter((p) => p.tipo === 'articulo')) {
    for (const lang of ['es', 'en']) {
      const lanzo = R.lanzados.includes(claveLanzada(lang, reg[lang].ruta));
      assert.equal(lanzo, !R.estados[reg.id], `${reg.id}.${lang}`);
      if (conContenido.has(reg.id)) assert.equal(lanzo, false, `${reg.id}.${lang} se rinde`);
    }
  }
  assert.equal(R.estados.a1, true);
  assert.equal(R.estados.blog, true);
  assert.equal(R.estados.estado, true, 'Estado se publica');
  assert.equal(R.estados.a7, false, 'a7 queda pendiente de revisión');
  assert.equal(ARTICULOS.length, 7, 'siete artículos en el lanzamiento');
});

test('Estado se rinde (sin notFound) y el pie lo enlaza; a7 da 404 y ninguna página rendida lo enlaza', () => {
  for (const lang of ['es', 'en']) {
    assert.ok(!R.lanzados.includes(claveLanzada(lang, rutaDe('estado', lang))), `estado.${lang} no lanza notFound`);
    assert.ok(R.casos.some((c) => c.nombre === `pagina:${lang}:estado`), `estado.${lang} se rinde`);
    assert.ok(R.lanzados.includes(claveLanzada(lang, rutaDe('a7', lang))), `a7.${lang} lanza notFound`);
    assert.ok(!R.casos.some((c) => c.nombre === `pagina:${lang}:a7`), `a7.${lang} no se rinde`);
    const inicio = R.casos.find((c) => c.nombre === `pagina:${lang}:blog`).html;
    assert.ok(inicio.includes(`href="${rutaDe('estado', lang)}"`), `${lang}: el pie enlaza Estado`);
  }
  for (const c of R.casos) for (const lang of ['es', 'en']) assert.ok(!c.html.includes(`href="${rutaDe('a7', lang)}"`), `${c.nombre} enlaza a7`);
});

test('a1 se rinde como artículo: un h1, fecha en time, tiempo de lectura, tabla de contenido, nota y JSON-LD BlogPosting', () => {
  for (const lang of ['es', 'en']) {
    const c = R.casos.find((x) => x.nombre === `pagina:${lang}:a1`);
    assert.ok(c, `a1.${lang}`);
    assert.match(c.html, /<article class="s-art">/);
    assert.ok(c.html.includes(`<time dateTime="${FECHA_CONTENIDO}">`));
    assert.match(c.html, lang === 'es' ? /\d+ min de lectura/ : /\d+ min read/);
    assert.match(c.html, /<nav class="s-art__toc"/);
    assert.match(c.html, /<blockquote class="s-art__cita">/);
    assert.match(c.html, lang === 'es' ? /<aside class="s-art__limites" aria-labelledby="lo-que-no-afirmamos">/ : /<aside class="s-art__limites" aria-labelledby="what-we-do-not-claim">/);
    assert.ok(!/\{\{|\}\}/.test(c.html.replace(/<script[\s\S]*?<\/script>/g, '')), 'la sintaxis de enlace interno no llega al HTML');
    const ld = JSON.parse(c.html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.ok(ld['@graph'].some((n) => n['@type'] === 'BlogPosting' && n.datePublished === FECHA_CONTENIDO));
    // Enlaces internos del artículo: solo a páginas publicables (la pantalla de fuga de reembolsos sigue pendiente y no se enlaza).
    assert.ok(!c.html.includes(rutaDe('fuga-de-reembolsos', lang)) || R.estados['fuga-de-reembolsos']);
  }
});

test('el índice del blog lista los artículos con su fecha, su subtítulo corto y el enlace al canal RSS', () => {
  for (const lang of ['es', 'en']) {
    const idx = R.casos.find((x) => x.nombre === `pagina:${lang}:blog`).html;
    assert.ok(idx.includes(`href="${rutaDe('a1', lang)}"`));
    assert.match(idx, /<ol class="s-art-indice">/);
    assert.ok(idx.includes(lang === 'es' ? '/blog/rss.xml' : '/en/blog/rss.xml'));
    for (const a of ARTICULOS) assert.ok(idx.includes(`href="${rutaDe(a.id, lang)}"`), `${a.id}.${lang} en el índice`);
    assert.ok(!idx.includes(rutaDe('a7', lang)), `a7.${lang} fuera del índice`);
    const a1 = ARTICULOS.find((a) => a.id === 'a1');
    assert.ok(idx.includes(a1.subtitulo[lang].replace(/&/g, '&amp;')), 'la tarjeta lleva el subtítulo');
    assert.ok(!idx.includes(a1.resumen[lang].replace(/&/g, '&amp;')), 'no el resumen largo');
  }
});

test('los rótulos de viñeta se rinden con strong (sin color nuevo) y ninguna sintaxis de énfasis llega al HTML', () => {
  for (const lang of ['es', 'en']) {
    for (const id of ['a1', 'a2', 'a4', 'a8']) {
      const h = R.casos.find((x) => x.nombre === `pagina:${lang}:${id}`).html.replace(/<script[\s\S]*?<\/script>/g, '');
      assert.match(h, /<strong class="s-art__rotulo">/, `${id}.${lang}`);
      assert.ok(!h.includes('**'), `${id}.${lang}: asteriscos en el HTML`);
    }
  }
});
