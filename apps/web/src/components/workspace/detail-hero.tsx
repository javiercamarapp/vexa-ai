'use client';
import {useState,type ReactNode} from 'react';
import {formatMinorUnits} from '../../../../../packages/metrics/money.mjs';
import type {ProblemDetail,CustomerDetail} from '../../../../../packages/workspace-service/detail.mjs';
import {KindBadge} from '../ui/kind-badge';
import {StatusChip} from '../ui/status-chip';
import {Stepper,type Step} from '../ui/stepper';
import {Drawer} from '../ui/overlay';
import {InsightCard} from '../ui/insight-card';
import {Icon} from '../ui/icons';
import {nf} from '../ui/format';
import {WaitStatus} from '../ui/wait-status';
import {ESPERA} from '../../lib/legibilidad/espera.mjs';
import {etiquetaCategoria} from '../../lib/legibilidad/categorias.mjs';
const STATE={ready:{l:'Cobertura completa',t:'ok'},partial:{l:'Cobertura parcial',t:'warn'},stale:{l:'Corte anterior',t:'warn'},empty:{l:'Sin datos',t:'muted'}} as const;
const CAUSE:Record<string,{l:string;sev:'high'|'medium'|'low'|'info'}>={unassessed:{l:'Sin evaluar',sev:'info'},hypothesis:{l:'Causa probable, no confirmada',sev:'medium'},confirmed:{l:'Causa confirmada con evidencia operativa',sev:'low'},retracted:{l:'Causa retractada',sev:'info'}};
function Fig({label,value,kind,note}:{label:string;value:ReactNode;kind?:Parameters<typeof KindBadge>[0];note?:ReactNode}){return <div className="hero-fig"><span className="hero-fig-label">{label}</span><strong>{value}</strong>{kind&&<KindBadge {...kind}/>}{note&&<small>{note}</small>}</div>;}
/** Entity hero: title + status, 3 exact figures with their class, lifecycle stepper (only steps the data can prove), evidence in a drawer. */
export function DetailHero({data,evidence,nota,children,esperando=false,registradas=null}:{data:ProblemDetail|CustomerDetail;evidence:ReactNode;nota?:string;children?:ReactNode;esperando?:boolean;registradas?:number|null}){
 const [open,setOpen]=useState(false);
 const st=STATE[data.state];
 const cites=data.conversations.reduce((a,c)=>a+('citations' in c&&Array.isArray(c.citations)?c.citations.length:0),0);
 const money=(m:{amount_minor:string|null;currency:string;exponent:number})=>m.amount_minor===null?'No disponible':formatMinorUnits(m.amount_minor,m.currency,m.exponent);
 const metrics=data.kind==='problem'?data.record.metrics:[];
 const claim=data.kind==='problem'?data.causality.view?.claim.state:undefined;
 const steps:Step[]=data.kind==='problem'?[
  {key:'d',label:'Detectado',state:'done'},
  {key:'e',label:'Con evidencia',state:esperando?'todo':cites>0?'done':'current',hint:esperando?'Verificando la evidencia en vivo.':cites>0?undefined:'Aún no hay citas verificables con tu acceso.'},
  {key:'c',label:claim?CAUSE[claim]?.l??'Causa':'Causa sin evaluar',state:claim==='confirmed'?'done':cites>0?'current':'todo',hint:'La causa es una hipótesis hasta que se confirma con evidencia operativa.'}
 ]:[];
 return <>
  <section className="card hero" aria-label="Resumen del detalle">
   <div className="hero-main"><div className="hero-title"><StatusChip tone={st.t}>{st.l}</StatusChip><h2 className="detail-title">{data.kind==='problem'?etiquetaCategoria(data.title):data.title}</h2><p className="hero-sub">Corte financiero <time>{data.as_of.replace('T',' ').replace(/\.\d{3}Z$/,' UTC')}</time></p></div>
    <div className="hero-figs">
     {metrics.slice(0,2).map((m,i)=><Fig key={i} label={m.label} value={money(m)} kind={{metric:m}} note={m.amount_minor===null&&m.known_subtotal!==null?'Subtotal conocido: '+formatMinorUnits(m.known_subtotal,m.currency,m.exponent)+'; no es el total.':undefined}/>)}
     {data.kind==='customer'&&<Fig label="Órdenes atribuidas" value={nf.format(data.orders.length)} kind={{kind:'observed'}}/>}
     {esperando?<div className="hero-fig" aria-busy="true"><WaitStatus {...ESPERA.evidencia}/></div>:<Fig label="Conversaciones" value={nf.format(data.conversations.length)} note={<>{nf.format(cites)} {cites===1?'cita verificada al abrir':'citas verificadas al abrir'}{registradas!==null&&<> · {nf.format(registradas)} {registradas===1?'cita registrada':'citas registradas'} en la lista</>}</>}/>}
    </div>
   </div>
   {nota&&<p className="state" role="note">{nota}</p>}
   {steps.length>0&&<div className="hero-steps"><Stepper label="Ciclo de vida del problema" steps={steps}/></div>}
   <div className="hero-actions"><button type="button" className="btn btn-primary btn-sm" disabled={esperando} onClick={()=>setOpen(true)}><Icon name="message" size={14}/><span className="btn-label">{esperando?'Verificando evidencia…':`Ver evidencia (${nf.format(cites)})`}</span></button></div>
  </section>
  {data.kind==='problem'&&data.causality.view&&claim&&<InsightCard severity={CAUSE[claim]?.sev??'info'} eyebrow="Hipótesis, no hecho" title={CAUSE[claim]?.l??'Estado causal'} sentence={<>{data.causality.view.claim.probableCause?<strong>{data.causality.view.claim.probableCause}</strong>:'Sin causa identificada'}. {data.causality.view.claim.reason}</>} footer={<span className="chip">Evaluación vigente, separada de las cifras del corte</span>}/>}
  {children}
  <Drawer open={open} onClose={()=>setOpen(false)} width={640} title="Evidencia" subtitle="Las conversaciones describen el contexto; una frase del cliente no prueba un importe.">{evidence}</Drawer>
 </>;
}
