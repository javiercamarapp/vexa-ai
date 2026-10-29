// Arnés de Chrome por CDP (T12): candado, carga de la Mac, criterios de métricas, axe vendoreado,
// juez, matriz de humo y, con ROVAQ_CDP_VIVO=1, una corrida real de Chrome contra una página local.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, utimesSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { evaluarCandado, adquirir } from '../../../../tools/sitio/cdp/candado.mjs';
import { parsearUptime, parsearSwap, cargaAlta } from '../../../../tools/sitio/cdp/carga-mac.mjs';
import { evaluarMetricas, resumirCuadros } from '../../../../tools/sitio/cdp/metricas.mjs';
import { violacionesGraves } from '../../../../tools/sitio/cdp/a11y.mjs';
import { evaluarJuez } from '../../../../tools/sitio/cdp/juez-validar.mjs';
import { origenesExternos } from '../../../../tools/sitio/cdp/navegador.mjs';
import { VIEWPORTS, CUADROS_CARGA_MS, RED_SLOW_4G } from '../../../../tools/sitio/cdp/config.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..', '..', '..');
const CDP = join(homedir(), 'vexa-tools', 'cdp');

test('config: viewports, cuadros de carga y Slow 4G de la sección 11', () => {
  assert.deepEqual([VIEWPORTS[1440].width, VIEWPORTS[1440].height], [1440, 900]);
  assert.deepEqual([VIEWPORTS[768].width, VIEWPORTS[768].height], [768, 1024]);
  assert.deepEqual([VIEWPORTS[390].width, VIEWPORTS[390].height], [390, 844]);
  assert.deepEqual(CUADROS_CARGA_MS, [0, 300, 700, 1100, 1500, 1900, 2400]);
  assert.equal(RED_SLOW_4G.latency, 150);
  assert.equal(RED_SLOW_4G.downloadThroughput, Math.floor((1.6 * 1024 * 1024) / 8));
});

// ---- candado
test('candado: uno libre no existe; con dueño vivo y reciente no es obsoleto', () => {
  const d = mkdtempSync(join(tmpdir(), 'cand-'));
  assert.equal(evaluarCandado(join(d, 'nada')).existe, false);
  const l = join(d, 'l'); mkdirSync(l);
  writeFileSync(join(l, 'dueno.json'), JSON.stringify({ pid: process.pid, t: Date.now() }));
  assert.equal(evaluarCandado(l).obsoleto, false);
});

test('candado: dueño inexistente es obsoleto', () => {
  const d = mkdtempSync(join(tmpdir(), 'cand-')); const l = join(d, 'l'); mkdirSync(l);
  writeFileSync(join(l, 'dueno.json'), JSON.stringify({ pid: 999999, t: Date.now() }));
  const e = evaluarCandado(l, Date.now(), 15 * 60000, () => false);
  assert.equal(e.obsoleto, true); assert.match(e.motivo, /ya no existe/);
});

test('candado: más de 15 minutos es obsoleto aunque el dueño viva', () => {
  const d = mkdtempSync(join(tmpdir(), 'cand-')); const l = join(d, 'l'); mkdirSync(l);
  writeFileSync(join(l, 'dueno.json'), JSON.stringify({ pid: process.pid, t: Date.now() - 16 * 60000 }));
  const e = evaluarCandado(l);
  assert.equal(e.obsoleto, true); assert.match(e.motivo, /min/);
});

test('candado de script viejo sin dueño se juzga por la edad del directorio', () => {
  const d = mkdtempSync(join(tmpdir(), 'cand-')); const l = join(d, 'l'); mkdirSync(l);
  assert.equal(evaluarCandado(l).obsoleto, false);
  const viejo = new Date(Date.now() - 20 * 60000); utimesSync(l, viejo, viejo);
  assert.equal(evaluarCandado(l).obsoleto, true);
});

test('adquirir borra un candado obsoleto, registra la advertencia y lo toma; liberar lo quita', async () => {
  const d = mkdtempSync(join(tmpdir(), 'cand-')); const l = join(d, 'l'); mkdirSync(l);
  writeFileSync(join(l, 'dueno.json'), JSON.stringify({ pid: 999999, t: Date.now() }));
  const avisos = [];
  const c = await adquirir({ ruta: l, esperaMaxMs: 1000, log: (m) => avisos.push(m) });
  assert.equal(avisos.length, 1); assert.match(avisos[0], /ADVERTENCIA.*obsoleto/);
  assert.equal(JSON.parse(readFileSync(join(l, 'dueno.json'), 'utf8')).pid, process.pid);
  c.liberar();
  assert.equal(existsSync(l), false);
});

test('adquirir con candado vivo espera y agota el tiempo (un solo Chrome a la vez)', async () => {
  const d = mkdtempSync(join(tmpdir(), 'cand-')); const l = join(d, 'l');
  const c = await adquirir({ ruta: l });
  await assert.rejects(adquirir({ ruta: l, esperaMaxMs: 100, log() {} }), /ocupado/);
  c.liberar();
});

