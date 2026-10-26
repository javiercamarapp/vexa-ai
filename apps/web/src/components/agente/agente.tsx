'use client';
import {RovaqCargando} from '../rovaq-cargando';
import './agente.css';
import './una-pagina.css';
import {useCallback,useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {Ctl,CtlLink} from './ctl';
import {TemasRapidos} from './sugerencias';
import {Icon} from './icons';
import {Composer} from './composer';
import {HistoryPanel} from './historial';
import {AttachmentCard} from './attachment-card';
import {LiveTrace} from './trace';
import {ParticleField} from './particle-field';
import {RovaqWordmark} from './rovaq-mark';
import {analizarAdjunto,validarArchivo} from './attachments';
import {AnswerView} from './answer-view';
import {useAgente,type Runner} from './use-agente';
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
 if(load.kind==='loading')return <div className="agente" aria-busy="true" style={{display:'grid',placeItems:'center',minHeight:'60vh'}}><RovaqCargando mensaje=""/></div>;
 if(load.kind==='error')return <div className="agente"><div role="alert" className="state state-error agente-gate"><h1>No se pudo abrir «Pregúntale a tus datos»</h1><p>No pude verificar si la consulta está disponible. Revisa tu conexión e inténtalo de nuevo.</p><Ctl variant="soft" icon={<Icon name="refresh"/>} onClick={()=>{setLoad({kind:'loading'});setAttempt(n=>n+1);}}>Reintentar</Ctl></div></div>;
 if(load.kind==='forbidden')return <div className="agente"><div role="status" className="state agente-gate"><span className="agente-mark" aria-hidden="true"><Icon name="lock" size={22}/></span><h1>Sin acceso</h1><p>Tu rol no tiene acceso a estas consultas. Pídele acceso al administrador de tu espacio de trabajo.</p><CtlLink href="/overview" variant="soft" icon={<Icon name="arrow"/>}>Volver al resumen</CtlLink></div></div>;
 return <Chat data={load.data}/>;
}

