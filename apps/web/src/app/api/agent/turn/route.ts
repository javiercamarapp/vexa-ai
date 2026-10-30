import {NextRequest,NextResponse} from 'next/server';
import {AccessError,PRIVATE_HEADERS} from '../../../../lib/auth';
import {mensajesDe} from '../../../../lib/i18n/errores-api';
import {agent,agentContext,failure,jsonBody,knownRole,parseDirect} from '../../../../lib/agent/server';
import {admitirTurnoDurable} from '../../../../lib/agent/cupo-durable';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
/** One turn as NDJSON: `paso` events while tools run, then a single `fin` with the verified answer (or `error`). */
export async function POST(request:NextRequest){
 let finish=(r:NextResponse)=>r;const m=mensajesDe(request);
 try{
  const c=await agentContext(request,true);finish=c.finish;
  if(!knownRole(c.ctx.role))return failure(new AccessError(403,'forbidden'),finish,request);
  const body=await jsonBody(request,['question','history','directa','conversationTurns']);
  // R2-12: cupo diario por (organización, usuario) compartido entre instancias; sin base cae al límite en memoria del agente.
  if(await admitirTurnoDurable(c.ctx.tenantId,c.ctx.userId)==='limite')return failure(new AccessError(429,'daily_limit'),finish,request);
  const question=typeof body.question==='string'?body.question:'';
  const turns=Number.isInteger(body.conversationTurns)?Math.max(0,Math.min(1000,body.conversationTurns as number)):0;
  const directa=parseDirect(body.directa);
  const history=Array.isArray(body.history)?body.history:[];
  const encoder=new TextEncoder();
  const stream=new ReadableStream<Uint8Array>({async start(controller){
   const send=(o:unknown)=>{try{controller.enqueue(encoder.encode(JSON.stringify(o)+'\n'));}catch{/* client went away */}};
   try{
    const answer=await agent.answer({ctx:c.ctx,port:c.port,question,history,directa,conversationTurns:turns,onEvent:send,signal:request.signal});
    const {violations,...wire}=answer;void violations;
    send({t:'fin',respuesta:wire});
   }catch(e){send({t:'error',status:'unavailable',mensaje:e instanceof Error&&e.name==='AbortError'?m('tr.err.agCancelado'):m('tr.err.agNoDisponible')});}
   finally{try{controller.close();}catch{/* already closed */}}
  }});
  return finish(new NextResponse(stream,{headers:{...PRIVATE_HEADERS,'Content-Type':'application/x-ndjson; charset=utf-8','X-Accel-Buffering':'no'}}));
 }catch(error){return failure(error,finish,request);}
}
