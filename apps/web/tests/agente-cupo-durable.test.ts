// R2-12: el cupo diario del agente vive en la base; sin base o con error cae al límite en memoria (falla abierto).
//   cd apps/web && node --require ./tests/server-only-stub.cjs --import tsx --test tests/agente-cupo-durable.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {admitirTurnoDurable,type PoolMinimo} from '../src/lib/agent/cupo-durable';
const T='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',U='11111111-1111-4111-8111-111111111111';
const pool=(respuesta:()=>unknown,log:string[]=[]):PoolMinimo=>({async connect(){return {async query(sql:string){log.push(sql.slice(0,30));if(/agent_turn_admit/.test(sql)){const r=respuesta();if(r instanceof Error)throw r;return {rows:[{r}]};}return {rows:[]};},release(){log.push('release');}};}});
test('ok / límite según responda la base; usa vexa_backend y libera la conexión',async()=>{
  const log:string[]=[];assert.equal(await admitirTurnoDurable(T,U,100,pool(()=>({ok:true,used:1,limit:100}),log)),'ok');
  assert.ok(log.some(x=>/SET LOCAL ROLE vexa_backend/.test(x)));assert.ok(log.includes('release'));
  assert.equal(await admitirTurnoDurable(T,U,100,pool(()=>({ok:false,limit:100}))),'limite');
});
test('falla abierto: error de la base, respuesta rara o pool que no conecta devuelven sin_base y se hace ROLLBACK',async()=>{
  const log:string[]=[];assert.equal(await admitirTurnoDurable(T,U,100,pool(()=>new Error('42883 no existe'),log)),'sin_base');assert.ok(log.includes('ROLLBACK'));
  assert.equal(await admitirTurnoDurable(T,U,100,pool(()=>null)),'sin_base');
  assert.equal(await admitirTurnoDurable(T,U,100,{async connect(){throw new Error('sin red');}}),'sin_base');
  delete process.env.VEXA_DATABASE_URL;assert.equal(await admitirTurnoDurable(T,U),'sin_base');
});
test('la ruta del agente consulta el cupo durable antes de responder y devuelve 429 daily_limit',()=>{
  const src=fs.readFileSync(new URL('../src/app/api/agent/turn/route.ts',import.meta.url),'utf8');
  assert.match(src,/admitirTurnoDurable/);assert.match(src,/daily_limit/);
  assert.ok(src.indexOf('admitirTurnoDurable')<src.indexOf('agent.answer'),'el cupo se comprueba antes de ejecutar el turno');
});
