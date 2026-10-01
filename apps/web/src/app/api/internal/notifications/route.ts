import 'server-only';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../../../../lib/imports/server';
import {createRuntime} from '../../../../../../../packages/jobs/durable/runtime.mjs';
import {createTransports} from '../../../../../../../packages/notifications/transports.mjs';
import {createNotificationHostedHandler} from '../../../../../../../packages/notifications/hosted.mjs';
export const runtime='nodejs';
export const maxDuration=60;
export const dynamic='force-dynamic';
export const POST=createNotificationHostedHandler({
 secret:process.env.VEXA_WORKER_TRIGGER_SECRET,
 runtime:({deadlineAt})=>createRuntime(process.env,{createDatabase,pool:serverPool(),deadlineAt,consumer:'notifications'}),
 transports:({deadlineAt})=>createTransports(process.env,{createDatabase,pool:serverPool(),deadlineAt}),
});
