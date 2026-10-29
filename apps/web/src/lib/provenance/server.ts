import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
import {idiomaDePeticion} from '../i18n/errores-api';
import {createProvenanceRepository} from '../../../../../packages/workspace-service/provenance.mjs';
import {createTrendsRepository} from '../../../../../packages/workspace-service/trends.mjs';
/** Read-only endpoints for the coverage band and the citation -> origin chain. Same session/RLS boundary as every other view. */
export async function provenance(request:NextRequest,kind:'coverage'|'origin'|'trends',revisionId?:string){
 let finish=(r:NextResponse)=>r;
 try{
  if(!config())throw new AccessError(503,'configuration_required');
  if(request.nextUrl.search)throw new AccessError(400,'unsupported_filter');
  const auth=requestAuth(request);finish=auth.finish;
  const database=createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value});
  const data=kind==='trends'?await createTrendsRepository({database}).monthly():kind==='coverage'?await createProvenanceRepository({database}).coverage({idioma:idiomaDePeticion(request)}):await createProvenanceRepository({database}).origin({messageRevisionId:revisionId??''});
  return finish(NextResponse.json({data},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){
  const e=error as {status?:number;code?:string};const status=[400,401,403,404,503].includes(e.status??0)?e.status!:503;
  const code=status===503?'provenance_unavailable':e.code==='origin_not_found'||e.code==='origin_input_invalid'?e.code:status===404?'resource_not_found':'request_rejected';
  return finish(NextResponse.json({error:{code}},{status,headers:PRIVATE_HEADERS}));
 }
}
