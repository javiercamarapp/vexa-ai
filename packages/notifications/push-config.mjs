import {pushConfiguration,createPushTransport} from './push.mjs';
/** Configuration contains server credentials only; factory itself never signs in or sends. */
export async function createTransports(env=process.env){
 const vapid=pushConfiguration(env);if(!vapid)return {};
 let sdk;try{const module=await import('web-push');sdk=module.default??module;}catch{return {};}
 if(typeof sdk.generateRequestDetails!=='function')return {};
 if(['VEXA_DATABASE_URL','VEXA_SUPABASE_URL','VEXA_SUPABASE_ANON_KEY','VEXA_WORKER_EMAIL','VEXA_WORKER_PASSWORD','VEXA_WORKER_USER_ID'].some(k=>!env[k]))return {};
 const saved={...env};
 async function scoped(tenantId,work){
  const {createRuntime}=await import('../jobs/durable/runtime.mjs');
  // A claimed tenant is reauthorized by canonical identity/delegation; do not reserve another scope.
  const runtime=await createRuntime({...saved,VEXA_WORKER_DISPATCHER:'disabled',VEXA_WORKER_TENANT:tenantId},{consumer:'notifications'});
  try{return await work(createPushTransport({database:runtime.database,sdk,vapid}));}finally{await runtime.close();}
 }
 return {push:{configured:()=>true,resolveRecipient:identity=>scoped(identity.tenantId,t=>t.resolveRecipient(identity)),send:input=>scoped(input.recipient?.tenantId,t=>t.send(input)),close:async()=>{}}};
}
