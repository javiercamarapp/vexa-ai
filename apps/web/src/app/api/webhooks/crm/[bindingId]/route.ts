import 'server-only';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../../../../../lib/imports/server';
import {createRuntime} from '../../../../../../../../packages/jobs/durable/runtime.mjs';
import {createCRMWebhookBindings,createCRMWebhookHandler} from '../../../../../../../../packages/connectors/webhooks.mjs';
import {createCRMWebhookRepository} from '../../../../../../../../packages/connectors/webhook-repository.mjs';
export const runtime='nodejs';
export const maxDuration=60;
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try{
  if(process.env.VEXA_CRM_WEBHOOKS_ENABLED!=='true')throw Error('UNCONFIGURED');
  const bindings=createCRMWebhookBindings(process.env.VEXA_CRM_WEBHOOK_BINDINGS_JSON??'[]',process.env.NEXT_PUBLIC_SITE_URL??'');
  return await createCRMWebhookHandler({bindings,record:async({binding,digest})=>{
   // Tenant comes exclusively from authenticated, server-configured binding.
   const worker=await createRuntime({...process.env,VEXA_WORKER_DISPATCHER:'disabled',VEXA_WORKER_TENANT:binding.tenantId},{createDatabase,pool:serverPool(),deadlineAt:Date.now()+10000,consumer:'crm'});
   try{return await createCRMWebhookRepository({database:worker.database}).record({binding,digest});}finally{await worker.close();}
  }})(request);
 }catch{return Response.json({code:'CRM_WEBHOOK_CONFIGURATION_REQUIRED'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
