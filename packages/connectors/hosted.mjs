import {readTriggerInput} from '../jobs/durable/trigger-input.mjs';
import {createHash,timingSafeEqual} from 'node:crypto';
const digest=x=>createHash('sha256').update(x).digest();
/** Authenticated, tenant-free POST scheduler and GET cron share one execution guard. */
export function createCRMHostedHandler({runtime,secret,timeoutMs=15000}={}){
 let active=false;
 return async request=>{
  const reply=(code,status)=>Response.json({code},{status,headers:{'Cache-Control':'private, no-store'}});
  if(typeof secret!=='string'||secret.length<32||typeof runtime!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>20000)return reply('CRM_CONFIGURATION_REQUIRED',503);
  if(!['GET','POST'].includes(request.method))return reply('METHOD_NOT_ALLOWED',405);
  if(!timingSafeEqual(digest(request.headers.get('authorization')??''),digest('Bearer '+secret)))return reply('UNAUTHORIZED',401);
  if(new URL(request.url).search)return reply('BODY_NOT_ALLOWED',400);
  try{await readTriggerInput(request);}catch(error){return reply(error.message==='BODY_TIMEOUT'?'REQUEST_TIMEOUT':'BODY_NOT_ALLOWED',error.message==='BODY_TIMEOUT'?408:400);}
  if(active)return reply('CHUNK_BUSY',409);active=true;let state;
  try{state=await runtime();if(state.idle)return reply('IDLE',200);const result=await state.crm.tick({deadlineMs:timeoutMs,maxPages:100});return Response.json({data:result},{headers:{'Cache-Control':'private, no-store'}});}
  catch{return reply('CRM_WORKER_UNAVAILABLE',503);}
  finally{try{await state?.close();}finally{active=false;}}
 };
}
