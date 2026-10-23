import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase,connectionLost} from '../src/db.ts';

const T='11111111-1111-4111-8111-111111111111', U='22222222-2222-4222-8222-222222222222';
const identity={getUser:async()=>({id:U}),memberships:async()=>[{tenant_id:T,user_id:U,role:'owner',status:'active',permissions_version:1}]} as never;
function pool(plan:Array<'ok'|'corta'|'corta_en_trabajo'>){
  let n=0;const usos:string[]=[];
  return {usos,pool:{async connect(){
    const modo=plan[n++]??'ok';
    return {release(){usos.push('release');},async query(text:string){
      if(/FROM public\.memberships/.test(text))return {rows:[{tenant_id:T,user_id:U,role:'owner',status:'active',permissions_version:1}],rowCount:1};
      if(modo==='corta'&&/BEGIN/.test(text))throw new Error('Connection terminated unexpectedly');
      return {rows:[],rowCount:0};
    }};
  }}};
}
test('connectionLost distingue conexion cortada de timeout de sentencia', () => {
  assert.equal(connectionLost(new Error('Connection terminated unexpectedly')), true);
  assert.equal(connectionLost(Object.assign(new Error('x'),{code:'57014'})), false);
});
test('una lectura se repite una vez cuando el pooler corta la conexion', async () => {
  const {pool:p}=pool(['corta','ok']);let trabajos=0;
  const db=createDatabase({identity,pool:p as never});
  const r=await db.transaction('read',async()=>{trabajos++;return 'listo';});
  assert.equal(r,'listo');assert.equal(trabajos,1);
});
test('una escritura NO se repite aunque la conexion se corte', async () => {
  const {pool:p}=pool(['corta','ok']);
  const db=createDatabase({identity,pool:p as never});
  await assert.rejects(db.transaction('configure',async()=>'x'),(e:{status?:number})=>e.status===503);
});
test('dos cortes seguidos en una lectura siguen siendo 503 (un solo reintento)', async () => {
  const {pool:p}=pool(['corta','corta','ok']);
  const db=createDatabase({identity,pool:p as never});
  await assert.rejects(db.transaction('read',async()=>'x'),(e:{status?:number})=>e.status===503);
});
