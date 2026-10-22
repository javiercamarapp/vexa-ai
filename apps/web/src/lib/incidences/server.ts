import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
import {createIncidencesRepository} from '../../../../../packages/workspace-service/incidences.mjs';
/** Lectura de incidencias (por categoría o por mes). Misma frontera de sesión/RLS que las demás vistas; solo GET, sin escrituras. */
export async function incidences(request:NextRequest,kind:'categories'|'monthly'){
 let finish=(r:NextResponse)=>r;
 try{
  if(!config())throw new AccessError(503,'configuration_required');
  const keys=[...request.nextUrl.searchParams.keys()];
  if(keys.some(k=>k!=='problem'||kind!=='monthly')||request.nextUrl.searchParams.getAll('problem').length>1)throw new AccessError(400,'unsupported_filter');
  const auth=requestAuth(request);finish=auth.finish;
  const database=createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value});
  const repo=createIncidencesRepository({database});
  const data=kind==='categories'?await repo.categories():await repo.monthly({problemId:request.nextUrl.searchParams.get('problem')});
  return finish(NextResponse.json({data},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){
  const e=error as {status?:number;code?:string};const status=[400,401,403,404,503].includes(e.status??0)?e.status!:503;
  const code=status===503?'incidences_unavailable':e.code==='incidences_input_invalid'?e.code:'request_rejected';
  return finish(NextResponse.json({error:{code}},{status,headers:PRIVATE_HEADERS}));
 }
}
