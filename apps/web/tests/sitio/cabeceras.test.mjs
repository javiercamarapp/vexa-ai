// T3: cabeceras del sitio público, negociación Accept y CSP candidata en informe. Puro: sin servidor.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {cspSitioInforme, reglasEspejos, reglasPorHost, HOST_SITIO_RE} from '../../config/sitio/cabeceras.mjs';
import {decidirHost, prefiereMarkdown} from '../../src/lib/host-routing.mjs';
import {mapaEspejos, espejoDeRuta, rutaEspejoDe} from '../../src/lib/sitio/espejos.mjs';
import {rutaEspejo} from '../../src/lib/sitio/metadatos.mjs';
import {LISTA_BLANCA_NEXT_POR_DEFECTO} from './_escaner.mjs';

const aqui = import.meta.dirname;
const manifest = JSON.parse(readFileSync(join(aqui, '../../public/s/manifest.json'), 'utf8'));
const md = manifest.md;
const cab = (r, k) => r.headers.find((h) => h.key === k)?.value;

test('prefiereMarkdown respeta los valores q y nunca elige Markdown para un navegador', () => {
  assert.equal(prefiereMarkdown('text/markdown'), true);
  assert.equal(prefiereMarkdown('text/markdown, text/html;q=0.9'), true);
  assert.equal(prefiereMarkdown('text/html, text/markdown;q=0.5'), false);
  assert.equal(prefiereMarkdown('text/markdown;q=0'), false);
  assert.equal(prefiereMarkdown('text/markdown;q=0.8, */*;q=0.8'), true, 'empate: gana el tipo explícito');
  assert.equal(prefiereMarkdown('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'), false);
  assert.equal(prefiereMarkdown('*/*'), false, 'un comodín no pide Markdown');
  assert.equal(prefiereMarkdown('text/*'), false);
  assert.equal(prefiereMarkdown(''), false);
  assert.equal(prefiereMarkdown(null), false);
  assert.equal(prefiereMarkdown('x'.repeat(5000) + ',text/markdown'), false, 'cabecera enorme: se ignora');
});

const mapa = mapaEspejos(md);
const espejoDe = espejoDeRuta(mapa);
test('espejos: rutaEspejoDe coincide con rutaEspejo de metadatos y cubre portada y páginas del manifest', () => {
  for (const id of ['inicio', 'hoy', 'finanzas']) for (const lang of ['es', 'en']) assert.equal(rutaEspejoDe(id, lang, md), rutaEspejo(id, lang, md), `${lang}/${id}`);
  assert.equal(espejoDe('/'), '/index.md');
  assert.equal(espejoDe('/en'), '/en/index.md');
  assert.ok(espejoDe('/producto/hoy')?.startsWith('/s/md/es/'));
  assert.equal(espejoDe('/producto'), null, 'las páginas no publicables no tienen espejo');
  assert.equal(espejoDe('/no-existe'), null);
  assert.equal(mapa.get('/producto/hoy').canonica, 'https://rovaq.ai/producto/hoy');
  assert.equal(mapa.get('/').canonica, 'https://rovaq.ai');
});

test('decidirHost: Accept text/markdown reescribe al espejo en rovaq.ai y solo ahí', () => {
  const base = {pathname: '/producto/hoy', espejoDe};
  const d = decidirHost({...base, host: 'rovaq.ai', accept: 'text/markdown'});
  assert.equal(d.tipo, 'reescribir'); assert.equal(d.markdown, true); assert.ok(d.destino.endsWith('.md'));
  assert.deepEqual(decidirHost({...base, host: 'rovaq.ai', accept: 'text/html,*/*;q=0.8'}), {tipo: 'reescribir', destino: '/sitio/es/producto/hoy'});
  assert.deepEqual(decidirHost({...base, host: 'rovaq.ai'}), {tipo: 'reescribir', destino: '/sitio/es/producto/hoy'});
  assert.equal(decidirHost({...base, host: 'app.rovaq.ai', accept: 'text/markdown'}).tipo, 'pasar', 'la app no negocia');
  assert.equal(decidirHost({pathname: '/', host: 'rovaq.ai', accept: 'text/markdown', espejoDe}).destino, '/index.md');
  assert.equal(decidirHost({pathname: '/en', host: 'rovaq.ai', accept: 'text/markdown', espejoDe}).destino, '/en/index.md');
  // Ruta desconocida o sin espejo: 404 del sitio, sin Markdown.
  const n = decidirHost({pathname: '/no-existe', host: 'rovaq.ai', accept: 'text/markdown', espejoDe});
  assert.equal(n.noEncontrada, true); assert.equal(n.markdown, undefined);
});

