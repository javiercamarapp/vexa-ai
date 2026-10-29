import 'server-only';
import {failureClass} from '@vexa/platform/db';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../../../../../lib/imports/server';
import {createRuntime} from '../../../../../../../../packages/jobs/durable/runtime.mjs';
import {createCRMWebhookBindings,createCRMWebhookHandler,crmWebhookReadiness} from '../../../../../../../../packages/connectors/webhooks.mjs';
import {createCRMWebhookRepository} from '../../../../../../../../packages/connectors/webhook-repository.mjs';
export const runtime='nodejs';
export const maxDuration=60;
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try{
  const readiness=crmWebhookReadiness(process.env);
  if(!readiness.ready){
   // Sin esto el 503 era mudo en los logs: queda dicha la causa (código fijo, sin valores de entorno).
   console.warn('crm-webhook-not-ready',readiness.code);
   return Response.json({code:readiness.code},{status:503,headers:{'Cache-Control':'private, no-store','Retry-After':'3600'}});
  }
  const bindings=createCRMWebhookBindings(process.env.VEXA_CRM_WEBHOOK_BINDINGS_JSON??'[]',process.env.NEXT_PUBLIC_SITE_URL??'');
  return await createCRMWebhookHandler({bindings,record:async({binding,digest})=>{
   // Tenant comes exclusively from authenticated, server-configured binding.
   const worker=await createRuntime({...process.env,VEXA_WORKER_DISPATCHER:'disabled',VEXA_WORKER_TENANT:binding.tenantId},{createDatabase,pool:serverPool(),deadlineAt:Date.now()+10000,consumer:'crm'});
   try{return await createCRMWebhookRepository({database:worker.database}).record({binding,digest});}finally{await worker.close();}
  }})(request);
 }catch(error){console.error('crm-webhook-failed',typeof (error as {code?:unknown})?.code==='string'&&/^[A-Z_0-9]{3,64}$/.test((error as {code:string}).code)?(error as {code:string}).code:failureClass(error)/* B-06: nunca el mensaje (puede traer host, usuario o consulta) */);return Response.json({code:'CRM_WEBHOOK_CONFIGURATION_REQUIRED'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
