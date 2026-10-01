import { createReceiptRepository, handleEmailWebhook } from '@vexa/notifications/receipts';
import pg from 'pg';
import {databasePoolOptions} from '@vexa/platform/pool-options';
export const runtime = 'nodejs';
let pool: pg.Pool | undefined;
export async function POST(request: Request) {
  const connectionString = process.env.VEXA_EMAIL_DATABASE_URL;
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!connectionString || !webhookSecret) return Response.json({code:'email_webhook_unconfigured'}, {status:503,headers:{'Cache-Control':'no-store'}});
  try {pool ??= new pg.Pool({...databasePoolOptions(connectionString,process.env.VEXA_EMAIL_DATABASE_CA_PEM),max:2,idleTimeoutMillis:1000,allowExitOnIdle:true,statement_timeout:5000,query_timeout:6000});}
  catch {return Response.json({code:'email_webhook_unconfigured'}, {status:503,headers:{'Cache-Control':'no-store'}});}
  return handleEmailWebhook(request,{webhookSecret,repository:createReceiptRepository({pool})});
}
