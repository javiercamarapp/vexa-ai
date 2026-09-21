import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {createCausalityRepository} from '../../../../../../../../packages/problems/causality.mjs';
import {serverPool} from '../../../../../lib/imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../../../../../lib/auth';
import {requestAuth} from '../../../../../lib/auth-http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handle(request:NextRequest,context:{params:Promise<{id:string}>}){
 let finish=(r:NextResponse)=>r;
 try{
 const configuration=config();if(!configuration)throw new AccessError(503,'configuration_required');
 if(request.method==='POST')assertOrigin(request.headers.get('origin'),configuration.origin);
 const auth=requestAuth(request);finish=auth.finish;const {id}=await context.params;
 if(!/^[a-f0-9-]{36}$/i.test(id)||request.nextUrl.search)throw new AccessError(400,'input_invalid');
 const database=createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value});const repository=createCausalityRepository({database});
 let data;if(request.method==='GET')data=await repository.get({problemId:id});else{
 const raw=await request.text();if(Buffer.byteLength(raw)>32768)throw new AccessError(400,'input_invalid');let body;try{body=JSON.parse(raw);}catch{throw new AccessError(400,'input_invalid');}
 const keys=body?.operation==='evidence'?['operation','expectedVersion','expectedEvidenceVersion','recordId','sourceKind','observedAt','report','stance','facts','status','attested']:body?.operation==='revise'?['operation','expectedVersion','symptom','probableCause','state','evidenceIds','reason','approved']:[];
 if(!body||Array.isArray(body)||!keys.length||Object.keys(body).some(k=>!keys.includes(k)))throw new AccessError(400,'input_invalid');
 data=body.operation==='evidence'?await repository.recordEvidence({...body,problemId:id}):await repository.revise({...body,problemId:id});
 }
 return finish(NextResponse.json({data},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){const e=error as {status?:number};const status=[400,401,403,404,409,503].includes(e.status??0)?e.status!:503;return finish(NextResponse.json({error:{code:'causality_unavailable',message:'No se pudo consultar o actualizar la evaluación causal.'}},{status,headers:PRIVATE_HEADERS}));}
}
export const GET=handle;
export const POST=handle;
