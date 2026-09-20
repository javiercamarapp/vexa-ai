// External process driver: only the product's built runtime/consumer execute work.
import {pathToFileURL} from 'node:url';
const root=process.env.F02_BUILT;
const {createRuntime}=await import(pathToFileURL(root+'/packages/jobs/durable/runtime.mjs'));
const {createDatabase}=await import(pathToFileURL(root+'/packages/platform/db.mjs'));
let database;const r=await createRuntime(process.env,{createDatabase:options=>(database=createDatabase(options))});
const reply=data=>process.send?.(data);
process.on('message',async m=>{try{
 if(m.op==='healthOptions'){
  const {createJobRepository}=await import(pathToFileURL(root+'/packages/jobs/durable/repository.mjs'));reply({ok:true,value:await createJobRepository({database,...m.args[0]}).health()});
 }else if(m.op==='credentials'){
  const {workerCredentials}=await import(pathToFileURL(root+'/packages/jobs/durable/credentials.mjs'));
  const credentials=workerCredentials();const realNow=Date.now;
  try{const token=await credentials.token();Date.now=()=>realNow()+3600000;const rotated=await credentials.token();Date.now=realNow;const response=await fetch(process.env.VEXA_SUPABASE_URL+'/auth/v1/user',{headers:{apikey:process.env.VEXA_SUPABASE_ANON_KEY,authorization:'Bearer '+rotated}});const user=await response.json();reply({ok:true,value:{authenticated:!!token,status:response.status,userId:user.id}});}finally{Date.now=realNow;}
 }else if(m.op==='consume'){
  if(r.idle){reply({ok:true,value:{idle:true}});return;}
  const {runDaemon}=await import(pathToFileURL(root+'/packages/jobs/durable/daemon.mjs'));
  await runDaemon({...r,close:async()=>{}},{once:true,afterCommit:async j=>{
   if(m.barrier && (m.barrier!=='final'||(await r.repository.checkpoint(j))?.done)){reply({barrier:true,id:j.id});await new Promise(()=>{});}
  }});reply({ok:true});
 }else if(m.op==='close'){await r.close();process.exit(0);}
 else reply({ok:true,value:await r.repository[m.op](...(m.args??[]))});
 }catch(e){reply({ok:false,error:{code:e.code??'UNCLASSIFIED',status:e.status??null}});}});
reply({ready:true});
