// Own regression probe, not an acceptance gate. Real local Auth and restricted SQL login.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=process.cwd(),reuse=process.env.VEXA_REUSE_SOURCE;
assert.ok(reuse,'VEXA_REUSE_SOURCE is required (read-only reviewed infrastructure)');
assert.ok(!process.env.NODE_TEST_CONTEXT,'real process must not inherit NODE_TEST_CONTEXT');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-delegation-'));
const support=path.join(reuse,'tests/acceptance/support');
process.env.VEXA_CI_BROKER=randomUUID();process.env.VEXA_CI_JOURNAL=path.join(scratch,'resources.jsonl');
fs.writeFileSync(process.env.VEXA_CI_JOURNAL,'',{mode:0o600});
let infra=fs.readFileSync(path.join(support,'F02-durable/isolated-infra.mjs'),'utf8')
 .replace("'../ci/resources.mjs'",JSON.stringify(pathToFileURL(path.join(support,'ci/resources.mjs')).href))
 .replace("'../F01-03/matrix.mjs'",JSON.stringify(pathToFileURL(path.join(support,'F01-03/matrix.mjs')).href));
for(const [a,b] of [['56327','58210'],['56328','58211'],['56329','58212']])infra=infra.replaceAll(a,b);
fs.writeFileSync(path.join(scratch,'infra.mjs'),infra);
const {launch}=await import(pathToFileURL(path.join(scratch,'infra.mjs')));
const {sqlPool}=await import(pathToFileURL(path.join(support,'F02-durable/sql-pool.mjs')));
const q=v=>"'"+String(v).replaceAll("'","''")+"'";
let h,pool;const results=[],owned=[];const original=process.argv.includes('--original');
try{
 h=await launch({services:true});
 for(const name of fs.readdirSync(path.join(root,'supabase/migrations')).filter(n=>/^000[1-7].*\.sql$/.test(n)).sort()){
  const origin=original&&name.startsWith('0007')?reuse:root;
  h.sql(fs.readFileSync(path.join(origin,'supabase/migrations',name),'utf8'));
 }
 const owner=await h.user(),bot=await h.user(),other=await h.user();const a=randomUUID(),b=randomUUID();
 for(const tenant of [a,b])h.sql(`INSERT INTO organizations(id,name) VALUES(${q(tenant)},'SYNTHETIC'); INSERT INTO memberships(tenant_id,user_id,role,status) VALUES(${q(tenant)},${q(owner.id)},'owner','active'),(${q(tenant)},${q(bot.id)},'analyst','active'),(${q(tenant)},${q(other.id)},'analyst','active');`);
 h.sql(`INSERT INTO worker_delegations(tenant_id,user_id,enabled) VALUES(${q(a)},${q(bot.id)},true);`);
 const config=h.productConfiguration();pool=sqlPool(config.container,config.connection);
 async function probe(actor,tenant,sql,action='configure'){
  const verified=await h.http('auth','/user',actor.token);assert.equal(verified.status,200);assert.equal(verified.data.id,actor.id);
  const c=await pool.connect();try{
   const role=(await c.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];assert.equal(role.rolsuper,false);assert.equal(role.rolbypassrls,false);
   await c.query('BEGIN');await c.query('SET LOCAL ROLE vexa_backend');
   await c.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('vexa.tenant_id',$2,true),set_config('vexa.action',$3,true)",[verified.data.id,tenant,action]);
   try{const r=await c.query(sql);return {code:'00000',affected:r.rowCount,rows:r.rows};}catch(e){return {code:e.code};}
  }finally{await c.query('ROLLBACK');c.release();}
 }
 const denied=r=>r.code==='42501'||(r.code==='00000'&&r.affected===0);
 async function check(name,run,accept){const result=await run();const pass=accept(result);results.push({name,pass,result});console.log(JSON.stringify(results.at(-1)));}
 await check('owner A+B, scope A cannot insert enabled B',()=>probe(owner,a,`INSERT INTO worker_delegations VALUES(${q(b)},${q(other.id)},true,NULL)`),denied);
 await check('UPDATE cannot mutate user_id',()=>probe(owner,a,`UPDATE worker_delegations SET user_id=${q(other.id)} WHERE tenant_id=${q(a)} AND user_id=${q(bot.id)}`),denied);
 await check('UPDATE cannot mutate tenant_id (already rejected in source)',()=>probe(owner,a,`UPDATE worker_delegations SET tenant_id=${q(b)} WHERE tenant_id=${q(a)} AND user_id=${q(bot.id)}`),denied);
 await check('scope A owner can revoke same delegation',()=>probe(owner,a,`UPDATE worker_delegations SET enabled=false WHERE tenant_id=${q(a)} AND user_id=${q(bot.id)}`),r=>r.code==='00000'&&r.affected===1);
 await check('scope B owner can insert B',()=>probe(owner,b,`INSERT INTO worker_delegations VALUES(${q(b)},${q(other.id)},true,NULL)`),r=>r.code==='00000'&&r.affected===1);
 await check('scope B cannot update A',()=>probe(owner,b,`UPDATE worker_delegations SET enabled=false WHERE tenant_id=${q(a)} AND user_id=${q(bot.id)}`),denied);
 await check('analyst cannot grant delegation',()=>probe(other,a,`INSERT INTO worker_delegations VALUES(${q(a)},${q(other.id)},true,NULL)`),denied);
 await check('empty scope cannot insert delegation',()=>probe(owner,'',`INSERT INTO worker_delegations VALUES(${q(b)},${q(other.id)},true,NULL)`),denied);
 await check('dispatcher updates timestamp without mutating identity',()=>probe(bot,'','SELECT public.reserve_worker_scope() AS tenant','worker_dispatch'),r=>r.code==='00000'&&r.rows[0].tenant===a);
 process.exitCode=results.every(r=>r.pass)?0:1;
}catch(e){console.error(e);process.exitCode=2;}
finally{
 pool?.close();
 for(const line of fs.readFileSync(process.env.VEXA_CI_JOURNAL,'utf8').trim().split('\n').filter(Boolean)){
  const r=JSON.parse(line),out=spawnSync('docker',[r.kind,'inspect',r.name,'--format','{{.Id}}'],{encoding:'utf8'});if(out.status===0)owned.push({...r,id:out.stdout.trim()});
 }
 h?.close();
 const cleanup=owned.map(r=>({...r,absent:spawnSync('docker',[r.kind,'inspect',r.id],{encoding:'utf8'}).status!==0}));
 fs.writeFileSync(path.join(scratch,'cleanup.json'),JSON.stringify(cleanup,null,2));
 if(cleanup.some(r=>!r.absent))process.exitCode=2;
 fs.writeFileSync(path.join(scratch,'result.json'),JSON.stringify({original,exit:process.exitCode??0,results,cleanup},null,2));
 fs.rmSync(path.join(scratch,'infra.mjs'));
 console.log('EVIDENCE '+scratch);
}
