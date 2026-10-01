import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {setup as acceptedSetup,q} from '../F06-notifications/harness.mjs';
export {q};
export function inputs(candidate){
 assert.ok(candidate,'VEXA_CANDIDATE_REQUIRED');
 assert.ok(fs.readdirSync(path.join(candidate,'supabase/migrations')).some(name=>/^0029_.*notification.*outbox.*\.sql$/.test(name)),'NOTIFICATION_OUTBOX_IMPLEMENTATION_MISSING');
 for(const name of ['outbox.mjs','worker.mjs','daemon.mjs'])assert.ok(fs.existsSync(path.join(candidate,'packages/notifications',name)),'NOTIFICATION_OUTBOX_IMPLEMENTATION_MISSING:'+name);
}
export async function setup(candidate,evidence){
 inputs(candidate);const h=await acceptedSetup(candidate,evidence),pools=[];
 try{
 const {default:pg}=await import(pathToFileURL(path.join(h.tmp,'node_modules/pg/lib/index.js')));
 const {createDatabase}=await import(pathToFileURL(path.join(h.built,'packages/platform/db.mjs')));
 const {createOutboxRepository}=await import(pathToFileURL(path.join(h.built,'packages/notifications/outbox.mjs')));
 h.outbox=(actor=h.A,options={})=>{
  const pool=new pg.Pool({connectionString:h.common.VEXA_DATABASE_URL,max:3});pools.push(pool);
  const identity={async getUser(){const r=await h.auth('auth','/user',actor.token);assert.equal(r.status,200,'OWNER_AUTH_REAL');return r.data;},async memberships(){const r=await h.auth('rest','/memberships?select=*',actor.token);assert.equal(r.status,200,'OWNER_MEMBERSHIPS_REAL');return r.data;}};
  const database=createDatabase({identity,pool,selectedTenant:actor.tenant});
  return {database,repository:createOutboxRepository({database,...options})};
 };
 h.verifier=async verify=>{
  const role='syn_outbox_verifier_'+randomUUID().replaceAll('-',''),password=randomUUID();
  h.sql(`CREATE ROLE ${role} LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS PASSWORD ${q(password)};GRANT vexa_notification_verifier TO ${role};`);
  const url=new URL(h.common.VEXA_DATABASE_URL);url.username=role;url.password=password;
  const pool=new pg.Pool({connectionString:url.toString(),max:1});pools.push(pool);
  const {createReconciliationVerifier}=await import(pathToFileURL(path.join(h.built,'packages/notifications/reconciliation.mjs')));
  return createReconciliationVerifier({pool,verify});
 };
 h.assertVerifierIsolation=async()=>{
  const pool=new pg.Pool({connectionString:h.common.VEXA_DATABASE_URL,max:1});pools.push(pool);const c=await pool.connect();
  try{await assert.rejects(c.query('SET ROLE vexa_notification_verifier'),e=>e.code==='42501');await c.query('BEGIN');await c.query('SET LOCAL ROLE vexa_backend');await assert.rejects(c.query('INSERT INTO public.notification_reconciliation_evidence DEFAULT VALUES'),e=>e.code==='42501');await c.query('ROLLBACK');}finally{await c.query('ROLLBACK');c.release();}
 };
 const close=h.close.bind(h);h.close=async()=>{try{for(const pool of pools)await pool.end();}finally{await close();}};return h;
 }catch(error){try{for(const pool of pools)await pool.end();}finally{await h.close();}throw error;}
}
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
const outboundEnv=h=>({NODE_OPTIONS:'--import='+fileURLToPath(new URL('../F06-recommendations/outbound-audit.mjs',import.meta.url)),VEXA_RECOMMENDATION_AUDIT:path.join(h.evidence,'outbound-attempts.jsonl')});
export async function worker(h,{actor=h.A,identity=h.bot,leaseMs=1000,sinkUrl}={}){
 const child=fork(new URL('./worker-driver.mjs',import.meta.url),[],{execPath:process.execPath,execArgv:[],env:{...h.common,...outboundEnv(h),VEXA_WORKER_EMAIL:identity.email,VEXA_WORKER_PASSWORD:identity.password,VEXA_WORKER_USER_ID:identity.id,VEXA_WORKER_TENANT:actor.tenant,SYN_OUTBOX_LEASE_MS:String(leaseMs),SYN_OUTBOX_SINK:sinkUrl},stdio:['ignore','ignore','ignore','ipc']});
 const pending=new Map(),barriers=[];
 child.on('message',value=>{if(value.barrier){barriers.push(value);return;}const resolve=pending.get(value.id);if(resolve){pending.delete(value.id);resolve(value);}});
 try{const ready=await bounded(new Promise((resolve,reject)=>{child.once('message',resolve);child.once('error',reject);child.once('exit',code=>reject(Error('OUTBOX_WORKER_START_EXIT:'+code)));}),'worker-ready');assert.equal(ready.ready,true,JSON.stringify(ready));}catch(error){if(child.exitCode===null&&child.signalCode===null){const ended=once(child,'exit');child.kill('SIGKILL');await bounded(ended,'failed-worker-exit',10000);}pending.clear();throw error;}
 return {child,barriers,call(op,...args){const id=randomUUID();return bounded(new Promise(resolve=>{pending.set(id,resolve);child.send({id,op,args});}),'worker-'+op);},release(){child.send({op:'release'});},async kill(){if(child.exitCode===null&&child.signalCode===null){const ended=once(child,'exit');child.kill('SIGKILL');await bounded(ended,'worker-exit',10000);}for(const resolve of pending.values())resolve({ok:false,error:{code:'SYN_PROCESS_KILLED'}});pending.clear();}};
}
export async function bounded(p,label,ms=20000){let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('OUTBOX_HANDSHAKE:'+label)),ms);})]);}finally{clearTimeout(timer);}}
export async function eventually(read,accept,label,ms=10000){const end=Date.now()+ms;while(Date.now()<end){const value=await read();if(accept(value))return value;await new Promise(r=>setTimeout(r,30));}throw Error('OUTBOX_EVENTUALLY:'+label);}
export async function cli(h,{actor=h.A,identity=h.bot,transportModule,dispatcher=true,args=['--once'],extraEnv={}}={}){
 const {spawn}=await import('node:child_process');
 const c=spawn(process.execPath,[path.join(h.built,'packages/notifications/daemon.mjs'),...args],{cwd:h.tmp,env:{...h.common,...outboundEnv(h),VEXA_WORKER_EMAIL:identity.email,VEXA_WORKER_PASSWORD:identity.password,VEXA_WORKER_USER_ID:identity.id,VEXA_WORKER_TENANT:actor.tenant,VEXA_WORKER_DISPATCHER:dispatcher?'enabled':'disabled',...(transportModule?{VEXA_NOTIFICATION_TRANSPORT_MODULE:transportModule}:{}),...extraEnv},stdio:['ignore','pipe','pipe']});
 let output='';c.stdout.on('data',b=>{output+=b;});c.stderr.on('data',b=>{output+=b;});
 try{const [code,signal]=await bounded(once(c,'exit'),'cli-exit',30000);return {code,signal,output,pid:c.pid};}
 finally{if(c.exitCode===null&&c.signalCode===null){const ended=once(c,'exit');c.kill('SIGKILL');await bounded(ended,'cli-killed-exit',10000);}}
}
