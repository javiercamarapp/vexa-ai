#!/usr/bin/env node
// Escribe las consultas SELECT de SOLO LECTURA para medir por MCP (execute_sql) cuántos pedidos/clientes/problemas se enlazarían.
// Ninguna escribe ni devuelve identificadores o datos personales (solo conteos y sumas agregadas).
//   node consultas.mjs [--max 800] [--desde 2026-07-01]    ->  <out>/consultas-solo-select/*.sql
// 0..4: diagnóstico independiente del puente (no necesitan economia-tickets.csv); muestra: el cálculo de candidatos con las primeras --max parejas
// (contiene identificadores de ticket/pedido: archivo privado 0600; el resultado que devuelve es solo agregado).
import fs from 'node:fs';
import path from 'node:path';
import {DIAG, medirSql, verificacionSql, TENANT} from './sqlgen.mjs';
import {OUT_DEFAULT} from './puente.mjs';
import {leerPares, seleccionar} from './vinculos.mjs';

const a = process.argv.slice(2), opt = (n, d) => { const i = a.indexOf('--' + n); return i >= 0 ? a[i + 1] : d; };
const out = opt('out', OUT_DEFAULT), max = Number(opt('max', '800')), desde = opt('desde', null);
const dir = path.join(out, 'consultas-solo-select'); fs.mkdirSync(dir, {recursive: true, mode: 0o700});
const w = (n, s) => { fs.writeFileSync(path.join(dir, n), s, {mode: 0o600}); return n; };
const files = [];
for (const [k, q] of Object.entries(DIAG)) files.push(w(`${k}.sql`, q + '\n'));
files.push(w('9-verificacion-post-carga.sql', verificacionSql({tenant: TENANT}) + '\n'));
const pf = path.join(out, 'pares-economia.jsonl');
if (fs.existsSync(pf)) {
  const todos = leerPares(pf);
  let validos = null; const vf = path.join(out, 'problemas-validos.json'); if (fs.existsSync(vf)) validos = JSON.parse(fs.readFileSync(vf, 'utf8')).validos;
  for (const kind of ['order', 'refund']) {
    const ps = seleccionar(todos, {kind, max, desde}); if (ps.length) files.push(w(`5-muestra-${kind}-${ps.length}-pares${desde ? '-desde-' + desde : ''}.sql`, medirSql({tenant: TENANT, kind, pares: ps, validos, etiqueta: `muestra-${kind}`}) + '\n'));
  }
}
console.log(JSON.stringify({directorio: dir, archivos: files}));
