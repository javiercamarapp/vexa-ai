import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,config,identity,PRIVATE_HEADERS,resolveSession} from '../auth';
import {requestAuth} from '../auth-http';
import {conMemoria,olvidarSiDegradada} from '../lectura-memo.mjs';
import {createRefundLeakRepository} from '../../../../../packages/workspace-service/fuga-reembolsos.mjs';
/** GET /api/refunds[?date_start=YYYY-MM-DD&date_end=YYYY-MM-DD]: «Fuga de reembolsos» del tenant activo. Solo lectura bajo la sesión y la RLS del usuario; sin PII. */
export async function refunds(request:NextRequest){
 let finish=(r:NextResponse)=>r;
 try{
  if(!config())throw new AccessError(503,'configuration_required');
  const q=request.nextUrl.searchParams;
  for(const k of q.keys())if(!['date_start','date_end'].includes(k))throw new AccessError(400,'unsupported_filter');
  const auth=requestAuth(request);finish=auth.finish;
  const id=identity(auth.client);
  // Dinero: solo propietarios y analistas (igual que el menú «Dinero»); ocultar el ítem no protege la ruta.
  const session=await resolveSession(id,request.cookies.get(ACTIVE_ORG)?.value);
  if(!['owner','analyst'].includes(session.active.role))throw new AccessError(403,'role_insufficient');
  const database=createDatabase({identity:id,pool:serverPool(),selectedTenant:session.active.tenant_id});
  const clave=session.active.tenant_id+'|'+session.active.role+'|refunds|'+(q.get('date_start')??'')+'|'+(q.get('date_end')??'');
  const data=olvidarSiDegradada(clave,await conMemoria(clave,90_000,()=>createRefundLeakRepository({database}).get({dateStart:q.get('date_start'),dateEnd:q.get('date_end')})));
  return finish(NextResponse.json({data},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){
  const e=error as {status?:number;code?:string};const status=[400,401,403,404,503].includes(e.status??0)?e.status!:503;
  const code=status===503?'refunds_unavailable':e.code==='refunds_input_invalid'?e.code:status===404?'resource_not_found':'request_rejected';
  return finish(NextResponse.json({error:{code}},{status,headers:PRIVATE_HEADERS}));
 }
}
