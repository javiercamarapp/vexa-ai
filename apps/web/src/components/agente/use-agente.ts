'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Answer,ChatMessage,Conversation,Direct,Step} from './types';
import type {AdjuntoResumen} from './attachments';
import {loadConversations,saveConversations,titleOf} from './store';
export const PHASES:ReadonlyArray<readonly [number,string]>=[[0,'Entendiendo tu pregunta…'],[2500,'Consultando tus datos…'],[8000,'Armando la respuesta…'],[20000,'Sigo trabajando en esto…']];
const TIMEOUT_MS=75000;
/** Tiempo mínimo que se ve «pensando» antes de mostrar una respuesta correcta. */
const MIN_PENSAR_MS=2200;
const phaseAt=(ms:number)=>{let t=PHASES[0][1];for(const [from,text] of PHASES)if(ms>=from)t=text;return t;};
let counter=0;const uid=(p:string)=>`${p}-${Date.now().toString(36)}-${++counter}`;
/** Folds one server event into the live step list. Pure: exported for tests. */
export function applyEvent(prev:Step[],e:TurnEvent,labels:Record<string,string>):Step[]{
 if(e.t==='traza'&&e.paso)return [...prev,{id:e.paso.id,kind:e.paso.kind,label:e.paso.label,done:true,estado:e.paso.estado,ms:e.paso.ms,detail:e.paso.detail}];
 const tool=e.herramienta;if(e.t!=='paso'||!tool)return prev;
 if(e.fase==='fin')return prev.map(s=>s.kind==='tool'&&s.tool===tool&&!s.done?{...s,done:true,estado:e.estado,ms:e.ms,cifras:e.cifras,fuentes:e.fuentes}:s);
 return [...prev,{id:`tool:${prev.filter(s=>s.kind==='tool').length+1}`,kind:'tool',tool,label:labels[tool]??tool,done:false}];
}
const failAnswer=(status:Answer['status'],text:string):Answer=>({status,text,figures:[],blocks:[],citations:[],sources:[],calc:[],missing:[],suggestions:[],usage:{modelCalls:0,toolCalls:0,costMinor:'0',mode:'deterministic',fallback:false,guardRejected:false}});

/** Reads the NDJSON turn stream: `paso` events while tools run, then `fin` (or `error`). Also accepts a single JSON line. */
export type TurnEvent={t?:string;fase?:string;herramienta?:string;estado?:string;ms?:number|null;cifras?:number;fuentes?:string[];paso?:{id:string;kind:Step['kind'];label:string;estado:string;ms:number|null;detail?:string}};
export type Runner=(body:{question:string;history:{role:'user'|'assistant';text:string}[];conversationTurns:number;directa?:Direct},signal:AbortSignal,onEvent:(e:TurnEvent)=>void)=>Promise<Answer>;
export const failAnswerOf=failAnswer;
export async function runTurn(body:unknown,signal:AbortSignal,onEvent:(e:TurnEvent)=>void):Promise<Answer>{
 const res=await fetch('/api/agent/turn',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal,cache:'no-store'});
 if(!res.ok){
  if(res.status===401||res.status===403)return failAnswer('forbidden','Tu rol no tiene acceso a estas consultas.');
  if(res.status===400||res.status===413)return failAnswer('invalid_input','No pude leer esa pregunta; reescríbela más corta.');
  return failAnswer('unavailable','');
 }
 let final:Answer|null=null;
 const handle=(line:string)=>{
  if(!line.trim())return;let e:TurnEvent&{respuesta?:Answer;status?:Answer['status'];mensaje?:string};try{e=JSON.parse(line);}catch{return;}
  if(e.t==='paso'&&e.herramienta)onEvent(e);
  else if(e.t==='traza'&&e.paso)onEvent(e);
  else if(e.t==='fin'&&e.respuesta)final=e.respuesta;
  else if(e.t==='error')final=failAnswer(e.status??'unavailable',e.mensaje??'');
 };
 if(res.body){
  const reader=res.body.getReader(),dec=new TextDecoder();let buf='';
  for(;;){const {value,done}=await reader.read();if(value)buf+=dec.decode(value,{stream:!done});let i;while((i=buf.indexOf('\n'))>=0){handle(buf.slice(0,i));buf=buf.slice(i+1);}if(done)break;}
  handle(buf);
 }else for(const line of (await res.text()).split('\n'))handle(line);
 return final??failAnswer('unavailable','');
}

