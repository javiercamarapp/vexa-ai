import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
const headers={...PRIVATE_HEADERS,'Referrer-Policy':'no-referrer',Vary:'Cookie'};
const generic={message:'Si la cuenta existe, Auth intentará enviar un enlace. La entrega no está confirmada. Revisa tu correo antes de solicitar otro.',retryAfterSeconds:60};
async function input(request:NextRequest,limit:number){if(request.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json'||!request.body)throw new AccessError(400,'email_auth_input_invalid');const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new AccessError(413,'email_auth_input_limit');}chunks.push(value);}}finally{reader.releaseLock();}try{const result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));if(!result||typeof result!=='object'||Array.isArray(result))throw new Error();return result;}catch{throw new AccessError(400,'email_auth_input_invalid');}}
export async function emailAuth(request:NextRequest,operation:'request'|'session'){let finish=(r:NextResponse)=>r;try{
 const c=config();if(process.env.VEXA_EMAIL_AUTH_ENABLED!=='true'||!c)throw new AccessError(503,'email_auth_unavailable');assertOrigin(request.headers.get('origin'),c.origin);if(request.nextUrl.search)throw new AccessError(400,'email_auth_input_invalid');
 const body=await input(request,operation==='request'?1024:16384);
 if(operation==='request'){
  if(Object.keys(body).length!==1||typeof body.email!=='string'||body.email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))throw new AccessError(400,'email_auth_input_invalid');
  const client=createClient(c.url,c.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,flowType:'implicit'},global:{fetch:(target,init)=>fetch(target,{...init,cache:'no-store',signal:AbortSignal.timeout(10000)})}});
  try{await client.auth.signInWithOtp({email:body.email.trim().toLowerCase(),options:{shouldCreateUser:false,emailRedirectTo:new URL('/auth/email/complete',c.origin).href}});}catch{/* Same public result for transport uncertainty and unknown accounts. Never retry. */}
  return NextResponse.json(generic,{status:202,headers:{...headers,'Retry-After':'60'}});
 }
 if(Object.keys(body).some(k=>!['accessToken','refreshToken'].includes(k))||typeof body.accessToken!=='string'||typeof body.refreshToken!=='string'||body.accessToken.length>8000||body.refreshToken.length>8000||!body.refreshToken)throw new AccessError(400,'email_auth_input_invalid');
 const auth=requestAuth(request);
 // Refresh credential establishes the final identity. The supplied access token is not an identity assertion.
 const established=await auth.client.auth.refreshSession({refresh_token:body.refreshToken});if(established.error)throw new AccessError(401,'email_auth_invalid_link');
 const verified=await auth.client.auth.getUser();if(verified.error||!verified.data.user?.email_confirmed_at)throw new AccessError(401,'email_auth_invalid_link');
 const memberships=await identity(auth.client).memberships(verified.data.user.id);const ids=memberships.map(m=>m.tenant_id);
 let organizations:{id:string;name:string}[]=[];if(ids.length){const result=await auth.client.from('organizations').select('id,name').in('id',ids).order('name');if(result.error)throw new AccessError(503,'email_auth_unavailable');organizations=result.data;}
 // Commit refreshed cookies only after all final-identity and authorization reads succeed.
 finish=response=>{const finished=auth.finish(response);for(const [key,value] of Object.entries(headers))finished.headers.set(key,value);return finished;};
 return finish(NextResponse.json({organizations},{headers}));
 }catch(error){const e=error as {status?:number};const status=[400,401,403,413,503].includes(e.status??0)?e.status!:503;return finish(NextResponse.json({error:{code:status===401?'email_auth_invalid_link':status===403?'email_auth_origin_rejected':status===400||status===413?'email_auth_input_invalid':'email_auth_unavailable'}},{status,headers}));}}
