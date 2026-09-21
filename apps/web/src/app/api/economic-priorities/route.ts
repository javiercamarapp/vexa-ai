import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {createPriorityRepository} from '../../../../../../packages/metrics/priority.mjs';
import {serverPool} from '../../../lib/imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../../../lib/auth';
import {requestAuth} from '../../../lib/auth-http';
export const runtime='nodejs';export const dynamic='force-dynamic';
async function handle(request:NextRequest){let finish=(r:NextResponse)=>r;const trace_id=randomUUID();try{const configuration=config();if(!configuration)return NextResponse.json({contract_version:'f05-priority-v1',error:{code:'configuration_required',retryable:true,message:'La configuración de prioridad no está disponible.'},meta:{trace_id}},{status:503,headers:PRIVATE_HEADERS});if(request.method==='POST')assertOrigin(request.headers.get('origin'),configuration.origin);const auth=requestAuth(request);finish=auth.finish;const repo=createPriorityRepository({database:createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value})});let data;
 if(request.method==='GET'){const params=request.nextUrl.searchParams;if([...params.keys()].some(k=>k!=='snapshotId'||params.getAll(k).length!==1))throw new AccessError(400,'unsupported_filter');data=await repo.view({snapshotId:params.get('snapshotId')??''});}
 else {if(request.nextUrl.search)throw new AccessError(400,'unsupported_filter');const raw=await request.text();if(Buffer.byteLength(raw)>32768)throw new AccessError(400,'input_too_large');let q;try{q=JSON.parse(raw);}catch{throw new AccessError(400,'input_invalid');}if(!q||Array.isArray(q)||typeof q!=='object')throw new AccessError(400,'input_invalid');const {operation,...input}=q;if(operation==='policy')data=await repo.recordPolicy(input);else if(operation==='actionability')data=await repo.recordActionability(input);else if(operation==='rank')data=await repo.rank(input);else throw new AccessError(400,'operation_invalid');}
 return finish(NextResponse.json({contract_version:'f05-priority-v1',data,meta:{trace_id}},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){const e=error as {status?:number};const status=[400,401,403,404,409,503].includes(e.status??0)?e.status!:503;return finish(NextResponse.json({contract_version:'f05-priority-v1',error:{code:'priority_request_failed',retryable:status===503,message:status===409?'La versión o evidencia cambió. Actualiza y revisa antes de continuar.':'No se pudo consultar o guardar la prioridad.'},meta:{trace_id}},{status,headers:PRIVATE_HEADERS}));}}
export const GET=handle;export const POST=handle;
