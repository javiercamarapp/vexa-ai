import {readRequestBytes} from '../request-body';
import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {createDeliveryPolicyRepository} from '../../../../../packages/notifications/policies.mjs';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';

async function notificationInput(request:NextRequest){
 if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json'||!request.body)throw new AccessError(400,'input_invalid');
 let bytes:Uint8Array;
 try{bytes=await readRequestBytes(request,4096);}catch(error){if(error instanceof AccessError&&error.status===413)throw new AccessError(413,'input_limit');throw error;}
 try{const result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));return result;}catch{throw new AccessError(400,'input_invalid');}
}
export async function deliveryResponse(request:NextRequest){
 let finish=(r:NextResponse)=>r;
 try{
  const configuration=config();if(!configuration)throw new AccessError(503,'configuration_required');
  if(request.method==='POST')assertOrigin(request.headers.get('origin'),configuration.origin);
  if(request.nextUrl.search)throw new AccessError(400,'unsupported_filter');
  const auth=requestAuth(request);finish=auth.finish;
  const database=createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value});
  // Check role at the normal identity boundary before entering the repository.
  await database.transaction('read',async scope=>{if(scope.role!=='owner')throw new AccessError(403,'owner_required');});
  const repository=createDeliveryPolicyRepository({database});
  if(request.method==='GET')return finish(NextResponse.json({data:await repository.list()},{headers:PRIVATE_HEADERS}));
  const input=await notificationInput(request);
  return finish(NextResponse.json({data:await repository.save(input)},{headers:PRIVATE_HEADERS}));
 }catch(error){
  const code=(error as {status?:number}).status;
  const status=[400,401,403,408,409,413,429].includes(code??0)?code!:503;
  return finish(NextResponse.json({error:{code:'delivery_policy_unavailable',message:status===409?'La política cambió. Actualiza antes de guardar.':'No se pudo verificar la política de envío con tus permisos actuales.'}},{status,headers:PRIVATE_HEADERS}));
 }
}
