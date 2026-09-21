import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
import {createEvidenceRepository} from '../../../../../packages/intelligence/evidence-repository.mjs';
import {extractionFailure} from '../../../../../packages/intelligence/api.mjs';
export async function evidence(request:NextRequest){
 let finish=(response:NextResponse)=>response;
 try{
  if(!config())throw new AccessError(503,'configuration_required');
  const auth=requestAuth(request);finish=auth.finish;
  const database=createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value});
  const data=await createEvidenceRepository({database}).get(request.nextUrl.pathname.split('/')[3]);
  return finish(NextResponse.json({data},{headers:PRIVATE_HEADERS}));
 }catch(error){const response=extractionFailure(error);return finish(new NextResponse(response.body,{status:response.status,headers:response.headers}));}
}
