import {readRequestBytes} from '../request-body';
import 'server-only';
import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {createNotificationRepository} from '../../../../../packages/notifications/index.mjs';
import {configuredChannels} from '../../../../../packages/notifications/readiness.mjs';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
async function notificationInput(request:NextRequest){
 if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json'||!request.body)throw new AccessError(400,'input_invalid');
 let bytes:Uint8Array;
 try{bytes=await readRequestBytes(request,4096);}catch(error){if(error instanceof AccessError&&error.status===413)throw new AccessError(413,'input_limit');throw error;}
 try{const result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));return result;}catch{throw new AccessError(400,'input_invalid');}
}
export async function notificationResponse(request:NextRequest,path?:{preferences?:boolean;id?:string}){
 const traceId=randomUUID(),version='f06-notifications-v1';let finish=(r:NextResponse)=>r;
 try{
  const configuration=config();if(!configuration)return NextResponse.json({contract_version:version,error:{code:'configuration_required',retryable:true,message:'Configura el acceso autorizado al centro de notificaciones.'},meta:{trace_id:traceId}},{status:503,headers:PRIVATE_HEADERS});
  if(request.method==='POST')assertOrigin(request.headers.get('origin'),configuration.origin);
  const auth=requestAuth(request);finish=auth.finish;
  const repository=createNotificationRepository({database:createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value})});let data;
  if(request.method==='GET'){
   if(path?.preferences){
    if(request.nextUrl.search)throw new AccessError(400,'unsupported_filter');
    const preferences=await repository.preferences(),configured=await configuredChannels();
    data={...preferences,channels:preferences.channels.map(channel=>({...channel,deliveryAvailable:configured[channel.id],reason:channel.id==='inapp'?channel.reason:configured[channel.id]?'Configuración disponible en este servidor. Se requieren una política habilitada, tus preferencias y el consumidor activo; todavía no acredita entrega del proveedor.':channel.reason}))};
   }
   else data=await repository.inbox({query:request.nextUrl.searchParams});
  }else{
   if(request.nextUrl.search)throw new AccessError(400,'unsupported_filter');const input=await notificationInput(request);
   if(path?.preferences)data=await repository.setPreference(input);
   else if(path?.id){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new AccessError(400,'input_invalid');data=await repository.markRead({id:path.id});}
   else throw new AccessError(400,'unsupported_operation');
  }
  return finish(NextResponse.json({contract_version:version,data,meta:{trace_id:traceId}},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){const e=error as {status?:number};const status=[400,401,403,404,408,409,413,429,503].includes(e.status??0)?e.status!:503;return finish(NextResponse.json({contract_version:version,error:{code:'notification_request_failed',retryable:status===503,message:status===409?'La preferencia o la página cambió. Actualiza antes de volver a guardar.':status===404?'El aviso no está disponible para tu usuario.':'No se pudo completar la operación autorizada.'},meta:{trace_id:traceId}},{status,headers:PRIVATE_HEADERS}));}
}