// ---- carga de la Mac
test('uptime y vm.swapusage se parsean y la carga alta se detecta', () => {
  const u = parsearUptime('21:33  up 6 days, 7 users, load averages: 10.28 9.69 14.65');
  assert.deepEqual(u, { carga1: 10.28, carga5: 9.69, carga15: 14.65 });
  const s = parsearSwap('vm.swapusage: total = 9216.00M  used = 7475.50M  free = 1740.50M  (encrypted)');
  assert.ok(Math.abs(s.usadoPct - 81.1) < 0.1);
  assert.equal(cargaAlta({ ...u, swap: s }, { cargaMax: 6, swapUsadoMaxPct: 90 }).length, 1);
  assert.equal(cargaAlta({ carga1: 2, swap: { usadoPct: 40 } }, { cargaMax: 6, swapUsadoMaxPct: 90 }).length, 0);
  assert.equal(cargaAlta({ carga1: 9, swap: { usadoPct: 95 } }, { cargaMax: 6, swapUsadoMaxPct: 90 }).length, 2);
});

// ---- métricas
const BUENAS = { lcp: { t: 1200, elemento: 'h1.s-display' }, cls: 0.01, tbtMs: 40, fps: { scroll: { cuadrosLargos: 0, maxMs: 17 }, reposo: { cuadrosLargos: 0, maxMs: 17 } }, csp: [], errores: [], consolaErrores: [], origenesExternos: [] };
test('métricas buenas no fallan; cada criterio roto produce su falla', () => {
  assert.deepEqual(evaluarMetricas(BUENAS, { estrangulado: false }), []);
  const rotos = [
    [{ lcp: { t: 2600, elemento: 'p' } }, true, /LCP/],
    [{ lcp: { t: 1600, elemento: 'p' } }, false, /LCP/],
    [{ lcp: null }, false, /LCP/],
    [{ cls: 0.06 }, false, /CLS/],
    [{ tbtMs: 250 }, true, /TBT/],
    [{ fps: { scroll: { cuadrosLargos: 2, maxMs: 40 }, reposo: { cuadrosLargos: 0, maxMs: 10 } } }, false, /cuadros/],
    [{ clicMs: 140 }, false, /clic/],
    [{ csp: [{ directiva: 'script-src' }] }, false, /securitypolicyviolation/],
    [{ consolaErrores: [{ texto: 'x' }] }, false, /consola/],
    [{ origenesExternos: ['https://fonts.googleapis.com'] }, false, /origen externo/],
  ];
  for (const [parche, estr, re] of rotos) assert.ok(evaluarMetricas({ ...BUENAS, ...parche }, { estrangulado: estr }).some((f) => re.test(f)), JSON.stringify(parche));
});
test('LCP de 2 s pasa estrangulado (2.5 s) y falla sin estrangular (1.5 s)', () => {
  const m = { ...BUENAS, lcp: { t: 2000, elemento: 'h1' } };
  assert.equal(evaluarMetricas(m, { estrangulado: true }).length, 0);
  assert.equal(evaluarMetricas(m, { estrangulado: false }).length, 1);
});
test('resumirCuadros cuenta los de más de 25 ms', () => {
  const r = resumirCuadros([16, 16, 30, 17, 40]);
  assert.equal(r.cuadrosLargos, 2); assert.equal(r.maxMs, 40);
});
test('origenesExternos ignora data: y el origen propio', () => {
  assert.deepEqual(origenesExternos(['http://127.0.0.1:1/a', 'data:image/png;base64,xx', 'https://cdn.x.com/a.js', 'blob:x'], 'http://127.0.0.1:1/'), ['https://cdn.x.com']);
});

