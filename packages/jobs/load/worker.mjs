// Instrumentation wraps production commits; no fixture SQL substitutes persistence.
import {pathToFileURL} from 'node:url';
const root=process.env.F02_BUILT;
const {createRuntime}=await import(pathToFileURL(root+'/packages/jobs/durable/runtime.mjs'));
const {runDaemon}=await import(pathToFileURL(root+'/packages/jobs/durable/daemon.mjs'));
const runtime=await createRuntime(process.env);let active=false;
const send=value=>process.send?.(value);
const repository={...runtime.repository,async commitChunk(...args){const start=performance.now();try{return await runtime.repository.commitChunk(...args);}finally{send({kind:'chunk',jobId:args[0].id,rows:args[1].records.length,offset:args[1].checkpoint.offset,done:args[1].done,commitMs:performance.now()-start,memory:process.memoryUsage(),maxRssKiB:process.resourceUsage().maxRSS});}}};
process.on('message',async message=>{if(active){send({id:message.id,ok:false,error:'LOAD_WORKER_BUSY'});return;}active=true;try{
 if(message.op==='heartbeat')await repository.heartbeat();
 else if(message.op==='consume')await runDaemon({...runtime,repository,close:async()=>{}},{once:true});
 else if(message.op==='close'){await runtime.close();process.exit(0);}
 else throw Error('LOAD_WORKER_OPERATION_INVALID');
 send({id:message.id,ok:true,memory:process.memoryUsage(),maxRssKiB:process.resourceUsage().maxRSS});
 }catch(error){send({id:message.id,ok:false,error:{code:error.code??'UNCLASSIFIED',status:error.status??null}});}finally{active=false;}});
send({ready:true,pid:process.pid,node:process.version});
