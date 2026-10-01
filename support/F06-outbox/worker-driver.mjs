// External test process: product runtime, repository and consumer; only transport is SYN loopback.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.F02_BUILT;
const {createRuntime}=await import(pathToFileURL(path.join(root,'packages/jobs/durable/runtime.mjs')));
const {createOutboxRepository}=await import(pathToFileURL(path.join(root,'packages/notifications/outbox.mjs')));
const {consumeNotification}=await import(pathToFileURL(path.join(root,'packages/notifications/worker.mjs')));
let runtime,repository,holdResolve;
const state={configured:true,hold:false,recipient:null,mutateRecipient:false};
const transport={
 async configured(){return state.configured;},
 async resolveRecipient(identity){state.recipient={...identity,email:'SYN-member@example.test',emailVerified:true};return state.recipient;},
 async send(input){
  const url=new URL(process.env.SYN_OUTBOX_SINK);if(url.hostname!=='127.0.0.1'||url.pathname!=='/SYN-notification')throw Error('SYN_SINK_SCOPE');
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json','idempotency-key':input.idempotencyKey},body:JSON.stringify({recipient:input.recipient,message:input.message}),signal:input.signal,redirect:'error'});
  return response.json();
 }
};
try{
 runtime=await createRuntime(process.env,{consumer:'notifications'});
 if(runtime.idle){process.send?.({ready:true,idle:true});}else{
  const durable=createOutboxRepository({database:runtime.database,leaseMs:Number(process.env.SYN_OUTBOX_LEASE_MS??1000)});
  repository={...durable,async beginSend(...args){
   if(state.mutateRecipient&&state.recipient){state.recipient.email='SYN-substituted@example.test';state.recipient.userId='22222222-2222-4222-8222-222222222222';}
   return durable.beginSend(...args);
  }};
  process.send?.({ready:true});
 }
 process.on('message',async message=>{
  if(message.op==='release'){holdResolve?.();return;}
  const {id,op,args=[]}=message;
  try{
   let result;
   if(op==='settings'){Object.assign(state,args[0]);result=true;}
   else if(op==='consume')result=await consumeNotification({repository,transports:{email:transport,push:transport},timeoutMs:500,afterSend:async value=>{process.send?.({barrier:'afterSend',id,claim:value.claim,outcome:value.outcome});if(state.hold)await new Promise(resolve=>{holdResolve=resolve;});}});
   else if(op==='close'){await runtime.close();process.send?.({id,ok:true,result:true});process.disconnect();return;}
   else result=await repository[op](...args);
   process.send?.({id,ok:true,result});
  }catch(error){process.send?.({id,ok:false,error:{code:error.code??error.message,status:error.status}});}
 });
}catch(error){process.send?.({ready:false,error:error.code??error.message});await runtime?.close();process.exitCode=1;}
