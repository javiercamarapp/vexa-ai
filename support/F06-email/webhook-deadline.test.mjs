import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';import path from 'node:path';const {handleEmailWebhook}=await import(pathToFileURL(path.join(process.env.VEXA_CANDIDATE,'packages/notifications/receipts.mjs')));
test('stalled webhook body ends before deadline without receipt effects',async()=>{
 let cancelled=false,controller,calls=0;
 const body=new ReadableStream({start(c){controller=c;c.enqueue(new TextEncoder().encode('{'));},cancel(){cancelled=true;}});
 const request=new Request('https://vexa.test/api/webhooks/email',{method:'POST',headers:{'content-type':'application/json'},body,duplex:'half'});
 const pending=handleEmailWebhook(request,{webhookSecret:'SYN_ONLY',repository:{record:async()=>{calls++;}},readTimeoutMs:30});
 let timer;const response=await Promise.race([pending,new Promise(resolve=>{timer=setTimeout(()=>resolve(null),500);})]);clearTimeout(timer);
 if(!response){controller.close();await pending;}
 assert.ok(response,'WEBHOOK_READ_DEADLINE_MISSING');assert.equal(response.status,408);assert.equal(calls,0);assert.equal(cancelled,true);
});
