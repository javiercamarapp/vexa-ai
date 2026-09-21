import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
import {createHealthRepository} from '../../../../../packages/connectors/health.mjs';
import {crmFailure} from './errors';
export async function connections(request:NextRequest){
 let finish=(r:NextResponse)=>r;
 try{
  if(!config())throw new AccessError(503,'configuration_required');
  const auth=requestAuth(request);finish=auth.finish;
  const database=createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value});
  const rows=await createHealthRepository({database}).list();
  return finish(NextResponse.json({connections:rows},{headers:PRIVATE_HEADERS}));
 }catch(error){
  return finish(crmFailure(error instanceof AccessError?error.code:'connections_unavailable',error instanceof AccessError?error.status:503));
 }
}

export async function recheck(request:NextRequest){
 let finish=(r:NextResponse)=>r;
 try{
  const configuration=config();if(!configuration)throw new AccessError(503,'configuration_required');assertOrigin(request.headers.get('origin'),configuration.origin);
  const auth=requestAuth(request);finish=auth.finish;
  let body;try{body=await request.json();}catch{throw new AccessError(400,'recheck_input_invalid');}
  const connectionId=request.nextUrl.pathname.split('/')[3];const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  if(!body||body.confirmedCredentialRotation!==true||!uuid.test(connectionId)||typeof body.expectedAttemptId!=='string'||!uuid.test(body.expectedAttemptId))throw new AccessError(400,'recheck_input_invalid');
  const database=createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value});
  const data=await createHealthRepository({database}).requestRecheck({connectionId,expectedAttemptId:body.expectedAttemptId,confirmedCredentialRotation:true});
  return finish(NextResponse.json(data,{status:202,headers:PRIVATE_HEADERS}));
 }catch(error){return finish(crmFailure(error instanceof AccessError?error.code:'connections_unavailable',error instanceof AccessError?error.status:503));}
}
