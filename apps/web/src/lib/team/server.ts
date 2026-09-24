import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {ACTIVE_ORG,AccessError,assertOrigin,config,PRIVATE_HEADERS,resolveSession,identity} from '../auth';
import {requestAuth} from '../auth-http';
import {createTeam} from '../../../../../packages/team/index.mjs';
const headers={...PRIVATE_HEADERS,'Referrer-Policy':'no-referrer',Vary:'Cookie'};
async function body(request:NextRequest){if(request.headers.get('content-type')?.split(';')[0]!=='application/json'||!request.body)throw new AccessError(400,'team_input_invalid');const reader=request.body.getReader();let size=0;const chunks:Uint8Array[]=[];try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16384){await reader.cancel();throw new AccessError(413,'team_input_limit');}chunks.push(value);}}finally{reader.releaseLock();}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AccessError(400,'team_input_invalid');}}
function sender(){const c=config();const key=process.env.VEXA_TEAM_AUTH_ADMIN_KEY,url=process.env.VEXA_TEAM_AUTH_URL;if(!c||!key||!url||new URL(url).origin!==new URL(c.url).origin||new URL(url).pathname!=='/')return undefined;
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input:RequestInfo|URL,init?:RequestInit)=>fetch(input,{...init,cache:'no-store',signal:AbortSignal.timeout(10000)})}};
 const admin=createClient(c.url,key,options),publicClient=createClient(c.url,c.key,options);
 return async({id,email}:{id:string;email:string})=>{const redirectTo=new URL(`/auth/invitations/${id}`,c.origin).href;try{const result=await admin.auth.admin.inviteUserByEmail(email,{redirectTo});if(!result.error)return 'sent';if(result.error.code==='email_exists'||result.error.code==='user_already_exists'){const existing=await publicClient.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:redirectTo}});return existing.error?'uncertain':'sent';}return result.error.status&&result.error.status>=400&&result.error.status<500?'failed':'uncertain';}catch{return 'uncertain';}};
}
export async function handleTeam(request:NextRequest,invitationId?:string){let finish=(r:NextResponse)=>r;try{const c=config();if(!c)throw new AccessError(503,'team_configuration_required');if(request.method==='POST')assertOrigin(request.headers.get('origin'),c.origin);const auth=requestAuth(request);finish=r=>{const response=auth.finish(r);response.headers.set('Referrer-Policy','no-referrer');return response;};const input=request.method==='POST'?await body(request):null;
 if(request.method==='POST'){const allowed:Record<string,string[]>={invite:['operation','email','role','requestId','confirmed'],role:['operation','id','version','role'],revoke:['operation','id','version'],cancel:['operation','id','version'],session:['operation','accessToken','refreshToken'],accept:['operation']};if(!input||typeof input!=='object'||Array.isArray(input)||!allowed[input.operation]||Object.keys(input).some(key=>!allowed[input.operation].includes(key)))throw new AccessError(400,'team_input_invalid');}
 const query=request.nextUrl.searchParams;if([...query.keys()].some(key=>!['kind','cursor'].includes(key)||query.getAll(key).length!==1)||invitationId&&query.size||request.method==='POST'&&query.size)throw new AccessError(400,'team_input_invalid');
 if(invitationId&&input?.operation==='session'){
  if(typeof input.accessToken!=='string'||typeof input.refreshToken!=='string'||input.accessToken.length>8000||input.refreshToken.length>8000)throw new AccessError(400,'team_input_invalid');
  const established=await auth.client.auth.refreshSession({refresh_token:input.refreshToken});if(established.error)throw new AccessError(401,'team_authentication_required');
 }
 const verified=await auth.client.auth.getUser();if(verified.error||!verified.data.user)throw new AccessError(401,'team_authentication_required');
 let tenantId:string|undefined;
 if(!invitationId){const session=await resolveSession(identity(auth.client),request.cookies.get(ACTIVE_ORG)?.value);tenantId=session.active.tenant_id;}
 const team=createTeam({client:auth.client,tenantId,sendInvitation:sender()});let data;
 if(invitationId){if(!/^[0-9a-f-]{36}$/i.test(invitationId))throw new AccessError(400,'team_input_invalid');if(request.method==='POST'&&!['session','accept'].includes(input?.operation))throw new AccessError(400,'team_input_invalid');data=await team.call({operation:input?.operation==='accept'?'accept':'inspect',id:invitationId});}
 else if(request.method==='GET'){const kind=request.nextUrl.searchParams.get('kind')??'members';if(!['members','invitations'].includes(kind))throw new AccessError(400,'team_input_invalid');data=await team.call({operation:'list',kind,cursor:request.nextUrl.searchParams.get('cursor')});}
 else {if(!input||!['invite','role','revoke','cancel'].includes(input.operation))throw new AccessError(400,'team_input_invalid');data=input.operation==='invite'?await team.invite(input):await team.call(input);}
 return finish(NextResponse.json({data},{headers}));
 }catch(error){const e=error as {status?:number;code?:string};const status=[400,401,403,409,413,503].includes(e.status??0)?e.status!:503;return finish(NextResponse.json({error:{code:e.code?.startsWith('team_')?e.code:'team_unavailable'}},{status,headers}));}}
