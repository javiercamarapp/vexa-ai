import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {esErrorDeConexion,conectarConReintento,vigilarPool} from '../../src/lib/db-resiliencia.mjs';

const muerto=()=>{const c={liberado:null,query:async()=>{throw Object.assign(new Error('Connection terminated unexpectedly'),{});},release(x){c.liberado=x===undefined?'ok':'destruido';}};return c;};
const vivo=()=>{const c={liberado:null,query:async()=>({rows:[{ok:1}]}),release(x){c.liberado=x===undefined?'ok':'destruido';}};return c;};

test('reconoce errores de conexion cortada por el pooler y no confunde errores de SQL', () => {
  assert.equal(esErrorDeConexion(new Error('Connection terminated unexpectedly')), true);
  assert.equal(esErrorDeConexion(Object.assign(new Error('x'), {code: 'ECONNRESET'})), true);
  assert.equal(esErrorDeConexion(Object.assign(new Error('x'), {code: '57P01'})), true);
  assert.equal(esErrorDeConexion(Object.assign(new Error('canceling statement due to statement timeout'), {code: '57014'})), false);
  assert.equal(esErrorDeConexion(Object.assign(new Error('duplicate'), {code: '23505'})), false);
  assert.equal(esErrorDeConexion(null), false);
});
test('una conexion muerta del pool se destruye y se reintenta con otra viva', async () => {
  const a=muerto(), b=vivo(), cola=[a,b];
  const driver={connect:async()=>cola.shift()};
  const c=await conectarConReintento(driver, (x)=>x.query('select 1'));
  assert.equal(c, b); assert.equal(a.liberado, 'destruido'); assert.equal(b.liberado, null);
});
test('un error que no es de conexion no se reintenta y libera la conexion normal', async () => {
  const a=vivo(), driver={connect:async()=>a};
  await assert.rejects(conectarConReintento(driver, async()=>{throw Object.assign(new Error('role'), {code: '42501'});}), /role/);
  assert.equal(a.liberado, 'ok');
});
test('agota los intentos y propaga el error de conexion', async () => {
  const cola=[muerto(),muerto(),muerto()], driver={connect:async()=>cola.shift()};
  await assert.rejects(conectarConReintento(driver, (x)=>x.query('select 1'), {intentos: 2}), /Connection terminated/);
});
test('sin manejador de error un cliente inactivo cortado tumba el proceso: vigilarPool lo absorbe', () => {
  const pool=new EventEmitter(), avisos=[];
  assert.throws(() => pool.emit('error', new Error('Connection terminated unexpectedly')), /Connection terminated/);
  vigilarPool(pool, (m)=>avisos.push(m));
  assert.doesNotThrow(() => pool.emit('error', new Error('Connection terminated unexpectedly')));
  assert.equal(avisos.length, 1);
  assert.ok(!/postgres|pooler/i.test(avisos[0]));
});
