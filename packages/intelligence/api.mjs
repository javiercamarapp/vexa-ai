import {createManagedExtractionResolver} from './candidates/resolve.mjs';
import {randomUUID} from 'node:crypto';
import {createExtractionQueue} from './queue.mjs';
import {createDurableBudgetRepository} from '../gateway/durable-budget.mjs';
const invalid=()=>{throw Object.assign(Error('extraction_input_invalid'),{status:400,code:'extraction_input_invalid'});};
const fields=(body,allowed)=>{if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).some(k=>!allowed.includes(k)))invalid();};
const dollars=value=>{if(typeof value!=='string'||! /^\d{1,12}(?:\.\d{1,6})?$/.test(value))invalid();const [whole,fraction='']=value.split('.');return String(BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,'0')));};
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
export function extractionFailure(error){
 const status=[400,401,403,404,409,503].includes(error?.status)?error.status:503;
 const codes=new Set(['configuration_required','extraction_input_invalid','database_conflict','database_permission_denied','role_insufficient','organization_not_authorized','authentication_required','database_input_invalid']);
 return Response.json({contract_version:'f04-extraction-v1',error:{code:codes.has(error?.code)?error.code:'extraction_unavailable',message:'No se pudo completar la solicitud de análisis.',retryable:status===503},meta:{trace_id:randomUUID()}},{status,headers});
}
/** Auth, session cookies and CSRF are supplied by the Next server boundary. */
export function createExtractionHandler({database,resolveConfig,runtime='stub',env=process.env,runtimeCode}){
 const queue=createExtractionQueue({database});
 const effective=createManagedExtractionResolver({database,baseResolver:resolveConfig,env,runtimeCode});
 const budget=(jobId=randomUUID())=>createDurableBudgetRepository({database,purpose:'extraction',jobId}); // configure/list/reconcile do not create a job or reserve spend.
 return async request=>{
  try{
   const context=await database.transaction('read',async s=>({tenantId:s.tenantId,role:s.role}));
   let config;try{config=await effective(context.tenantId);}catch{config=null;}
   if(request.method==='GET'){
    const query=new URL(request.url).searchParams;for(const key of query.keys())if(!['conversation_cursor','job_cursor','limit'].includes(key)||query.getAll(key).length!==1)invalid();
    const rawLimit=query.get('limit');if(rawLimit!==null&&!/^(?:[1-9]|[1-9][0-9]|100)$/.test(rawLimit))invalid();const limit=rawLimit===null?100:Number(rawLimit);
    const jobs=await queue.listPage({cursor:query.get('job_cursor'),limit}),conversations=['owner','analyst'].includes(context.role)?await queue.conversationsPage({cursor:query.get('conversation_cursor'),limit}):{items:[],next_cursor:null,hasMore:false};
    if(!['owner','analyst'].includes(context.role)&&query.has('conversation_cursor'))invalid();
    const limits=config&&context.role==='owner'?await database.transaction('read',async s=>(await s.query('SELECT purpose,limit_minor::text AS limit_minor,version FROM public.ai_budget_limits WHERE tenant_id=$1 AND window_key=$2 AND purpose IN (\'all\',\'extraction\') ORDER BY purpose',[s.tenantId,config.gateway.policy.window])).rows):[];
    const reservations=config&&context.role==='owner'?await budget().list({window:config.gateway.policy.window}):[];
    return Response.json({jobs:jobs.items,conversations:conversations.items,pagination:{jobs:{next_cursor:jobs.next_cursor,hasMore:jobs.hasMore},conversations:{next_cursor:conversations.next_cursor,hasMore:conversations.hasMore}},canSubmit:['owner','analyst'].includes(context.role),canConfigure:context.role==='owner',configuration:{ready:!!config,enabled:runtime==='enabled',window:config?.gateway.policy.window??null},limits,reservations},{headers});
   }
   if(request.method!=='POST')return new Response(null,{status:405,headers});
   const raw=await request.text();if(Buffer.byteLength(raw)>8192)invalid();let body;try{body=JSON.parse(raw);}catch{invalid();}
   if(!body||typeof body!=='object')invalid();let data;
   if(body.action==='cancel'){fields(body,['action','jobId']);data=await queue.cancel(body.jobId);}
   else{
    if(!config)throw Object.assign(Error('configuration_required'),{code:'configuration_required',status:503});
    if(body.action==='submit'){fields(body,['action','conversationId','requestKey']);data=await queue.submit({conversationId:body.conversationId,requestKey:body.requestKey,configHash:config.hash});}
    else if(body.action==='budget'){
     fields(body,['action','purpose','limitUsd','expectedVersion']);if(!['all','extraction'].includes(body.purpose))invalid();
     data=await budget().configure({window:config.gateway.policy.window,purpose:body.purpose,limitMinor:dollars(body.limitUsd),expectedVersion:body.expectedVersion});
    }else if(body.action==='reconcile'){
     fields(body,['action','reservationId','expectedVersion','actualUsd','evidenceHash','confirmedProviderEvidence']);
     const linked=await database.transaction('configure',async s=>(await s.query("SELECT job_id FROM public.ai_budget_reservations WHERE tenant_id=$1 AND id=$2 AND purpose='extraction'",[s.tenantId,body.reservationId])).rows[0]);if(!linked)throw Object.assign(Error('extraction_unavailable'),{status:404});
     data=await budget(linked.job_id).reconcile({reservationId:body.reservationId,expectedVersion:body.expectedVersion,actualMinor:dollars(body.actualUsd),evidenceHash:body.evidenceHash,confirmedProviderEvidence:body.confirmedProviderEvidence});
    }else invalid();
   }
   return Response.json({data},{status:body.action==='submit'?202:200,headers});
  }catch(error){return extractionFailure(error);}
 };
}
