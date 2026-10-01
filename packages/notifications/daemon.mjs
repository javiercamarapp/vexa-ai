import path from 'node:path';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createOutboxRepository} from './outbox.mjs';
import {consumeNotification} from './worker.mjs';

function pause(ms,signal){
 return new Promise(resolve=>{
  let timer;
  const done=()=>{clearTimeout(timer);signal?.removeEventListener('abort',done);resolve();};
  if(signal?.aborted)return done();
  timer=setTimeout(done,ms);signal?.addEventListener('abort',done,{once:true});
 });
}

/** Acquire a fresh authorized dispatcher scope each cycle; release every runtime. */
export async function runNotificationDaemon(runtimeFactory,{transports={},signal,once=false,timeoutMs=10000,intervalMs=1000,afterSend}={}){
 if(typeof runtimeFactory!=='function'||!Number.isSafeInteger(intervalMs)||intervalMs<100||intervalMs>60000||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw Error('NOTIFICATION_DAEMON_CONFIGURATION_REQUIRED');
 while(!signal?.aborted){
  let runtime;
  try{
   runtime=await runtimeFactory();
   if(!runtime||typeof runtime.close!=='function')throw Error('NOTIFICATION_RUNTIME_INVALID');
   if(!signal?.aborted&&!runtime.idle){
    const repository=createOutboxRepository({database:runtime.database});
    await consumeNotification({repository,transports,timeoutMs,afterSend});
   }
  }finally{await runtime?.close?.();}
  if(once||signal?.aborted)break;
  await pause(intervalMs,signal);
 }
}

/** Server deployment configuration only. No HTTP URL or browser-selected module. */
export async function loadNotificationTransports(env=process.env){
 const filename=env.VEXA_NOTIFICATION_TRANSPORT_MODULE;
 if(filename===undefined||filename==='')return Object.freeze({});
 if(typeof filename!=='string'||!path.isAbsolute(filename)||path.extname(filename)!=='.mjs')throw Error('NOTIFICATION_TRANSPORT_CONFIGURATION_REQUIRED');
 const real=await fs.realpath(filename);
 if(!(await fs.stat(real)).isFile())throw Error('NOTIFICATION_TRANSPORT_CONFIGURATION_REQUIRED');
 const module=await import(pathToFileURL(real).href);
 if(typeof module.createTransports!=='function')throw Error('NOTIFICATION_TRANSPORT_CONFIGURATION_REQUIRED');
 const transports=await module.createTransports(env);
 if(!transports||typeof transports!=='object'||Array.isArray(transports)||Object.keys(transports).some(k=>!['email','push'].includes(k)))throw Error('NOTIFICATION_TRANSPORT_CONFIGURATION_REQUIRED');
 for(const transport of Object.values(transports)){
  if(!transport||['configured','resolveRecipient','send'].some(k=>typeof transport[k]!=='function'))throw Error('NOTIFICATION_TRANSPORT_CONFIGURATION_REQUIRED');
 }
 return Object.freeze({...transports});
}

const entry=process.argv[1]?await fs.realpath(path.resolve(process.argv[1])).catch(()=>null):null;
if(entry&&import.meta.url===pathToFileURL(entry).href){
 const controller=new AbortController();
 const stop=()=>controller.abort();process.once('SIGTERM',stop);process.once('SIGINT',stop);
 try{
  if(process.argv.slice(2).some(arg=>arg!=='--once')||process.argv.slice(2).length>1)throw Error('NOTIFICATION_ARGUMENT_INVALID');
  const transports=await loadNotificationTransports();
  const {createRuntime}=await import('../jobs/durable/runtime.mjs');
  await runNotificationDaemon(()=>createRuntime(process.env,{consumer:'notifications'}),{transports,signal:controller.signal,once:process.argv.includes('--once'),timeoutMs:Number(process.env.VEXA_NOTIFICATION_TIMEOUT_MS??10000),intervalMs:Number(process.env.VEXA_NOTIFICATION_POLL_MS??1000)});
 }catch{
  console.error('Notification consumer unavailable: verify documented Auth, SQL, worker delegation and channel configuration.');process.exitCode=1;
 }finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}
}
