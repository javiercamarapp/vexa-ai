import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
import {createProblemFactsRepository} from '../../../../../packages/workspace-service/problem-facts.mjs';
/** Ficha de un problema (conversaciones, citas registradas, críticos, adjuntos, recomendación). Solo GET, misma frontera de sesión/RLS que las demás vistas. */
export async function problemFacts(request:NextRequest,problemId:string){
 let finish=(r:NextResponse)=>r;
 try{
  if(!config())throw new AccessError(503,'configuration_required');
  const keys=[...request.nextUrl.searchParams.entries()];
  if(!/^[a-f0-9-]{36}$/i.test(problemId)||keys.length>1||keys.some(([k,v])=>k!=='parts'||v!=='themes'))throw new AccessError(400,'input_invalid');
  const auth=requestAuth(request);finish=auth.finish;
  const database=createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value});
  const data=await createProblemFactsRepository({database}).get({problemId,parts:keys.length?['themes']:null});
  return finish(NextResponse.json({data},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){
  const e=error as {status?:number};const status=[400,401,403,404,503].includes(e.status??0)?e.status!:503;
  return finish(NextResponse.json({error:{code:status===503?'problem_facts_unavailable':'request_rejected'}},{status,headers:PRIVATE_HEADERS}));
 }
}
