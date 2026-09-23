import 'server-only';
import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {createNotificationRepository} from '../../../../../packages/notifications/index.mjs';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
export async function notificationResponse(request:NextRequest,path?:{preferences?:boolean;id?:string}){
 const traceId=randomUUID(),version='f06-notifications-v1';let finish=(r:NextResponse)=>r;
 try{
  const configuration=config();if(!configuration)return NextResponse.json({contract_version:version,error:{code:'configuration_required',retryable:true,message:'Configura el acceso autorizado al centro de notificaciones.'},meta:{trace_id:traceId}},{status:503,headers:PRIVATE_HEADERS});
  if(request.method==='POST')assertOrigin(request.headers.get('origin'),configuration.origin);
  const auth=requestAuth(request);finish=auth.finish;
  const repository=createNotificationRepository({database:createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value})});let data;
  if(request.method==='GET'){
   if(path?.preferences){if(request.nextUrl.search)throw new AccessError(400,'unsupported_filter');data=await repository.preferences();}
   else data=await repository.inbox({query:request.nextUrl.searchParams});
  }else{
   if(request.nextUrl.search)throw new AccessError(400,'unsupported_filter');const raw=await request.text();if(Buffer.byteLength(raw)>4096)throw new AccessError(400,'input_too_large');let input;try{input=JSON.parse(raw);}catch{throw new AccessError(400,'input_invalid');}
   if(path?.preferences)data=await repository.setPreference(input);
   else if(path?.id){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new AccessError(400,'input_invalid');data=await repository.markRead({id:path.id});}
   else throw new AccessError(400,'unsupported_operation');
  }
  return finish(NextResponse.json({contract_version:version,data,meta:{trace_id:traceId}},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){const e=error as {status?:number};const status=[400,401,403,404,409,503].includes(e.status??0)?e.status!:503;return finish(NextResponse.json({contract_version:version,error:{code:'notification_request_failed',retryable:status===503,message:status===409?'La preferencia o la página cambió. Actualiza antes de volver a guardar.':status===404?'El aviso no está disponible para tu usuario.':'No se pudo completar la operación autorizada.'},meta:{trace_id:traceId}},{status,headers:PRIVATE_HEADERS}));}
}
