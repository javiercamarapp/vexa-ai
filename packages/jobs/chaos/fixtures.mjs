import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {q} from './harness.mjs';
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function seeded(seed){let state=seed>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};}
export const logicalClock=()=>{let now=Date.UTC(2026,8,23),sequence=0;const timers=new Map();return{now:()=>now,setTimeout(fn,ms){timers.set(++sequence,{at:now+ms,fn});return sequence;},clearTimeout(id){timers.delete(id);},advance(ms){now+=ms;for(const[id,t]of timers)if(t.at<=now){timers.delete(id);t.fn();}}};};
export const call=async(worker,operation,...args)=>{const result=await worker.call(operation,...args);assert.equal(result.ok,true,operation+':'+JSON.stringify(result.error));return result.value;};
export function fixture(seed,n=200){const random=seeded(seed);return Buffer.from('id,text,date,role,conversation\n'+Array.from({length:n},(_,i)=>`syn-${seed}-${i},SYNTHETIC-${random()},2026-09-01T00:00:00Z,customer,conversation-${i}`).join('\n')+'\n');}
export async function createImport(h,worker,{seed=42,n=200,actor=h.A}={}){
 await call(worker,'heartbeat');const bytes=fixture(seed,n),sha=digest(bytes);
 const expect=(r,status)=>{assert.equal(r.status,status,JSON.stringify(r.data));return r.data.data;};
 const v=expect(await h.request(actor,'/api/imports',{connection_id:actor.connection,mapping_version:'csv-message-v1',content_type:'text/csv',size:bytes.length,sha256:sha}),201);
 assert.equal(new URL(v.upload_url).origin,'http://127.0.0.1:61623');const upload=await fetch(v.upload_url,{method:'PUT',signal:AbortSignal.timeout(30000),headers:{'content-type':'text/csv'},body:bytes});assert.equal(upload.status,200);await upload.arrayBuffer();
 const mapping=expect(await h.request(actor,`/api/imports/${v.import_id}/mapping`,{mapping:{columns:{id:'id',text:'text',date:'date',role:'role',conversation:'conversation'},timezone:'UTC',dateFormat:'iso'},expected_version:'csv-message-v1'}),200);
 expect(await h.request(actor,`/api/imports/${v.import_id}/confirm`,{upload_token:mapping.upload_token,sha256:sha,mapping_version:mapping.mapping_version}),202);
 const job=h.json(`SELECT row_to_json(j) FROM jobs j WHERE import_id=${q(v.import_id)}`);return{id:job.id,importId:v.import_id,n,fixtureHash:sha};
}
export function observed(h,id){return h.json(`SELECT jsonb_build_object('job',(SELECT to_jsonb(j) FROM jobs j WHERE id=${q(id)}),'cursor',(SELECT checkpoint FROM checkpoints WHERE job_id=${q(id)} AND stage='ingestion'),'rows',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'ref',r.row_ref,'state',r.state,'code',r.error_code) ORDER BY r.row_ref),'[]') FROM import_rows r JOIN jobs j ON j.import_id=r.import_id WHERE j.id=${q(id)}),'import',(SELECT to_jsonb(i) FROM imports i JOIN jobs j ON j.import_id=i.id WHERE j.id=${q(id)}),'deadLetters',(SELECT count(*) FROM dead_letters WHERE job_id=${q(id)}))`);}
export const backlog=h=>h.json("SELECT jsonb_build_object('queued',count(*) FILTER(WHERE state='queued'),'running',count(*) FILTER(WHERE state='running'),'failed',count(*) FILTER(WHERE state='failed')) FROM jobs WHERE type='import'");
