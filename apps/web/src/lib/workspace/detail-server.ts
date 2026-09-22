import 'server-only';
import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {createDetailService} from '../../../../../packages/workspace-service/detail.mjs';
import type {DetailKind} from '../../../../../packages/workspace-service/detail.mjs';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
export async function detailResponse(request:NextRequest,path?:{kind:string;id:string}){
 const traceId=randomUUID(),version='f06-detail-v1';let finish=(r:NextResponse)=>r;try{
 const configuration=config();if(!configuration)return NextResponse.json({contract_version:version,error:{code:'configuration_required',retryable:true,message:'La configuración del servidor de detalle no está disponible.'},meta:{trace_id:traceId}},{status:503,headers:PRIVATE_HEADERS});
 if(request.method==='POST')assertOrigin(request.headers.get('origin'),configuration.origin);const auth=requestAuth(request);finish=auth.finish;const service=createDetailService({database:createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value})});let data;
 if(path)data=await service.get({kind:path.kind as DetailKind,id:path.id,query:request.nextUrl.searchParams});else{if(request.nextUrl.search)throw new AccessError(400,'unsupported_filter');if(request.method==='GET')data=await service.customerBindings();else{const raw=await request.text();if(Buffer.byteLength(raw)>16384)throw new AccessError(400,'input_too_large');let input;try{input=JSON.parse(raw);}catch{throw new AccessError(400,'input_invalid');}data=await service.recordCustomerBinding(input);}}
 return finish(NextResponse.json({contract_version:version,data,meta:{trace_id:traceId}},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){const value=error as {status?:number};const status=[400,401,403,404,409,503].includes(value.status??0)?value.status!:503;return finish(NextResponse.json({contract_version:version,error:{code:'detail_request_failed',retryable:status===503,message:status===404?'El recurso no está disponible en este alcance.':status===409?'El alcance o su versión cambió.':'No se pudo consultar el detalle autorizado.'},meta:{trace_id:traceId}},{status,headers:PRIVATE_HEADERS}));}
}
