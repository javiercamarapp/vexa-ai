import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bloqueOpcional} from '../../../../packages/workspace-service/parcial.mjs';
const sesion=()=>{const q=[];return {q,query:async(t)=>{q.push(t.split(' ')[0]+' '+t.split(' ')[1]);return {rows:[]};}};};
test('un bloque que funciona libera su savepoint y devuelve el valor', async () => {
  const s=sesion();const r=await bloqueOpcional(s,async()=>42);
  assert.deepEqual(r,{ok:true,value:42});assert.deepEqual(s.q,['SAVEPOINT vexa_bloque_1','RELEASE SAVEPOINT'].map((x,i)=>i===0?s.q[0]:x));
});
test('un bloque que falla (tiempo agotado) se revierte y no tumba la ficha', async () => {
  const s=sesion();const r=await bloqueOpcional(s,async()=>{throw Object.assign(new Error('canceling statement due to statement timeout'),{code:'57014'});});
  assert.deepEqual(r,{ok:false,code:'57014'});
  assert.ok(s.q.some(x=>x.startsWith('ROLLBACK TO')));
});
test('un error de dominio con mensaje corto da su codigo; sin PII ni texto libre', async () => {
  const s=sesion();const r=await bloqueOpcional(s,async()=>{throw new Error('detail_evidence_unavailable');});
  assert.equal(r.code,'detail_evidence_unavailable');
  const r2=await bloqueOpcional(s,async()=>{throw new Error('relation "x" falla con Juan Perez');});
  assert.equal(r2.code,'bloque_no_disponible');
});
test('una conexion cortada se propaga: no hay nada que degradar', async () => {
  const s=sesion();
  await assert.rejects(bloqueOpcional(s,async()=>{throw new Error('Connection terminated unexpectedly');}),/Connection terminated/);
});
