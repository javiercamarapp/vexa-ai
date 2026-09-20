import {timingSafeEqual,createHash} from 'node:crypto';
import {consumeOne} from './consumer.mjs';
import {pagesFromStorage} from './records.mjs';
const digest=s=>createHash('sha256').update(s).digest();
let active=false;
export function createHostedHandler({runtime,secret,timeoutMs=20000,platformTimeoutMs=60000,intervalMs=30000}){
 return async request=>{
  const reply=(code,status)=>Response.json({code},{status,headers:{'Cache-Control':'no-store'}});
  if(!secret||secret.length<32||!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>20000||platformTimeoutMs<timeoutMs+15000||intervalMs<10000||intervalMs>60000)return reply('WORKER_CONFIGURATION_REQUIRED',503);
  if(request.method!=='POST')return reply('METHOD_NOT_ALLOWED',405);
  if(!timingSafeEqual(digest(request.headers.get('authorization')??''),digest('Bearer '+secret)))return reply('UNAUTHORIZED',401);
  const body=await request.text();
  if(new URL(request.url).search||(body!==''&&body!=='{}'))return reply('BODY_NOT_ALLOWED',400);
  if(active)return reply('CHUNK_BUSY',409);
  active=true;let r;
  try{r=await runtime();if(r.idle)return reply('IDLE',200);await r.repository.heartbeat();const result=await consumeOne({repository:r.repository,pages:async(j,cp,options)=>pagesFromStorage(r.storage,await r.repository.source(j),cp,{...options,chunkSize:r.chunkSize??500}),maxChunks:1,maxSourceWaitMs:timeoutMs});return Response.json({data:result??{state:'idle'}},{headers:{'Cache-Control':'no-store'}});}
  catch{return reply('WORKER_UNAVAILABLE',503);}
  finally{await r?.close();active=false;}
 };
}
