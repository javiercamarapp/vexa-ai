import 'server-only';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../../../../lib/imports/server';
import {createRuntime} from '../../../../../../../packages/jobs/durable/runtime.mjs';
import {createCRMRuntime} from '../../../../../../../packages/connectors/runtime.mjs';
import {createCRMCredentialResolver} from '../../../../../../../packages/connectors/credentials.mjs';
import {createCRMHostedHandler} from '../../../../../../../packages/connectors/hosted.mjs';
export const runtime='nodejs';
export const maxDuration=60;
export const dynamic='force-dynamic';
const handler=createCRMHostedHandler({secret:process.env.VEXA_WORKER_TRIGGER_SECRET,runtime:async()=>{
 const worker=await createRuntime(process.env,{createDatabase,pool:serverPool(),deadlineAt:Date.now()+40000,consumer:'crm'});
 if(worker.idle)return worker;
 try{return {...worker,crm:createCRMRuntime({database:worker.database,webhookSignals:process.env.VEXA_CRM_WEBHOOKS_ENABLED==='true',resolveCredentials:createCRMCredentialResolver(process.env.VEXA_CRM_CREDENTIALS_JSON??'[]')})};}
 catch(error){await worker.close();throw error;}
}});

// One instance keeps GET/POST concurrency shared; CRON_SECRET is configured to match the trigger secret.
export const GET=handler;
export const POST=handler;
