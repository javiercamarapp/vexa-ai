import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const sheet=readFileSync(new URL('../../components/workspace/problem-sheet.tsx',import.meta.url),'utf8'),panel=readFileSync(new URL('../../components/workspace/detail-panel.tsx',import.meta.url),'utf8');
test('la ficha no muestra 0 conversaciones/citas mientras carga ni mientras espera la evidencia viva',()=>{
 assert.match(sheet,/WaitStatus/);assert.match(sheet,/esperando/);assert.match(sheet,/No disponible ahora/);
 assert.match(panel,/ProblemSheet/);
});
test('citas rotuladas: registradas (conteo del grupo) y verificadas al abrir (evidencia viva), cada una con su fuente',()=>{
 assert.match(sheet,/Citas registradas/);assert.match(sheet,/verificadas al abrir/);assert.match(sheet,/\/api\/trends\/incidences/);
});
test('el título «Desglose financiero del problema» ya no encabeza la ficha del problema',()=>{
 assert.match(panel,/ficha\?\(titulo\?\?'Ficha del problema'\)/);
});