// ---- axe vendoreado
const hayCdp = existsSync(join(CDP, 'vendor', 'axe.min.js'));
test('axe-core vendoreado: hash del lock, versión fija y licencia MPL-2.0 en el archivo', { skip: hayCdp ? false : `PENDIENTE: ${CDP}/vendor/axe.min.js no existe` }, () => {
  const lock = JSON.parse(readFileSync(join(CDP, 'vendor', 'vendor.lock.json'), 'utf8'))['axe-core'];
  const src = readFileSync(join(CDP, 'vendor', 'axe.min.js'));
  assert.equal(createHash('sha256').update(src).digest('hex'), lock.sha256);
  assert.match(lock.version, /^\d+\.\d+\.\d+$/);
  assert.equal(lock.licencia, 'MPL-2.0');
  const cab = src.subarray(0, 800).toString('utf8');
  assert.match(cab, new RegExp('axe v' + lock.version.replace(/\./g, '\\.')));
  assert.match(cab, /Mozilla Public[\s*]+License, v\. 2\.0/);
  const pkg = JSON.parse(readFileSync(join(CDP, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies['axe-core'], lock.version);
  assert.match(pkg.dependencies['playwright-core'], /^\d+\.\d+\.\d+$/, 'playwright-core con versión exacta');
  assert.ok(existsSync(join(CDP, 'package-lock.json')), 'package-lock propio');
});
test('violacionesGraves solo deja serious y critical', () => {
  const r = { violations: [{ id: 'a', impact: 'minor', help: '', nodes: [{}] }, { id: 'b', impact: 'serious', help: 'h', nodes: [{ target: ['p'] }] }, { id: 'c', impact: 'critical', help: 'h', nodes: [{ target: ['img'] }, {}] }, { id: 'd', impact: 'moderate', help: '', nodes: [{}] }] };
  assert.deepEqual(violacionesGraves(r).map((v) => v.id), ['b', 'c']);
});

// ---- juez
const crit = (nota) => Array.from({ length: 10 }, (_, i) => ({ n: i + 1, nota, captura: 'x.png', accion: nota < 9 ? 'ajustar' : '' }));
const juez = (nota) => ({ ronda: 1, enterprise: true, celdas: Object.fromEntries(['escritorio-oscuro', 'escritorio-claro', 'movil-oscuro', 'movil-claro'].map((c) => [c, { criterios: crit(nota) }])) });
test('juez: aprueba con promedio 8 y nada bajo 7; rechaza si una celda promedia menos o un criterio baja de 7', () => {
  assert.equal(evaluarJuez(juez(8)).aprueba, true);
  assert.equal(evaluarJuez(juez(7)).aprueba, false);
  const j = juez(9); j.celdas['movil-claro'].criterios[3].nota = 6;
  const r = evaluarJuez(j);
  assert.equal(r.aprueba, false); assert.deepEqual(r.resumen['movil-claro'].bajos, [4]);
  const k = juez(9); k.enterprise = false;
  assert.equal(evaluarJuez(k).aprueba, false);
});
test('juez: salida incompleta o sin captura ni acción da errores', () => {
  const j = juez(8); delete j.celdas['movil-oscuro']; j.celdas['movil-claro'].criterios[0].captura = ''; j.celdas['movil-claro'].criterios[1].accion = '';
  assert.ok(evaluarJuez(j).errores.length >= 3);
});
test('el esquema JSON del juez y la rúbrica están completos', () => {
  const e = JSON.parse(readFileSync(join(RAIZ, 'tools/sitio/cdp/juez-esquema.json'), 'utf8'));
  const r = JSON.parse(readFileSync(join(RAIZ, 'tools/sitio/cdp/rubrica.json'), 'utf8'));
  assert.equal(r.criterios.length, 10); assert.equal(r.celdas.length, 4);
  assert.deepEqual(e.properties.celdas.required, r.celdas);
  assert.equal(e.properties.celdas.patternProperties['^(escritorio|movil)-(oscuro|claro)$'].properties.criterios.minItems, 10);
});

// ---- matriz de humo
test('humo-produccion.sh: sintaxis válida y exactamente 30 comprobaciones', () => {
  const sh = join(RAIZ, 'tools/sitio/humo-produccion.sh');
  assert.equal(spawnSync('bash', ['-n', sh]).status, 0);
  const r = spawnSync('bash', [sh, '--listar'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^30 comprobaciones$/m);
  const cuerpo = readFileSync(sh, 'utf8');
  assert.equal((cuerpo.match(/^comprobar "/gm) || []).length, 30);
  for (const clave of ['www', 'app.rovaq.ai', '/en', '/s/', 'robots', 'sitemap', 'llms', 'hreflang', 'Strict-Transport', '404', 'redirige']) assert.ok(cuerpo.includes(clave), clave);
});

// ---- corrida real de Chrome (opcional: abre Chrome, necesita la Mac sin carga)
const vivo = process.env.ROVAQ_CDP_VIVO === '1' && hayCdp;
test('Chrome real: sesión con webdriver, claro y oscuro, movimiento reducido y WebGL apagado', { skip: vivo ? false : 'PENDIENTE: corrida real de Chrome; se activa con ROVAQ_CDP_VIVO=1 (abre Chrome)' }, async () => {
  const { conSesion } = await import('../../../../tools/sitio/cdp/navegador.mjs');
  const html = 'data:text/html,<html><body><h1>x</h1></body></html>';
  const leer = (opc, js) => conSesion({ ...opc, sinCandado: false }, async ({ page }) => { await page.goto(html); return page.evaluate(js); });
  assert.equal(await leer({ vp: 390 }, 'navigator.webdriver'), true);
  assert.equal(await leer({ vp: 390, esquema: 'dark' }, 'matchMedia("(prefers-color-scheme: dark)").matches'), true);
  assert.equal(await leer({ vp: 390, esquema: 'light' }, 'matchMedia("(prefers-color-scheme: dark)").matches'), false);
  assert.equal(await leer({ vp: 390, movimiento: 'reduce' }, 'matchMedia("(prefers-reduced-motion: reduce)").matches'), true);
  assert.equal(await leer({ vp: 1440, webgl: false }, '!!document.createElement("canvas").getContext("webgl")'), false);
  assert.equal(await leer({ vp: 768 }, 'innerWidth + "x" + innerHeight'), '768x1024');
});
