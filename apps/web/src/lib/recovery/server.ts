import {readRequestBytes} from '../request-body';
import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
import {createRecoveryWeb} from '../../../../../packages/recovery/web.mjs';
import {createRecoveryStorage} from '../../../../../packages/recovery/storage.mjs';
async function readBody(request:NextRequest){
 if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json'||!request.body)throw new AccessError(400,'retention_input_invalid');
 let bytes:Uint8Array;
 try{bytes=await readRequestBytes(request,16384);}catch(error){if(error instanceof AccessError&&error.status===413)throw new AccessError(413,'retention_input_limit');throw error;}
 try{const result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));return result;}catch{throw new AccessError(400,'retention_input_invalid');}
}
export async function recovery(request:NextRequest){let finish=(r:NextResponse)=>r;const headers={...PRIVATE_HEADERS,Vary:'Cookie'};try{const c=config();if(!c)throw new AccessError(503,'configuration_required');if(request.method==='POST')assertOrigin(request.headers.get('origin'),c.origin);const auth=requestAuth(request);finish=auth.finish;const database=createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value}),web=createRecoveryWeb({database,storage:createRecoveryStorage({database,client:auth.client}),ledgerKey:process.env.VEXA_RETENTION_LEDGER_KEY});
 const params=request.nextUrl.searchParams;if([...params.keys()].some(k=>!['connectionId','entityType','cursor'].includes(k)||params.getAll(k).length!==1)||request.method==='POST'&&params.size)throw new AccessError(400,'retention_input_invalid');
 if(request.method==='GET')return finish(NextResponse.json(params.size?await web.sources({connectionId:params.get('connectionId'),entityType:params.get('entityType'),cursor:params.get('cursor')}):await web.state(),{headers}));
 const body=await readBody(request);if(!body||typeof body!=='object'||Array.isArray(body)||!['policy','preview','erase','purge','export'].includes(body.operation))throw new AccessError(400,'retention_input_invalid');const {operation,...input}=body;let data;if(operation==='policy')data=await web.policy(input);else if(operation==='preview')data=await web.preview(input);else if(operation==='erase')data=await web.erase(input);else{if(Object.keys(input).length)throw new AccessError(400,'retention_input_invalid');data=operation==='purge'?await web.purge():await web.exportLedger();}
 if(operation==='export')return finish(new NextResponse(JSON.stringify(data,null,2),{headers:{...headers,'content-type':'application/json','content-disposition':'attachment; filename="retention-ledger.json"'}}));return finish(NextResponse.json({data},{headers}));
 }catch(error){const e=error as {code?:string;status?:number};const status=[400,401,403,404,408,409,413,429,503].includes(e.status??0)?e.status!:503;return finish(NextResponse.json({error:{code:e.code?.startsWith('retention_')||['role_insufficient','organization_not_authorized','authentication_required'].includes(e.code??'')?e.code:'retention_unavailable'}},{headers,status}));}}
