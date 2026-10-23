import test from 'node:test';import assert from 'node:assert/strict';import {lineaCategorias,UNIDADES} from './unidades.mjs';
test('cada vista dice qué cuenta y no mezcla incidencias con conversaciones o grupos',()=>{
 const r=lineaCategorias({categorias:44,unidad:'incidencias'}),p=lineaCategorias({categorias:37,ocultasCategorias:6,unidad:'conversaciones'});
 assert.match(r,/incidencias/i);assert.doesNotMatch(r,/Grupos:/);
 assert.match(p,/conversaciones únicas/);assert.match(p,/Grupos:/);assert.match(p,/6 más solo tienen notificaciones automáticas/);
 assert.ok(UNIDADES.incidencias.includes('una conversación puede sumar varias'));
});
