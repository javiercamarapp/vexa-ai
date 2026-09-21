import 'server-only';
import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {createProblemRepository} from '../../../../../packages/problems/repository.mjs';
import {createProblemConfigResolver} from '../../../../../packages/problems/runtime.mjs';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
const headers={...PRIVATE_HEADERS,Vary:'Cookie'};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const invalid=()=>new AccessError(400,'problem_input_invalid');
function object(value:unknown,keys:string[]):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))throw invalid();return value as Record<string,unknown>;}
export async function problems(request:NextRequest,problemId?:string){
 let finish=(r:NextResponse)=>r;
 try{
  const configuration=config();if(!configuration)throw new AccessError(503,'configuration_required');
  if(request.method==='POST')assertOrigin(request.headers.get('origin'),configuration.origin);
  const auth=requestAuth(request);finish=auth.finish;
  const database=createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value});
  const repository=createProblemRepository({database});const context=await database.transaction('read',async s=>({tenantId:s.tenantId,role:s.role}));
  if([...request.nextUrl.searchParams].length)throw invalid();
  if(problemId!==undefined){if(!uuid(problemId)||request.method!=='GET')throw invalid();return finish(NextResponse.json({problem:await repository.detail({problemId})},{headers}));}
  let runtimeConfig:ReturnType<ReturnType<typeof createProblemConfigResolver>>|null;try{runtimeConfig=createProblemConfigResolver(process.env.VEXA_PROBLEMS_CONFIG_JSON??'[]')(context.tenantId);}catch{runtimeConfig=null;}
  const canSubmit=['owner','analyst'].includes(context.role),canRestructure=context.role==='owner';
  if(request.method==='GET'){
   const [items,sources,jobs]=await Promise.all([repository.list(),canSubmit?repository.sources():[],repository.jobs()]);
   return finish(NextResponse.json({problems:items,sources,jobs,canSubmit,canRestructure,configuration:{ready:!!runtimeConfig,enabled:process.env.VEXA_PROBLEMS_RUNTIME==='enabled'}},{headers}));
  }
  const raw=await request.text();if(Buffer.byteLength(raw)>32768)throw invalid();let parsed:unknown;try{parsed=JSON.parse(raw);}catch{throw invalid();}
  const body=object(parsed,['operation','extractionRunId','requestKey','embeddingId','limit','parents','children','reason','approved']);let data;
  if(body.operation==='submit'){
   object(body,['operation','extractionRunId','requestKey']);if(!canSubmit)throw new AccessError(403,'role_insufficient');if(!uuid(body.extractionRunId)||!uuid(body.requestKey))throw invalid();if(!runtimeConfig)throw new AccessError(503,'configuration_required');if(process.env.VEXA_PROBLEMS_RUNTIME!=='enabled')throw new AccessError(503,'runtime_disabled');
   data=await repository.submit({extractionRunId:body.extractionRunId,requestKey:body.requestKey,configHash:runtimeConfig.hash});
  }else if(body.operation==='retrieve'){
   object(body,['operation','embeddingId','limit']);if(!uuid(body.embeddingId)||body.limit!==undefined&&(!Number.isInteger(body.limit)||(body.limit as number)<1||(body.limit as number)>50))throw invalid();data=await repository.retrieve({embeddingId:body.embeddingId,limit:body.limit as number|undefined});
  }else if(body.operation==='split'||body.operation==='merge'){
   object(body,['operation','parents','children','reason','approved']);if(!canRestructure)throw new AccessError(403,'role_insufficient');if(body.approved!==true||typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>1000||!Array.isArray(body.parents)||!Array.isArray(body.children)||body.parents.length<1||body.parents.length>10||body.children.length<1||body.children.length>10)throw invalid();
   const parents=body.parents.map(value=>{const p=object(value,['problemId','expectedVersion']);if(!uuid(p.problemId)||!Number.isSafeInteger(p.expectedVersion)||((p.expectedVersion as number)<1||(p.expectedVersion as number)>=2147483647))throw invalid();return{problemId:p.problemId,expectedVersion:p.expectedVersion as number};});
   const children=body.children.map(value=>{const c=object(value,['label','embeddingIds']);if(typeof c.label!=='string'||!c.label.trim()||c.label.length>200||!Array.isArray(c.embeddingIds)||!c.embeddingIds.length||c.embeddingIds.length>1000||!c.embeddingIds.every(uuid))throw invalid();return{label:c.label.trim(),embeddingIds:c.embeddingIds as string[]};});
   if(new Set(parents.map(p=>p.problemId)).size!==parents.length||children.some(c=>new Set(c.embeddingIds).size!==c.embeddingIds.length))throw invalid();
   if(body.operation==='split'&&(parents.length!==1||children.length<2)||body.operation==='merge'&&(parents.length<2||children.length!==1))throw invalid();
   data=await repository.restructure({operation:body.operation,parents,children,reason:body.reason.trim(),approved:true});
  }else throw invalid();
  return finish(NextResponse.json({data},{status:body.operation==='submit'?202:200,headers}));
 }catch(error){
  const e=error as {status?:number;code?:string};const status=[400,401,403,404,409,503].includes(e.status??0)?e.status!:503;
  const known=new Set(['configuration_required','runtime_disabled','problem_input_invalid','role_insufficient','organization_not_authorized','authentication_required','problem_not_found','problem_conflict','database_conflict']);
  return finish(NextResponse.json({contract_version:'f04-problems-v1',error:{code:known.has(e.code??'')?e.code:'problems_unavailable',message:'No se pudo consultar o modificar los problemas.',retryable:status===503},meta:{trace_id:randomUUID()}},{status,headers}));
 }
}
