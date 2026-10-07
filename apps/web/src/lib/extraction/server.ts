import 'server-only';
import {boundedRequest} from '../request-body';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity} from '../auth';
import {requestAuth} from '../auth-http';
import {createExtractionHandler,extractionFailure} from '../../../../../packages/intelligence/api.mjs';
import {createExtractionConfigResolver} from '../../../../../packages/intelligence/runtime.mjs';
export async function extraction(request:NextRequest){
 let finish=(response:NextResponse)=>response;
 const convert=(response:Response)=>finish(new NextResponse(response.body,{status:response.status,headers:response.headers}));
 try{
  const configuration=config();if(!configuration)throw new AccessError(503,'configuration_required');
  if(request.method==='POST')assertOrigin(request.headers.get('origin'),configuration.origin);
  const auth=requestAuth(request);finish=auth.finish;
  const database=createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value});
  return convert(await createExtractionHandler({database,resolveConfig:createExtractionConfigResolver(process.env.VEXA_EXTRACTION_CONFIG_JSON??'[]'),env:process.env,runtime:process.env.VEXA_AI_RUNTIME})(await boundedRequest(request, 8192)));
 }catch(error){return convert(extractionFailure(error));}
}
