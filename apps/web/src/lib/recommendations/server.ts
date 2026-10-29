import {mensajesDe} from '../i18n/errores-api';
import { readRequestText } from '../request-body';
import 'server-only';
import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {createRecommendationRepository} from '../../../../../packages/recommendations/index.mjs';
import {createFlowRepository} from '../../../../../packages/recommendations/flow.mjs';
import {createInterventionRepository} from '../../../../../packages/interventions/index.mjs';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
export async function recommendationResponse(request:NextRequest,path?:{id:string;draft?:boolean}){
 const traceId=randomUUID(),version='f06-recommendations-v1';let finish=(r:NextResponse)=>r;const m=mensajesDe(request);try{
 const configuration=config();if(!configuration)return NextResponse.json({contract_version:version,error:{code:'configuration_required',retryable:true,message:m('tr.err.cfgRecs')},meta:{trace_id:traceId}},{status:503,headers:PRIVATE_HEADERS});
 if(request.method==='POST')assertOrigin(request.headers.get('origin'),configuration.origin);const auth=requestAuth(request);finish=auth.finish;const database=createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value}),base=createRecommendationRepository({database}),repository=createFlowRepository({database,recommendations:base,interventions:createInterventionRepository({database})});let data;
 if(request.method==='GET'){if(path){if(request.nextUrl.search)throw new AccessError(400,'unsupported_filter');data=await repository.get({id:path.id});}else data=await repository.list({query:request.nextUrl.searchParams});}
 else{if(request.nextUrl.search)throw new AccessError(400,'unsupported_filter');const raw=await readRequestText(request, 32768);if(Buffer.byteLength(raw)>32768)throw new AccessError(400,'input_too_large');let input;try{input=JSON.parse(raw);}catch{throw new AccessError(400,'input_invalid');}if(!input||typeof input!=='object'||Array.isArray(input))throw new AccessError(400,'input_invalid');if(Object.hasOwn(input,'id'))throw new AccessError(400,'input_invalid');if(path?.draft)data=await base.createDraft({...input,id:path.id});else{const {operation,...body}=input;if(!path&&operation==='generate')data=await base.generate(body);else if(path&&operation==='revise')data=await base.revise({...body,id:path.id});else if(path&&operation==='state')data=await base.setState({...body,id:path.id});else if(path&&operation==='approve')data=await repository.approve({...body,id:path.id});else if(path&&operation==='adjust')data=await repository.adjust({...body,id:path.id});else if(path&&operation==='start')data=await repository.start({...body,id:path.id});else if(path&&operation==='resolve')data=await repository.resolve({...body,id:path.id});else throw new AccessError(400,'operation_invalid');}}
 return finish(NextResponse.json({contract_version:version,data,meta:{trace_id:traceId}},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){const e=error as {status?:number;code?:string};const status=[400,401,403,404,408,409,413,429,503].includes(e.status??0)?e.status!:path&&(e.code==='42501'||e.code==='23514')?409:503;return finish(NextResponse.json({contract_version:version,error:{code:'recommendation_request_failed',retryable:status===503,message:status===409?m('tr.err.recsRevision'):status===404?m('tr.err.recNoDisp'):m('tr.err.opFallo')},meta:{trace_id:traceId}},{status,headers:PRIVATE_HEADERS}));}
}
