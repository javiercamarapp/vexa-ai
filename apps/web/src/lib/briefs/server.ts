import { readRequestText } from '../request-body';
import 'server-only';
import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase,forDownload} from '@vexa/platform/db';
import {createBriefRepository,briefHtml} from '../../../../../packages/briefs/index.mjs';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS,resolveSession} from '../auth';
import {requestAuth} from '../auth-http';
import {conMemoria,olvidarMemoria} from '../lectura-memo.mjs';
export async function briefResponse(request:NextRequest,path?:{id:string;export?:boolean}){
 const traceId=randomUUID(),version='f06-briefs-v1';let finish=(r:NextResponse)=>r;try{
 const configuration=config();if(!configuration)return NextResponse.json({contract_version:version,error:{code:'configuration_required',retryable:true,message:'Configura el acceso autorizado a briefs.'},meta:{trace_id:traceId}},{status:503,headers:PRIVATE_HEADERS});
 if(request.method==='POST')assertOrigin(request.headers.get('origin'),configuration.origin);const auth=requestAuth(request);finish=auth.finish;const repository=createBriefRepository({database:forDownload(createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value}),Boolean(path?.export))});let data;
 if(request.method==='GET'){if(path){if(path.export){const q=request.nextUrl.searchParams;if([...q.keys()].some(k=>k!=='format')||q.getAll('format').length!==1||!['json','html'].includes(q.get('format')??''))throw new AccessError(400,'unsupported_format');data=await repository.get({id:path.id});const html=q.get('format')==='html';return finish(new NextResponse(html?briefHtml(data):JSON.stringify(data),{headers:{...PRIVATE_HEADERS,'Content-Type':html?'text/html; charset=utf-8':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="brief-${data.id}.${html?'html':'json'}"`,'X-Content-Type-Options':'nosniff','X-Contract-Version':version,'X-Trace-Id':traceId,'Content-Security-Policy':"default-src 'none'; sandbox; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",Vary:'Cookie'}}));}if(request.nextUrl.search)throw new AccessError(400,'unsupported_filter');data=await repository.get({id:path.id});}else{ // Historial: la sesión se valida ANTES de consultar la memoria (clave = persona + organización + consulta); 60 s; el fallo no se guarda; generar un brief la vacía.
  // R-05: antes de servir de la memoria se revalida la membresía vigente contra la base (resolveSession); una membresía revocada ya no lee 60 s de caché. La clave usa la organización y el rol revalidados, no la cookie cruda.
  const sesion=await resolveSession(identity(auth.client),request.cookies.get(ACTIVE_ORG)?.value),consulta=request.nextUrl.searchParams;
  data=await conMemoria('briefs|'+sesion.user.id+'|'+sesion.active.tenant_id+'|'+sesion.active.role+'|'+consulta.toString(),60_000,()=>repository.list({query:consulta}));}}
 else{if(path||request.nextUrl.search)throw new AccessError(400,'unsupported_operation');const raw=await readRequestText(request, 32768);if(Buffer.byteLength(raw)>32768)throw new AccessError(400,'input_too_large');let input;try{input=JSON.parse(raw);}catch{throw new AccessError(400,'input_invalid');}if(!input||typeof input!=='object'||Array.isArray(input)||input.operation!=='generate')throw new AccessError(400,'input_invalid');const {operation:_,...body}=input;void _;data=await repository.generate(body);olvidarMemoria();}
 return finish(NextResponse.json({contract_version:version,data,meta:{trace_id:traceId}},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){const e=error as {status?:number};const status=[400,401,403,404,408,409,413,429,503].includes(e.status??0)?e.status!:503;return finish(NextResponse.json({contract_version:version,error:{code:'brief_request_failed',retryable:status===503,message:status===409?'El alcance, comparación o versión requiere revisión.':status===404?'El brief no está disponible en este alcance.':'No se pudo completar la operación autorizada.'},meta:{trace_id:traceId}},{status,headers:PRIVATE_HEADERS}));}
}
