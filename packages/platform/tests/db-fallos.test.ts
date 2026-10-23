import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase,failureClass} from '../src/db.ts';

const T='11111111-1111-4111-8111-111111111111', U='22222222-2222-4222-8222-222222222222';
const identity={getUser:async()=>({id:U}),memberships:async()=>[{tenant_id:T,user_id:U,role:'owner',status:'active',permissions_version:1}]} as never;

test('failureClass: etiqueta fija por causa, sin mensajes ni datos', () => {
  const caso=(codigo:string|undefined,mensaje:string)=>failureClass(Object.assign(new Error(mensaje),codigo?{code:codigo}:{}));
  assert.equal(caso(undefined,'timeout exceeded when trying to connect'),'connect_timeout');
  assert.equal(caso('57014','canceling statement due to statement timeout'),'statement_timeout');
  assert.equal(caso(undefined,'Connection terminated unexpectedly'),'connection_lost');
  assert.equal(caso('POOL_WAIT','pool_wait_timeout'),'pool_wait_timeout');
  assert.equal(caso('53300','sorry, too many clients already'),'too_many_connections');
  assert.equal(caso('42P01','relation "x" does not exist'),'sqlstate_42P01');
  assert.equal(caso(undefined,'algo con datos de clientes'),'other');
});
test('un 503 de base deja un registro con la clase y sin el mensaje original', async () => {
  const avisos:string[]=[];const original=console.warn;console.warn=(...a:unknown[])=>{avisos.push(a.join(' '));};
  try{
    const pool={async connect(){throw Object.assign(new Error('timeout exceeded when trying to connect secreto@correo.com'),{});}};
    const db=createDatabase({identity,pool:pool as never});
    await assert.rejects(db.transaction('read',async()=>1),{status:503});
  }finally{console.warn=original;}
  assert.equal(avisos.length>=1,true);
  const linea=avisos.find(a=>a.startsWith('db-fallo '))!;assert.ok(linea,'hay registro db-fallo');
  const dato=JSON.parse(linea.slice('db-fallo '.length));
  assert.equal(dato.clase,'connect_timeout');assert.equal(dato.accion,'read');assert.equal(typeof dato.ms,'number');
  assert.ok(!/secreto|correo/.test(linea),'el mensaje original no se registra');
});
