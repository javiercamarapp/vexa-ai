// N6 (QA-2): POST /api/explorer/tools devolvia 400 en cada apertura de ficha con snapshot_id sin scope_hash.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseExplorerQuery, validateToolCall} from '../../../../packages/recommendations/explorer-contracts.mjs';

const ID = '1bdfa078-d245-57e4-aef2-254e9fd4c16d', SNAP = 'f3937770-c59a-5e77-a4c6-92680914b8ba', HASH = 'a'.repeat(64);
const base = 'date_start=2025-10-01&date_end=2026-10-01&timezone=UTC&date_basis=occurred_at&currency=USD&basis=marketplace_line_price&exponent=2';
test('el servidor rechaza con 400 una consulta de evidencia con snapshot_id pero sin scope_hash', () => {
  assert.throws(() => validateToolCall({name: 'get_evidence', args: {query: base + '&snapshot_id=' + SNAP, problemId: ID}}), /published_scope_required/);
  assert.doesNotThrow(() => validateToolCall({name: 'get_evidence', args: {query: base + '&snapshot_id=' + SNAP + '&scope_hash=' + HASH, problemId: ID}}));
  assert.ok(parseExplorerQuery(new URLSearchParams(base + '&snapshot_id=' + SNAP + '&scope_hash=' + HASH)).scope.scope_hash);
});
test('la ficha no pide la evidencia si falta el snapshot_id O el scope_hash (muestra «Abre este problema desde una publicación»)', () => {
  const src = readFileSync(new URL('../../src/components/workspace/problem-sheet.tsx', import.meta.url), 'utf8');
  assert.match(src, /sinAlcance=!alcance\.get\('snapshot_id'\)\|\|!alcance\.get\('scope_hash'\)/);
});
