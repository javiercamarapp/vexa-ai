'use client';
import './agente.css';
import {useCallback,useEffect,useId,useRef,useState} from 'react';
import {Button,LinkButton} from '../ui/button';
import {Icon} from './icons';
import {Composer} from './composer';
import {ChatSidebar} from './chat-sidebar';
import {AttachmentCard} from './attachment-card';
import {LiveTrace} from './trace';
import {ParticleField} from './particle-field';
import {RovaqMark,RovaqWordmark} from './rovaq-mark';
import {analizarAdjunto,validarArchivo} from './attachments';
import {AnswerView} from './answer-view';
import {useAgente} from './use-agente';
import type {AgentState} from './types';

type Load={kind:'loading'}|{kind:'error'}|{kind:'forbidden'}|{kind:'ready';data:AgentState};

export function Agente(){
 const [load,setLoad]=useState<Load>({kind:'loading'}),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const ctl=new AbortController();
  void (async()=>{
   try{
    const r=await fetch('/api/agent/state',{cache:'no-store',signal:ctl.signal});
    if(r.status===401||r.status===403){setLoad({kind:'forbidden'});return;}
    if(!r.ok)throw Error(String(r.status));
    const j=await r.json();if(!j?.data?.suggestions)throw Error('shape');
    setLoad({kind:'ready',data:j.data});
   }catch{if(!ctl.signal.aborted)setLoad({kind:'error'});}
  })();
  return()=>ctl.abort();
 },[attempt]);
 if(load.kind==='loading')return <div className="agente" aria-busy="true"><div role="status" className="state-panel skeleton-panel"><span className="sr-only">Preparando la consulta…</span><span className="skeleton skeleton-line"/><span className="skeleton skeleton-bar"/><span className="skeleton skeleton-line"/></div></div>;
 if(load.kind==='error')return <div className="agente"><div role="alert" className="state state-error agente-gate"><h1>No se pudo abrir «Pregúntale a tus datos»</h1><p>No pude verificar si la consulta está disponible. Revisa tu conexión e inténtalo de nuevo.</p><Button icon={<Icon name="refresh"/>} onClick={()=>{setLoad({kind:'loading'});setAttempt(n=>n+1);}}>Reintentar</Button></div></div>;
 if(load.kind==='forbidden')return <div className="agente"><div role="status" className="state agente-gate"><span className="agente-mark" aria-hidden="true"><Icon name="lock" size={22}/></span><h1>Sin acceso</h1><p>Tu rol no tiene acceso a estas consultas. Pídele acceso al administrador de tu espacio de trabajo.</p><LinkButton href="/overview" icon={<Icon name="arrow"/>}>Volver al resumen</LinkButton></div></div>;
 return <Chat data={load.data}/>;
}

function useNarrow(){
 const [narrow,setNarrow]=useState(false);
 useEffect(()=>{const m=window.matchMedia('(max-width: 1023px)');const f=()=>setNarrow(m.matches);f();m.addEventListener('change',f);return()=>m.removeEventListener('change',f);},[]);
 return narrow;
}

