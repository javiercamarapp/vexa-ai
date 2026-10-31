// T2: preparación para agentes de IA. llms.txt, llms-full.txt, espejos Markdown, política de rastreadores, cabeceras y negociación.
// Sin servidor:  node --test tests/sitio/agentic.test.mjs  (Node 22.18 o posterior).
// Con servidor local (next start en el puerto SITIO_PUERTO, por ejemplo 4417):  SITIO_PUERTO=4417 node --test tests/sitio/agentic.test.mjs
// corre además tools/sitio/verificar-agentes.sh con Host rovaq.ai. AGENTIC_LISTO=1 (antes de publicar) falla si queda un marcador sin resolver.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cargarSitio, espejoMd, llmsFullTxt, llmsTxt, producir } from '../../../../tools/sitio/generar-md.mjs';
import { rutaEspejo, urlAbsoluta } from '../../src/lib/sitio/metadatos.mjs';
import { plantillaSecurityTxt, reglasCabecerasEspejos, reglasNegociacionMarkdown } from '../../config/sitio/agentic.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(aqui, '..', '..');
const PUB = path.join(WEB, 'public');
const BASE = 'https://rovaq.ai';
const sitio = await cargarSitio();
const { fichas, M } = sitio;
const publicas = fichas.filter((f) => f.indexable);
const pendientes = fichas.filter((f) => !f.indexable);
const IDIOMAS = ['es', 'en'];
const manifest = JSON.parse(fs.readFileSync(path.join(PUB, 's', 'manifest.json'), 'utf8'));
const PROHIBIDAS = JSON.parse(fs.readFileSync(path.join(aqui, 'prohibidas.json'), 'utf8'));
const lee = (r) => fs.readFileSync(path.join(PUB, r), 'utf8');
const RE_CORREO = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const espejoDe = (id, lang) => rutaEspejo(id, lang, manifest.md);

const LLMS = ['llms.txt', 'llms-full.txt', 'en/llms.txt', 'en/llms-full.txt'];
const MIRRORS = publicas.flatMap((f) => IDIOMAS.map((l) => ({ f, l, ruta: espejoDe(f.id, l) })));
const TODOS = [...LLMS, ...MIRRORS.map((m) => m.ruta.slice(1))];

/** Texto sin front matter ni destinos de enlaces: las reglas editoriales hablan del texto, no de las direcciones. */
const cuerpo = (t) => t.replace(/^---\n[\s\S]*?\n---\n/, '').replace(/\]\([^)]*\)/g, ']').replace(/https?:\/\/\S+/g, '');

