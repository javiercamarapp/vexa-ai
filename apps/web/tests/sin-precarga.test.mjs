// Los enlaces del espacio de trabajo no precargan solos: la QA del 19.º build contó ~34 precargas `_rsc` al entrar a una pantalla y 7 daban 503 por saturar el pool de la base.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const src = readFileSync(join(import.meta.dirname, '../src/components/workspace/navigation-lifecycle.tsx'), 'utf8');
test('WorkspaceLink desactiva la precarga automática por defecto y deja que una pantalla la reactive', () => {
  assert.match(src, /<NextLink prefetch=\{false\} \{\.\.\.props\}/);
});
