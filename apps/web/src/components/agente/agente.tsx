'use client';
import './agente.css';
import {useCallback,useEffect,useId,useRef,useState} from 'react';
import {Button,LinkButton} from '../ui/button';
import {Icon} from './icons';
import {Composer} from './composer';
import {HistoryPanel} from './history-panel';
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

function Chat({data}:{data:AgentState}){
 const a=useAgente(data.scope,data.limits.maxQuestionChars,data.limits.maxTurnsPerConversation);
 const [text,setText]=useState(''),[consult,setConsult]=useState(false),[historyOpen,setHistoryOpen]=useState(false);
 const historyId=useId(),catId=useId(),inputId=useId();
 const end=useRef<HTMLDivElement>(null),historyButton=useRef<HTMLSpanElement>(null);
 const has=a.messages.length>0;
 const s=data.suggestions;
 useEffect(()=>{end.current?.scrollIntoView?.({block:'end'});},[a.messages.length,a.sending]);
 const ask=useCallback((q:string)=>{const t=q.trim().slice(0,data.limits.maxQuestionChars);if(!t||a.sending)return;setText('');setConsult(false);a.send(t,s.directas[t]);},[a,data.limits.maxQuestionChars,s.directas]);
 const closeHistory=useCallback(()=>{setHistoryOpen(false);historyButton.current?.querySelector('button')?.focus();},[]);
 useEffect(()=>{if(!historyOpen)return;const k=(e:KeyboardEvent)=>{if(e.key==='Escape')closeHistory();};document.addEventListener('keydown',k);return()=>document.removeEventListener('keydown',k);},[historyOpen,closeHistory]);
 const lastAssistant=[...a.messages].reverse().find(m=>m.role==='assistant')?.id;
 const limitReached=a.turnsUsed>=data.limits.maxTurnsPerConversation;
 const pct=s.total>0?Math.round(s.loaded*100/s.total):0;
 return <div className="agente" data-testid="agente-shell">
  <div className="agente-toolbar">
   <p className="agente-context"><span className="chip" title="Fuentes con datos cargados frente a las que el espacio de trabajo espera.">{s.loaded} de {s.total} fuentes cargadas</span><span className="chip agente-mode" title={data.note}>{data.mode==='deterministic'?'Cifras calculadas, sin IA generativa':'Redacción con IA verificada'}</span></p>
   <span className="btn-group">
    {has&&<Button size="sm" icon={<Icon name="plus"/>} onClick={()=>{a.newChat();setText('');}}>Chat nuevo</Button>}
    <span ref={historyButton}><Button size="sm" icon={<Icon name="history"/>} aria-expanded={historyOpen} aria-controls={historyId} onClick={()=>historyOpen?closeHistory():setHistoryOpen(true)}>Historial{a.conversations.length>0?` (${a.conversations.length})`:''}</Button></span>
   </span>
  </div>

  {!has&&<header className="agente-hero">
   <span className="agente-mark" aria-hidden="true"><Icon name="spark" size={24}/></span>
   <h1>Pregúntale a tus datos</h1>
   <p className="agente-sub">Tu información cargada, con la cifra que ya calculó el sistema, su clase y su cobertura.</p>
   {s.empty&&<div className="state agente-empty" role="status"><strong>Todavía no hay información cargada.</strong><p>Sin datos no puedo responder cifras: no las invento. Carga tus fuentes y vuelve a preguntar.</p><LinkButton href="/imports" icon={<Icon name="arrow"/>}>Ir a Importaciones</LinkButton></div>}
  </header>}

  {has&&<div className="agente-thread" role="log" aria-live="polite" aria-label="Conversación con el agente de datos">
   {a.messages.map(m=>m.role==='user'?<div key={m.id} className="agente-user"><div className="agente-bubble">{m.text}</div></div>:<AnswerView key={m.id} message={m} question={m.question??''} isLast={m.id===lastAssistant&&!a.sending} busy={a.sending} onAsk={ask} onRegenerate={a.regenerate} onFeedback={a.setFeedback}/>)}
   {a.sending&&<div className="agente-thinking" role="status" aria-live="polite" data-testid="agente-pensando"><span className="agente-mark agente-mark-sm agente-pulse" aria-hidden="true"><Icon name="spark" size={14}/></span><div><span>{a.phase}</span>{a.steps.length>0&&<ul>{a.steps.map((st,i)=><li key={st.tool+i}>{st.done?<Icon name="check" size={12}/>:<span className="agente-dot" aria-hidden="true"/>}{data.toolLabels[st.tool]??st.tool}{st.done?'':'…'}</li>)}</ul>}</div></div>}
   {limitReached&&<p className="state" role="status">Esta conversación llegó a {data.limits.maxTurnsPerConversation} preguntas. Empieza un chat nuevo para seguir.</p>}
   <div ref={end}/>
  </div>}

  {!has&&consult&&s.categorias.length>0&&<div id={catId} className="agente-cats">{s.categorias.map(c=><section key={c.titulo} className="card" aria-label={c.titulo}><h2 className="eyebrow">{c.titulo}</h2><div className="agente-cat-list">{c.preguntas.map(q=><Button key={q} size="sm" className="agente-q" onClick={()=>ask(q)}>{q}</Button>)}</div></section>)}</div>}

  <div className="agente-dock"><Composer value={text} onChange={setText} onSend={()=>ask(text)} onStop={a.stop} onConsult={()=>setConsult(v=>!v)} sending={a.sending} disabled={limitReached} placeholder="Pregunta sobre tus datos…" maxChars={data.limits.maxQuestionChars} categoriesId={catId} categoriesOpen={consult} inputId={inputId}/></div>

  {!has&&<>
   {s.sugerencias.length>0&&<div className="agente-chips agente-chips-center" role="group" aria-label="Preguntas sugeridas según lo que tienes cargado">{s.sugerencias.map(q=><Button key={q} size="sm" onClick={()=>ask(q)}>{q}</Button>)}</div>}
   <p className="agente-foot">Cargado: {pct} % de las fuentes esperadas. {data.note}</p>
  </>}

  {historyOpen&&<HistoryPanel id={historyId} conversations={a.conversations} activeId={a.activeId} onNew={()=>{a.newChat();setText('');closeHistory();}} onOpen={id=>{a.open(id);closeHistory();}} onRename={a.rename} onDelete={a.remove} onClose={closeHistory}/>}
 </div>;
}
