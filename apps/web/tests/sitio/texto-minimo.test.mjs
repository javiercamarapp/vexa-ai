// Tamaño mínimo del texto real (T16): 12 px a 1440 y 11 px a 390, excluyendo las imágenes (capturas del producto).
// Sin Chrome: la fuente CSS no declara ningún tamaño literal bajo 11 px y el token mínimo es 12 px (11 px a 768 o menos).
// Con ROVAQ_CDP_VIVO=1 y ROVAQ_URL: recorre la portada en Chrome y mide el tamaño efectivo de cada texto visible (incluido el de los SVG escalados).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const AQUI = dirname(fileURLToPath(import.meta.url));
const WEB = join(AQUI, '..', '..');
const RAIZ = join(WEB, '..', '..');
const DIR = join(WEB, 'src', 'styles', 'sitio');
const css = readdirSync(DIR).filter((f) => f.endsWith('.css')).map((f) => [f, readFileSync(join(DIR, f), 'utf8')]);
const TOKENS = readFileSync(join(DIR, 'tokens.css'), 'utf8');

test('fuente: ningún font-size literal por debajo de 11 px en el CSS del sitio', () => {
  const bajos = [];
  for (const [f, s] of css) for (const m of s.matchAll(/font(?:-size)?:\s*(?:[^;{}]*?\s)?(\d+(?:\.\d+)?)px/g)) if (!/calc\(/.test(m[0]) && Number(m[1]) < 11 && Number(m[1]) > 0) bajos.push(`${f}: ${m[0]}`);
  assert.deepEqual(bajos, []);
});

test('fuente: el token de tamaño mínimo es 12 px y baja a 11 px solo a 768 px o menos', () => {
  assert.match(TOKENS, /--s-t-minimo:\s*12px/);
  const bloque = TOKENS.match(/@media \(max-width: 768px\) \{\s*:root \{([^}]*)\}/);
  assert.ok(bloque && /--s-t-minimo:\s*11px/.test(bloque[1]), 'a 768 px o menos el mínimo es 11 px');
  assert.ok(!/--s-t-minimo:\s*(?:[0-9]|10)(?:\.\d+)?px/.test(TOKENS), 'nunca menos de 11');
});

const vivo = process.env.ROVAQ_CDP_VIVO === '1' && process.env.ROVAQ_URL;
test('Chrome: todo texto visible mide 12 px a 1440 y 11 px a 390 (sin contar imágenes)', {skip: vivo ? false : 'PENDIENTE: corrida real de Chrome; ROVAQ_CDP_VIVO=1 y ROVAQ_URL'}, () => {
  const salida = execFileSync(process.execPath, [join(RAIZ, 'tools/sitio/cdp/texto-minimo.mjs'), '--url', process.env.ROVAQ_URL, '--vp', '1440,390'], {encoding: 'utf8', timeout: 300000});
  assert.match(salida, /OK +vp 1440/);
  assert.match(salida, /OK +vp 390/);
  assert.ok(existsSync(RAIZ));
});
