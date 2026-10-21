// GET acotado de «mappings» y «customer-bindings» (resumen + página ≤100 con cursor). POST sigue en el servicio de siempre.
import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {createWorkspaceViews} from '../../../../../../../packages/metrics/workspace-views.mjs';
import {sourceCustomer} from '../../../../../../../packages/workspace-service/detail.mjs';
import {serverPool} from '../../../../lib/imports/server';
import {ACTIVE_ORG,AccessError,config,identity,PRIVATE_HEADERS} from '../../../../lib/auth';
import {requestAuth} from '../../../../lib/auth-http';
import {economicErrorResponse} from '../../economics/query';
const ALLOWED:Record<string,string[]>={mappings:['limit','cursor','q'],customers:['limit','cursor','q','customerQ']};
export async function boundedWorkspaceGet(request:NextRequest,kind:'mappings'|'customers'){
 const traceId=randomUUID(),version='f06-workspace-v2';let finish=(r:NextResponse)=>r;
 try{
  if(!config())return NextResponse.json({contract_version:version,error:{code:'configuration_required',retryable:true,message:'La configuración del servidor del espacio de trabajo no está disponible.'},meta:{trace_id:traceId}},{status:503,headers:PRIVATE_HEADERS});
  const params=request.nextUrl.searchParams;for(const k of params.keys())if(!ALLOWED[kind].includes(k)||params.getAll(k).length!==1)throw new AccessError(400,'unsupported_filter');
  const auth=requestAuth(request);finish=auth.finish;
  const views=createWorkspaceViews({database:createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value}),sourceCustomer});
  const input:Record<string,string|number|undefined>={cursor:params.get('cursor')??undefined,q:params.get('q')??undefined,customerQ:params.get('customerQ')??undefined};
  if(params.has('limit')){if(!/^\d{1,3}$/.test(params.get('limit')!))throw new AccessError(400,'limit_invalid');input.limit=Number(params.get('limit'));}
  const data=kind==='mappings'?await views.mappings(input):await views.customerBindings(input);
  return finish(NextResponse.json({contract_version:version,data,meta:{trace_id:traceId}},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){const r=economicErrorResponse(error);return finish(NextResponse.json({contract_version:version,error:{...r.body.error,code:r.status===504?'economic_query_timeout':'workspace_request_failed'},meta:{trace_id:traceId}},{status:r.status,headers:{...PRIVATE_HEADERS,...r.headers}}));}
}
