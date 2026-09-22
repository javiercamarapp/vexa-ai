import 'server-only';
import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {createRecommendationRepository} from '../../../../../packages/recommendations/index.mjs';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
export async function recommendationResponse(request:NextRequest,path?:{id:string;draft?:boolean}){
 const traceId=randomUUID(),version='f06-recommendations-v1';let finish=(r:NextResponse)=>r;try{
 const configuration=config();if(!configuration)return NextResponse.json({contract_version:version,error:{code:'configuration_required',retryable:true,message:'Configura el acceso autorizado a recomendaciones.'},meta:{trace_id:traceId}},{status:503,headers:PRIVATE_HEADERS});
 if(request.method==='POST')assertOrigin(request.headers.get('origin'),configuration.origin);const auth=requestAuth(request);finish=auth.finish;const repository=createRecommendationRepository({database:createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value})});let data;
 if(request.method==='GET'){if(path){if(request.nextUrl.search)throw new AccessError(400,'unsupported_filter');data=await repository.get({id:path.id});}else data=await repository.list({query:request.nextUrl.searchParams});}
 else{if(request.nextUrl.search)throw new AccessError(400,'unsupported_filter');const raw=await request.text();if(Buffer.byteLength(raw)>32768)throw new AccessError(400,'input_too_large');let input;try{input=JSON.parse(raw);}catch{throw new AccessError(400,'input_invalid');}if(!input||typeof input!=='object'||Array.isArray(input))throw new AccessError(400,'input_invalid');if(Object.hasOwn(input,'id'))throw new AccessError(400,'input_invalid');if(path?.draft)data=await repository.createDraft({...input,id:path.id});else{const {operation,...body}=input;if(!path&&operation==='generate')data=await repository.generate(body);else if(path&&operation==='revise')data=await repository.revise({...body,id:path.id});else if(path&&operation==='state')data=await repository.setState({...body,id:path.id});else throw new AccessError(400,'operation_invalid');}}
 return finish(NextResponse.json({contract_version:version,data,meta:{trace_id:traceId}},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){const e=error as {status?:number};const status=[400,401,403,404,409,503].includes(e.status??0)?e.status!:503;return finish(NextResponse.json({contract_version:version,error:{code:'recommendation_request_failed',retryable:status===503,message:status===409?'La versión, estado o evidencia requiere revisión.':status===404?'La recomendación no está disponible en este alcance.':'No se pudo completar la operación autorizada.'},meta:{trace_id:traceId}},{status,headers:PRIVATE_HEADERS}));}
}
