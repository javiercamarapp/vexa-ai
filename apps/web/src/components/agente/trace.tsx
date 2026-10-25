'use client';
import {useState} from 'react';
import {Icon} from './icons';
import {RovaqMark} from './rovaq-mark';
import type {Step,TraceStep} from './types';

const ESTADO:Record<string,string>={ok:'Listo',no_data:'Sin datos',unavailable:'No disponible',forbidden:'Sin acceso',invalid_input:'Entrada no válida',clarify:'Pide aclaración',descartado:'Descartado',sin_consulta:'Sin consulta aplicable'};
export const estadoLabel=(e?:string)=>e?(ESTADO[e]??e):'';
export const msText=(ms?:number|null)=>ms===null||ms===undefined?'':ms<1000?`${ms} ms`:`${(ms/1000).toLocaleString('es-MX',{maximumFractionDigits:1})} s`;
/** Same shape for live events and for the stored `answer.trace`: only what the system measured, never model text. */
export const stepsOf=(trace:TraceStep[]):Step[]=>trace.map(t=>({id:t.id,kind:t.kind,tool:t.tool,label:t.label,done:true,estado:t.estado,ms:t.ms,detail:t.detail,cifras:t.cifras,fuentes:t.fuentes}));

function StepList({steps,labels}:{steps:Step[];labels:Record<string,string>}){
 return <ol className="trace-list">{steps.map(s=><li key={s.id} className="trace-step" data-done={s.done} data-estado={s.estado}>
  <span className="trace-icon" aria-hidden="true">{s.done?<Icon name={s.estado==='ok'||!s.estado?'check':'info'} size={12}/>:<span className="agente-dot"/>}</span>
  <div className="trace-body">
   <p className="trace-title">{s.kind==='tool'&&s.tool?(labels[s.tool]??s.label):s.label}{s.done?'':'…'}
    {s.done&&<span className="trace-meta">{[estadoLabel(s.estado),msText(s.ms),s.cifras!==undefined?`${s.cifras} cifras`:''].filter(Boolean).join(' · ')}</span>}</p>
   {s.detail&&<p className="trace-detail">{s.detail}</p>}
   {s.tool&&<p className="trace-detail"><code>{s.tool}</code>{s.fuentes&&s.fuentes.length>0?` · Fuente: ${s.fuentes.join('; ')}`:''}</p>}
  </div></li>)}</ol>;
}

/** Live «thinking»: the animated Rovaq mark, the timed phase and a collapsible step list fed by server events. */
export function LiveTrace({phase,steps,labels}:{phase:string;steps:Step[];labels:Record<string,string>}){
 const [open,setOpen]=useState(true);
 return <div className="agente-thinking" role="status" aria-live="polite" data-testid="agente-pensando">
  <RovaqMark size={16} thinking/>
  <div className="trace-main">
   <p className="trace-phase">{phase}</p>
   {steps.length>0&&<><button type="button" className="trace-toggle" aria-expanded={open} aria-controls="trace-live" onClick={()=>setOpen(v=>!v)}><Icon name="arrow" size={12}/>Pensamiento del sistema en vivo ({steps.length})</button>
    {open&&<div id="trace-live"><StepList steps={steps} labels={labels}/></div>}</>}
  </div></div>;
}

/** Stored breakdown under a finished answer. Collapsed by default. */
export function TraceDisclosure({trace,labels}:{trace:TraceStep[];labels:Record<string,string>}){
 if(!trace.length)return null;
 const total=trace.reduce((a,t)=>a+(t.ms??0),0);
 return <details className="agente-calc agente-trace"><summary className="ctl">Cómo llegué a esto · {trace.length} pasos · {msText(total)||'0 ms'}</summary>
  <StepList steps={stepsOf(trace)} labels={labels}/>
  <p className="card-lead agente-note">Cada paso lo registró el sistema al ejecutarlo (consultas, fuentes y tiempos). No es el razonamiento interno de ningún modelo.</p></details>;
}
