import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,config,identity,PRIVATE_HEADERS,resolveSession} from '../auth';
import {requestAuth} from '../auth-http';
import {createGeoMapRepository} from '../../../../../packages/workspace-service/mapa-problemas.mjs';
/** GET /api/map: «Mapa de problemas» (casos por estado, provisional desde el Tracker). Solo lectura bajo la sesión y la RLS del usuario; sin PII; solo propietarios y analistas. */
export async function mapHandler(request:NextRequest){
 let finish=(r:NextResponse)=>r;
 try{
  if(!config())throw new AccessError(503,'configuration_required');
  if([...request.nextUrl.searchParams.keys()].length)throw new AccessError(400,'unsupported_filter');
  const auth=requestAuth(request);finish=auth.finish;
  const id=identity(auth.client);
  const session=await resolveSession(id,request.cookies.get(ACTIVE_ORG)?.value);
  if(!['owner','analyst'].includes(session.active.role))throw new AccessError(403,'role_insufficient');
  const database=createDatabase({identity:id,pool:serverPool(),selectedTenant:session.active.tenant_id});
  const data=await createGeoMapRepository({database}).get();
  return finish(NextResponse.json({data},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){
  const e=error as {status?:number};const status=[400,401,403,404,503].includes(e.status??0)?e.status!:503;
  const code=status===503?'map_unavailable':status===404?'resource_not_found':'request_rejected';
  return finish(NextResponse.json({error:{code}},{status,headers:PRIVATE_HEADERS}));
 }
}
