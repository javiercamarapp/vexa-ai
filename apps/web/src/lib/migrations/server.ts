import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {createComparisonRepository,comparisonScope} from '../../../../../packages/connectors/comparability.mjs';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
import {crmFailure} from '../connections/errors';
export async function migrations(request:NextRequest){
 let finish=(r:NextResponse)=>r;
 try{
  const configuration=config();if(!configuration)throw new AccessError(503,'configuration_required');
  if(request.method==='POST')assertOrigin(request.headers.get('origin'),configuration.origin);
  const auth=requestAuth(request);finish=auth.finish;
  const database=createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value});
  const repository=createComparisonRepository({database});
  if(request.method==='POST'){
   let body;try{body=await request.json();}catch{throw new AccessError(400,'comparison_input_invalid');}
   let scope;try{scope=comparisonScope(body);}catch{throw new AccessError(400,'comparison_input_invalid');}
   return finish(NextResponse.json({snapshot:await repository.capture(scope)},{status:201,headers:PRIVATE_HEADERS}));
  }
  if(request.nextUrl.pathname.endsWith('/compare')){
   const beforeId=request.nextUrl.searchParams.get('before')??'',afterId=request.nextUrl.searchParams.get('after')??'';
   const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;if(!uuid.test(beforeId)||!uuid.test(afterId)||beforeId===afterId)throw new AccessError(400,'comparison_input_invalid');
   return finish(NextResponse.json(await repository.compare({beforeId,afterId}),{headers:PRIVATE_HEADERS}));
  }
  return finish(NextResponse.json(await repository.list({cursor:request.nextUrl.searchParams.get('cursor')}),{headers:PRIVATE_HEADERS}));
 }catch(error){return finish(crmFailure(error instanceof AccessError?error.code:'comparison_unavailable',error instanceof AccessError?error.status:error instanceof Error&&error.message==='COMPARISON_CURSOR_INVALID'?400:503));}
}
