import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {sqlPool} from './sql-pool.mjs';
export async function canonicalPorts(config){
 const {createDatabase}=await import(pathToFileURL(path.join(config.compiled,'db.mjs')));
 const {AccessError}=await import(pathToFileURL(path.join(config.compiled,'session.mjs')));
 const pool=sqlPool(config.container,config.connection);
 const http=async(kind,route,token,{method='GET',body,headers={}}={})=>{
  const origin='http://127.0.0.1:'+({auth:56327,rest:56329,storage:56328}[kind]);const url=new URL(route,origin);
  if(url.origin!==origin)throw new Error('NETWORK_SCOPE');
  const r=await fetch(url,{method,redirect:'error',signal:AbortSignal.timeout(5000),headers:{Connection:'close',apikey:config.anon,Authorization:'Bearer '+(token??config.anon),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
  const bytes=new Uint8Array(await r.arrayBuffer());const text=new TextDecoder().decode(bytes);let data;try{data=JSON.parse(text);}catch{}return {status:r.status,text,data,bytes};
 };
 const identity=token=>({getUser:async()=>{const r=await http('auth','/user',token);return r.status===200?r.data:null;},memberships:async userId=>{const r=await http('rest','/memberships?select=*&user_id=eq.'+userId,token);if(r.status!==200)throw new Error('IDENTITY_UNAVAILABLE');return r.data;}});
 return {pool,AccessError,database:request=>createDatabase({identity:identity(request.headers.get('authorization')?.replace(/^Bearer /,'')),pool,selectedTenant:request.headers.get('x-vexa-organization')??undefined}),storage:(...args)=>http('storage',...args),now:()=>config.clock,signingSecret:config.signingSecret,close:()=>pool.close()};
}
