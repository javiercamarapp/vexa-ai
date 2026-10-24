import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,config,identity,PRIVATE_HEADERS,resolveSession} from '../auth';
import {requestAuth} from '../auth-http';
import {conMemoria,olvidarSiDegradada} from '../lectura-memo.mjs';
import {createPainPointsRepository} from '../../../../../packages/workspace-service/pain-points.mjs';
import {createPainEvidenceRepository} from '../../../../../packages/workspace-service/pain-points-evidencia.mjs';
const TTL_MS=90_000;
/** Solo propietarios y analistas (igual que el menú «Dinero»): ocultar el ítem no protege la ruta. */
async function contexto(request:NextRequest){
 if(!config())throw new AccessError(503,'configuration_required');
 const auth=requestAuth(request);
 const id=identity(auth.client);
 const session=await resolveSession(id,request.cookies.get(ACTIVE_ORG)?.value);
 if(!['owner','analyst'].includes(session.active.role))throw new AccessError(403,'role_insufficient');
 const database=createDatabase({identity:id,pool:serverPool(),selectedTenant:session.active.tenant_id});
 return {finish:auth.finish,database,tenant:session.active.tenant_id,role:session.active.role};
}
function falla(error:unknown,finish:(r:NextResponse)=>NextResponse,base:string){
 const e=error as {status?:number;code?:string};const status=[400,401,403,404,503].includes(e.status??0)?e.status!:503;
 const code=status===503?base+'_unavailable':status===404?'resource_not_found':e.code&&/^(pain_point_invalid|pain_point_not_found|cursor_invalid|cursor_scope_conflict)$/.test(e.code)?e.code:'request_rejected';
 return finish(NextResponse.json({error:{code}},{status,headers:PRIVATE_HEADERS}));
}
/** GET /api/pain-points: puntos de dolor del tenant activo (dinero bruto, monedas separadas, `sinDato` explícito, jamás 0). Solo lectura bajo la sesión y la RLS del usuario; sin PII. */
export async function painPointsHandler(request:NextRequest){
 let finish=(r:NextResponse)=>r;
 try{
  if([...request.nextUrl.searchParams.keys()].length)throw new AccessError(400,'unsupported_filter');
  const c=await contexto(request);finish=c.finish;
  const clave=c.tenant+'|'+c.role+'|pain-points';
  const data=olvidarSiDegradada(clave,await conMemoria(clave,TTL_MS,()=>createPainPointsRepository({database:c.database}).get()));
  return finish(NextResponse.json({data},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){return falla(error,finish,'pain_points');}
}
/** GET /api/pain-points/[id]/evidence[?cursor=…][&format=csv]: filas (libro y Tracker) que sustentan la cifra, 50 por página, con total verificable; CSV sin PII (tope 5 000). */
export async function painEvidenceHandler(request:NextRequest,params:{id:string}){
 let finish=(r:NextResponse)=>r;
 try{
  const q=request.nextUrl.searchParams;
  for(const k of q.keys())if(!['cursor','format'].includes(k))throw new AccessError(400,'unsupported_filter');
  if(q.getAll('cursor').length>1||q.getAll('format').length>1||(q.get('format')!==null&&q.get('format')!=='csv'))throw new AccessError(400,'unsupported_format');
  const c=await contexto(request);finish=c.finish;
  const resumen=()=>{const clave=c.tenant+'|'+c.role+'|pain-points';return conMemoria(clave,TTL_MS,()=>createPainPointsRepository({database:c.database}).get());};
  const repo=createPainEvidenceRepository({database:c.database,resumen});
  const id=decodeURIComponent(params.id);
  if(q.get('format')==='csv'){
   const clave=c.tenant+'|'+c.role+'|pain-points-csv|'+id;
   const out=olvidarSiDegradada(clave,await conMemoria(clave,TTL_MS,()=>repo.csv({id})));
   if(out.estado==='unavailable')throw new AccessError(503,'pain_points_unavailable');
   return finish(new NextResponse(out.contenido,{headers:{...PRIVATE_HEADERS,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${out.nombre}"`,'X-Content-Type-Options':'nosniff','X-Evidence-Rows':String(out.filas),'X-Evidence-Truncated':String(out.truncado),'X-Evidence-Check':out.verificacion.marca==='✓'?'match':out.verificacion.marca==='✗'?'mismatch':'unchecked',Vary:'Cookie'}}));
  }
  const clave=c.tenant+'|'+c.role+'|pain-points-ev|'+id+'|'+(q.get('cursor')??'');
  const data=olvidarSiDegradada(clave,await conMemoria(clave,TTL_MS,()=>repo.get({id,cursor:q.get('cursor')})));
  return finish(NextResponse.json({data},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){return falla(error,finish,'pain_points');}
}
