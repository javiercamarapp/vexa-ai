import {readRequestBytes} from '../request-body';
import 'server-only';
import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {createPushRepository,availablePushConfiguration} from '../../../../../packages/notifications/push.mjs';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
export const PUSH_DEVICE='vexa_push_device';
const validId=(x:unknown):x is string=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
function repository(request:NextRequest,client:ReturnType<typeof requestAuth>['client'],sessionId:string,selectedTenant=request.cookies.get(ACTIVE_ORG)?.value){return createPushRepository({database:createDatabase({identity:identity(client),pool:serverPool(),selectedTenant}),sessionId});}
export async function revokePushForSession(request:NextRequest,client:ReturnType<typeof requestAuth>['client'],global=false,selectedTenant?:string){
 const deviceId=request.cookies.get(PUSH_DEVICE)?.value;
 // Devices cannot have registered without a cookie. Global logout must revoke other sessions too.
 if(!global&&!validId(deviceId))return;
 const claims=await pushClaims(client);
 await repository(request,client,claims.sessionId,selectedTenant).revokeSession({global,deviceId});
}
async function pushClaims(client:ReturnType<typeof requestAuth>['client']){
 const claims=await client.auth.getClaims();if(claims.error||!claims.data?.claims)throw new AccessError(401,'session_required');
 const sessionId=claims.data.claims.session_id,expiresAt=claims.data.claims.exp;
 if(!validId(sessionId)||!Number.isSafeInteger(expiresAt))throw new AccessError(401,'session_required');
 return {sessionId,expiresAt:expiresAt as number};
}
async function pushInput(request:NextRequest){
 if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json'||!request.body)throw new AccessError(400,'input_invalid');
 const bytes=await readRequestBytes(request,8192);
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new AccessError(400,'input_invalid');}
}
export async function pushResponse(request:NextRequest){
 let finish=(r:NextResponse)=>r;const trace=randomUUID();
 try{
  const c=config();if(!c)throw new AccessError(503,'configuration_required');
  if(request.nextUrl.search)throw new AccessError(400,'input_invalid');
  if(request.method==='POST')assertOrigin(request.headers.get('origin'),c.origin);
  const auth=requestAuth(request);finish=auth.finish;const claims=await pushClaims(auth.client);const repo=repository(request,auth.client,claims.sessionId),push=await availablePushConfiguration();
  if(request.method==='GET')return finish(NextResponse.json({data:{devices:await repo.list(),observedAt:Date.now(),configured:!!push,publicKey:push?.publicKey??null,currentDeviceId:request.cookies.get(PUSH_DEVICE)?.value??null},meta:{trace_id:trace}},{headers:PRIVATE_HEADERS}));
  const input=await pushInput(request);
  if(!input||typeof input!=='object'||Array.isArray(input))throw new AccessError(400,'input_invalid');
  if(input.op==='revoke'&&Object.keys(input).every(k=>['op','id'].includes(k))&&validId(input.id))return finish(NextResponse.json({data:await repo.revoke(input.id),meta:{trace_id:trace}},{headers:PRIVATE_HEADERS}));
  if(input.op!=='register'||Object.keys(input).some(k=>!['op','consent','subscription'].includes(k)))throw new AccessError(400,'input_invalid');
  if(!push)throw new AccessError(503,'push_configuration_required');
  const {sessionId,expiresAt}=claims;
  const old=request.cookies.get(PUSH_DEVICE)?.value,deviceId=validId(old)?old:randomUUID();
  const data=await repo.register({consent:input.consent,subscription:input.subscription},{deviceId,sessionId,expiresAt});
  const response=finish(NextResponse.json({data,meta:{trace_id:trace}},{headers:PRIVATE_HEADERS}));
  response.cookies.set(PUSH_DEVICE,deviceId,{httpOnly:true,secure:c.secure,sameSite:'strict',path:'/',maxAge:31536000});return response;
 }catch(error){const e=error as {status?:number};const status=[400,401,403,404,408,409,413,429,503].includes(e.status??0)?e.status!:503;return finish(NextResponse.json({error:{code:'push_request_failed',message:status===409?'La suscripción cambió o pertenece a otra sesión. Desactívala antes de volver a registrarla.':'No se pudo verificar la suscripción.',retryable:status===503},meta:{trace_id:trace}},{status,headers:PRIVATE_HEADERS}));}
}
