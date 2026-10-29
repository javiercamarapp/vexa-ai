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
import { LOGOS } from '../../../../packages/workspace-service/marca.mjs';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const salida = execFileSync(process.execPath, ['--import', 'tsx', '--import', join(WEB, 'tests', 'sitio', '_css-nulo.mjs'), join(WEB, 'tests', 'sitio', '_render-shell.tsx')], { cwd: WEB, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, NODE_NO_WARNINGS: '1' } });
const R = JSON.parse(salida.toString('utf8'));

const hrefs = (html) => [...html.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map((m) => m[1]);
const internos = (html) => hrefs(html).filter((h) => h.startsWith('/'));
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
  assert.equal(R.noPublicablesLanzan, R.params.length - esperadas.length);
  assert.ok(R.noPublicablesLanzan >= 2, 'el centinela y las páginas pendientes lanzan notFound');
});

for (const c of R.casos) {
  test(`HTML limpio y válido: ${c.nombre}`, () => {
    // 404 sin canonical por diseño (noindex); el resto lleva el canonical de metadatosPagina.
    const hall = escanearHtml(c.html, { archivo: c.nombre }).filter((h) => !(c.nombre.startsWith('404') && h.regla === 'canonical'));
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
