import 'server-only';
import {randomUUID} from 'node:crypto';
import {cookies} from 'next/headers';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {createWorkspaceService,workspaceCsv} from '../../../../../packages/workspace-service/index.mjs';
import {AccessError,ACTIVE_ORG,authClient,identity,resolveSession,assertOrigin,config,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
import {serverPool} from '../imports/server';
import type {ReadPort} from './data';
import type {Resource} from './contracts';
export async function workspaceSession(){const jar=await cookies();const client=authClient({getAll:()=>jar.getAll(),set:()=>{}});const session=await resolveSession(identity(client),jar.get(ACTIVE_ORG)?.value);return {client,session};}
interface WorkspacePort extends ReadPort{resourceScope(input:{resource:Resource;id:string}):Promise<Record<string,string|string[]|null>>;}
export function workspaceService(client:ReturnType<typeof authClient>,selectedTenant?:string):WorkspacePort{
 const service=createWorkspaceService({database:createDatabase({identity:identity(client),pool:serverPool(),selectedTenant})});
 return {query:service.query,async resolveSnapshot(){throw new AccessError(503,'workspace_resource_unavailable');},async read(){throw new AccessError(503,'workspace_resource_unavailable');},async resourceScope(){throw new AccessError(503,'workspace_resource_unavailable');}};
}
export async function workspaceResponse(request:NextRequest,mode:'query'|'export'|'mappings'='query'){
 const traceId=randomUUID();const contractVersion='f06-workspace-v1';let finish=(r:NextResponse)=>r;try{
 const configuration=config();if(!configuration)return NextResponse.json({contract_version:contractVersion,error:{code:'configuration_required',retryable:true,message:'La configuración del servidor del espacio de trabajo no está disponible.'},meta:{trace_id:traceId}},{status:503,headers:PRIVATE_HEADERS});
 if(request.method==='POST')assertOrigin(request.headers.get('origin'),configuration.origin);const auth=requestAuth(request);finish=auth.finish;const service=createWorkspaceService({database:createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value})});
 let data;
 if(mode==='mappings'){
  if(request.nextUrl.search)throw new AccessError(400,'unsupported_filter');
  if(request.method==='GET')data=await service.mappings();else{const raw=await request.text();if(Buffer.byteLength(raw)>32768)throw new AccessError(400,'input_too_large');let input;try{input=JSON.parse(raw);}catch{throw new AccessError(400,'input_invalid');}data=await service.recordMapping(input);}
 }else{
  const params=request.nextUrl.searchParams;if(mode==='export'){if(!params.get('snapshot_id')||!params.get('scope_hash')||!['json','csv'].includes(params.get('format')??'')||params.has('cursor'))throw new AccessError(400,'export_scope_required');}else if(params.has('format'))throw new AccessError(400,'unsupported_filter');
  data=await service.query(params,{all:mode==='export'});
  if(mode==='export'){const format=params.get('format')!;return finish(new NextResponse(format==='json'?JSON.stringify(data):workspaceCsv(data),{headers:{...PRIVATE_HEADERS,'Content-Type':format==='json'?'application/json':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="workspace-${data.meta.snapshot_id}-${data.meta.scope_hash}.${format}"`,'X-Snapshot-Id':data.meta.snapshot_id!,'X-Workspace-Scope':data.meta.scope_hash!,'X-Trace-Id':traceId,'X-Contract-Version':contractVersion}}));}
 }
 return finish(NextResponse.json({contract_version:contractVersion,data,meta:{trace_id:traceId}},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){const e=error as {status?:number};const status=[400,401,403,404,409,503].includes(e.status??0)?e.status!:503;return finish(NextResponse.json({contract_version:contractVersion,error:{code:'workspace_request_failed',retryable:status===503,message:status===409?'El alcance o su versión requiere revisión.':'No se pudo consultar el espacio de trabajo.'},meta:{trace_id:traceId}},{status,headers:PRIVATE_HEADERS}));}
}