test('espejos Markdown: noindex, Content-Type y Link canonical por cada espejo y para llms*.txt', () => {
  const reglas = reglasEspejos(md);
  const fuentes = new Set(reglas.map((r) => r.source));
  for (const e of Object.values(md)) assert.ok(fuentes.has(e.url), 'sin regla: ' + e.url);
  for (const s of ['/index.md', '/en/index.md', '/llms.txt', '/llms-full.txt', '/en/llms.txt', '/en/llms-full.txt']) assert.ok(fuentes.has(s), s);
  for (const r of reglas) {
    assert.equal(cab(r, 'X-Robots-Tag'), 'noindex', r.source);
    if (r.source.endsWith('.md')) {
      assert.equal(cab(r, 'Content-Type'), 'text/markdown; charset=utf-8', r.source);
      assert.match(cab(r, 'Link'), /^<https:\/\/rovaq\.ai[^>]*>; rel="canonical"$/, r.source);
    } else assert.equal(cab(r, 'Content-Type'), 'text/plain; charset=utf-8', r.source);
    if (r.source.startsWith('/s/')) assert.equal(cab(r, 'Cache-Control'), undefined, 'los espejos con hash conservan la caché inmutable de /s/');
  }
  const es = reglas.find((r) => r.source === md['es/hoy'].url);
  assert.equal(cab(es, 'Link'), '<https://rovaq.ai/producto/hoy>; rel="canonical"');
});

test('CSP candidata: solo informe, solo rovaq.ai, sin eval ni orígenes externos, con lista blanca', () => {
  const csp = cspSitioInforme();
  assert.match(csp, /default-src 'self'/); assert.match(csp, /object-src 'none'/); assert.match(csp, /frame-ancestors 'none'/);
  assert.doesNotMatch(csp, /unsafe-eval|https?:\/\/(?!app\.rovaq\.ai)/, 'sin eval ni orígenes de terceros');
  assert.match(csp, /style-src 'self'(;|$)/, 'el sitio no usa style en línea');
  assert.match(csp, /report-uri https:\/\/app\.rovaq\.ai\/api\/csp-informe/);
  const lista = JSON.parse(readFileSync(join(aqui, 'csp-lista-blanca.json'), 'utf8'));
  assert.deepEqual(lista.scriptsEnLinea, LISTA_BLANCA_NEXT_POR_DEFECTO.map((re) => re.source), 'la lista blanca del JSON es la del escáner');
  assert.equal(lista.evalPermitido, false);
  const [csp1, noindex] = reglasPorHost();
  assert.deepEqual(csp1.has, [{type: 'host', value: HOST_SITIO_RE}]);
  assert.equal(csp1.headers.length, 1); assert.equal(csp1.headers[0].key, 'Content-Security-Policy-Report-Only');
  assert.equal(csp1.headers.some((h) => h.key === 'Content-Security-Policy'), false, 'nada en modo enforce');
  assert.deepEqual(noindex.missing, [{type: 'host', value: HOST_SITIO_RE}]);
  assert.equal(cab(noindex, 'X-Robots-Tag'), 'noindex, nofollow');
});

test('next.config: la CSP en informe de la app excluye al sitio y no se pierde ninguna cabecera de seguridad', () => {
  const c = readFileSync(join(aqui, '../../next.config.ts'), 'utf8');
  assert.match(c, /missing: \[\{ type: 'host', value: HOST_SITIO_RE \}\], headers: \[\{ key: 'Content-Security-Policy-Report-Only', value: cspReportOnly \}\]/);
  for (const k of ['X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'Cross-Origin-Opener-Policy', 'Strict-Transport-Security', "max-age=31536000; includeSubDomains; preload", 'Cross-Origin-Resource-Policy'])
    assert.ok(c.includes(k), k);
  assert.match(c, /\.\.\.reglasEspejos\(manifestMd\), \.\.\.reglasPorHost\(\)/);
});

