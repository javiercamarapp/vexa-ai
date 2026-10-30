// MFA opcional de propietarios (apagada por defecto): con la opción de la organización activa, las acciones fuertes del propietario (configure, approve, retain) exigen AAL2 en la capa de base.
//   cd apps/web && node --require ./tests/server-only-stub.cjs --import tsx --test tests/owner-mfa-db.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase} from '@vexa/platform/db';
const T='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',U='11111111-1111-4111-8111-111111111111';
function montar(opts:{rol:'owner'|'analyst'|'operator'|'viewer';requerida:boolean|'sin_funcion';aal:string|null|undefined}){
  const log:string[]=[];
  const pool={async connect(){return {async query(sql:string){log.push(sql.slice(0,45));
    if(/owner_mfa_required/.test(sql)){if(opts.requerida==='sin_funcion'){const e:any=new Error('function does not exist');e.code='42883';throw e;}return {rows:[{r:opts.requerida}]};}
    if(/FROM public.memberships/.test(sql))return {rows:[{tenant_id:T,user_id:U,role:opts.rol,status:'active',permissions_version:1}]};
    return {rows:[]};},release(){}};}};
  const identidad:any={async getUser(){return {id:U};},async memberships(){return [{tenant_id:T,user_id:U,role:opts.rol,status:'active',permissions_version:1}];}};
  if(opts.aal!==undefined)identidad.assurance=async()=>opts.aal;
  return {db:createDatabase({identity:identidad,pool:pool as never,selectedTenant:T}),log};
}
for(const accion of ['configure','approve','retain'] as const){
  test(`opción activa: el propietario con aal1 recibe 403 owner_mfa_required en ${accion}; con aal2 pasa`,async()=>{
    const m1=montar({rol:'owner',requerida:true,aal:'aal1'});
    await assert.rejects(m1.db.transaction(accion,async()=>1),(e:any)=>e.status===403&&e.code==='owner_mfa_required');
    const m2=montar({rol:'owner',requerida:true,aal:'aal2'});assert.equal(await m2.db.transaction(accion,async()=>7),7);
    const m3=montar({rol:'owner',requerida:true,aal:null});await assert.rejects(m3.db.transaction(accion,async()=>1),(e:any)=>e.code==='owner_mfa_required','Auth sin responder = falla cerrada');
  });
}
test('opción apagada (por defecto): nada cambia para el propietario; las lecturas nunca exigen aal2',async()=>{
  const m=montar({rol:'owner',requerida:false,aal:'aal1'});assert.equal(await m.db.transaction('configure',async()=>1),1);
  const l=montar({rol:'owner',requerida:true,aal:'aal1'});assert.equal(await l.db.transaction('read',async()=>2),2);assert.ok(!l.log.some(x=>/owner_mfa_required/.test(x)),'una lectura ni consulta la opción');
});
test('migración aún no aplicada (la función no existe): se tolera con SAVEPOINT y no se exige',async()=>{
  const m=montar({rol:'owner',requerida:'sin_funcion',aal:'aal1'});assert.equal(await m.db.transaction('retain',async()=>3),3);
  assert.ok(m.log.some(x=>/ROLLBACK TO SAVEPOINT/.test(x)));
});
test('otros roles no consultan la opción (analista con import, operador con execute)',async()=>{
  const a=montar({rol:'analyst',requerida:true,aal:'aal1'});assert.equal(await a.db.transaction('import',async()=>1),1);assert.ok(!a.log.some(x=>/owner_mfa_required/.test(x)));
  const o=montar({rol:'operator',requerida:true,aal:'aal1'});assert.equal(await o.db.transaction('execute',async()=>1),1);
});
