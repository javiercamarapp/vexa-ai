import 'server-only';
import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {createExplorerRepository} from '../../../../../packages/recommendations/explorer.mjs';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
export async function explorerResponse(request:NextRequest,mode:'search'|'tools'|'query'){
 const traceId=randomUUID(),version='f06-explorer-v1';let finish=(r:NextResponse)=>r;try{
 const configuration=config();if(!configuration)return NextResponse.json({contract_version:version,error:{code:'configuration_required',retryable:true,message:'Configura el acceso autorizado al Explorer.'},meta:{trace_id:traceId}},{status:503,headers:PRIVATE_HEADERS});
 if(request.method==='POST')assertOrigin(request.headers.get('origin'),configuration.origin);const auth=requestAuth(request);finish=auth.finish;const repository=createExplorerRepository({database:createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value})});let data;
 if(mode==='search')data=await repository.search({query:request.nextUrl.searchParams});else{if(request.nextUrl.search)throw new AccessError(400,'unsupported_filter');const raw=await request.text();if(Buffer.byteLength(raw)>16384)throw new AccessError(400,'input_too_large');let input;try{input=JSON.parse(raw);}catch{throw new AccessError(400,'input_invalid');}data=mode==='tools'?await repository.tools(input):await repository.ask(input);}
 return finish(NextResponse.json({contract_version:version,data,meta:{trace_id:traceId}},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){const e=error as {status?:number};const status=[400,401,403,404,409,503].includes(e.status??0)?e.status!:503;return finish(NextResponse.json({contract_version:version,error:{code:'explorer_request_failed',retryable:status===503,message:status===409?'El cursor o alcance no coincide con esta consulta.':status===404?'El recurso no está disponible en este alcance.':'No se pudo completar la consulta autorizada.'},meta:{trace_id:traceId}},{status,headers:PRIVATE_HEADERS}));}
}
