import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,config,identity,PRIVATE_HEADERS,resolveSession} from '../auth';
import {requestAuth} from '../auth-http';
import {idiomaDePeticion} from '../i18n/errores-api';
import {createRevenueGapsRepository} from '../../../../../packages/workspace-service/brechas.mjs';
/** GET /api/gaps: «Brechas de ingreso» del tenant activo. SOLO lee insight_* precalculados bajo la sesión y la RLS del usuario; sin PII; todo es ingreso bruto (sin margen). */
export async function gaps(request:NextRequest){
 let finish=(r:NextResponse)=>r;
 try{
  if(!config())throw new AccessError(503,'configuration_required');
  for(const k of request.nextUrl.searchParams.keys())throw new AccessError(400,'unsupported_filter:'+k);
  const auth=requestAuth(request);finish=auth.finish;
  const id=identity(auth.client);
  // Dinero: solo propietarios y analistas (igual que el menú «Dinero»); ocultar el ítem no protege la ruta.
  const session=await resolveSession(id,request.cookies.get(ACTIVE_ORG)?.value);
  if(!['owner','analyst'].includes(session.active.role))throw new AccessError(403,'role_insufficient');
  const database=createDatabase({identity:id,pool:serverPool(),selectedTenant:session.active.tenant_id});
  const data=await createRevenueGapsRepository({database}).get({idioma:idiomaDePeticion(request)});
  return finish(NextResponse.json({data},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){
  const e=error as {status?:number;code?:string};const status=[400,401,403,404,503].includes(e.status??0)?e.status!:503;
  const code=status===503?'gaps_unavailable':status===404?'resource_not_found':'request_rejected';
  return finish(NextResponse.json({error:{code}},{status,headers:PRIVATE_HEADERS}));
 }
}
