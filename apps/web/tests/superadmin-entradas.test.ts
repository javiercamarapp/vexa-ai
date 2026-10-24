import {test} from 'node:test';
import assert from 'node:assert/strict';
import {supportMarkActive, supportVerdict} from '../src/lib/support-guard';
import {parseSupportInput} from '../src/lib/platform/support-input';
import {mmss, secondsLeft} from '../src/lib/platform/support-time';
const T='01000000-0000-4000-8000-000000000001', R='11111111-1111-4111-8111-111111111111';
test('guardia: lecturas pasan, escrituras y exportaciones no; la consola y el cambio de organización siguen',()=>{
  assert.deepEqual(supportVerdict('GET','/api/problems'),{ok:true});
  assert.deepEqual(supportVerdict('POST','/api/agent/turn'),{ok:false,code:'support_read_only'});
  assert.deepEqual(supportVerdict('DELETE','/api/notifications/push'),{ok:false,code:'support_read_only'});
  assert.deepEqual(supportVerdict('GET','/api/workspace/export'),{ok:false,code:'support_export_blocked'});
  assert.deepEqual(supportVerdict('GET','/cfo/data/export'),{ok:false,code:'support_export_blocked'});
  assert.deepEqual(supportVerdict('POST','/auth/organization'),{ok:true});
  assert.deepEqual(supportVerdict('POST','/platform/data/support'),{ok:true});
  assert.deepEqual(supportVerdict('POST','/api/platform/team'),{ok:true});
  assert.deepEqual(supportVerdict('POST','/api/platformx'),{ok:false,code:'support_read_only'},'el prefijo exige límite de segmento');
  assert.deepEqual(supportVerdict('POST','/platformx/y'),{ok:false,code:'support_read_only'});
});
test('marca: solo vigente si es epoch futuro bien formado',()=>{
  const now=Date.UTC(2026,9,24,12,0,0);
  assert.equal(supportMarkActive(String(now/1000+60),now),true);
  assert.equal(supportMarkActive(String(now/1000-1),now),false);
  for(const bad of [undefined,'','abc','1e12','-5','99999999999999'])assert.equal(supportMarkActive(bad,now),false,String(bad));
});
test('entrada de inicio: motivo 10–500, minutos 5–60 enteros, UUID, sin campos extra',()=>{
  const ok={operation:'start',tenant:T,reason:'  revisar carga de HubSpot  ',minutes:45,requestId:R};
  assert.deepEqual(parseSupportInput(ok),{operation:'start',tenant:T,reason:'revisar carga de HubSpot',minutes:45,requestId:R});
  assert.equal(parseSupportInput({...ok,minutes:undefined})!.operation==='start'&&(parseSupportInput({...ok,minutes:undefined}) as {minutes:number}).minutes,30,'30 por defecto');
  for(const bad of [{...ok,reason:'corto'},{...ok,reason:'x'.repeat(501)},{...ok,minutes:61},{...ok,minutes:4},{...ok,minutes:30.5},{...ok,minutes:'30'},{...ok,tenant:'no-uuid'},{...ok,requestId:'no'},{...ok,extra:1},{...ok,operation:'otro'},{...ok,reason:'          '}])
    assert.equal(parseSupportInput(bad as never),null,JSON.stringify(bad).slice(0,70));
  assert.deepEqual(parseSupportInput({operation:'end'}),{operation:'end'});
  assert.equal(parseSupportInput({operation:'end',tenant:T}),null);
});
test('cuenta regresiva: nunca negativa y con formato mm:ss',()=>{
  const now=Date.UTC(2026,9,24,12,0,0);
  assert.equal(secondsLeft(new Date(now+61_500).toISOString(),now),62);
  assert.equal(secondsLeft(new Date(now-5000).toISOString(),now),0);
  assert.equal(mmss(0),'00:00');assert.equal(mmss(59),'00:59');assert.equal(mmss(3600),'60:00');assert.equal(mmss(125),'02:05');
});
