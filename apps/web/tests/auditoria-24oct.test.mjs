// Auditoría de calidad del 24-oct: pruebas de las correcciones con lógica (A2, A3, A6 y las medias que siguen).
//   cd apps/web && node --test tests/auditoria-24oct.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {partesCaidas,debeReintentar,elegirDato} from '../src/lib/workspace/reintento-vista.mjs';
import {crearVigilante} from '../src/lib/workspace/vivos.mjs';
const leer = r => readFileSync(new URL('../src/' + r, import.meta.url), 'utf8');

test('A3: partes caídas se cuentan y el reintento silencioso es único y nunca empeora lo pintado', () => {
  const caida = {carga: {status: 'ok'}, sla: {status: 'unavailable'}, cierre: {status: 'unavailable'}};
  const buena = {carga: {status: 'ok'}, sla: {status: 'ok'}, cierre: {status: 'ok'}};
  assert.equal(partesCaidas(caida), 2); assert.equal(partesCaidas(buena), 0); assert.equal(partesCaidas(null), 0);
  assert.equal(debeReintentar(caida, 0), true); assert.equal(debeReintentar(caida, 1), false); assert.equal(debeReintentar(buena, 0), false);
  assert.equal(elegirDato(caida, buena), buena);
  assert.equal(elegirDato(buena, caida), buena, 'una respuesta peor no reemplaza a la buena');
  assert.equal(elegirDato(null, caida), caida);
  assert.equal(partesCaidas({a: {status: 'ok', x: {status: 'unavailable'}}}), 1);
});
test('A3: useVista reintenta en silencio (1.ª carga fallida y partes caídas) y usa el cupo', () => {
  const src = leer('components/map/use-vista.ts');
  assert.match(src, /fetchCupo/); assert.match(src, /debeReintentar/); assert.match(src, /elegirDato/);
  assert.match(src, /await dormir\(1500/);
});
test('A6: el primer sondeo de /api/freshness se difiere y no compite con la primera pantalla', async () => {
  const llamadas = []; const timers = [];
  const v = crearVigilante({fetchFn: async u => { llamadas.push(u); return {ok: true, status: 200, json: async () => ({data: {availability: 'ready', version: 'abcdef0123456789'}})}; },
    setT: (f, ms) => { timers.push({f, ms}); return timers.length; }, clearT: () => {}, primerRetrasoMs: 6000});
  v.iniciar();
  assert.equal(llamadas.length, 0); assert.equal(timers[0].ms, 6000);
  const v2 = crearVigilante({fetchFn: async u => { llamadas.push(u); return {ok: true, status: 200, json: async () => ({data: {availability: 'ready', version: 'abcdef0123456789'}})}; }, setT: () => 1, clearT: () => {}});
  v2.iniciar(); assert.equal(llamadas.length, 1, 'sin retraso consulta enseguida (comportamiento previo)');
  assert.match(leer('components/workspace/datos-nuevos.tsx'), /primerRetrasoMs:PRIMER_SONDEO_MS/);
});
test('A6: «Datos y confianza» pinta en cuanto llega CUALQUIER lectura (no espera a freshness)', () => {
  assert.match(leer('components/confianza/confianza-pantalla.tsx'), /!fresh\.data&&!cov\.data&&!fuga\.data&&!carga\.data&&!tr\.data\)return <RovaqCargando/);
});
test('A2: /briefs ofrece «Reintentar», no manda a «Actualizar» y el historial se lee con memoria del servidor', () => {
  const p = leer('components/briefs/panel.tsx');
  assert.match(p, /state-error[^>]*>.*Reintentar/s); assert.ok(!/Actualiza para comprobar|Actualiza antes/.test(p));
  const sv = leer('lib/briefs/server.ts');
  assert.match(sv, /conMemoria\('briefs\|'/); assert.match(sv, /olvidarMemoria\(\)/);
  assert.match(sv, /getUser\(\)[\s\S]{0,200}conMemoria/, 'la sesión se valida antes de consultar la memoria');
});

import {usd, dinero} from '../src/lib/formato/es-mx.mjs';
import {formatMinorUnits} from '../src/lib/formato/dinero-pantalla.mjs';
test('M2: un solo formato de dinero es-MX con «US$» en toda la pantalla (nada de «803,982.16 USD»)', () => {
  assert.equal(usd('80398216'), 'US$803,982'); assert.equal(formatMinorUnits('80398216', 'USD', 2), 'US$803,982');
  assert.equal(formatMinorUnits('-123400', 'USD', 2), '−US$1,234'); assert.equal(formatMinorUnits(null, 'USD', 2), 'No disponible');
  assert.equal(dinero('120000', 'MXN', 2), 'MX$1,200'); assert.equal(dinero('5000', 'EUR', 2), 'EUR 50'); assert.equal(dinero(null), '—');
  assert.equal(usd('80398216', {decimales: true}), 'US$803,982.16');
  // ninguna pantalla de lectura importa el formateador viejo («… USD»); solo los paneles de importación (que verifican centavos) lo conservan
  const permitidos = new Set(['economic-priority-panel.tsx', 'economic-import-panel.tsx', 'economic-panel.tsx', 'economic-money-panel.tsx', 'economic-exposure-panel.tsx', 'dinero-pantalla.mjs']);
  const {readdirSync, statSync} = require_fs();
  const recorre = d => readdirSync(d).flatMap(n => { const p = d + '/' + n; return statSync(p).isDirectory() ? recorre(p) : [p]; });
  const raiz = new URL('../src/', import.meta.url).pathname;
  for (const f of recorre(raiz).filter(x => /\.(tsx|mjs)$/.test(x) && !/\.test\./.test(x))) {
    if (permitidos.has(f.split('/').pop())) continue;
    assert.ok(!/packages\/metrics\/money\.mjs/.test(readFileSync(f, 'utf8')), 'formato viejo de dinero en ' + f);
  }
});
import * as fs from 'node:fs';
function require_fs() { return fs; }
