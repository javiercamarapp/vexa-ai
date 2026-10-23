import test from 'node:test';import assert from 'node:assert/strict';
import {claveCache,guardarCache,leerCache,invalidarCache,olvidarMemoria,guardarVista,leerVista,hace,TTL_MS} from './cache.mjs';
const almacenFalso=()=>{const m=new Map();return {get length(){return m.size;},key:i=>[...m.keys()][i]??null,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
test('la clave ignora el orden de parámetros, resource y format; distingue recurso y alcance',()=>{
 assert.equal(claveCache('problems','b=2&a=1&resource=problems'),claveCache('problems','a=1&b=2&format=json'));
 assert.notEqual(claveCache('problems','a=1'),claveCache('metrics','a=1'));assert.notEqual(claveCache('problems','scope_hash=x'),claveCache('problems','scope_hash=y'));
});
test('guarda y devuelve dentro de 5 min (memoria y sessionStorage); caduca después; no devuelve fechas futuras',()=>{
 const a=almacenFalso(),k=claveCache('problems','a=1');olvidarMemoria();guardarCache(k,{n:1},{ahora:1000,almacen:a});
 assert.deepEqual(leerCache(k,{ahora:1000+TTL_MS-1,almacen:a}),{datos:{n:1},edadMs:TTL_MS-1});
 olvidarMemoria();assert.equal(leerCache(k,{ahora:2000,almacen:a}).datos.n,1,'se recupera de sessionStorage al recargar');
 assert.equal(leerCache(k,{ahora:1000+TTL_MS+1,almacen:a}),null);assert.equal(leerCache(k,{ahora:10,almacen:a}),null);
});
test('«Actualizar» invalida todo lo cacheado y sin almacenamiento no revienta',()=>{
 const a=almacenFalso(),k=claveCache('problems','a=1');olvidarMemoria();guardarCache(k,{n:1},{ahora:1,almacen:a});a.setItem('otra','x');
 invalidarCache({almacen:a});assert.equal(leerCache(k,{ahora:2,almacen:a}),null);assert.equal(a.getItem('otra'),'x');
 const roto={getItem(){throw new Error('x');},setItem(){throw new Error('cuota');},get length(){return 0;},key:()=>null,removeItem(){}};
 guardarCache(k,{n:2},{ahora:3,almacen:roto});assert.equal(leerCache(k,{ahora:4,almacen:roto}).datos.n,2);
});
test('vista (scroll y filtros) se guarda y se lee; texto de edad',()=>{
 const a=almacenFalso();guardarVista('k',{y:420,texto:'bat'},{almacen:a});assert.deepEqual(leerVista('k',{almacen:a}),{y:420,texto:'bat'});assert.equal(leerVista('z',{almacen:a}),null);
 assert.equal(hace(20000),'hace 20 s');assert.equal(hace(180000),'hace 3 min');
});
