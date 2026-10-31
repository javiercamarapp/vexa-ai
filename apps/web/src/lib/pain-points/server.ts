import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {forDownloadAuditado as forDownload} from '../security/descargas';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS,resolveSession} from '../auth';
import {requestAuth} from '../auth-http';
import {idiomaDePeticion} from '../i18n/errores-api';
import {conMemoria,olvidarSiDegradada} from '../lectura-memo.mjs';
import {createPainPointsRepository} from '../../../../../packages/workspace-service/pain-points.mjs';
import {createPainEvidenceRepository} from '../../../../../packages/workspace-service/pain-points-evidencia.mjs';
import {createPainAiService} from '../../../../../packages/workspace-service/pain-points-ia.mjs';
import {createPainAiStore} from '../../../../../packages/workspace-service/pain-points-ia-store.mjs';
import {crearProveedorReal} from '../../../../../packages/workspace-service/pain-points-ia-proveedor.mjs';
const TTL_MS=90_000;
/** B-02: un `%` suelto hacía lanzar URIError (503). Se decodifica con captura y se rechaza con 400 si no es un id de punto de dolor razonable. */
function idSeguro(valor:string):string{let id:string;try{id=decodeURIComponent(valor);}catch{throw new AccessError(400,'pain_point_invalid');}if(id.length<1||id.length>128||/[\u0000-\u001f]/.test(id))throw new AccessError(400,'pain_point_invalid');return id;}
/** Solo propietarios y analistas (igual que el menú «Dinero»): ocultar el ítem no protege la ruta. */
async function contexto(request:NextRequest,descarga=false){
 if(!config())throw new AccessError(503,'configuration_required');
 const auth=requestAuth(request);
 const id=identity(auth.client);
 const session=await resolveSession(id,request.cookies.get(ACTIVE_ORG)?.value);
 if(!['owner','analyst'].includes(session.active.role))throw new AccessError(403,'role_insufficient');
 // Una sesión de soporte («ver como») nunca descarga: la guardia vive en la acción 'export' de la base, no en la cookie.
 if(descarga&&session.support)throw new AccessError(403,'support_export_blocked');
 const database=forDownload(createDatabase({identity:id,pool:serverPool(),selectedTenant:session.active.tenant_id}),descarga);
 return {finish:auth.finish,database,tenant:session.active.tenant_id,role:session.active.role};
}
function falla(error:unknown,finish:(r:NextResponse)=>NextResponse,base:string){
 const e=error as {status?:number;code?:string};const status=[400,401,403,404,503].includes(e.status??0)?e.status!:503;
 const code=status===503?base+'_unavailable':status===404?'resource_not_found':e.code&&/^(pain_point_invalid|pain_point_not_found|cursor_invalid|cursor_scope_conflict)$/.test(e.code)?e.code:'request_rejected';
 return finish(NextResponse.json({error:{code}},{status,headers:PRIVATE_HEADERS}));
}
/** Clave del memo del resumen de puntos de dolor: el inglés lleva su propia entrada (el texto sale ya traducido; nunca se comparte con el español). */
export const claveMemoPuntos=(tenant:string,role:string,idioma:string)=>tenant+'|'+role+'|pain-points'+(idioma==='en'?'|en':'');
/** GET /api/pain-points: puntos de dolor del tenant activo (dinero bruto, monedas separadas, `sinDato` explícito, jamás 0). Solo lectura bajo la sesión y la RLS del usuario; sin PII. */
export async function painPointsHandler(request:NextRequest){
 let finish=(r:NextResponse)=>r;
 try{
  if([...request.nextUrl.searchParams.keys()].length)throw new AccessError(400,'unsupported_filter');
  const c=await contexto(request);finish=c.finish;
  const idioma=idiomaDePeticion(request);
  const clave=claveMemoPuntos(c.tenant,c.role,idioma);
  const data=olvidarSiDegradada(clave,await conMemoria(clave,TTL_MS,()=>createPainPointsRepository({database:c.database}).get({idioma})));
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
  const c=await contexto(request,q.get('format')==='csv');finish=c.finish;
  const resumen=()=>{const clave=c.tenant+'|'+c.role+'|pain-points';return conMemoria(clave,TTL_MS,()=>createPainPointsRepository({database:c.database}).get());};
  const repo=createPainEvidenceRepository({database:c.database,resumen});
  const id=idSeguro(params.id);
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

const CODIGOS_IA=/^(pain_point_invalid|pain_point_not_found|pain_point_sin_dato|pii_blocked|ia_apagada|ia_no_migrada)$/;
function fallaIa(error:unknown,finish:(r:NextResponse)=>NextResponse){
 const e=error as {status?:number;code?:string};const status=[400,401,403,404,409,422,503].includes(e.status??0)?e.status!:503;
 const code=e.code&&CODIGOS_IA.test(e.code)?e.code:status===403?'request_rejected':status===404?'resource_not_found':status===503?'pain_points_ia_unavailable':'request_rejected';
 return finish(NextResponse.json({error:{code}},{status,headers:PRIVATE_HEADERS}));
}
/** Proveedor de IA: null (apagado) salvo VEXA_PAIN_AI=enabled con llave. Inyectable en pruebas. */
export const proveedorIa={actual:()=>crearProveedorReal(process.env)};
/**
 * GET /api/pain-points/[id]/ia: última lectura de IA del punto (corte actual o la última guardada), tope semanal «US$x de US$5.00» y si «Analizar» está permitido. NO dispara IA.
 * POST /api/pain-points/[id]/ia: corre (o completa) el triple análisis. Solo propietario/analista, mismo origen, sin cuerpo; respeta el tope y es idempotente por (punto, corte, versión de prompt).
 */
export async function painAiHandler(request:NextRequest,params:{id:string}){
 let finish=(r:NextResponse)=>r;
 try{
  if(request.nextUrl.search)throw new AccessError(400,'unsupported_filter');
  if(request.method==='POST'){const c0=config();if(!c0)throw new AccessError(503,'configuration_required');assertOrigin(request.headers.get('origin'),c0.origin);if(request.headers.get('content-length')&&request.headers.get('content-length')!=='0')throw new AccessError(400,'unsupported_filter');}
  else if(request.method!=='GET')throw new AccessError(400,'unsupported_filter');
  const c=await contexto(request);finish=c.finish;
  const resumen=()=>{const clave=c.tenant+'|'+c.role+'|pain-points';return conMemoria(clave,TTL_MS,()=>createPainPointsRepository({database:c.database}).get());};
  const id=idSeguro(params.id);
  const svc=createPainAiService({store:createPainAiStore({database:c.database}),provider:proveedorIa.actual(),vista:resumen,evidencia:createPainEvidenceRepository({database:c.database,resumen})});
  const data=request.method==='POST'?await svc.analizar({id}):await svc.estado({id});
  return finish(NextResponse.json({data:{...data,puedeAnalizar:['owner','analyst'].includes(c.role)}},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){return fallaIa(error,finish);}
}
