import 'server-only';
import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
import {createCRMRuntime} from '../../../../../packages/connectors/runtime.mjs';
import {createCRMCredentialResolver} from '../../../../../packages/connectors/credentials.mjs';
export async function connectionSettings(request:NextRequest){
 let finish=(response:NextResponse)=>response;
 try{
  const configuration=config();if(!configuration)throw new AccessError(503,'configuration_required');
  if(request.method==='POST')assertOrigin(request.headers.get('origin'),configuration.origin);
  const auth=requestAuth(request);finish=auth.finish;
  const database=createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value});
  const crm=createCRMRuntime({database,resolveCredentials:createCRMCredentialResolver(process.env.VEXA_CRM_CREDENTIALS_JSON??'[]')});
  if(request.method==='GET')return finish(NextResponse.json(await crm.list(),{headers:PRIVATE_HEADERS}));
  let body;try{body=await request.json();}catch{throw new AccessError(400,'configuration_input_invalid');}
  const data=await crm.configure(body);return finish(NextResponse.json({data},{status:201,headers:PRIVATE_HEADERS}));
 }catch(error){const e=error instanceof AccessError?error:new AccessError(503,'configuration_unavailable');return finish(NextResponse.json({contract_version:'f03-crm-v1',error:{code:e.code,message:'No se pudo consultar o guardar la configuración.',retryable:e.status===503},meta:{trace_id:randomUUID()}},{status:e.status,headers:PRIVATE_HEADERS}));}
}