describe('llms.txt y llms-full.txt', () => {
  test('existen en español y en inglés y no están vacíos', () => {
    for (const r of LLMS) assert.ok(fs.statSync(path.join(PUB, r)).size > 800, r);
  });
  test('llms.txt sigue el formato: H1, cita de resumen, secciones H2 y enlaces absolutos', () => {
    for (const r of ['llms.txt', 'en/llms.txt']) {
      const t = lee(r);
      assert.match(t, /^# Rovaq AI\n\n> .{120,}/s, r);
      assert.ok((t.match(/^## /gm) ?? []).length >= 3, r);
      for (const m of t.matchAll(/\]\(([^)\s]+)\)/g)) assert.match(m[1], /^https:\/\/rovaq\.ai(\/|$)/, `${r}: ${m[1]}`);
    }
  });
  test('llms.txt solo enlaza a URLs que existen: páginas publicables, espejos del manifest, llms-full, mapa del sitio y la otra versión', () => {
    const vivas = new Set([`${BASE}/sitemap.xml`, `${BASE}/llms.txt`, `${BASE}/en/llms.txt`, `${BASE}/llms-full.txt`, `${BASE}/en/llms-full.txt`]);
    for (const f of publicas) for (const l of IDIOMAS) { vivas.add(urlAbsoluta(f.ruta[l])); vivas.add(`${BASE}${espejoDe(f.id, l)}`); }
    for (const r of ['llms.txt', 'en/llms.txt']) for (const m of lee(r).matchAll(/\]\(([^)\s]+)\)/g)) assert.ok(vivas.has(m[1]), `${r} enlaza a una URL que no existe: ${m[1]}`);
  });
  test('llms.txt lista cada página publicable (menos la portada, que va aparte) y ninguna pendiente', () => {
    for (const l of IDIOMAS) {
      const t = lee(l === 'es' ? 'llms.txt' : 'en/llms.txt');
      for (const f of publicas.filter((x) => x.id !== 'inicio')) assert.ok(t.includes(`${BASE}${espejoDe(f.id, l)}`), `${l}: falta ${f.id}`);
      for (const f of pendientes) assert.ok(!t.includes(f.ruta[l]), `${l}: ${f.id} está pendiente y aparece`);
    }
  });
  test('llms-full.txt trae la portada y cada página publicable, con su fuente, y ninguna pendiente', () => {
    for (const l of IDIOMAS) {
      const t = lee(l === 'es' ? 'llms-full.txt' : 'en/llms-full.txt');
      assert.match(t, /^# Rovaq AI\n\n> /);
      for (const f of publicas.filter((x) => x.id !== 'inicio')) {
        assert.ok(t.includes(`${l === 'es' ? 'Fuente' : 'Source'}: ${urlAbsoluta(f.ruta[l])}\n`), `${l}: falta ${f.id}`);
        assert.ok(t.includes(f.arbol.h1[l].replace(/\s+/g, ' ')), `${l}: falta el título de ${f.id}`);
      }
      for (const f of pendientes) assert.ok(!t.includes(`${l === 'es' ? 'Fuente' : 'Source'}: ${urlAbsoluta(f.ruta[l])}\n`), `${l}: ${f.id} pendiente`);
      assert.match(t, /Contenido actualizado: \d{4}-\d{2}-\d{2}|Content updated: \d{4}-\d{2}-\d{2}/);
    }
  });
  test('los archivos de disco son los que generaría la herramienta con el contenido actual (no hay desfase)', () => {
    const { archivos } = producir({ fichas, ctx: sitio.ctx });
    for (const [ruta, texto] of archivos) assert.equal(lee(ruta), texto, `${ruta}: correr node tools/sitio/generar-md.mjs`);
    const md = path.join(PUB, 's', 'md');
    const enDisco = fs.readdirSync(md, { recursive: true }).filter((n) => n.endsWith('.md')).map((n) => `s/md/${n}`);
    for (const r of enDisco) assert.ok(archivos.has(r), `sobra ${r}`);
    assert.equal(enDisco.length, MIRRORS.filter((m) => m.f.id !== 'inicio').length);
  });
  test('la generación es determinista', () => {
    const a = producir({ fichas, ctx: sitio.ctx }).archivos, b = producir({ fichas, ctx: sitio.ctx }).archivos;
    assert.deepEqual([...a], [...b]);
    assert.equal(llmsTxt(fichas, 'es', espejoDe), lee('llms.txt'));
    assert.equal(llmsFullTxt(fichas, 'en'), lee('en/llms-full.txt'));
  });
});

describe('espejos Markdown', () => {
  test('cada página publicable tiene espejo en los dos idiomas y ninguna pendiente lo tiene', () => {
    for (const { f, l, ruta } of MIRRORS) assert.ok(ruta && (f.id === 'inicio' || ruta.startsWith(`/s/md/${l}/${f.id}.`)), `${f.id}.${l}`);
    for (const f of pendientes) for (const l of IDIOMAS) {
      assert.equal(espejoDe(f.id, l), null, `${f.id}.${l} pendiente con espejo en el manifest`);
      assert.deepEqual(fs.readdirSync(path.join(PUB, 's', 'md', l)).filter((n) => n.startsWith(`${f.id}.`)), []);
    }
  });
  test('manifest.md declara cada espejo con su hash en el nombre, su tamaño y su sha256 reales', () => {
    assert.equal(Object.keys(manifest.md).length, publicas.filter((f) => f.id !== 'inicio').length * 2);
    for (const [clave, e] of Object.entries(manifest.md)) {
      const buf = fs.readFileSync(path.join(PUB, e.url.slice(1)));
      assert.equal(createHash('sha256').update(buf).digest('hex'), e.sha256, clave);
      assert.equal(buf.length, e.bytes, clave);
      assert.match(e.url, new RegExp(`^/s/md/${clave.replace('/', '/')}\\.${e.sha256.slice(0, 8)}\\.md$`), `hash en el nombre: ${e.url}`);
    }
  });
  test('frente de cada espejo: título, descripción, URL canónica, idioma, noindex y fecha real', () => {
    for (const { f, l, ruta } of MIRRORS) {
      const t = lee(ruta.slice(1));
      const frente = /^---\n([\s\S]*?)\n---\n/.exec(t)?.[1] ?? '';
      const campos = Object.fromEntries(frente.split('\n').map((x) => [x.slice(0, x.indexOf(':')), x.slice(x.indexOf(':') + 2)]));
      assert.equal(campos.title, f.titulo[l]);
      assert.equal(campos.description, f.descripcion[l]);
      assert.equal(campos.canonical_url, urlAbsoluta(f.ruta[l]));
      assert.equal(campos.url, campos.canonical_url);
      assert.equal(campos.language, l === 'es' ? 'es-MX' : 'en');
      assert.equal(campos.robots, 'noindex');
      assert.equal(campos.alternate_language_url, urlAbsoluta(f.ruta[l === 'es' ? 'en' : 'es']));
      assert.match(campos.last_modified, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(t.replace(/^---\n[\s\S]*?\n---\n/, ''), /^\s*# \S/, 'después del frente va el h1');
    }
  });
  test('el espejo sale del mismo contenido que el HTML: mismo h1 y mismos textos de las preguntas', () => {
    for (const l of IDIOMAS) {
      const md = lee(l === 'es' ? 'index.md' : 'en/index.md');
      assert.ok(md.includes(`# ${sitio.fichas[0].arbol.hero.titulo[l]}`));
      for (const q of sitio.fichas[0].arbol.faq.items) assert.ok(md.includes(q.q[l]), q.q[l]);
    }
  });
  test('un espejo no existe para una página no publicable aunque se pida a la función', () => {
    const pend = pendientes[0];
    assert.throws(() => espejoMd(pend, 'es', fichas));
  });
  test('cabeceras de los espejos y de llms: noindex, tipo y Link con el canonical HTML (reglas para T3)', () => {
    const reglas = reglasCabecerasEspejos(publicas, espejoDe);
    assert.equal(reglas.length, MIRRORS.length + 4);
    for (const r of reglas) {
      const h = Object.fromEntries(r.headers.map((x) => [x.key, x.value]));
      assert.equal(h['X-Robots-Tag'], 'noindex', r.source);
      assert.match(h['Content-Type'], /^text\/(markdown|plain); charset=utf-8$/, r.source);
      if (r.source.endsWith('.md')) assert.match(h.Link, /^<https:\/\/rovaq\.ai[^>]*>; rel="canonical"$/, r.source);
    }
    const hoy = reglas.find((r) => r.source === espejoDe('hoy', 'es'));
    assert.equal(hoy.headers.find((x) => x.key === 'Link').value, `<${BASE}/producto/hoy>; rel="canonical"`);
  });
  test('negociación Accept: text/markdown: una regla por URL publicable, solo en rovaq.ai y sin mirar el User-Agent', () => {
    const reglas = reglasNegociacionMarkdown(publicas, espejoDe);
    assert.equal(reglas.length, MIRRORS.length);
    for (const r of reglas) {
      assert.ok(r.has.some((h) => h.type === 'host' && h.value === 'rovaq.ai'));
      assert.ok(r.has.some((h) => h.type === 'header' && h.key === 'accept'));
      assert.ok(!r.has.some((h) => /user-agent/i.test(h.key ?? '')), 'sin cloaking por User-Agent');
      assert.ok(MIRRORS.some((m) => m.ruta === r.destination));
    }
    const fuente = fs.readFileSync(path.join(WEB, '..', '..', 'tools', 'sitio', 'generar-md.mjs'), 'utf8');
    const codigo = fuente.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    assert.doesNotMatch(codigo, /user-agent|userAgent/i);
  });
});

describe('contenido veraz y reglas editoriales', () => {
  test('sin paréntesis, signos de exclamación ni emojis en el texto de llms y de los espejos', () => {
    const malos = [];
    for (const r of TODOS) {
      const t = cuerpo(lee(r));
      if (/[()!¡]/.test(t)) malos.push(`${r}: ${[...t.matchAll(/.{0,30}[()!¡].{0,30}/g)][0]?.[0]}`);
      if (/\p{Extended_Pictographic}/u.test(t)) malos.push(`${r}: emoji`);
    }
    assert.deepEqual(malos, []);
  });
  test('ninguna de las 45 afirmaciones prohibidas (ni las adicionales) aparece en llms ni en los espejos', () => {
    const ctx = new RegExp(PROHIBIDAS.contextoSeguro, PROHIBIDAS.banderas);
    const oraciones = (t) => [...t.matchAll(/[^.!?\n]+[.!?]?/gu)].map((m) => ({ ini: m.index, fin: m.index + m[0].length, texto: m[0] }));
    const todas = [...PROHIBIDAS.afirmaciones.filter((a) => a.regla !== 'estructural'), ...PROHIBIDAS.adicionales];
    const malas = [];
    for (const r of TODOS) {
      const t = cuerpo(lee(r));
      // Los encabezados de pregunta y su respuesta forman una unidad; se revisa por bloque entre encabezados.
      const bloques = t.split(/\n(?=#{1,5} )/);
      for (const b of bloques) for (const a of todas) {
        if ((a.excepciones ?? []).some((e) => new RegExp(e.ruta).test(r))) continue;
        for (const p of a.patrones) for (const m of b.matchAll(new RegExp(p, PROHIBIDAS.banderas.includes('g') ? PROHIBIDAS.banderas : `${PROHIBIDAS.banderas}g`))) {
          if (a.regla === 'negada') {
            const os = oraciones(b), i = os.findIndex((x) => m.index >= x.ini && m.index < x.fin);
            if (i >= 0 && ctx.test(os.slice(Math.max(0, i - 1), i + 2).map((x) => x.texto).join(' '))) continue;
            if (/^#{1,5} .*\?/.test(b) && ctx.test(b)) continue; // una pregunta que se responde con negación
          }
          // El titular decidido por el dueño va con su subtítulo y su límite adyacentes: está en la excepción del hero.
          if (/Know how much money you lose|Sabe cuánto dinero se te va/i.test(m.input.slice(Math.max(0, m.index - 40), m.index + 60))) continue;
          malas.push(`${r} #${a.n ?? a.id}: ${m[0]} <- ${b.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\n/g, ' ')}`);
        }
      }
    }
    assert.deepEqual(malas, []);
  });
  test('sin cifras de clientes, precios ni planes', () => {
    for (const r of TODOS) {
      const t = lee(r);
      assert.doesNotMatch(t, /\$\s?\d|usd al mes|por mes|\/mes|per month/i, r);
      assert.doesNotMatch(t, /\b\d+\s*(clientes|customers|usuarios|users)\b/i, r);
    }
  });
  test('el nombre anterior del producto no aparece', () => {
    for (const r of TODOS) assert.doesNotMatch(lee(r), /\bvexa\b/i, r);
  });
  test('ningún correo en los archivos públicos para agentes, en los espejos, en humans.txt ni en el manifest del sitio', () => {
    const contacto = M.contextoPorDefecto().contacto;
    for (const r of [...TODOS, 'humans.txt', 'sitio.webmanifest']) {
      const t = lee(r);
      assert.ok(!t.includes(contacto), `${r} repite el buzón de contacto`);
      assert.doesNotMatch(t, RE_CORREO, `${r} trae una dirección de correo`);
    }
  });
  test('sin marcadores entre corchetes en ningún archivo público (AGENTIC_LISTO exige además que security.txt exista resuelto o no se publique)', () => {
    for (const r of TODOS) assert.doesNotMatch(lee(r), /\[[A-Z][A-Z0-9_]*\]/, `${r}: marcador sin resolver`);
    const sec = path.join(PUB, '.well-known', 'security.txt');
    if (fs.existsSync(sec)) assert.doesNotMatch(fs.readFileSync(sec, 'utf8'), /\[(CORREO|FECHA|REVIEW|CONTACT)[A-Z_]*\]/);
  });
  test('la solicitud de acceso se explica sin repetir el buzón: apunta a la página de solicitud', () => {
    const t = lee('index.md');
    assert.ok(t.includes('Solicita acceso en https://rovaq.ai/solicitar-acceso') || t.includes(`Solicitar acceso: ${BASE}/solicitar-acceso`));
    assert.ok(lee('en/index.md').includes('https://rovaq.ai/en/request-access'));
  });
});

describe('security.txt', () => {
  test('no se publica mientras [CORREO_DE_SEGURIDAD] y [FECHA_DE_REVISION] no existan', () => {
    const ctx = M.contextoPorDefecto();
    assert.equal(ctx.seguridad, null);
    assert.equal(ctx.fechaRevision, null);
    assert.ok(!fs.existsSync(path.join(PUB, '.well-known', 'security.txt')));
    assert.ok(!producir({ fichas, ctx }).archivos.has('.well-known/security.txt'));
  });
  test('con buzón y fecha resueltos se genera con los campos de RFC 9116 y el Canonical del dominio real', () => {
    const { archivos } = producir({ fichas, ctx: { ...M.contextoPorDefecto(), seguridad: 'seguridad@ejemplo.test', fechaRevision: '2027-04-28T00:00:00.000Z' } });
    const t = archivos.get('.well-known/security.txt');
    assert.match(t, /^Contact: mailto:seguridad@ejemplo\.test$/m);
    assert.match(t, /^Expires: 2027-04-28T00:00:00\.000Z$/m);
    assert.match(t, /^Preferred-Languages: es, en$/m);
    assert.match(t, /^Canonical: https:\/\/rovaq\.ai\/\.well-known\/security\.txt$/m);
    assert.equal(plantillaSecurityTxt({ correo: 'a@b.c', expira: '2027-01-01' }).split('\n')[0].startsWith('#'), true);
  });
  test('compuerta de publicación (solo con AGENTIC_LISTO=1): security.txt existe y sin marcadores', { skip: process.env.AGENTIC_LISTO !== '1' }, () => {
    assert.ok(fs.existsSync(path.join(PUB, '.well-known', 'security.txt')), 'falta security.txt');
  });
});

describe('contra el servidor local (SITIO_PUERTO) con Host rovaq.ai', { skip: process.env.SITIO_PUERTO ? false : 'sin SITIO_PUERTO: next start no está corriendo' }, () => {
  test('tools/sitio/verificar-agentes.sh no tiene fallas', () => {
    const script = path.join(WEB, '..', '..', 'tools', 'sitio', 'verificar-agentes.sh');
    let salida = '';
    try {
      salida = execFileSync('bash', [script, `http://127.0.0.1:${process.env.SITIO_PUERTO}`], { encoding: 'utf8', env: { ...process.env, HOST_SITIO: 'rovaq.ai', HOST_APP: 'app.rovaq.ai' }, timeout: 180000 });
    } catch (e) { assert.fail(`${e.stdout ?? ''}${e.stderr ?? ''}`); }
    assert.match(salida, /TODO EN ORDEN/);
  });
});
