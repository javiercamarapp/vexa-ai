import {NextRequest,NextResponse} from 'next/server';
import {AccessError,PRIVATE_HEADERS} from '../../../../lib/auth';
import {mensajesDe} from '../../../../lib/i18n/errores-api';
import {TOOLS} from '../../../../../../../packages/agent-datos/index.mjs';
import {LIMITS,agent,agentContext,buildSuggestions,failure,knownRole} from '../../../../lib/agent/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
/** Availability + role + suggestions built from the REAL coverage (only questions about loaded data are offered). */
export async function GET(request:NextRequest){
 let finish=(r:NextResponse)=>r;const m=mensajesDe(request);
 try{
  if(request.nextUrl.search)return failure(new AccessError(400,'unsupported_filter'),finish,request);
  const c=await agentContext(request,false);finish=c.finish;
  if(!knownRole(c.ctx.role))return failure(new AccessError(403,'forbidden'),finish,request);
  const coverage=await c.port.coverage();
  const evidence=c.ctx.role==='analyst'||c.ctx.role==='owner';
  return finish(NextResponse.json({data:{available:true,mode:agent.model.kind==='deterministic'?'deterministic':'model',role:c.ctx.role,scope:c.ctx.tenantId.slice(0,8),toolLabels:Object.fromEntries(TOOLS.map(t=>[t.name,t.label])),canSeeEvidence:evidence,suggestions:buildSuggestions(coverage,c.ctx.role),limits:{maxQuestionChars:LIMITS.maxQuestionChars,maxHistory:LIMITS.maxHistory,maxTurnsPerConversation:LIMITS.maxTurnsPerConversation},note:m('tr.err.agNota')}},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){return failure(error,finish,request);}
}
