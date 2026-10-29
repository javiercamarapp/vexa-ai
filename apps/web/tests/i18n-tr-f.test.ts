// Traducción grupo F (adjuntos, embudo y módulos puros con idioma): paridad es/en, reglas del inglés y salidas puras en inglés.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trFEs, trFEn} from '../src/lib/i18n/d-tr-f';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';
import {analizarAdjunto, validarArchivo} from '../src/components/agente/attachments';
import {estadoCarga, filasConfirmadas} from '../src/lib/jobs/progreso.mjs';
import {buildCfoModel, metricCoverage} from '../src/components/workspace/cfo-model.mjs';
import {compactEs, mesAbrev} from '../src/lib/charts/escala.mjs';
import {mil} from '../src/lib/connections/estado.mjs';
import {usdCorto, kpisDe} from '../src/components/pain-points/modelo.mjs';
import {TXT as TBrief} from '../src/components/copiloto/briefing-cfo.mjs';
import {TXT as TConf} from '../src/components/confianza/confianza-modelo.mjs';
import {TXT as TFuga} from '../src/components/refunds/fuga-modelo.mjs';
import {TXT as TProg} from '../src/lib/jobs/progreso.mjs';
import {TXT as TCfo} from '../src/components/workspace/cfo-model.mjs';

const variables = (t: string) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const ES = trFEs as Record<string, string>, EN = trFEn as Record<string, string>;

test('d-tr-f: claves idénticas, sin vacíos, mismas {variables} e incorporadas en es.ts y en.ts', () => {
  const ke = Object.keys(ES).sort(), kn = Object.keys(EN).sort();
  assert.ok(ke.length >= 10); assert.deepEqual(kn, ke);
  for (const k of ke) {
    assert.ok(k.startsWith('tr.'), k); assert.ok(ES[k].trim() && EN[k].trim(), k);
    assert.equal(variables(EN[k]), variables(ES[k]), k);
    assert.equal((es as Record<string, string>)[k], ES[k]); assert.equal((en as Record<string, string>)[k], EN[k]);
  }
});
const reglasEn = (k: string, v: string) => {
  assert.doesNotMatch(v, /[áéíóúñüÁÉÍÓÚÑÜ¿¡]/, 'acento: ' + k); assert.doesNotMatch(v, /[()]/, 'paréntesis: ' + k);
  assert.doesNotMatch(v, /\p{Extended_Pictographic}/u, 'emoji: ' + k); assert.doesNotMatch(v.replace(/\{\w+\}/g, ''), /(^|[^\w.-])\d{2,}/, 'cifra a mano: ' + k);
};
test('d-tr-f: reglas del inglés', () => { for (const [k, v] of Object.entries(EN)) reglasEn(k, v); });
test('módulos puros: mismas claves es/en y el inglés sin acentos ni emojis', () => {
  for (const T of [TBrief, TConf, TFuga, TProg, TCfo] as Record<'es' | 'en', Record<string, unknown>>[]) {
    assert.deepEqual(Object.keys(T.en).sort(), Object.keys(T.es).sort());
    const plano = (o: unknown): string[] => typeof o === 'string' ? [o] : typeof o === 'function' ? [(o as (...a: string[]) => string)(...Array(7).fill('X'))] : o && typeof o === 'object' ? Object.values(o).flatMap(plano) : [];
    for (const v of plano(T.en)) { assert.doesNotMatch(v, /[áéíóúñ¿¡]/); assert.doesNotMatch(v, /\p{Extended_Pictographic}/u); }
  }
});
test('funciones puras en inglés conservan el español por omisión', () => {
  assert.equal(validarArchivo('a.csv', 0), 'El archivo está vacío.'); assert.equal(validarArchivo('a.csv', 0, 'en'), 'The file is empty.');
  const r = analizarAdjunto('a.json', '{x', 5, 'id', 'en'); assert.ok(!r.ok && r.error === 'The JSON is not valid.');
  assert.equal(estadoCarga('succeeded'), 'Completada'); assert.equal(estadoCarga('succeeded', 'en'), 'Completed');
  assert.equal(filasConfirmadas(1, 'en'), '1 row confirmed'); assert.equal(filasConfirmadas(12446), '12,446 filas confirmadas');
  assert.equal(metricCoverage({known_n: 0, eligible_n: 0}, 'en').label, 'No eligible records');
  assert.equal(buildCfoModel([], 'en').comparisonNote, 'There are no complete amounts to compare.');
  assert.equal(compactEs(2100000, 'en'), '2.1M'); assert.equal(mesAbrev('2026-10', 'en'), 'Oct');
  assert.equal(mil(1200000, 'en'), '1.2M'); assert.equal(mil(1200000), '1,2 millones');
  assert.equal(usdCorto('123456789', 'en'), '$1.2M'); assert.equal(usdCorto('123456789'), '$1.2 M');
  assert.equal(kpisDe({puntos: []} as never, 'en')[3].label, 'Pain points');
});
