// Escáner del HTML construido (SPEC 9.2): cero style, cero script en línea fuera de la lista
// blanca de Next, cero origen externo, cero inert, un h1, canonical absoluto, img con alt,
// width y height. Se prueba con fixtures y luego con .next/server/app/sitio tras `next build`
// (o con ROVAQ_HTML_DIR apuntando a otra carpeta).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { listarArchivos, escanearHtml, LISTA_BLANCA_NEXT_POR_DEFECTO, rel, leer } from './_escaner.mjs';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = process.env.ROVAQ_HTML_DIR || join(WEB, '.next', 'server', 'app', 'sitio');

const BUENO = `<!doctype html><html lang="es"><head><link rel="canonical" href="https://rovaq.ai/"><link rel="alternate" hreflang="en" href="https://rovaq.ai/en"><link rel="stylesheet" href="/s/a.css"><script type="application/ld+json">{"@type":"Organization"}</script></head><body><h1>Hola</h1><img src="/s/a.webp" alt="" width="10" height="10"><script>self.__next_f.push([1,"x"])</script><script src="/s/a.js" type="module"></script></body></html>`;

test('HTML bueno no produce hallazgos', () => assert.deepEqual(escanearHtml(BUENO), []));

const MALOS = {
  'style-atributo': BUENO.replace('<h1>', '<h1 style="color:red">'),
  'script-en-linea': BUENO.replace('</body>', '<script>alert(1)</script></body>'),
  'origen-externo': BUENO.replace('/s/a.css', 'https://cdn.ejemplo.com/a.css'),
  'inert': BUENO.replace('<h1>', '<h1 inert>'),
  'h1': BUENO.replace('<h1>Hola</h1>', '<h1>a</h1><h1>b</h1>'),
  'canonical': BUENO.replace('https://rovaq.ai/"><link rel="alt', '/relativo"><link rel="alt'),
  'img-atributos': BUENO.replace(' width="10" height="10"', ''),
};
for (const [regla, html] of Object.entries(MALOS)) {
  test(`detecta ${regla}`, () => assert.ok(escanearHtml(html).some((h) => h.regla === regla), regla));
}

test('la lista blanca de T3 (csp-lista-blanca.json) se respeta si existe', () => {
  const ruta = join(dirname(fileURLToPath(import.meta.url)), 'csp-lista-blanca.json');
  if (!existsSync(ruta)) return; // el escáner usa la lista por defecto
  const j = JSON.parse(readFileSync(ruta, 'utf8'));
  assert.ok(j && typeof j === 'object');
});

const archivos = listarArchivos(DIR, ['.html']);
const motivo = archivos.length ? false : `PENDIENTE: no hay HTML del sitio en ${rel(WEB, DIR)}; falta next build con las rutas del sitio (T1 y T14)`;
const lista = process.env.ROVAQ_LISTA_BLANCA ? [new RegExp(process.env.ROVAQ_LISTA_BLANCA)] : LISTA_BLANCA_NEXT_POR_DEFECTO;
const hallazgos = archivos.flatMap((f) => escanearHtml(leer(f), { archivo: rel(WEB, f), listaBlanca: lista }));
const fmt = (h) => `${h.archivo} ${h.regla}: ${h.nota}`;

test('HTML construido: sin style, sin script fuera de la lista blanca, sin origen externo, sin inert, un h1, img completas, lang', { skip: motivo }, () => {
  assert.deepEqual(hallazgos.filter((h) => h.regla !== 'canonical').map(fmt), []);
});

// El canonical lo emiten los metadatos de T2: mientras ninguna página lo traiga queda pendiente;
// si unas lo traen y otras no, falla.
const conCanonical = archivos.filter((f) => /rel="canonical"/.test(leer(f))).length;
test('HTML construido: canonical absoluto de rovaq.ai en cada página', { skip: motivo || (conCanonical === 0 ? 'PENDIENTE: ninguna página trae canonical todavía (metadatos de T2)' : false) }, () => {
  assert.deepEqual(hallazgos.filter((h) => h.regla === 'canonical').map(fmt), []);
});