function Chat({data}:{data:AgentState}){
 const a=useAgente(data.scope,data.limits.maxQuestionChars,data.limits.maxTurnsPerConversation,data.toolLabels);
 const [text,setText]=useState(''),[consult,setConsult]=useState(false),[menu,setMenu]=useState(false),[attachError,setAttachError]=useState<string|null>(null);
 const narrow=useNarrow();
 const sideId=useId(),catId=useId(),inputId=useId();
 const end=useRef<HTMLDivElement>(null),menuButton=useRef<HTMLSpanElement>(null);
 const has=a.messages.length>0;
 const s=data.suggestions;
 useEffect(()=>{end.current?.scrollIntoView?.({block:'end'});},[a.messages.length,a.sending]);
 const ask=useCallback((q:string)=>{const t=q.trim().slice(0,data.limits.maxQuestionChars);if(!t||a.sending)return;setText('');setConsult(false);setAttachError(null);a.send(t,s.directas[t]);},[a,data.limits.maxQuestionChars,s.directas]);
 const closeMenu=useCallback(()=>{setMenu(false);menuButton.current?.querySelector('button')?.focus();},[]);
 const attach=useCallback(async(file:File)=>{
  const bad=validarArchivo(file.name,file.size);if(bad){setAttachError(bad);return;}
  try{
   const r=analizarAdjunto(file.name,await file.text(),file.size,`adj-${Date.now().toString(36)}`);
   if(!r.ok){setAttachError(r.error);return;}
   setAttachError(null);a.attach(r.resumen);
  }catch{setAttachError('No pude leer el archivo.');}
 },[a]);
 const lastAssistant=[...a.messages].reverse().find(m=>m.role==='assistant')?.id;
 const limitReached=a.turnsUsed>=data.limits.maxTurnsPerConversation;
 const pct=s.total>0?Math.round(s.loaded*100/s.total):0;
 const userContext=a.messages.filter(m=>m.adjunto&&m.adjunto.columns.length+(m.adjunto.text?1:0)>0).map(m=>{const x=m.adjunto!;return `${x.name} (${x.kind.toUpperCase()}): ${x.rows!==null?`${x.rows} filas, ${x.columns.length} columnas`:`${x.text?.lines??0} líneas`}`;});
 return <div className="chat-app" data-testid="agente-shell">
  <ChatSidebar id={sideId} conversations={a.conversations} activeId={a.activeId} drawer={narrow} open={narrow&&menu} onNew={()=>{a.newChat();setText('');setMenu(false);}} onOpen={id=>{a.open(id);setMenu(false);}} onRename={a.rename} onDelete={a.remove} onClose={closeMenu}/>
  {narrow&&menu&&<div className="chat-backdrop" aria-hidden="true" onClick={closeMenu}/>}
  <div className="chat-main">
   <header className="chat-bar">
    <span ref={menuButton} className="chat-bar-menu"><Button size="sm" icon={<Icon name="menu"/>} aria-expanded={menu} aria-controls={sideId} onClick={()=>setMenu(true)}>Chats</Button></span>
    <span className="chat-bar-brand"><RovaqMark size={20} thinking={a.sending}/><span>Pregúntale a tus datos</span></span>
    <span className="chat-bar-end"><span className="chip" title="Fuentes con datos cargados frente a las que el espacio de trabajo espera.">{s.loaded} de {s.total} fuentes</span><span className="chip agente-mode" title={data.note}>{data.mode==='deterministic'?'Cifras calculadas, sin IA generativa':'Redacción con IA verificada'}</span>
     <LinkButton href="/overview" size="sm" variant="ghost" icon={<Icon name="back"/>}>Espacio de trabajo</LinkButton></span>
   </header>
   <div className="chat-stage" data-has={has}>
    {!has&&<ParticleField/>}
    <div className="agente">
     {!has&&<header className="agente-hero">
      <RovaqWordmark size={44}/>
      <h1>Pregúntale a tus datos</h1>
      <p className="agente-sub">Tu información cargada, con la cifra que ya calculó el sistema, su clase y su cobertura. Pide tablas, gráficas, comparaciones o un reporte.</p>
      {s.empty&&<div className="state agente-empty" role="status"><strong>Todavía no hay información cargada.</strong><p>Sin datos no puedo responder cifras: no las invento. Carga tus fuentes y vuelve a preguntar.</p><LinkButton href="/imports" icon={<Icon name="arrow"/>}>Ir a Importaciones</LinkButton></div>}
     </header>}

     {has&&<div className="agente-thread" role="log" aria-live="polite" aria-label="Conversación con el agente de datos">
      {a.messages.map(m=>m.adjunto?<div key={m.id} className="agente-answer"><div className="agente-user"><div className="agente-bubble">{m.text}</div></div><AttachmentCard a={m.adjunto}/></div>:m.role==='user'?<div key={m.id} className="agente-user"><div className="agente-bubble">{m.text}</div></div>:<AnswerView key={m.id} message={m} question={m.question??''} labels={data.toolLabels} userContext={userContext} isLast={m.id===lastAssistant&&!a.sending} busy={a.sending} onAsk={ask} onRegenerate={a.regenerate} onFeedback={a.setFeedback}/>)}
      {a.sending&&<LiveTrace phase={a.phase} steps={a.steps} labels={data.toolLabels}/>}
      {limitReached&&<p className="state" role="status">Esta conversación llegó a {data.limits.maxTurnsPerConversation} preguntas. Empieza un chat nuevo para seguir.</p>}
      <div ref={end}/>
     </div>}

     {!has&&consult&&s.categorias.length>0&&<div id={catId} className="agente-cats">{s.categorias.map(c=><section key={c.titulo} className="card" aria-label={c.titulo}><p className="eyebrow" role="heading" aria-level={2}>{c.titulo}</p><div className="agente-cat-list">{c.preguntas.map(q=><Button key={q} size="sm" className="agente-q" onClick={()=>ask(q)}>{q}</Button>)}</div></section>)}</div>}

     <div className="agente-dock"><Composer value={text} onChange={setText} onSend={()=>ask(text)} onStop={a.stop} onConsult={()=>setConsult(v=>!v)} sending={a.sending} disabled={limitReached} placeholder="Pregunta sobre tus datos…" maxChars={data.limits.maxQuestionChars} categoriesId={catId} categoriesOpen={consult} inputId={inputId} onAttach={f=>void attach(f)} attachError={attachError}/></div>

     {!has&&<>
      {s.sugerencias.length>0&&<div className="agente-chips agente-chips-center" role="group" aria-label="Preguntas sugeridas según lo que tienes cargado">{s.sugerencias.map(q=><Button key={q} size="sm" onClick={()=>ask(q)}>{q}</Button>)}</div>}
      <p className="agente-foot">Cargado: {pct} % de las fuentes esperadas. {data.note}</p>
     </>}
    </div>
   </div>
  </div>
 </div>;
}
