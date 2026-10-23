import test from 'node:test';import assert from 'node:assert/strict';
import {lecturasDePantalla,precalentarPantallas,precalentarEnlace,consultaFijada,PANTALLAS_PRINCIPALES} from './precalentar.mjs';
import {claveCache} from './cache.mjs';
import {claveSwr,fijarTenant,olvidarMemoriaSwr,reiniciarPrecalentamiento,estadoPrecalentamiento,leerSwr} from './swr.mjs';
const almacenFalso=()=>{const m=new Map();return {get length(){return m.size;},key:i=>[...m.keys()][i]??null,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const nuevo=()=>{olvidarMemoriaSwr();reiniciarPrecalentamiento();const a=almacenFalso();fijarTenant('T',{almacen:a});return a;};
const Q='date_start=2026-08-01&date_end=2026-09-21&currency=USD&basis=net&snapshot_id=S1&scope_hash=H1';
const scope={date_start:'2026-08-01T00:00:00.000Z',date_end:'2026-09-21T00:00:00.000Z',timezone:'UTC',date_basis:'occurred_at',currency:'USD',basis:'net',exponent:2,sku:['A','B'],source:['hubspot']};
test('Problemas: la lectura tiene la MISMA clave que usa el panel (claveCache), sin importar el orden de parámetros',()=>{
 nuevo();const [l]=lecturasDePantalla('/problems',Q.split('&').reverse().join('&'));assert.equal(claveSwr(l.url),claveCache('problems',Q));
});
test('consulta fijada: idéntica a la que arman Recomendaciones, Brief y Explorador (orden y repetidos)',()=>{
 assert.equal(consultaFijada(scope,'S1','H1').toString(),'date_start=2026-08-01&date_end=2026-09-21&timezone=UTC&date_basis=occurred_at&currency=USD&basis=net&snapshot_id=S1&scope_hash=H1&exponent=2&sku=A&sku=B&source=hubspot');
});
test('Recomendaciones: primero fija el alcance (meta_only) y de esa respuesta sale la lectura de datos; Brief con alcance fijado va directo; CFO es un solo recurso',()=>{
 const [r]=lecturasDePantalla('/recommendations',Q+'&problem_id=x&cursor=c');
 assert.ok(r.url.startsWith('/api/workspace?')&&r.url.includes('meta_only=1')&&r.url.includes('resource=problems')&&!r.url.includes('problem_id')&&!r.url.includes('cursor'));
 const sig=r.luego({data:{meta:{scope,snapshot_id:'S1',scope_hash:'H1'}}});assert.equal(sig[0].url,'/api/recommendations?'+consultaFijada(scope,'S1','H1'));
 assert.equal(r.luego({data:{meta:{scope,snapshot_id:null,scope_hash:null}}}),null,'sin publicación no hay segunda lectura');
 const [b]=lecturasDePantalla('/briefs',Q+'&q=x&status=all');assert.equal(b.url,'/api/briefs?'+new URLSearchParams(Q).toString());
 const [b2]=lecturasDePantalla('/briefs','date_start=2026-08-01&date_end=2026-09-21');assert.ok(b2.url.includes('meta_only=1')&&b2.luego);
 assert.deepEqual(lecturasDePantalla('/cfo',Q).map(x=>x.url),['/cfo/data/report']);assert.deepEqual(lecturasDePantalla('/settings/team',Q),[]);
});
test('precalentar las 4 pantallas: tope de concurrencia 2, sin duplicar en vuelo, las lecturas dependientes salen de la respuesta y una segunda pasada no pide nada',async()=>{
 const a=nuevo();const vistas=[];let vivos=0,max=0;
 const resp=url=>url.startsWith('/api/workspace?')&&url.includes('meta_only')?{data:{meta:{scope,snapshot_id:'S1',scope_hash:'H1'}}}:url.startsWith('/api/workspace?')?{data:{items:[],meta:{scope}}}:url.startsWith('/api/recommendations')?{data:{items:[],problemOptions:[],members:[]}}:url.startsWith('/api/briefs')?{data:{items:[]}}:{data:{status:'empty'}};
 const f=async(url,opc)=>{vistas.push({url,prioridad:opc?.priority});vivos++;max=Math.max(max,vivos);await new Promise(r=>setTimeout(r,15));vivos--;return {ok:true,status:200,json:async()=>resp(url)};};
 const n=precalentarPantallas(PANTALLAS_PRINCIPALES,Q,{fetchFn:f,almacen:a});assert.equal(n,4);
 await new Promise(r=>setTimeout(r,200));
 assert.equal(max,2);assert.equal(estadoPrecalentamiento().maxActivos,2);
 assert.ok(vistas.every(v=>v.prioridad==='low'),'todas con prioridad baja');
 assert.equal(new Set(vistas.map(v=>v.url)).size,vistas.length,'ninguna URL se pidió dos veces');
 assert.ok(vistas.some(v=>v.url.startsWith('/api/recommendations?')),'la lectura dependiente de Recomendaciones se encadenó');
 assert.ok(leerSwr(claveCache('problems',Q),{almacen:a})?.fresca);
 const antes=vistas.length;assert.equal(precalentarPantallas(PANTALLAS_PRINCIPALES,Q,{fetchFn:f,almacen:a}),0);await new Promise(r=>setTimeout(r,30));assert.equal(vistas.length,antes,'frescas: no se vuelve a pedir');
 assert.equal(precalentarEnlace('/problems?'+Q,{fetchFn:f,almacen:a}),0);
});
