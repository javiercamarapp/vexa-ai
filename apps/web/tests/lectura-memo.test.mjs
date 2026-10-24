import test from 'node:test';
import assert from 'node:assert/strict';
import {conMemoria,esDegradada,olvidarMemoria} from '../src/lib/lectura-memo.mjs';
test('comparte una sola lectura entre peticiones simultáneas y respeta el TTL', async () => {
  olvidarMemoria();let n=0,t=0;const leer=async()=>{n++;await new Promise(r=>setTimeout(r,10));return {n};};
  const [a,b]=await Promise.all([conMemoria('k',1000,leer,()=>t),conMemoria('k',1000,leer,()=>t)]);
  assert.equal(n,1);assert.equal(a,b);
  t=500;assert.equal((await conMemoria('k',1000,leer,()=>t)).n,1);
  t=1500;assert.equal((await conMemoria('k',1000,leer,()=>t)).n,2);
});
test('no guarda los fallos y no mezcla claves (organizaciones)', async () => {
  olvidarMemoria();let n=0;
  await assert.rejects(conMemoria('x',1000,async()=>{n++;throw new Error('falla');}));
  assert.equal((await conMemoria('x',1000,async()=>{n++;return 'ok';})),'ok');assert.equal(n,2);
  assert.notEqual(await conMemoria('org-a|/api/workload',1000,async()=>'A'),await conMemoria('org-b|/api/workload',1000,async()=>'B'));
});
test('rancio: pasado el TTL responde al instante con el último bueno y relee por detrás; un fallo o una lectura degradada no lo pisan', async () => {
  olvidarMemoria();let n=0,t=0,modo='bueno';
  const leer=async()=>{n++;await new Promise(r=>setTimeout(r,5));if(modo==='falla')throw new Error('x');return modo==='degradado'?{parte:{status:'unavailable'}}:{n};};
  const op={rancioMs:1000,noGuardar:esDegradada};
  assert.equal((await conMemoria('r',100,leer,()=>t,op)).n,1);
  t=500;const rancio=await conMemoria('r',100,leer,()=>t,op);assert.equal(rancio.n,1,'devuelve el viejo sin esperar');
  await new Promise(r=>setTimeout(r,20));assert.equal(n,2,'una sola relectura por detrás');
  t=600;assert.equal((await conMemoria('r',100,leer,()=>t,op)).n,2,'la relectura quedó guardada');
  modo='degradado';t=800;await conMemoria('r',100,leer,()=>t,op);await new Promise(r=>setTimeout(r,20));
  t=801;modo='bueno';assert.equal((await conMemoria('r',100,leer,()=>t,{...op,rancioMs:1000})).n,2,'la degradada no sustituyó al bueno');
  modo='falla';t=950;await conMemoria('r',100,leer,()=>t,op);await new Promise(r=>setTimeout(r,20));
  t=951;assert.equal((await conMemoria('r',100,async()=>({n:99}),()=>t,op)).n,2,'el fallo tampoco');
  t=5000;assert.equal((await conMemoria('r',100,async()=>({n:7}),()=>t,op)).n,7,'fuera de la ventana rancia espera la lectura nueva');
  assert.equal(esDegradada({a:{status:'unavailable'}}),true);assert.equal(esDegradada({a:{status:'ok'}}),false);
});
