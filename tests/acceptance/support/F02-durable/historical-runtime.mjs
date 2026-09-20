import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {launch,candidateInputs} from './isolated-infra.mjs';
import {q} from '../F01-03/matrix.mjs';
export {q};
export const hash=b=>createHash('sha256').update(b).digest('hex');
export async function runtime(candidate){
 const core=JSON.parse(fs.readFileSync(new URL('./core-hashes.json',import.meta.url)));
 for(const [file,expected] of Object.entries(core))assert.equal(hash(fs.readFileSync(path.join(candidate,file))),expected,'CORE_MIGRATION_CHANGED:'+file);
 const h=await launch({services:true});
 try{
  for(const ddl of candidateInputs(candidate))h.sql(ddl);
  const A=await h.user(),B=await h.user();
  for(const a of [A,B]){
   a.tenant=randomUUID();a.connection=randomUUID();
   h.sql(`INSERT INTO organizations(id,name) VALUES (${q(a.tenant)},'SYNTHETIC F02'); INSERT INTO memberships(tenant_id,user_id,role,status) VALUES (${q(a.tenant)},${q(a.id)},'owner','active'); INSERT INTO connections(id,tenant_id,source,account_id) VALUES (${q(a.connection)},${q(a.tenant)},'csv',${q(randomUUID())});`);
  }
  let clock=Date.now();
  // This is an explicit proposed boundary, not an alternate silently selected export.
  const ports={sql:async statement=>h.sql(statement),auth:async token=>{
   const r=await h.http('auth','/user',token);return r.status===200?r.data:null;
  },storage:async(route,token,options)=>h.http('storage',route,token,options),now:()=>clock};
  return Object.assign(h,{A,B,ports,advance:ms=>clock+=ms});
 }catch(e){h.close();throw e;}
}
export async function serve(handler){
 const server=http.createServer(async(req,res)=>{
  try{const chunks=[];for await(const c of req)chunks.push(c);
   const r=await handler(new Request(`http://127.0.0.1${req.url}`,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}));
   res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));
  }catch{res.writeHead(500);res.end('HANDLER_UNCAUGHT');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 return {origin,close:()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}),async request(actor,route,body,headers={}){
  const r=await fetch(origin+route,{method:body===undefined?'GET':'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{Connection:'close',...(actor?{Authorization:`Bearer ${actor.token}`,'x-vexa-organization':actor.tenant}:{}),'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await r.text();let data;try{data=JSON.parse(text);}catch{}return {status:r.status,data,text};
 }};
}
export function snapshot(h,id){return h.json(`SELECT json_build_object('imports',(SELECT coalesce(json_agg(i),'[]') FROM imports i WHERE id=${q(id)}),'jobs',(SELECT coalesce(json_agg(j),'[]') FROM jobs j WHERE import_id=${q(id)}),'outbox',(SELECT coalesce(json_agg(o),'[]') FROM outbox o JOIN jobs j ON j.id=o.job_id AND j.tenant_id=o.tenant_id WHERE j.import_id=${q(id)}))`);}
export function injection(h,table,on){
 assert.ok(['imports','jobs','outbox'].includes(table));
 h.sql(on?`CREATE SEQUENCE public.f02_fault_reached START 1; CREATE OR REPLACE FUNCTION public.f02_exam_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM nextval('public.f02_fault_reached'); RAISE EXCEPTION 'SYNTHETIC_F02_FAULT' USING ERRCODE='P0001'; END $$; CREATE TRIGGER f02_exam_fault BEFORE INSERT ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.f02_exam_fault();`:`DROP TRIGGER f02_exam_fault ON public.${table}; DROP FUNCTION public.f02_exam_fault(); DROP SEQUENCE public.f02_fault_reached;`);
}
