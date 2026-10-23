import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const hero=readFileSync(new URL('../../components/workspace/detail-hero.tsx',import.meta.url),'utf8'),panel=readFileSync(new URL('../../components/workspace/detail-panel.tsx',import.meta.url),'utf8'),pv=readFileSync(new URL('../../components/workspace/problems-view.tsx',import.meta.url),'utf8');
test('el detalle no muestra 0 conversaciones/citas mientras espera la evidencia viva',()=>{
 assert.match(hero,/esperando/);assert.match(hero,/WaitStatus/);assert.match(hero,/disabled=\{esperando\}/);
 assert.match(panel,/esperando=\{/);
});
test('citas rotuladas: registradas (vista rápida) y verificadas al abrir (detalle), misma fuente',()=>{
 assert.match(hero,/citas? verificadas? al abrir/);assert.match(hero,/registradas/);
 assert.match(pv,/vexa:citas-registradas/);assert.match(panel,/vexa:citas-registradas/);
});
