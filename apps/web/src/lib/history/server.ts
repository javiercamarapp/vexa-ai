import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
import {createHistoryRepository} from '../../../../../packages/history/repository.mjs';
import {historyConfig} from '../../../../../packages/history/config.mjs';
export async function history(request:NextRequest){let finish=(r:NextResponse)=>r;const headers={...PRIVATE_HEADERS,Vary:'Cookie'};try{
 const c=config();if(!c)throw new AccessError(503,'configuration_required');if(request.method==='POST')assertOrigin(request.headers.get('origin'),c.origin);if(request.method==='POST'&&request.nextUrl.search||[...request.nextUrl.searchParams.keys()].some(k=>!['batch','cursor'].includes(k))||[...request.nextUrl.searchParams.keys()].some(k=>request.nextUrl.searchParams.getAll(k).length!==1))throw new AccessError(400,'history_input_invalid');
 const auth=requestAuth(request);finish=auth.finish;const database=createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value}),repository=createHistoryRepository({database,resolveConfig:historyConfig()});
 if(request.method==='GET'){if(request.nextUrl.searchParams.has('cursor')&&!request.nextUrl.searchParams.has('batch'))throw new AccessError(400,'history_input_invalid');return finish(NextResponse.json(request.nextUrl.searchParams.has('batch')?await repository.page({batchId:request.nextUrl.searchParams.get('batch'),cursor:request.nextUrl.searchParams.get('cursor')}):await repository.list(),{headers}));}
 const raw=await request.text();if(Buffer.byteLength(raw)>4096)throw new AccessError(400,'history_input_invalid');let body;try{body=JSON.parse(raw);}catch{throw new AccessError(400,'history_input_invalid');}
 if(!body||typeof body!=='object'||Array.isArray(body)||!['start','cancel','resume'].includes(body.operation)||Object.keys(body).some(k=>!(body.operation==='start'?['operation','connectionId','requestKey','confirmed']:['operation','batchId','expectedVersion','confirmed']).includes(k)))throw new AccessError(400,'history_input_invalid');
 const data=body.operation==='start'?await repository.start(body):await repository.change(body);return finish(NextResponse.json({data},{headers,status:body.operation==='start'?202:200}));
 }catch(error){const e=error as {status?:number;code?:string},status=[400,401,403,404,409,503].includes(e.status??0)?e.status!:503;return finish(NextResponse.json({error:{code:e.code?.startsWith('history_')||['role_insufficient','organization_not_authorized','authentication_required'].includes(e.code??'')?e.code:'history_unavailable'}},{headers,status}));}}
