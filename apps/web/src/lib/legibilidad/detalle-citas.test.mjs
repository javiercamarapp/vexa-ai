import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';
// Los textos visibles viven en los diccionarios i18n: se comprueba la clave en el componente y el texto en el diccionario ES.
const dic=readdirSync(new URL('../i18n/',import.meta.url)).filter(f=>/^(es|d-.*)\.ts$/.test(f)).map(f=>readFileSync(new URL('../i18n/'+f,import.meta.url),'utf8')).join('\n');
const sheet=readFileSync(new URL('../../components/workspace/problem-sheet.tsx',import.meta.url),'utf8'),panel=readFileSync(new URL('../../components/workspace/detail-panel.tsx',import.meta.url),'utf8');
test('la ficha no muestra 0 conversaciones/citas mientras carga ni mientras espera la evidencia viva',()=>{
 assert.match(sheet,/WaitStatus/);assert.match(sheet,/esperando/);assert.match(sheet,/t\('prob\.noDispAhoraC'\)/);assert.match(dic,/'prob\.noDispAhoraC': 'No disponible ahora'/);
 assert.match(panel,/ProblemSheet/);
});
test('citas rotuladas: registradas (conteo del grupo) y verificadas al abrir (evidencia viva), cada una con su fuente',()=>{
 assert.match(sheet,/t\('prob\.citasRegistradas'\)/);assert.match(dic,/'prob\.citasRegistradas': 'Citas registradas'/);assert.match(sheet,/t\('prob\.citasTextuales'\)/);assert.match(dic,/'prob\.citasTextuales': 'Citas textuales verificadas al abrir/);assert.match(sheet,/\/api\/trends\/incidences/);
});
test('el título «Desglose financiero del problema» ya no encabeza la ficha del problema',()=>{
 assert.match(panel,/ficha\?\(titulo\?\?t\('det\.fichaDelProblema'\)\)/);assert.match(dic,/'det\.fichaDelProblema': 'Ficha del problema'/);
});
