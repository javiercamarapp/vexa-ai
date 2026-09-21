import assert from 'node:assert/strict';
import {configured,request,started,received,digest} from './fixtures.mjs';
import {q} from './harness.mjs';
const conflict={code:'database_conflict'};
const reserve=async s=>{const r=await s.repository.reserve(request(s.actor));assert.equal(r.acquired,true);return r.reservationId;};
const row=async(s,id)=>(await s.repository.list({window:s.window})).find(r=>r.id===id);
export async function normalization(t,h){
 await t.test('started replay normalizes accepted minor strings without another attempt',async()=>{
  const s=await configured(h),id=await reserve(s);await s.repository.recordAttempt(id,started(0,'080'));
  await s.repository.recordAttempt(id,started(0,'080'));await s.repository.recordAttempt(id,started(0,'80'));
  await assert.rejects(s.repository.recordAttempt(id,started(0,'081')),conflict);
  assert.equal(h.sql(`SELECT count(*) FROM ai_budget_attempts WHERE reservation_id=${q(id)}`),'1');
  assert.equal((await row(s,id)).heldMinor,'80');assert.equal((await s.repository.reserve(request(s.actor,{amountMinor:'21'}))).acquired,false);
 });
 await t.test('received replay canonicalizes known usage and preserves append-only charges',async()=>{
  const s=await configured(h),id=await reserve(s);await s.repository.recordAttempt(id,started());await s.repository.recordAttempt(id,received(0,'020'));
  await s.repository.recordAttempt(id,received(0,'020'));await s.repository.recordAttempt(id,received(0,'20'));
  await assert.rejects(s.repository.recordAttempt(id,received(0,'021')),conflict);
  assert.equal(h.sql(`SELECT count(*) FROM ai_budget_attempts WHERE reservation_id=${q(id)}`),'2');
  await s.repository.finalize(id,{state:'settled',actualMinor:'20',reportedMinor:'20'});assert.equal((await row(s,id)).actualMinor,'20');
 });
 await t.test('settled replay normalizes amounts without double charge or version changes',async()=>{
  const s=await configured(h),id=await reserve(s);await s.repository.recordAttempt(id,started());await s.repository.recordAttempt(id,received());
  const result={state:'settled',actualMinor:'020',reportedMinor:'020'};await s.repository.finalize(id,result);const before=await row(s,id);
  await s.repository.finalize(id,result);await s.repository.finalize(id,{...result,actualMinor:'20',reportedMinor:'20'});
  await assert.rejects(s.repository.finalize(id,{...result,actualMinor:'021',reportedMinor:'021'}),conflict);assert.deepEqual(await row(s,id),before);
  assert.equal((await s.repository.reserve(request(s.actor,{amountMinor:'80'}))).acquired,true);assert.equal((await s.repository.reserve(request(s.actor,{amountMinor:'1'}))).acquired,false);
 });
 await t.test('unknown received and uncertain replay retain null and held quota despite zero normalization',async()=>{
  const s=await configured(h),id=await reserve(s);await s.repository.recordAttempt(id,started());await s.repository.recordAttempt(id,received(0,null));await s.repository.recordAttempt(id,received(0,null));
  await assert.rejects(s.repository.recordAttempt(id,received(0,'000')),conflict);await assert.rejects(s.repository.finalize(id,{state:'settled',actualMinor:'000',reportedMinor:'000'}),conflict);
  const result={state:'uncertain',actualMinor:null,reportedMinor:'000'};await s.repository.finalize(id,result);const before=await row(s,id);await s.repository.finalize(id,result);await s.repository.finalize(id,{...result,reportedMinor:'0'});
  await assert.rejects(s.repository.finalize(id,{...result,actualMinor:'000'}),{code:'23514',message:'BUDGET_SETTLEMENT_INVALID'});await assert.rejects(s.repository.finalize(id,{...result,reportedMinor:'001'}),conflict);
  assert.deepEqual(await row(s,id),before);assert.equal(before.actualMinor,null);assert.equal(before.heldMinor,'80');assert.equal((await s.repository.reserve(request(s.actor,{amountMinor:'21'}))).acquired,false);
 });
 await t.test('owner reconciliation replay normalizes minor strings without duplicate evidence or charge',async()=>{
  const s=await configured(h),id=await reserve(s);await s.repository.recordAttempt(id,started());await s.repository.finalize(id,{state:'uncertain',actualMinor:null,reportedMinor:'0'});
  const held=await row(s,id),input={reservationId:id,expectedVersion:held.version,actualMinor:'020',evidenceHash:digest('SYN-normalization-'+id),confirmedProviderEvidence:true};
  await s.repository.reconcile(input);const before=await row(s,id);await s.repository.reconcile(input);await s.repository.reconcile({...input,actualMinor:'20'});
  await assert.rejects(s.repository.reconcile({...input,actualMinor:'021'}),conflict);assert.deepEqual(await row(s,id),before);
  assert.equal(h.sql(`SELECT count(*) FROM ai_budget_reconciliations WHERE reservation_id=${q(id)}`),'1');assert.equal(before.actualMinor,'20');
  assert.equal((await s.repository.reserve(request(s.actor,{amountMinor:'80'}))).acquired,true);assert.equal((await s.repository.reserve(request(s.actor,{amountMinor:'1'}))).acquired,false);
 });
}
