import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {createEconomicRepository} from '../../../../../../packages/metrics/repository.mjs';
import {serverPool} from '../../../lib/imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../../../lib/auth';
import {requestAuth} from '../../../lib/auth-http';
export const runtime='nodejs';export const dynamic='force-dynamic';
async function handle(request:NextRequest){let finish=(r:NextResponse)=>r;try{
 const configuration=config();if(!configuration)throw new AccessError(503,'configuration_required');if(request.method==='POST')assertOrigin(request.headers.get('origin'),configuration.origin);
 const auth=requestAuth(request);finish=auth.finish;const repository=createEconomicRepository({database:createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value})});let data;
 if(request.method==='GET'){const params=request.nextUrl.searchParams;for(const key of params.keys())if(!['start','end','currency','exponent','basis'].includes(key)||params.getAll(key).length!==1)throw new AccessError(400,'unsupported_filter');const exponent=params.get('exponent');if(!exponent||!/^\d$/.test(exponent))throw new AccessError(400,'scope_required');data=await repository.list({scope:{start:params.get('start')??'',end:params.get('end')??'',currency:params.get('currency')??'',exponent:Number(exponent),basis:params.get('basis')??'',timezone:'UTC',dateBasis:'occurred_at'}});
 }else{if(request.nextUrl.search)throw new AccessError(400,'unsupported_filter');const raw=await request.text();if(Buffer.byteLength(raw)>32768)throw new AccessError(400,'input_too_large');let parsed;try{parsed=JSON.parse(raw);}catch{throw new AccessError(400,'input_invalid');}if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw new AccessError(400,'input_invalid');const {operation,...input}=parsed;if(operation==='source')data=await repository.recordSource(input);else if(operation==='record')data=await repository.record(input);else throw new AccessError(400,'operation_invalid');}
 return finish(NextResponse.json({data},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){const e=error as {status?:number};const status=[400,401,403,404,409,503].includes(e.status??0)?e.status!:503;return finish(NextResponse.json({error:{code:'economic_request_failed',message:status===409?'La versión, identidad o fuente requiere revisión.':'No se pudo completar la consulta económica.'}},{status,headers:PRIVATE_HEADERS}));}}
export const GET=handle;export const POST=handle;
