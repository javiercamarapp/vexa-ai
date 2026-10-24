import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveSession, authorizeSelection, type IdentityPort, type Membership, type SupportGrant} from '../src/session.ts';
import {createDatabase, type SqlPool} from '../src/db.ts';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', C='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const U='22222222-2222-4222-8222-222222222222';
const member=(tenant_id:string,status:Membership['status']='active'):Membership=>({tenant_id,user_id:U,role:'owner',status,permissions_version:1});
const future=()=>new Date(Date.now()+30*60000).toISOString();
const grant=(tenant_id=C,expires_at=future()):SupportGrant=>({session_id:'s1',tenant_id,tenant_name:'Cliente C',expires_at,reason:'revisar carga de HubSpot'});
function port(rows:Membership[],support?:SupportGrant|null|'throws',counter={n:0}):IdentityPort{
  return {getUser:async()=>({id:U}),memberships:async()=>rows,...(support===undefined?{}:{support:async()=>{counter.n++;if(support==='throws')throw new Error('boom');return support;}})};
}

test('cookie de organización revocada: con fallback cae a la primera membresía válida y avisa; sin fallback sigue siendo 403',async()=>{
  const p=port([member(A,'revoked'),member(B)]);
  await assert.rejects(resolveSession(p,A),{status:403});
  const s=await resolveSession(p,A,{fallback:true});
  assert.equal(s.active.tenant_id,B);assert.equal(s.fellBack,true);assert.equal(s.support,null);
});
test('fallback no inventa acceso: sin ninguna membresía válida sigue en 403',async()=>{
  await assert.rejects(resolveSession(port([member(A,'revoked')]),A,{fallback:true}),{status:403});
});
test('con cookie válida no hay fallback y no se consulta soporte (cero llamadas extra)',async()=>{
  const c={n:0};const s=await resolveSession(port([member(A),member(B)],null,c),B,{fallback:true});
  assert.equal(s.active.tenant_id,B);assert.equal(s.fellBack,false);assert.equal(c.n,0);
});
test('sesión de soporte vigente da acceso de LECTOR a esa organización y nada más',async()=>{
  const s=await resolveSession(port([],grant()),C);
  assert.equal(s.active.tenant_id,C);assert.equal(s.active.role,'viewer');assert.equal(s.support?.tenant_id,C);
  await assert.rejects(resolveSession(port([],grant()),B),{status:403});
});
test('soporte vencido, de otra organización, con error o inexistente: 403 (falla cerrado)',async()=>{
  await assert.rejects(resolveSession(port([],grant(C,new Date(Date.now()-1000).toISOString())),C),{status:403});
  await assert.rejects(resolveSession(port([],grant(B)),C),{status:403});
  await assert.rejects(resolveSession(port([],'throws'),C),{status:403});
  await assert.rejects(resolveSession(port([],null),C),{status:403});
  await assert.rejects(resolveSession(port([]),C),{status:403});
});
test('una membresía real tiene prioridad sobre soporte y no consulta soporte',async()=>{
  const c={n:0};const s=await resolveSession(port([member(A)],grant(),c),A);
  assert.equal(s.active.role,'owner');assert.equal(s.support,null);assert.equal(c.n,0);
});
test('un UUID mal formado como cookie nunca llega a consultar soporte',async()=>{
  const c={n:0};await assert.rejects(resolveSession(port([],grant(),c),"x' or 1=1"),{status:403});assert.equal(c.n,0);
});
test('authorizeSelection acepta la organización con soporte vigente (como lector)',async()=>{
  assert.equal((await authorizeSelection(port([],grant()),C)).role,'viewer');
});

// ---- GUARDIA CENTRAL en la base: con soporte solo existe la acción 'read', en transacción de solo lectura.
function fakePool(log:string[],supportOk=true,missingFn=false):SqlPool{
  return {async connect(){return {release(){},async query(text:string){log.push(text.split('\n')[0].slice(0,60));
    if(/vexa_support_active/.test(text)){if(missingFn)throw Object.assign(new Error('function does not exist'),{code:'42883'});return {rows:[{ok:supportOk}],rowCount:1};}
    if(/FROM public.memberships/.test(text))return {rows:[],rowCount:0};
    return {rows:[],rowCount:0};}} as never;}};
}
test('soporte: toda acción distinta de read se rechaza ANTES de abrir la base',async()=>{
  for(const action of ['notify','materialize','import','configure','propose','approve','execute','retain'] as const){
    const log:string[]=[];const db=createDatabase({identity:port([],grant()),pool:fakePool(log),selectedTenant:C});
    await assert.rejects(db.transaction(action,async()=>1),{status:403,code:'support_read_only'});
    assert.deepEqual(log,[],'no se abrió transacción para '+action);
  }
});
test('soporte: read abre BEGIN READ ONLY, pregunta a la base por la sesión y entrega alcance de lector',async()=>{
  const log:string[]=[];const db=createDatabase({identity:port([],grant()),pool:fakePool(log),selectedTenant:C});
  const scope=await db.transaction('read',async s=>({tenant:s.tenantId,role:s.role}));
  assert.deepEqual(scope,{tenant:C,role:'viewer'});assert.equal(log[0],'BEGIN READ ONLY');assert.ok(log.some(l=>/vexa_support_active/.test(l)));
  assert.ok(!log.some(l=>/FROM public.memberships/.test(l)),'no se lee memberships del administrador');
});
test('soporte: si la base no confirma la sesión, 403; si falta la rama de lectura (migración), 503 explícito y nada se lee',async()=>{
  await assert.rejects(createDatabase({identity:port([],grant()),pool:fakePool([],false),selectedTenant:C}).transaction('read',async()=>1),{status:403,code:'organization_not_authorized'});
  await assert.rejects(createDatabase({identity:port([],grant()),pool:fakePool([],true,true),selectedTenant:C}).transaction('read',async()=>1),{status:503,code:'support_read_unavailable'});
});
