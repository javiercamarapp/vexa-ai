import 'server-only';
import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {createAliasRepository} from '../../../../../packages/connectors/aliases.mjs';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const invalid=()=>new AccessError(400,'alias_input_invalid');
export async function aliases(request:NextRequest){
 let finish=(response:NextResponse)=>response;
 try{
  const configuration=config();if(!configuration)throw new AccessError(503,'configuration_required');
  if(request.method==='POST')assertOrigin(request.headers.get('origin'),configuration.origin);
  const auth=requestAuth(request);finish=auth.finish;
  const database=createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value});
  const repository=createAliasRepository({database});
  if(request.method==='GET'){
   const params=request.nextUrl.searchParams;
   if([...params.keys()].some(key=>!['cursor','sourceConversationId'].includes(key)))throw invalid();
   const selected=params.get('sourceConversationId');
   if(selected!==null){if(!uuid(selected)||params.has('cursor'))throw invalid();return finish(NextResponse.json({history:await repository.history({sourceConversationId:selected})},{headers:PRIVATE_HEADERS}));}
   const cursor=params.get('cursor');if(cursor!==null&&!uuid(cursor))throw invalid();
   const listing=await database.transaction('read',async scope=>{
    const rows=(await scope.query<{id:string;source:string;accountId:string;externalId:string;revisionState:string|null}>(`SELECT c.id,c.source,x.account_id AS "accountId",c.external_id AS "externalId",h.state AS "revisionState" FROM public.conversations c JOIN public.connections x ON x.tenant_id=c.tenant_id AND x.id=c.connection_id LEFT JOIN public.source_heads h ON h.tenant_id=c.tenant_id AND h.id=c.id WHERE c.tenant_id=$1 AND ($2::uuid IS NULL OR c.id>$2::uuid) ORDER BY c.id LIMIT 101`,[scope.tenantId,cursor])).rows;
    return {conversations:rows.slice(0,100),nextCursor:rows.length>100?rows[99].id:null,canPropose:['owner','analyst','operator'].includes(scope.role),canApprove:scope.role==='owner'};
   });
   let groups:Awaited<ReturnType<typeof repository.list>>|null=null;
   try{groups=await repository.list();}catch(error){if(!(error instanceof AccessError&&error.status===409))throw error;}
   return finish(NextResponse.json({...listing,groups,projectionState:groups===null?'unresolved':'resolved'},{headers:PRIVATE_HEADERS}));
  }
  let input:unknown;try{input=await request.json();}catch{throw invalid();}
  if(!input||typeof input!=='object'||Array.isArray(input))throw invalid();
  const body=input as Record<string,unknown>;
  if(Object.keys(body).some(key=>!['operation','sourceConversationId','targetConversationId','expectedVersion','evidenceRef','reason','approved'].includes(key))||!uuid(body.sourceConversationId))throw invalid();
  if(body.operation==='propose'){
   if(!uuid(body.targetConversationId)||body.sourceConversationId===body.targetConversationId)throw invalid();
   return finish(NextResponse.json({proposal:await repository.propose({sourceConversationId:body.sourceConversationId,targetConversationId:body.targetConversationId})},{headers:PRIVATE_HEADERS}));
  }
  if(!['confirm','undo'].includes(String(body.operation))||body.approved!==true||!Number.isSafeInteger(body.expectedVersion)||(body.expectedVersion as number)<0||(body.expectedVersion as number)>=2147483647||typeof body.evidenceRef!=='string'||!body.evidenceRef.trim()||body.evidenceRef.length>2000||typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>1000)throw invalid();
  const approval={sourceConversationId:body.sourceConversationId,expectedVersion:body.expectedVersion as number,evidenceRef:body.evidenceRef,reason:body.reason,approved:true as const};
  if(body.operation==='confirm'&&(!uuid(body.targetConversationId)||body.targetConversationId===body.sourceConversationId))throw invalid();
  const event=body.operation==='confirm'?await repository.confirm({...approval,targetConversationId:body.targetConversationId as string}):await repository.undo(approval);
  return finish(NextResponse.json({event},{status:201,headers:PRIVATE_HEADERS}));
 }catch(error){
  const failure=error instanceof AccessError?error:(error as {code?:string})?.code==='23514'?new AccessError(409,'alias_conflict'):new AccessError(503,'alias_unavailable');
  return finish(NextResponse.json({contract_version:'f03-alias-v1',error:{code:failure.code,message:'No se pudo consultar o modificar el alias.',retryable:failure.status===503},meta:{trace_id:randomUUID()}},{status:failure.status,headers:PRIVATE_HEADERS}));
 }
}
