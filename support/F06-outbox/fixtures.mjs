// SYN298: the HTTP receiver is an isolated test transport, never a delivery provider.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
export {seedNotificationResource} from '../F06-notifications/fixtures.mjs';
export {createReader} from '../F06-recommendations/fixtures.mjs';
export async function sink(){
 const requests=[],responses=[],violations=[],receipts=new Map();
 const server=createServer(async(req,res)=>{res.on('error',error=>violations.push('SYN_RESPONSE_ERROR:'+error.code));try{
  if(req.method!=='POST'||req.url!=='/SYN-notification'){res.writeHead(404).end();return;}
  const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;assert.ok(length<=65536,'SYN_SINK_BODY_LIMIT');chunks.push(chunk);}
  const body=JSON.parse(Buffer.concat(chunks).toString());
  assert.ok(!req.headers.authorization,'SYN_SINK_NO_PROVIDER_SECRET');
  requests.push({body,idempotencyKey:req.headers['idempotency-key']});
  const next=responses.shift()??{status:202,body:{kind:'accepted',providerId:'SYN-local-acceptance-'+requests.length}};
  if(next.body.kind==='accepted'||next.evidenceDecision==='not_sent'){const evidenceId=randomUUID();receipts.set(evidenceId,Object.freeze({evidenceId,idempotencyKey:req.headers['idempotency-key'],providerId:next.body.kind==='accepted'?next.body.providerId:null,tenantId:body.recipient.tenantId,userId:body.recipient.userId,decision:next.body.kind==='accepted'?'accepted':'not_sent'}));}
  res.writeHead(next.status,{'content-type':'application/json','cache-control':'no-store',...next.headers});res.end(JSON.stringify(next.body));
 }catch(error){violations.push(error.message);if(!res.headersSent)res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({kind:'uncertain',code:'SYN_RECEIVER_INVALID_REQUEST'}));}});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 return {url:'http://127.0.0.1:'+server.address().port+'/SYN-notification',requests,responses,violations,receipts,async close(){server.closeAllConnections();await new Promise(r=>server.close(r));}};
}
export function policy(channel,expectedVersion=0,extra={}){return {channel,enabled:true,expectedVersion,intervalMs:1000,digestWindowMs:0,maxAttempts:2,lifetimeMs:60000,...extra};}
export function event(h,f,extra={}){return {eventId:randomUUID(),type:'brief.available',resourceId:f.brief.id,userId:h.A.id,channel:'email',...extra};}
export async function preferences(h,actor,channel,enabled=true,type='brief.available'){
 for(const eventType of ['*',type]){
  const listed=await h.request(actor,'/api/notifications/preferences');assert.equal(listed.status,200);
  const old=listed.data.data.preferences.find(x=>x.channel===channel&&x.eventType===eventType);
  const saved=await h.request(actor,'/api/notifications/preferences',{channel,eventType,enabled,expectedVersion:old.version});assert.equal(saved.status,200,JSON.stringify(saved.data));
 }
}