/** `opts.runner` cambia el transporte de los turnos (el copiloto de CFO usa su propio motor); `opts.modo` marca cada mensaje con el modo que lo produjo. */
export function useAgente(scope:string,maxChars:number,maxTurns:number,toolLabels:Record<string,string>={},opts:{runner?:Runner;modo?:string}={}){
 const runnerRef=useRef<Runner|undefined>(opts.runner),modoRef=useRef(opts.modo);
 useEffect(()=>{runnerRef.current=opts.runner;modoRef.current=opts.modo;});
 const [conversations,setConversations]=useState<Conversation[]>([]);
 const [activeId,setActiveId]=useState<string|null>(null);
 const [messages,setMessages]=useState<ChatMessage[]>([]);
 const [sending,setSending]=useState(false);
 const [freshId,setFreshId]=useState<string|null>(null);
 const [phase,setPhase]=useState(PHASES[0][1]);
 const [steps,setSteps]=useState<Step[]>([]);
 const busy=useRef(false),control=useRef<AbortController|null>(null),gen=useRef(0);
 const messagesRef=useRef(messages),activeRef=useRef(activeId),convRef=useRef(conversations);
 useEffect(()=>{messagesRef.current=messages;activeRef.current=activeId;convRef.current=conversations;});

 useEffect(()=>{const frame=requestAnimationFrame(()=>setConversations(loadConversations(scope)));return()=>cancelAnimationFrame(frame);},[scope]);
 useEffect(()=>{if(!sending)return;const t0=Date.now();const id=setInterval(()=>setPhase(phaseAt(Date.now()-t0)),700);return()=>clearInterval(id);},[sending]);

 const persist=useCallback((id:string,msgs:ChatMessage[])=>{
  setConversations(prev=>{
   const now=new Date().toISOString(),existing=prev.find(c=>c.id===id);
   const first=msgs.find(m=>m.role==='user');
   const next=existing?prev.map(c=>c.id===id?{...c,messages:msgs,updatedAt:now}:c):[{id,title:titleOf(first?.text??'Chat nuevo'),updatedAt:now,messages:msgs},...prev];
   next.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));saveConversations(scope,next);return next;
  });
 },[scope]);

 const turn=useCallback(async(question:string,base:ChatMessage[],directa?:Direct)=>{
  if(busy.current)return;const q=question.trim().slice(0,maxChars);if(!q)return;busy.current=true;
  const t0=Date.now(),g=++gen.current,ctl=new AbortController();control.current=ctl;let timedOut=false;const timer=setTimeout(()=>{timedOut=true;ctl.abort();},TIMEOUT_MS);
  const id=activeRef.current??uid('c');if(!activeRef.current){activeRef.current=id;setActiveId(id);}
  const modo=modoRef.current,userMsg:ChatMessage={id:uid('u'),role:'user',text:q,at:new Date().toISOString(),...(directa?{directa}:{}),...(modo?{modo}:{})};
  const withUser=[...base,userMsg];setMessages(withUser);setFreshId(null);setSteps([]);setPhase(PHASES[0][1]);setSending(true);
  const history=base.filter(m=>m.kind!=='adjunto').slice(-8).map(m=>({role:m.role,text:m.role==='assistant'?(m.answer?.text??m.text):m.text})).filter(h=>h.text);
  const turns=base.filter(m=>m.role==='user'&&m.kind!=='adjunto').length;
  let answer:Answer,cancelled=false;
  try{
   answer=await (runnerRef.current??runTurn)({question:q,history,conversationTurns:turns,...(directa?{directa}:{})},ctl.signal,e=>{if(ctl.signal.aborted)return;setSteps(prev=>applyEvent(prev,e,toolLabels));});
  }catch(e){
   if(e instanceof DOMException&&e.name==='AbortError'&&!timedOut){cancelled=true;answer=failAnswer('unavailable','');}
   else answer=failAnswer('unavailable','');
  }finally{clearTimeout(timer);}
  // «Pensando» se queda visible al menos MIN_PENSAR_MS aunque la respuesta sea inmediata (consultas directas): se siente deliberado, no un parpadeo. Un error no espera; «Detener» tampoco.
  const lento=typeof window!=='undefined'&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(lento&&!cancelled&&answer.status==='ok'){const resto=MIN_PENSAR_MS-(Date.now()-t0);if(resto>0)await new Promise<void>(r=>{const id=setTimeout(r,resto);ctl.signal.addEventListener('abort',()=>{clearTimeout(id);r();},{once:true});});}
  if(g!==gen.current)return;
  const reply:ChatMessage={id:uid('a'),role:'assistant',text:cancelled?'Cancelado.':answer.text,at:new Date().toISOString(),question:q,...(directa?{directa}:{}),...(modo?{modo}:{}),...(cancelled?{cancelled:true}:{answer})};
  const all=[...withUser,reply];setMessages(all);persist(id,all);setFreshId(cancelled?null:reply.id);
  busy.current=false;control.current=null;setSending(false);setSteps([]);
 },[maxChars,persist,toolLabels]);

 const send=useCallback((q:string,directa?:Direct)=>{
  if(messagesRef.current.filter(m=>m.role==='user'&&m.kind!=='adjunto').length>=maxTurns)return false;
  void turn(q,messagesRef.current,directa);return true;
 },[turn,maxTurns]);
 /** Adds a LOCAL attachment card to the thread. It never reaches the server and is never part of `history`. */
 const attach=useCallback((resumen:AdjuntoResumen)=>{
  const msg:ChatMessage={id:uid('f'),role:'user',kind:'adjunto',text:`Adjunto: ${resumen.name}`,at:new Date().toISOString(),adjunto:resumen};
  const id=activeRef.current??uid('c');if(!activeRef.current){activeRef.current=id;setActiveId(id);}
  const all=[...messagesRef.current,msg];setMessages(all);persist(id,all);
 },[persist]);
 const stop=useCallback(()=>control.current?.abort(),[]);
 const regenerate=useCallback(()=>{
  const list=messagesRef.current;let i=list.length-1;while(i>=0&&(list[i].role!=='user'||list[i].kind==='adjunto'))i--;
  if(i<0||busy.current)return;const last=list[i];void turn(last.text,list.slice(0,i),last.directa);
 },[turn]);
 const newChat=useCallback(()=>{gen.current++;control.current?.abort();busy.current=false;setSending(false);setSteps([]);activeRef.current=null;setActiveId(null);setMessages([]);},[]);
 const open=useCallback((id:string)=>{setFreshId(null);const c=convRef.current.find(x=>x.id===id);if(!c)return;gen.current++;control.current?.abort();busy.current=false;setSending(false);setSteps([]);activeRef.current=id;setActiveId(id);setMessages(c.messages);},[]);
 const rename=useCallback((id:string,title:string)=>setConversations(prev=>{const t=title.trim().slice(0,80);if(!t)return prev;const next=prev.map(c=>c.id===id?{...c,title:t}:c);saveConversations(scope,next);return next;}),[scope]);
 const remove=useCallback((id:string)=>{setConversations(prev=>{const next=prev.filter(c=>c.id!==id);saveConversations(scope,next);return next;});if(activeRef.current===id)newChat();},[scope,newChat]);
 const setFeedback=useCallback((messageId:string,fb:ChatMessage['feedback'])=>{
  const next=messagesRef.current.map(m=>m.id===messageId?{...m,feedback:fb}:m);setMessages(next);if(activeRef.current)persist(activeRef.current,next);
 },[persist]);
 return {conversations,activeId,messages,sending,freshId,phase,steps,send,stop,regenerate,newChat,open,rename,remove,setFeedback,turnsUsed:messages.filter(m=>m.role==='user'&&m.kind!=='adjunto').length,attach};
}
