import { readRequestText } from '../../../lib/request-body';
import {constrainEconomicTenant} from '../../../lib/economic-import/tenant-guard';
import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {createMoneyRepository} from '../../../../../../packages/metrics/money-repository.mjs';
import {createExposureRepository} from '../../../../../../packages/metrics/exposure.mjs';
import {createEconomicRepository} from '../../../../../../packages/metrics/repository.mjs';
import {serverPool} from '../../../lib/imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../../../lib/auth';
import {requestAuth} from '../../../lib/auth-http';
import {idiomaDePeticion,mensajesDe} from '../../../lib/i18n/errores-api';
import {parseEconomicsQuery,economicErrorResponse,QueryRejected} from './query';
export const runtime='nodejs';export const dynamic='force-dynamic';
async function handle(request:NextRequest){let finish=(r:NextResponse)=>r;const m=mensajesDe(request);try{
 const configuration=config();if(!configuration)return NextResponse.json({contract_version:'f05-economics-v1',error:{code:'configuration_required',message:m('tr.err.cfgEconomico'),retryable:true},meta:{trace_id:randomUUID()}},{status:503,headers:PRIVATE_HEADERS});if(request.method==='POST')assertOrigin(request.headers.get('origin'),configuration.origin);
 const auth=requestAuth(request);finish=auth.finish;const database=constrainEconomicTenant(createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value}),request.method==='POST'?request.headers.get('X-Economic-Import-Tenant'):null);const repository=createEconomicRepository({database});const exposure=createExposureRepository({database});const money=createMoneyRepository({database});let data;
 if(request.method==='GET'){let q;try{q=parseEconomicsQuery(request.nextUrl.searchParams);}catch(e){if(e instanceof QueryRejected)throw new AccessError(e.status,e.code);throw e;}
  if(q.view==='page')data=await repository.page({...(q.limit!==undefined?{limit:q.limit}:{}),...(q.cursor!==undefined?{cursor:q.cursor}:{}),filters:q.filters});
  else if(q.view==='history')data=await repository.entityHistory({entityId:q.entityId!});
  else if(q.view==='exposure')data=await repository.exposure({scope:q.scope!});
  else if(q.view==='overview')data=await repository.overview({scope:q.scope!,...(q.fxRateId?{fxRateId:q.fxRateId}:{}),...(q.limit!==undefined?{limit:q.limit}:{})});
  else data=await repository.view({scope:q.scope!,...(q.fxRateId?{fxRateId:q.fxRateId}:{})});
 }else{if(request.nextUrl.search)throw new AccessError(400,'unsupported_filter');const raw=await readRequestText(request, 32768);if(Buffer.byteLength(raw)>32768)throw new AccessError(400,'input_too_large');let parsed;try{parsed=JSON.parse(raw);}catch{throw new AccessError(400,'input_invalid');}if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw new AccessError(400,'input_invalid');const {operation,...input}=parsed;if(operation==='source')data=await repository.recordSource(input);else if(operation==='record')data=await repository.record(input);else if(operation==='link')data=await exposure.record(input);else if(operation==='orderAlias')data=await exposure.recordAlias(input);else if(operation==='orderCustomer')data=await exposure.recordCustomer(input);else if(operation==='relationCoverage')data=await exposure.recordCoverage(input);else if(operation==='currency')data=await money.recordCurrency(input);else if(operation==='fxRate')data=await money.recordFxRate(input);else throw new AccessError(400,'operation_invalid');}
 return finish(NextResponse.json({data},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){const r=economicErrorResponse(error,idiomaDePeticion(request));return finish(NextResponse.json(r.body,{status:r.status,headers:{...PRIVATE_HEADERS,...r.headers}}));}}
export const GET=handle;export const POST=handle;
