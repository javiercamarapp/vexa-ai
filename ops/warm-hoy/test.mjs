// node --test ops/warm-hoy/test.mjs  (servidor HTTP local de mentira; no toca red externa ni datos)
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RUTAS_HOY, origenValido, leerCookie, pedir, ronda, formatear } from './warm-hoy.mjs';

const servidor = (manejador) => new Promise((res) => { const s = http.createServer(manejador); s.listen(0, '127.0.0.1', () => res({ s, url: `http://127.0.0.1:${s.address().port}` })); });

test('pide exactamente las tres rutas que usa Hoy, solo con GET', async () => {
  assert.deepEqual(RUTAS_HOY.map((r) => r.ruta), ['/api/refunds', '/api/workload', '/cfo/data/report']);
  const vistas = [];
  const { s, url } = await servidor((q, r) => { vistas.push(`${q.method} ${q.url}`); r.setHeader('content-type', 'application/json'); r.end('{"data":{}}'); });
  try { await ronda(url, 'a=b'); } finally { s.close(); }
  assert.deepEqual(vistas.sort(), ['GET /api/refunds', 'GET /api/workload', 'GET /cfo/data/report']);
});
test('manda la cookie solo si hay y reporta el origen de la cifra', async () => {
  const cookies = [];
  const { s, url } = await servidor((q, r) => { cookies.push(q.headers.cookie ?? null); r.setHeader('content-type', 'application/json'); r.end(JSON.stringify({ data: { origenLibro: 'precalculado', libroPrecalculadoAt: '2026-10-28T10:00:00Z', sla: { origen: 'en_vivo' }, carga: { origen: 'precalculado' }, status: 'ok' } })); });
  try {
    const res = await ronda(url, 'sb=token');
    assert.ok(cookies.every((c) => c === 'sb=token'));
    assert.deepEqual(res.find((r) => r.id === 'reembolsos').origen, { libro: 'precalculado', precalculadoAt: '2026-10-28T10:00:00Z' });
    assert.deepEqual(res.find((r) => r.id === 'carga').origen, { sla: 'en_vivo', matriz: 'precalculado' });
    cookies.length = 0; await pedir(url, RUTAS_HOY[0], null); assert.deepEqual(cookies, [null]);
  } finally { s.close(); }
});
test('un 403 o un servidor caído se informa como estado, nunca como excepción, y la cookie no aparece en la salida', async () => {
  const { s, url } = await servidor((q, r) => { r.statusCode = 403; r.end('{}'); });
  try { const r = await pedir(url, RUTAS_HOY[0], 'sb=SECRETO'); assert.equal(r.status, 403); assert.ok(!formatear(1, [r]).includes('SECRETO')); } finally { s.close(); }
  const caido = await pedir('http://127.0.0.1:1', RUTAS_HOY[0], 'sb=SECRETO', { tope: 2000 });
  assert.equal(caido.status, 0); assert.equal(caido.error, 'sin respuesta'); assert.ok(!JSON.stringify(caido).includes('SECRETO'));
});
test('origen: https o localhost; otra cosa se rechaza', () => {
  assert.equal(origenValido('https://app.rovaq.ai/x'), 'https://app.rovaq.ai');
  assert.equal(origenValido('http://localhost:3000'), 'http://localhost:3000');
  assert.equal(origenValido('http://evil.example'), null); assert.equal(origenValido('no es url'), null); assert.equal(origenValido(undefined), null);
});
test('cookie desde archivo: una línea; sin archivo, null', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'warm-')), 'c'); fs.writeFileSync(f, 'a=1; b=2\n');
  assert.equal(leerCookie(f), 'a=1; b=2'); assert.equal(leerCookie(undefined), null);
});
