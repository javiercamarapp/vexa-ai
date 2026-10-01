import {Resend} from 'resend';
import net from 'node:net';
import nodemailer from 'nodemailer';
import pg from 'pg';
import {databasePoolOptions} from '../jobs/durable/pg-options.mjs';
import {createReceiptRepository} from './receipts.mjs';
import {renderEmail as renderTemplate} from './email-template.mjs';
export {renderEmail} from './email-template.mjs';
const mailbox=v=>typeof v==='string'&&v.length<=254&&/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(v);
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(v);
export function createEmailTransport({mode,apiKey,from,replyTo,appOrigin,repository,resend,smtp}={}){
 let template;try{template=renderTemplate({type:'digest.available',appOrigin,ctaUrl:new URL('/notifications',appOrigin).href});}catch{/* Invalid deployment config blocks the channel. */}
 const configured=()=>!!(template&&mailbox(from)&&(replyTo===undefined||mailbox(replyTo))&&repository&&((mode==='resend'&&typeof apiKey==='string'&&/^re_[A-Za-z0-9_-]+$/.test(apiKey))||(mode==='mailpit'&&smtp)));
 const sdk=mode==='resend'&&configured()?(resend??new Resend(apiKey,{baseUrl:'https://api.resend.com'})):null;
 if(sdk&&!resend)sdk.logError=()=>{}; // Provider messages may contain PII; never log SDK response bodies.
 return Object.freeze({configured,resolveRecipient:identity=>repository.resolveRecipient(structuredClone(identity)),async send(input){
  let owned;try{owned=structuredClone({recipient:input.recipient,idempotencyKey:input.idempotencyKey});}catch{return{kind:'blocked'};}
  if(!configured()||input.signal?.aborted)return{kind:'blocked'};
  const {recipient:r,idempotencyKey:key}=owned;
  if(!mailbox(r?.email)||r.emailVerified!==true||r.channel!=='email'||!/^[0-9a-f]{64}$/.test(key??''))return{kind:'blocked'};
  try{
   const current=await repository.prepare({idempotencyKey:key,tenantId:r.tenantId,userId:r.userId,provider:mode});
   if(!current||current.email!==r.email||current.emailVerified!==true)return{kind:'blocked'};
   if(current.providerId)return{kind:'accepted',providerId:current.providerId};
   if(input.signal?.aborted)return{kind:'blocked'};
   let providerId;
   if(mode==='resend'){
    const result=await sdk.emails.send({from,...(replyTo?{replyTo}:{}),to:[current.email],subject:template.subject,html:template.html,text:template.text},{idempotencyKey:key,signal:input.signal,redirect:'error'});
    if(result.error){if(result.error.statusCode===429)return{kind:'retry',retryAfterMs:60000};if([401,403].includes(result.error.statusCode))return{kind:'blocked'};return{kind:'uncertain'};}
    providerId=result.data?.id;if(!id(providerId))return{kind:'uncertain'};
   }else{
    const result=await smtp.sendMail({from,...(replyTo?{replyTo}:{}),to:current.email,subject:template.subject,html:template.html,text:template.text,messageId:`<${key}@mailpit.vexa.test>`,disableFileAccess:true,disableUrlAccess:true},{signal:input.signal});
    if(!result.accepted?.includes(current.email))return{kind:'uncertain'};
    providerId='mailpit_'+key;
   }
   await repository.accepted({idempotencyKey:key,provider:mode,providerId});
   return{kind:'accepted',providerId};
  }catch{return{kind:'uncertain'};}
 }});
}
/** Each attempt owns its socket. Abort destroys only that socket, including during connect. */
export function createMailpitSender({port}){
 if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('EMAIL_MAILPIT_CONFIGURATION_REQUIRED');
 return Object.freeze({async sendMail(message,{signal}={}){
  let socket;
  const sender=nodemailer.createTransport({host:'127.0.0.1',port,secure:false,ignoreTLS:true,connectionTimeout:5000,greetingTimeout:5000,socketTimeout:8000,disableFileAccess:true,disableUrlAccess:true,
   getSocket(_options,callback){
    if(signal?.aborted){callback(Error('EMAIL_ATTEMPT_ABORTED'));return;}
    socket=net.createConnection({host:'127.0.0.1',port,signal});
    const failed=()=>{socket.removeListener('connect',connected);callback(Error('EMAIL_SOCKET_UNAVAILABLE'));};
    const connected=()=>{socket.removeListener('error',failed);callback(null,{connection:socket});};
    socket.once('error',failed);socket.once('connect',connected);
   }
  });
  try{return await sender.sendMail(message);}finally{socket?.destroy();sender.close();}
 }});
}
/** Deployment-only module consumed by the existing F06-09 daemon loader. */
export async function createTransports(env=process.env){
 if(!env.VEXA_EMAIL_DATABASE_URL||!['resend','mailpit'].includes(env.VEXA_EMAIL_MODE)||!mailbox(env.VEXA_EMAIL_FROM)||!env.VEXA_APP_ORIGIN)return{};
 if(env.VEXA_EMAIL_MODE==='resend'&&!/^re_[A-Za-z0-9_-]+$/.test(env.RESEND_API_KEY??''))return{};
 try{renderTemplate({type:'digest.available',appOrigin:env.VEXA_APP_ORIGIN,ctaUrl:new URL('/notifications',env.VEXA_APP_ORIGIN).href});}catch{return{};}
 let smtp;
 if(env.VEXA_EMAIL_MODE==='mailpit')smtp=createMailpitSender({port:Number(env.VEXA_MAILPIT_SMTP_PORT)});
 const pool=new pg.Pool({...databasePoolOptions(env.VEXA_EMAIL_DATABASE_URL,env.VEXA_EMAIL_DATABASE_CA_PEM),max:2,idleTimeoutMillis:1000,allowExitOnIdle:true,statement_timeout:5000,query_timeout:6000});
 const email=createEmailTransport({mode:env.VEXA_EMAIL_MODE,apiKey:env.RESEND_API_KEY,from:env.VEXA_EMAIL_FROM,replyTo:env.VEXA_EMAIL_REPLY_TO,appOrigin:env.VEXA_APP_ORIGIN,repository:createReceiptRepository({pool}),smtp});
 return{email:Object.freeze({...email,close:async()=>{await pool.end();}})};
}
