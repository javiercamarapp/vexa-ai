import {readRequestBytes} from '../request-body';
import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {AccessError,assertOrigin,config,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
const headers={...PRIVATE_HEADERS,'Referrer-Policy':'no-referrer',Vary:'Cookie'};
async function input(request:NextRequest){
 if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json'||!request.body)throw new AccessError(400,'platform_input_invalid');
 let bytes:Uint8Array;
 try{bytes=await readRequestBytes(request,4096);}catch(error){if(error instanceof AccessError&&error.status===413)throw new AccessError(413,'platform_input_limit');throw error;}
 try{const result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));return result;}catch{throw new AccessError(400,'platform_input_invalid');}
}
export async function handlePlatform(request:NextRequest){
 let finish=(r:NextResponse)=>r;
 try{
  const c=config();if(!c)throw new AccessError(503,'platform_configuration_required');
  if(request.method==='POST')assertOrigin(request.headers.get('origin'),c.origin);
  const auth=requestAuth(request);finish=r=>{const response=auth.finish(r);response.headers.set('Referrer-Policy','no-referrer');return response;};
  const user=await auth.client.auth.getUser();if(user.error||!user.data.user)throw new AccessError(401,'platform_authentication_required');
  let value:Record<string,unknown>;const q=request.nextUrl.searchParams;
  if(request.method==='GET'){
   if([...q.keys()].some(k=>!['operation','cursor'].includes(k)||q.getAll(k).length!==1))throw new AccessError(400,'platform_input_invalid');
   const op=q.get('operation')??'list';if(!['list','audit','status'].includes(op)||op==='status'&&q.has('cursor'))throw new AccessError(400,'platform_input_invalid');
   value={operation:op,...(q.has('cursor')?{cursor:q.get('cursor')}:{})};
  }else{
   if(q.size)throw new AccessError(400,'platform_input_invalid');const body=await input(request);
   if(!body||typeof body!=='object'||Array.isArray(body)||body.operation!=='create'||Object.keys(body).some(k=>!['operation','name','ownerEmail','requestId','confirmed'].includes(k))||typeof body.name!=='string'||typeof body.ownerEmail!=='string'||typeof body.requestId!=='string'||body.confirmed!==true)throw new AccessError(400,'platform_input_invalid');
   value=body;
  }
  const result=await auth.client.rpc('platform_manage',{p_input:value});
  if(result.error){const e=result.error;throw new AccessError(e.code==='42501'?403:e.code==='P0001'?409:['22023','22P02','23502','23514'].includes(e.code)?400:503,/^platform_[a-z_]+$/.test(e.message)?e.message:'platform_unavailable');}
  return finish(NextResponse.json({data:result.data},{headers}));
 }catch(error){const e=error as {status?:number;code?:string};const status=[400,401,403,408,409,413,429,503].includes(e.status??0)?e.status!:503;
  return finish(NextResponse.json({error:{code:e.code?.startsWith('platform_')?e.code:'platform_unavailable'}},{status,headers}));}
}
