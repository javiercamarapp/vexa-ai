import test from 'node:test';
import assert from 'node:assert/strict';
import {conMemoria,olvidarMemoria} from '../src/lib/lectura-memo.mjs';
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
