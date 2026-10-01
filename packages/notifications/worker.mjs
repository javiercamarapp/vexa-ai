import {consumeOne} from '../jobs/durable/consumer.mjs';
import {check} from './contracts.mjs';
import {boundedSend,normalizeOutcome,recipientSnapshot} from './delivery.mjs';
/** Trusted callbacks only. Every network effect follows persisted sending and a live canonical fence. */
export async function consumeNotification({repository,transports={},timeoutMs=10000,afterSend=async()=>{}}){
 check(repository&&typeof repository.claim==='function'&&Number.isSafeInteger(timeoutMs)&&timeoutMs>=1&&timeoutMs<=10000&&timeoutMs*2<=repository.leaseMs,'notification_worker_invalid');
 const transportMap={...transports};
 return consumeOne({repository,leaseMs:repository.leaseMs,maxSourceWaitMs:Math.min(300000,Math.max(1000,timeoutMs*4)),
 pages:async claim=>({async *[Symbol.asyncIterator](){
  const owned=structuredClone(claim),identity={tenantId:owned.tenantId,userId:owned.userId,channel:owned.channel};let result;
  if(owned.channel==='inapp'){
   const ready=await repository.beginSend(owned,true);result=ready.kind==='ready'?{kind:'accepted',providerId:'inapp_'+owned.id}:ready;
  }else{
   const transport=transportMap[owned.channel];let recipient=null,configured=false;
   if(typeof transport?.configured==='function'&&typeof transport?.resolveRecipient==='function'&&typeof transport?.send==='function'){
    const authorization=await boundedSend(async signal=>({value:structuredClone(await transport.resolveRecipient(structuredClone(identity),{signal}))}),timeoutMs);
    recipient=recipientSnapshot(authorization?.value,identity);
    const configuration=await boundedSend(async()=>({value:await transport.configured()}),timeoutMs);configured=!!recipient&&configuration?.value===true;
   }
   const ready=await repository.beginSend(owned,configured);
   if(ready.kind!=='ready')result=ready;
   else{
    // Separate copies prevent retained mutable resolver/config objects from redirecting an effect.
    const input={recipient:structuredClone(recipient),message:{title:'VEXA',body:'Tienes avisos disponibles en VEXA.',href:'/notifications',count:ready.count},idempotencyKey:ready.idempotencyKey};
    const liveConfig=await boundedSend(async()=>({value:await transport.configured()}),timeoutMs);
    if(liveConfig?.value!==true)result={kind:'blocked',code:'transport_unconfigured'};
    else{result=normalizeOutcome(await boundedSend(signal=>transport.send({...structuredClone(input),signal}),timeoutMs));
     await afterSend({claim:structuredClone(owned),outcome:structuredClone(result)});}
   }
  }
  yield {records:[result],checkpoint:{done:true},done:true};
 }})
 });
}
