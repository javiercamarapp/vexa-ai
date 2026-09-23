import 'server-only';
import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {createInterventionRepository} from '../../../../../packages/interventions/index.mjs';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
export async function interventionResponse(request:NextRequest,id?:string){
 const traceId=randomUUID(),version='f06-interventions-v1';let finish=(r:NextResponse)=>r;try{
 const configuration=config();if(!configuration)return NextResponse.json({contract_version:version,error:{code:'configuration_required',retryable:true,message:'Configura el acceso autorizado a intervenciones.'},meta:{trace_id:traceId}},{status:503,headers:PRIVATE_HEADERS});
 if(request.method==='POST')assertOrigin(request.headers.get('origin'),configuration.origin);const auth=requestAuth(request);finish=auth.finish;const repository=createInterventionRepository({database:createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value})});let data;
 if(request.method==='GET'){if(id){if(request.nextUrl.search)throw new AccessError(400,'unsupported_filter');data=await repository.get({id});}else data=await repository.list(request.nextUrl.search?{query:request.nextUrl.searchParams}:{});}
 else{if(!id||request.nextUrl.search)throw new AccessError(400,'unsupported_filter');const raw=await request.text();if(Buffer.byteLength(raw)>32768)throw new AccessError(400,'input_too_large');let input;try{input=JSON.parse(raw);}catch{throw new AccessError(400,'input_invalid');}if(!input||typeof input!=='object'||Array.isArray(input)||Object.hasOwn(input,'id'))throw new AccessError(400,'input_invalid');const {operation,...body}=input;if(operation==='plan')data=await repository.savePlan({...body,id});else if(operation==='transition')data=await repository.transition({...body,id});else if(operation==='measure')data=await repository.measure({...body,id});else if(operation==='assign')data=await repository.assign({...body,id});else throw new AccessError(400,'operation_invalid');}
 return finish(NextResponse.json({contract_version:version,data,meta:{trace_id:traceId}},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){const e=error as {status?:number};const status=[400,401,403,404,409,503].includes(e.status??0)?e.status!:503;return finish(NextResponse.json({contract_version:version,error:{code:'intervention_request_failed',retryable:status===503,message:status===409?'El estado, plan, alcance o medición requiere revisión.':status===404?'La intervención no está disponible en este alcance.':'No se pudo completar la operación autorizada.'},meta:{trace_id:traceId}},{status,headers:PRIVATE_HEADERS}));}
}
