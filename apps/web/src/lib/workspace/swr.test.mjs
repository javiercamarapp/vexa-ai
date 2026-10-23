import test from 'node:test';import assert from 'node:assert/strict';
import {claveSwr,fijarTenant,limpiarTodo,guardarSwr,leerSwr,invalidarSwr,olvidarMemoriaSwr,pedirSwr,enVueloN,precalentar,estadoPrecalentamiento,reiniciarPrecalentamiento,FRESCO_MS,VIDA_MS,hace} from './swr.mjs';
const almacenFalso=()=>{const m=new Map();return {get length(){return m.size;},key:i=>[...m.keys()][i]??null,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),m};};
const nuevo=(t='T1')=>{olvidarMemoriaSwr();reiniciarPrecalentamiento();const a=almacenFalso();fijarTenant(t,{almacen:a});return a;};
test('la clave incluye tenant, ignora el orden de parámetros y distingue recurso y alcance',()=>{
 nuevo('A');const k=claveSwr('/api/x?b=2&a=1');assert.equal(k,claveSwr('/api/x?a=1&b=2'));assert.notEqual(k,claveSwr('/api/y?a=1&b=2'));assert.notEqual(k,claveSwr('/api/x?a=1&b=3'));
 assert.ok(k.includes('A|'));fijarTenant('B');assert.notEqual(k,claveSwr('/api/x?a=1&b=2'));
});
test('fresca ≤5 min, obsoleta pero pintable hasta 30 min, descartada después; no acepta fechas futuras',()=>{
 const a=nuevo(),k=claveSwr('/api/x');guardarSwr(k,{n:1},{ahora:1000,almacen:a});
 let r=leerSwr(k,{ahora:1000+FRESCO_MS,almacen:a});assert.equal(r.fresca,true);assert.equal(r.edadMs,FRESCO_MS);
 r=leerSwr(k,{ahora:1000+FRESCO_MS+1,almacen:a});assert.equal(r.fresca,false);assert.deepEqual(r.datos,{n:1});
 assert.equal(leerSwr(k,{ahora:500,almacen:a}),null);
 assert.equal(leerSwr(k,{ahora:1000+VIDA_MS+1,almacen:a}),null);assert.equal(a.getItem(k),null,'la vencida se elimina del almacenamiento');
});
test('se recupera de sessionStorage tras recargar la página (memoria vacía)',()=>{
 const a=nuevo(),k=claveSwr('/api/x');guardarSwr(k,{n:1},{ahora:10,almacen:a});olvidarMemoriaSwr();fijarTenant('T1',{almacen:a});assert.equal(leerSwr(k,{ahora:20,almacen:a}).datos.n,1);
});
test('«Actualizar» marca obsoleto pero conserva el dato (para rotular si falla la nueva lectura)',()=>{
 const a=nuevo(),k=claveSwr('/api/x');guardarSwr(k,{n:1},{ahora:10,almacen:a});invalidarSwr({almacen:a});
 const r=leerSwr(k,{ahora:11,almacen:a});assert.equal(r.fresca,false);assert.equal(r.obsoleta,true);assert.equal(r.datos.n,1);
});
test('aislamiento por tenant: cambiar de organización purga lo ajeno; cerrar sesión borra todo (incluida la vista)',()=>{
 const a=nuevo('A'),kA=claveSwr('/api/x');guardarSwr(kA,{n:'A'},{almacen:a});a.setItem('vexa:vista:z','{}');a.setItem('otra','x');
 fijarTenant('B',{almacen:a});assert.equal(leerSwr(kA,{almacen:a}),null);assert.equal(a.getItem(kA),null);
 guardarSwr(claveSwr('/api/x'),{n:'B'},{almacen:a});limpiarTodo({almacen:a});
 assert.deepEqual([...a.m.keys()],['otra']);
});
test('sin almacenamiento o con cuota llena no revienta (solo memoria)',()=>{
 nuevo();const roto={getItem(){throw new Error('x');},setItem(){throw new Error('cuota');},get length(){return 0;},key:()=>null,removeItem(){}};
 const k=claveSwr('/api/x');guardarSwr(k,{n:2},{ahora:3,almacen:roto});assert.equal(leerSwr(k,{ahora:4,almacen:roto}).datos.n,2);
});
test('de-duplica peticiones en vuelo, guarda solo 2xx válidos y un fallo no pisa el buen dato',async()=>{
 const a=nuevo();let n=0,modo='ok';
 const f=async()=>{n++;await new Promise(r=>setTimeout(r,10));return modo==='ok'?{ok:true,status:200,json:async()=>({data:{v:n}})}:{ok:false,status:503,json:async()=>({error:1})};};
 const valida=j=>j?.data?j:null;
 const [r1,r2]=await Promise.all([pedirSwr('/api/x?a=1',{fetchFn:f,almacen:a,valida}),pedirSwr('/api/x?a=1',{fetchFn:f,almacen:a,valida})]);
 assert.equal(n,1);assert.equal(r1.json.data.v,1);assert.equal(r2.status,200);assert.equal(enVueloN(),0);
 modo='falla';const r3=await pedirSwr('/api/x?a=1',{fetchFn:f,almacen:a,valida});assert.equal(r3.status,503);
 assert.equal(leerSwr(claveSwr('/api/x?a=1'),{almacen:a}).datos.data.v,1);
});
test('un lector que aborta no cancela la petición compartida (calienta la caché)',async()=>{
 const a=nuevo();const f=async()=>{await new Promise(r=>setTimeout(r,20));return {ok:true,status:200,json:async()=>({data:1})};};
 const c=new AbortController(),p=pedirSwr('/api/z',{fetchFn:f,almacen:a,signal:c.signal});c.abort();await assert.rejects(p,{name:'AbortError'});
 await new Promise(r=>setTimeout(r,40));assert.equal(leerSwr(claveSwr('/api/z'),{almacen:a}).datos.data,1);
});
test('precalentar: tope de concurrencia 2, sin duplicados ni lecturas frescas',async()=>{
 const a=nuevo();let vivos=0,max=0,llamadas=0;
 const f=async()=>{llamadas++;vivos++;max=Math.max(max,vivos);await new Promise(r=>setTimeout(r,15));vivos--;return {ok:true,status:200,json:async()=>({data:1})};};
 guardarSwr(claveSwr('/api/fresca'),{data:0},{almacen:a});
 const n=precalentar(['/api/1','/api/2','/api/3','/api/4','/api/1','/api/fresca'],{fetchFn:f,almacen:a});
 assert.equal(n,4);await new Promise(r=>setTimeout(r,120));
 assert.equal(max,2);assert.equal(llamadas,4);assert.equal(estadoPrecalentamiento().maxActivos,2);
 assert.equal(precalentar(['/api/1'],{fetchFn:f,almacen:a}),0,'ya está fresca');
});
test('texto de edad',()=>{assert.equal(hace(20000),'hace 20 s');assert.equal(hace(180000),'hace 3 min');});
