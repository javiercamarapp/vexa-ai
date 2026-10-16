import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {createAssociationRepository} from '../../../../../packages/ingestion/associations/repository.mjs';
import {createAssociationsHandler} from '../../../../../packages/ingestion/associations/api.mjs';
import {boundedRequest} from '../request-body';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';

export async function associations(request:NextRequest){
 let finish=(response:NextResponse)=>response;
 try{
  const settings=config();if(!settings)throw new AccessError(503,'configuration_required');
  if(request.method==='POST')assertOrigin(request.headers.get('origin'),settings.origin);
  const auth=requestAuth(request);finish=auth.finish;
  const database=createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value});
  const handler=createAssociationsHandler(createAssociationRepository({database}),{origin:settings.origin});
  const result=await handler(await boundedRequest(request,16384));
  return finish(new NextResponse(result.body,{status:result.status,headers:{...Object.fromEntries(result.headers),...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){
  const e=error instanceof AccessError?error:new AccessError(503,'associations_unavailable');
  return finish(NextResponse.json({error:{code:e.code}},{status:e.status,headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }
}
