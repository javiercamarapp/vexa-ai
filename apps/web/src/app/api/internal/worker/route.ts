import 'server-only';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../../../../lib/imports/server';
import {createHostedHandler} from '../../../../../../../packages/jobs/durable/hosted.mjs';
import {createRuntime} from '../../../../../../../packages/jobs/durable/runtime.mjs';
export const runtime='nodejs';
export const maxDuration=60;
export const dynamic='force-dynamic';
export const POST=createHostedHandler({runtime:()=>createRuntime(process.env,{createDatabase,pool:serverPool(),deadlineAt:Date.now()+40000,consumer:'imports'}),secret:process.env.VEXA_WORKER_TRIGGER_SECRET,timeoutMs:Number(process.env.VEXA_WORKER_SOURCE_TIMEOUT_MS??20000),platformTimeoutMs:Number(process.env.VEXA_WORKER_PLATFORM_TIMEOUT_MS??0),intervalMs:Number(process.env.VEXA_WORKER_INTERVAL_MS??30000)});