/** Extensión para los «modos copiloto» (CFO, reembolsos…): misma pantalla, pero la portada la pone el modo (briefing) y el transporte puede ser otro. */
export type ModoChat={modo:string;runner?:Runner;placeholder?:string;portada:(ask:(q:string)=>void,hayHilo:boolean)=>ReactNode;/** Encabezado en la misma fila que «Historial» (título y acciones del modo). */cabecera?:(hayHilo:boolean)=>ReactNode;pie?:ReactNode;etiquetaChat?:string};
export function Chat({data,modo}:{data:AgentState;modo?:ModoChat}){
 const a=useAgente(data.scope,data.limits.maxQuestionChars,data.limits.maxTurnsPerConversation,data.toolLabels,{runner:modo?.runner,modo:modo?.modo});
 const [text,setText]=useState(()=>{if(modo||typeof window==='undefined')return '';const sp=new URLSearchParams(window.location.search),q=sp.get('q');return sp.get('enviar')==='1'?'':q?q.slice(0,data.limits.maxQuestionChars):'';}),[hist,setHist]=useState(false),[leaving,setLeaving]=useState(false),[attachError,setAttachError]=useState<string|null>(null);
 const histId=useId(),inputId=useId();
 const histButton=useRef<HTMLButtonElement>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 const has=a.messages.length>0;
 const s=data.suggestions;
 // Cada respuesta se abre por el principio. Su crecimiento nunca arrastra al lector.
 const hilo=useRef<HTMLDivElement>(null);
 const ultimoMensaje=a.messages.at(-1)?.id;
 const conversacionAnterior=useRef(a.activeId);
 useEffect(()=>{
  const c=hilo.current;if(!c)return;
  const cambioConversacion=conversacionAnterior.current!==a.activeId;
  conversacionAnterior.current=a.activeId;
  if(cambioConversacion){c.scrollTop=0;return;}
  const mensaje=Array.from(c.querySelectorAll<HTMLElement>('[data-message-id]')).find(el=>el.dataset.messageId===ultimoMensaje);
  if(mensaje)c.scrollTop=Math.max(0,c.scrollTop+mensaje.getBoundingClientRect().top-c.getBoundingClientRect().top-12);
 },[ultimoMensaje,a.activeId]);
 const ask=useCallback((q:string)=>{const t=q.trim().slice(0,data.limits.maxQuestionChars);if(!t||a.sending)return;setText('');setAttachError(null);a.send(t,s.directas[t]);},[a,data.limits.maxQuestionChars,s.directas]);
 const openHist=()=>{clearTimeout(timer.current);setLeaving(false);setHist(true);};
 const closeHist=useCallback(()=>{
  clearTimeout(timer.current);
  const back=()=>setTimeout(()=>histButton.current?.focus(),0);
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){setHist(false);setLeaving(false);back();return;}
  setLeaving(true);back();timer.current=setTimeout(()=>{setHist(false);setLeaving(false);},480);
 },[]);
 const attach=useCallback(async(file:File)=>{
  const bad=validarArchivo(file.name,file.size);if(bad){setAttachError(bad);return;}
  try{
   const r=analizarAdjunto(file.name,await file.text(),file.size,`adj-${Date.now().toString(36)}`);
   if(!r.ok){setAttachError(r.error);return;}
   setAttachError(null);a.attach(r.resumen);
  }catch{setAttachError('No pude leer el archivo.');}
 },[a]);
 // «Preguntar a Rovaq» desde Hoy llega con ?enviar=1&q=…: el agente responde de inmediato (una sola vez) y la URL se limpia para que recargar no repita la pregunta.
 const autoEnviado=useRef(false);
 useEffect(()=>{if(autoEnviado.current||modo)return;const sp=new URLSearchParams(window.location.search),q=sp.get('q');if(sp.get('enviar')!=='1'||!q)return;autoEnviado.current=true;sp.delete('enviar');sp.delete('q');window.history.replaceState(null,'',window.location.pathname+(sp.toString()?'?'+sp.toString():''));const t=q.trim().slice(0,data.limits.maxQuestionChars);if(t)a.send(t,s.directas[t]);},[a,data.limits.maxQuestionChars,modo,s.directas]);
 const lastAssistant=[...a.messages].reverse().find(m=>m.role==='assistant')?.id;
 const limitReached=a.turnsUsed>=data.limits.maxTurnsPerConversation;
 const pct=s.total>0?Math.round(s.loaded*100/s.total):0;
 const userContext=a.messages.filter(m=>m.adjunto&&m.adjunto.columns.length+(m.adjunto.text?1:0)>0).map(m=>{const x=m.adjunto!;return `${x.name} (${x.kind.toUpperCase()}): ${x.rows!==null?`${x.rows} filas, ${x.columns.length} columnas`:`${x.text?.lines??0} líneas`}`;});
 const count=a.conversations.length;
 const chips=<p className="agente-meta"><span className="chip" title="Fuentes con datos cargados frente a las que el espacio de trabajo espera.">{s.loaded} de {s.total} fuentes</span><span className="chip agente-mode" title={data.note}>{data.mode==='deterministic'?'Cifras calculadas, sin IA generativa':'Redacción con IA verificada'}</span></p>;
 return <div className={'copiloto'+(modo?' copiloto-negocio':'')} data-testid="agente-shell" data-has={has} data-modo={modo?.modo}>
  <ParticleField/>
  <div className="copiloto-hist-row">{modo?.cabecera?.(has)}<button ref={histButton} type="button" className="ctl ctl-chip copiloto-hist-btn" aria-label="Historial de chats" aria-expanded={hist&&!leaving} aria-controls={histId} onClick={hist&&!leaving?closeHist:openHist}><Icon name="history" size={14}/><span className="ctl-label">Historial</span>{count>0&&<span className="copiloto-hist-count">{count>=50?'50+':count}</span>}</button></div>
  <div className="agente" data-has={has} data-negocio={modo?true:undefined}>
   {modo&&modo.portada(ask,has)}
   {!modo&&!has&&<header className="agente-hero">
    <RovaqWordmark size={36}/>
    <h1>Pregúntale a tus datos</h1>
    <p className="agente-sub">Tu información cargada, con la cifra que ya calculó el sistema, su clase y su cobertura. Pide tablas, gráficas, comparaciones o un reporte.</p>
    {s.empty&&<div className="state agente-empty" role="status"><strong>Todavía no hay información cargada.</strong><p>Sin datos no puedo responder cifras: no las invento. Carga tus fuentes y vuelve a preguntar.</p><CtlLink href="/imports" variant="soft" icon={<Icon name="arrow"/>}>Ir a Importaciones</CtlLink></div>}
   </header>}

   {has&&<div ref={hilo} className="agente-thread" role="log" aria-live="polite" tabIndex={0} aria-label={modo?.etiquetaChat??"Conversación con el agente de datos"}><div className="agente-hilo-in">
    {a.messages.map(m=><div key={m.id} data-message-id={m.id} className="agente-message">{m.adjunto?<div key={m.id} className="agente-answer"><div className="agente-user"><div className="agente-bubble">{m.text}</div></div><AttachmentCard a={m.adjunto}/></div>:m.role==='user'?<div key={m.id} className="agente-user"><div className="agente-bubble">{m.text}</div></div>:<AnswerView key={m.id} message={m} escribir={m.id===a.freshId} question={m.question??''} labels={data.toolLabels} userContext={userContext} isLast={m.id===lastAssistant&&!a.sending} busy={a.sending} onAsk={ask} onRegenerate={a.regenerate} onFeedback={a.setFeedback}/>}</div>)}
    {a.sending&&<LiveTrace phase={a.phase} steps={a.steps} labels={data.toolLabels}/>}
    {limitReached&&<p className="state" role="status">Esta conversación llegó a {data.limits.maxTurnsPerConversation} preguntas. Empieza un chat nuevo para seguir.</p>}
   </div></div>}


   <div className="agente-dock"><Composer value={text} onChange={setText} onSend={()=>ask(text)} onStop={a.stop} sending={a.sending} disabled={limitReached} placeholder={modo?.placeholder??"Pregunta sobre tus datos…"} maxChars={data.limits.maxQuestionChars} inputId={inputId} onAttach={f=>void attach(f)} attachError={attachError}/></div>

   {modo?.pie}
   {!modo&&!has&&<>
    {s.categorias.length>0?<TemasRapidos temas={s.categorias.slice(0,4)} ask={ask}/>
    :s.sugerencias.length>0&&<div className="una-fila" role="group" aria-label="Preguntas sugeridas según lo que tienes cargado">{s.sugerencias.slice(0,5).map(q=><button type="button" key={q} className="ctl ctl-q agente-chip" title={q} onClick={()=>ask(q)}><span className="ctl-label">{q}</span></button>)}</div>}
    <p className="agente-foot">Cargado: {pct} % de las fuentes esperadas. {data.note}</p>
   </>}
   {!modo&&chips}
  </div>
  {hist&&<HistoryPanel id={histId} conversations={a.conversations} activeId={a.activeId} leaving={leaving} onNew={()=>{a.newChat();setText('');closeHist();}} onOpen={id=>{a.open(id);closeHist();}} onRename={a.rename} onDelete={a.remove} onClose={closeHist}/>}
 </div>;
}
