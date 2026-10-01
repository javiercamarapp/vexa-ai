import {createHash} from 'node:crypto';
import {Resend} from 'resend';
const validId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(v);
const events=new Set(['email.sent','email.delivered','email.delivery_delayed','email.bounced','email.complained','email.failed','email.suppressed']);
export function createReceiptRepository({pool}){
 // Even injected pools must support pg query timeouts and release(destroy). Late acquisition is released.
 async function acquire(){let expired=false,timer;const pending=pool.connect().then(client=>{if(expired){client.release(true);throw Error('EMAIL_STORAGE_UNAVAILABLE');}return client;});try{return await Promise.race([pending,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Error('EMAIL_STORAGE_UNAVAILABLE'));},5000);})]);}finally{clearTimeout(timer);}}
 async function call(name,args){let client,destroy=false;try{
  client=await acquire();
  const query=(text,values)=>client.query({text,values,query_timeout:6000});
  await query('BEGIN');await query("SET LOCAL statement_timeout = '5s'");await query('SET LOCAL ROLE vexa_email_service');
  const result=await query(`SELECT public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) AS result`,args);
  await query('COMMIT');return result.rows[0]?.result;
 }catch{if(client){try{await client.query({text:'ROLLBACK',query_timeout:6000});}catch{destroy=true;}}throw Error('EMAIL_STORAGE_UNAVAILABLE');}finally{client?.release(destroy);}}

 return Object.freeze({
 resolveRecipient:({tenantId,userId})=>call('notification_email_recipient',[tenantId,userId]),
 prepare:({idempotencyKey,tenantId,userId,provider})=>call('notification_email_prepare',[idempotencyKey,tenantId,userId,provider]),
 accepted:({idempotencyKey,provider,providerId})=>call('notification_email_accepted',[idempotencyKey,provider,providerId]),
 record:({eventId,providerId,type,occurredAt,payloadHash,bounceKind=null})=>call('notification_email_receipt',[eventId,providerId,type,occurredAt,payloadHash,bounceKind]),
 });
}
const response=(status,code)=>Response.json({code},{status,headers:{'Cache-Control':'no-store'}});
/** No JSON parsing before the SDK authenticates the exact original body. No payload tenant is used. */
export async function handleEmailWebhook(request,{webhookSecret,repository,readTimeoutMs=5000}={}){
 if(!webhookSecret||!repository)return response(503,'email_webhook_unconfigured');
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return response(415,'email_webhook_invalid');
 if(!Number.isSafeInteger(readTimeoutMs)||readTimeoutMs<1||readTimeoutMs>5000)return response(503,'email_webhook_unconfigured');
 let raw='',reader,timer;const timedOut=Symbol('read_timeout');
 try{
  reader=request.body?.getReader();if(!reader)return response(400,'email_webhook_invalid');
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(timedOut),readTimeoutMs);});
  const chunks=[];let size=0;
  for(;;){const {value,done}=await Promise.race([reader.read(),timeout]);if(done)break;size+=value.length;if(size>65536){void reader.cancel().catch(()=>{});return response(413,'email_webhook_invalid');}chunks.push(value);}
  raw=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));
 }catch(error){if(reader)void reader.cancel().catch(()=>{});return response(error===timedOut?408:400,error===timedOut?'email_webhook_timeout':'email_webhook_invalid');}
 finally{clearTimeout(timer);reader?.releaseLock();}
 const headers={id:request.headers.get('svix-id'),timestamp:request.headers.get('svix-timestamp'),signature:request.headers.get('svix-signature')};
 let event;try{
  if(!validId(headers.id)||!/^\d{1,12}$/.test(headers.timestamp??'')||Math.abs(Date.now()/1000-Number(headers.timestamp))>300)throw Error();
  event=new Resend('webhook_verification_only').webhooks.verify({payload:raw,headers,webhookSecret});
  if(event?.type==='email.bounced'&&event.data?.bounce?.type!==undefined&&!['Permanent','Transient','Undetermined'].includes(event.data.bounce.type))throw Error();
  if(!events.has(event?.type)||!validId(event?.data?.email_id)||typeof event.created_at!=='string'||!Number.isFinite(Date.parse(event.created_at))||Date.parse(event.created_at)>Date.now()+300000)throw Error();
 }catch{return response(400,'email_webhook_invalid');}
 try{const result=await repository.record({eventId:headers.id,providerId:event.data.email_id,type:event.type,occurredAt:event.created_at,payloadHash:createHash('sha256').update(raw).digest('hex'),bounceKind:event.type==='email.bounced'?(event.data?.bounce?.type??null):null});return response(200,result?.replay?'email_webhook_replay':'email_webhook_recorded');}catch{return response(503,'email_webhook_unavailable');}
}
