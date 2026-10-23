import test from 'node:test';import assert from 'node:assert/strict';
import {claveCache,guardarCache,leerCache,invalidarCache,olvidarMemoria,guardarVista,leerVista,hace,TTL_MS,VIDA_MS} from './cache.mjs';
import {claveSwr,fijarTenant} from './swr.mjs';
const almacenFalso=()=>{const m=new Map();return {get length(){return m.size;},key:i=>[...m.keys()][i]??null,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
test('la clave ignora el orden de parámetros, resource y format; distingue recurso y alcance; coincide con la de la URL real',()=>{
 olvidarMemoria();fijarTenant('T');
 assert.equal(claveCache('problems','b=2&a=1&resource=metrics'),claveCache('problems','a=1&b=2&format=json'));
 assert.notEqual(claveCache('problems','a=1'),claveCache('metrics','a=1'));assert.notEqual(claveCache('problems','scope_hash=x'),claveCache('problems','scope_hash=y'));
 assert.equal(claveCache('problems','a=1&b=2'),claveSwr('/api/workspace?resource=problems&b=2&a=1'));
});
test('frescas ≤5 min, utilizables (rotuladas) hasta 30 min, nulas después',()=>{
 olvidarMemoria();fijarTenant('T');const a=almacenFalso(),k=claveCache('problems','a=1');guardarCache(k,{n:1},{ahora:1000,almacen:a});
 assert.deepEqual(leerCache(k,{ahora:1000+TTL_MS,almacen:a}),{datos:{n:1},edadMs:TTL_MS,fresca:true});
 const v=leerCache(k,{ahora:1000+TTL_MS+1,almacen:a});assert.equal(v.fresca,false);assert.equal(v.datos.n,1);
 olvidarMemoria();fijarTenant('T');assert.equal(leerCache(k,{ahora:2000,almacen:a}).datos.n,1,'se recupera de sessionStorage al recargar');
 assert.equal(leerCache(k,{ahora:1000+VIDA_MS+1,almacen:a}),null);assert.equal(leerCache(k,{ahora:10,almacen:a}),null);
});
test('«Actualizar» marca obsoleto sin borrar y sin almacenamiento no revienta',()=>{
 olvidarMemoria();fijarTenant('T');const a=almacenFalso(),k=claveCache('problems','a=1');guardarCache(k,{n:1},{ahora:1,almacen:a});a.setItem('otra','x');
 invalidarCache({almacen:a});const v=leerCache(k,{ahora:2,almacen:a});assert.equal(v.fresca,false);assert.equal(v.datos.n,1);assert.equal(a.getItem('otra'),'x');
 const roto={getItem(){throw new Error('x');},setItem(){throw new Error('cuota');},get length(){return 0;},key:()=>null,removeItem(){}};
 guardarCache(k,{n:2},{ahora:3,almacen:roto});assert.equal(leerCache(k,{ahora:4,almacen:roto}).datos.n,2);
});
test('vista (scroll y filtros) se guarda y se lee; texto de edad',()=>{
 const a=almacenFalso();guardarVista('k',{y:420,texto:'bat'},{almacen:a});assert.deepEqual(leerVista('k',{almacen:a}),{y:420,texto:'bat'});assert.equal(leerVista('z',{almacen:a}),null);
 assert.equal(hace(20000),'hace 20 s');assert.equal(hace(180000),'hace 3 min');
});
