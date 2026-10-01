import {createHash,timingSafeEqual} from 'node:crypto';
import {createOutboxRepository} from './outbox.mjs';
import {consumeNotification} from './worker.mjs';
import {closeNotificationTransports} from './daemon.mjs';
const digest=value=>createHash('sha256').update(value).digest();
const reply=(code,status)=>Response.json({code},{status,headers:{'Cache-Control':'private, no-store'}});

async function emptyInput(request){
 if(!request.body)return;
 const reader=request.body.getReader();let size=0,body='',timer,abort;
 const stop=new Promise((_,reject)=>{
  timer=setTimeout(()=>reject(Error('BODY_TIMEOUT')),5000);
  abort=()=>reject(Error('BODY_TIMEOUT'));
  request.signal.addEventListener('abort',abort,{once:true});
  if(request.signal.aborted)abort();
 });
 try{
  for(;;){const {done,value}=await Promise.race([reader.read(),stop]);if(done)break;size+=value.byteLength;if(size>2)throw Error('BODY_NOT_ALLOWED');body+=Buffer.from(value).toString('utf8');}
  if(body!==''&&body!=='{}')throw Error('BODY_NOT_ALLOWED');
 }catch(error){void reader.cancel().catch(()=>{});throw error;}
 finally{clearTimeout(timer);request.signal.removeEventListener('abort',abort);reader.releaseLock();}
}

/** Operator-only, tenant-free trigger. Injected factories are trusted server code, never request input. */
export function createNotificationHostedHandler({runtime,transports,secret,timeoutMs=40000,sendTimeoutMs=5000,cleanupMs=10000}={}){
 let active=false;
 return async request=>{
  if(typeof secret!=='string'||secret.length<32||typeof runtime!=='function'||typeof transports!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>40000||!Number.isSafeInteger(sendTimeoutMs)||sendTimeoutMs<1||sendTimeoutMs>5000||sendTimeoutMs*4>timeoutMs||!Number.isSafeInteger(cleanupMs)||cleanupMs<1||cleanupMs>10000)return reply('NOTIFICATION_CONFIGURATION_REQUIRED',503);
  if(request.method!=='POST')return reply('METHOD_NOT_ALLOWED',405);
  if(!timingSafeEqual(digest(request.headers.get('authorization')??''),digest('Bearer '+secret)))return reply('UNAUTHORIZED',401);
  if(new URL(request.url).search||request.headers.has('origin'))return reply('BODY_NOT_ALLOWED',400);
  if(active)return reply('CYCLE_BUSY',409);
  try{await emptyInput(request);}catch(error){return reply(error.message==='BODY_TIMEOUT'?'REQUEST_TIMEOUT':'BODY_NOT_ALLOWED',error.message==='BODY_TIMEOUT'?408:400);}
  if(active)return reply('CYCLE_BUSY',409);
  if(request.signal.aborted)return reply('NOTIFICATION_WORKER_UNAVAILABLE',503);
  active=true;
  const controller=new AbortController(),deadlineAt=Date.now()+timeoutMs;
  const abort=()=>controller.abort();request.signal.addEventListener('abort',abort,{once:true});
  let timer,rejectStopped;
  const stopped=new Promise((_,reject)=>{rejectStopped=()=>reject(Error('CYCLE_STOPPED'));controller.signal.addEventListener('abort',rejectStopped,{once:true});});
  timer=setTimeout(abort,timeoutMs);
  const live=()=>{if(controller.signal.aborted||Date.now()>=deadlineAt)throw Error('CYCLE_STOPPED');};
  const options={deadlineAt,signal:controller.signal};
  const work=(async()=>{
   let state,channels;
   try{
    state=await runtime(options);live();
    if(!state||typeof state.close!=='function')throw Error('RUNTIME_INVALID');
    if(state.idle)return 'IDLE';
    channels=await transports(options);live();
    const database={transaction:(action,callback)=>{live();return state.database.transaction(action,scope=>{live();return callback({...scope,query:(...args)=>{live();return scope.query(...args);}});});}};
    const guarded=Object.fromEntries(Object.entries(channels).map(([name,channel])=>[name,{
     configured:async()=>{live();const configured=await channel.configured();live();return configured;},
     resolveRecipient:async(identity,{signal}={})=>{live();const recipient=await channel.resolveRecipient(identity,{signal:signal?AbortSignal.any([signal,controller.signal]):controller.signal});live();return recipient;},
     send:async input=>{live();return channel.send({...input,signal:input.signal?AbortSignal.any([input.signal,controller.signal]):controller.signal});}
    }]));
    const result=await consumeNotification({repository:createOutboxRepository({database}),transports:guarded,timeoutMs:sendTimeoutMs});
    live();return result===null?'IDLE':'CYCLE_COMPLETED';
   }finally{
    const results=await Promise.allSettled([closeNotificationTransports(channels),Promise.resolve().then(()=>state?.close?.())]);
    if(results.some(result=>result.status==='rejected'))throw Error('CLEANUP_FAILED');
   }
  })().finally(()=>{active=false;clearTimeout(timer);request.signal.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',rejectStopped);});
  // A late factory result is still disposed in work.finally. The local busy lock
  // remains held until disposal; no new transaction/send starts after cancellation.
  try{return reply(await Promise.race([work,stopped]),200);}catch{
   controller.abort();
   // Drain before the HTTP response: hosted runtimes may freeze once it is sent.
   // An unresponsive dependency cannot be certified closed; never report success.
   let drainTimer;
   try{await Promise.race([work.catch(()=>{}),new Promise(resolve=>{drainTimer=setTimeout(resolve,cleanupMs);})]);}
   finally{clearTimeout(drainTimer);}
   return reply('NOTIFICATION_WORKER_UNAVAILABLE',503);
  }
 };
}
