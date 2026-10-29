import {NextRequest,NextResponse} from 'next/server';
import {AccessError,PRIVATE_HEADERS} from '../../../../lib/auth';
import {agentContext,failure,jsonBody,knownRole} from '../../../../lib/agent/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
const REASONS=['incorrecto','incompleto','sin_fuente','otro'];
/** Validates and acknowledges feedback. Persistence needs the `agent_feedback` table (not applied): until then the answer says so honestly. */
export async function POST(request:NextRequest){
 let finish=(r:NextResponse)=>r;
 try{
  const c=await agentContext(request,true);finish=c.finish;
  if(!knownRole(c.ctx.role))return failure(new AccessError(403,'forbidden'),finish,request);
  const b=await jsonBody(request,['messageId','verdict','reason','comment'],2048);
  const ok=typeof b.messageId==='string'&&/^[\w-]{1,64}$/.test(b.messageId)&&(b.verdict==='up'||b.verdict==='down')&&(b.reason===undefined||(typeof b.reason==='string'&&REASONS.includes(b.reason)))&&(b.comment===undefined||(typeof b.comment==='string'&&b.comment.length<=280&&!/[\u0000-\u001f]/.test(b.comment)));
  if(!ok)return failure(new AccessError(400,'input_invalid'),finish,request);
  return finish(NextResponse.json({data:{accepted:true,persisted:false,reason:'agent_feedback_table_not_applied'}},{status:202,headers:PRIVATE_HEADERS}));
 }catch(error){return failure(error,finish,request);}
}
