import test from 'node:test';import assert from 'node:assert/strict';
import {esErrorDeChunk,recargarSiChunk,CLAVE_RECARGA} from './recuperacion.mjs';
const memoria=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};};
test('reconoce ChunkLoadError por nombre, mensaje y CSS',()=>{
 const e=new Error('Loading chunk 149 failed.');e.name='ChunkLoadError';
 assert.ok(esErrorDeChunk(e));
 assert.ok(esErrorDeChunk(new Error('Loading chunk 149 failed. (error: https://x/_next/static/chunks/149.js)')));
 assert.ok(esErrorDeChunk(new Error('Loading CSS chunk 12 failed.')));
 assert.ok(esErrorDeChunk(new Error('Failed to fetch dynamically imported module: https://x/a.js')));
 assert.ok(esErrorDeChunk({name:'ChunkLoadError',message:''}));
});
test('no confunde otros errores',()=>{
 assert.ok(!esErrorDeChunk(new Error('workspace_request_failed')));
 assert.ok(!esErrorDeChunk(new TypeError('x is undefined')));
 assert.ok(!esErrorDeChunk(null));assert.ok(!esErrorDeChunk(undefined));assert.ok(!esErrorDeChunk('Loading chunk 1 failed'));
});
test('recarga una sola vez por pestaña y no hace bucle',()=>{
 const s=memoria();let n=0;const recargar=()=>{n++;};
 const e=new Error('Loading chunk 9 failed.');
 assert.equal(recargarSiChunk(e,{storage:s,recargar,ahora:()=>1000}),true);assert.equal(n,1);
 assert.equal(recargarSiChunk(e,{storage:s,recargar,ahora:()=>1500}),false);assert.equal(n,1);
 assert.ok(s.getItem(CLAVE_RECARGA));
});
test('pasada la ventana la guarda se libera (otro despliegue posterior)',()=>{
 const s=memoria();let n=0;const recargar=()=>{n++;};const e=new Error('Loading chunk 9 failed.');
 recargarSiChunk(e,{storage:s,recargar,ahora:()=>1000});
 assert.equal(recargarSiChunk(e,{storage:s,recargar,ahora:()=>1000+11*60*1000}),true);assert.equal(n,2);
});
test('un error que no es de chunk no recarga; sin sessionStorage no recarga (evita bucle)',()=>{
 let n=0;const recargar=()=>{n++;};
 assert.equal(recargarSiChunk(new Error('otro'),{storage:memoria(),recargar}),false);
 const roto={getItem(){throw Error('x');},setItem(){throw Error('x');}};
 assert.equal(recargarSiChunk(new Error('Loading chunk 1 failed.'),{storage:roto,recargar}),false);
 assert.equal(recargarSiChunk(new Error('Loading chunk 1 failed.'),{storage:null,recargar}),false);assert.equal(n,0);
});
