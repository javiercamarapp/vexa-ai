'use client';
import {useEffect,useRef,useState} from 'react';
import {useAgente} from '../agente/use-agente';
import {LiveTrace} from '../agente/trace';
import {AnswerView} from '../agente/answer-view';
import {LinkButton,Arrow} from '../ui/button';
import {RovaqMark} from '../agente/rovaq-mark';
import type {AgentState} from '../agente/types';

// auto-refresh: lectura única del estado del agente; la pregunta se manda una sola vez (es una consulta puntual, no una vista de datos que cambie sola).
type Carga={kind:'cargando'}|{kind:'error'}|{kind:'listo';data:AgentState};

/** «Preguntar a Rovaq» sin salir de Hoy: la pregunta se manda sola y la respuesta aparece aquí abajo, con el mismo «pensamiento» en vivo y la misma escritura progresiva del chat. */
export function RespuestaEnLinea({pregunta,onCerrar}:{pregunta:string;onCerrar:()=>void}){
 const [c,setC]=useState<Carga>({kind:'cargando'});
 useEffect(()=>{const ctl=new AbortController();void (async()=>{try{const r=await fetch('/api/agent/state',{cache:'no-store',signal:ctl.signal});if(!r.ok)throw Error(String(r.status));const j=await r.json();if(!j?.data?.suggestions)throw Error('forma');setC({kind:'listo',data:j.data});}catch{if(!ctl.signal.aborted)setC({kind:'error'});}})();return()=>ctl.abort();},[]);
 return <section className="hoy-card hoy-resp" aria-label="Respuesta de Rovaq" aria-live="polite">
  <header className="hoy-resp-cab"><span className="hoy-resp-t"><RovaqMark size={16}/><b>Rovaq responde</b><span className="hoy-resp-q">{pregunta}</span></span>
   <span className="hoy-resp-acc"><LinkButton href="/preguntale" variant="ghost" size="sm" icon={<Arrow/>}>Seguir en el chat</LinkButton><button type="button" className="btn btn-ghost btn-sm" onClick={onCerrar}>Cerrar</button></span></header>
  {c.kind==='error'&&<p className="state state-error" role="alert">No se pudo abrir la consulta ahora. Abre «Pregúntale a tus datos» e inténtalo de nuevo.</p>}
  {c.kind==='listo'&&<Cuerpo data={c.data} pregunta={pregunta}/>}
 </section>;
}

function Cuerpo({data,pregunta}:{data:AgentState;pregunta:string}){
 const a=useAgente(data.scope,data.limits.maxQuestionChars,data.limits.maxTurnsPerConversation,data.toolLabels,{});
 const enviada=useRef<string|null>(null);
 useEffect(()=>{if(enviada.current===pregunta)return;enviada.current=pregunta;a.send(pregunta,data.suggestions.directas?.[pregunta]);},[pregunta]);// eslint-disable-line react-hooks/exhaustive-deps
 const ultima=[...a.messages].reverse().find(m=>m.role==='assistant');
 return <div className="hoy-resp-cuerpo">
  {a.sending&&<LiveTrace phase={a.phase} steps={a.steps} labels={data.toolLabels}/>}
  {!a.sending&&ultima&&<AnswerView message={ultima} question={ultima.question??pregunta} labels={data.toolLabels} userContext={[]} isLast busy={a.sending} escribir={ultima.id===a.freshId} onAsk={q=>a.send(q,data.suggestions.directas?.[q])} onRegenerate={a.regenerate} onFeedback={a.setFeedback}/>}
 </div>;
}
