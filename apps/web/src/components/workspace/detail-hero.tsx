'use client';
import {useState,type ReactNode} from 'react';
import {formatMinorUnits} from '../../lib/formato/dinero-pantalla.mjs';
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
import {useT} from '../i18n/proveedor';
import type {Clave} from '../../lib/i18n';
const STATE={ready:{l:'tr.ws.dhCompleta',t:'ok'},partial:{l:'tr.ws.dhParcial',t:'warn'},stale:{l:'tr.ws.dhAnterior',t:'warn'},empty:{l:'carga.sinDatos',t:'muted'}} as const satisfies Record<string,{l:Clave;t:string}>;
const CAUSE:Record<string,{l:Clave;sev:'high'|'medium'|'low'|'info'}>={unassessed:{l:'tr.ws.dhSinEval',sev:'info'},hypothesis:{l:'tr.ws.dhProbable',sev:'medium'},confirmed:{l:'tr.ws.dhConfirmada',sev:'low'},retracted:{l:'tr.ws.dhRetractada',sev:'info'}};
function Fig({label,value,kind,note}:{label:string;value:ReactNode;kind?:Parameters<typeof KindBadge>[0];note?:ReactNode}){return <div className="hero-fig"><span className="hero-fig-label">{label}</span><strong>{value}</strong>{kind&&<KindBadge {...kind}/>}{note&&<small>{note}</small>}</div>;}
/** Entity hero: title + status, 3 exact figures with their class, lifecycle stepper (only steps the data can prove), evidence in a drawer. */
export function DetailHero({data,evidence,nota,children,esperando=false,registradas=null}:{data:ProblemDetail|CustomerDetail;evidence:ReactNode;nota?:string;children?:ReactNode;esperando?:boolean;registradas?:number|null}){
 const tx=useT(),[open,setOpen]=useState(false);
 const st=STATE[data.state];
 const cites=data.conversations.reduce((a,c)=>a+('citations' in c&&Array.isArray(c.citations)?c.citations.length:0),0);
 const money=(m:{amount_minor:string|null;currency:string;exponent:number})=>m.amount_minor===null?tx('tr.ui.cbNoDisp'):formatMinorUnits(m.amount_minor,m.currency,m.exponent);
 const metrics=data.kind==='problem'?data.record.metrics:[];
 const claim=data.kind==='problem'?data.causality.view?.claim.state:undefined;
 const steps:Step[]=data.kind==='problem'?[
  {key:'d',label:tx('tr.ws.dhDetectado'),state:'done'},
  {key:'e',label:tx('tr.ws.dhConEvid'),state:esperando?'todo':cites>0?'done':'current',hint:esperando?tx('tr.ws.dhVerificando'):cites>0?undefined:tx('tr.ws.dhSinCitas')},
  {key:'c',label:claim?(CAUSE[claim]?tx(CAUSE[claim].l):tx('tr.ws.dhCausa')):tx('tr.ws.dhCausaSinEval'),state:claim==='confirmed'?'done':cites>0?'current':'todo',hint:tx('tr.ws.dhHipotesisHint')}
 ]:[];
 return <>
  <section className="card hero" aria-label={tx('tr.ws.dhResumen')}>
   <div className="hero-main"><div className="hero-title"><StatusChip tone={st.t}>{tx(st.l)}</StatusChip><h2 className="detail-title">{data.kind==='problem'?etiquetaCategoria(data.title,tx):data.title}</h2><p className="hero-sub">{(()=>{const [a,b]=tx('tr.ws.dhCorte',{fecha:'\u0000'}).split('\u0000');return <>{a}<time>{data.as_of.replace('T',' ').replace(/\.\d{3}Z$/,' UTC')}</time>{b}</>;})()}</p></div>
    <div className="hero-figs">
     {metrics.slice(0,2).map((m,i)=><Fig key={i} label={m.label} value={money(m)} kind={{metric:m}} note={m.amount_minor===null&&m.known_subtotal!==null?tx('tr.ws.dhSubtotal',{x:formatMinorUnits(m.known_subtotal,m.currency,m.exponent)}):undefined}/>)}
     {data.kind==='customer'&&<Fig label={tx('tr.ws.dhOrdenesAtr')} value={nf.format(data.orders.length)} kind={{kind:'observed'}}/>}
     {esperando?<div className="hero-fig" aria-busy="true"><WaitStatus {...ESPERA.evidencia}/></div>:<Fig label={tx('prob.conversaciones')} value={nf.format(data.conversations.length)} note={<>{tx(cites===1?'tr.ws.dhCita1':'tr.ws.dhCitaN',{n:nf.format(cites)})}{registradas!==null&&<> · {tx(registradas===1?'tr.ws.dhReg1':'tr.ws.dhRegN',{n:nf.format(registradas)})}</>}</>}/>}
    </div>
   </div>
   {nota&&<p className="state" role="note">{nota}</p>}
   {steps.length>0&&<div className="hero-steps"><Stepper label={tx('tr.ws.dhCiclo')} steps={steps}/></div>}
   <div className="hero-actions"><button type="button" className="btn btn-primary btn-sm" disabled={esperando} onClick={()=>setOpen(true)}><Icon name="message" size={14}/><span className="btn-label">{esperando?tx('tr.ws.dhVerEvid'):tx('tr.ws.dhVerEvidN',{n:nf.format(cites)})}</span></button></div>
  </section>
  {data.kind==='problem'&&data.causality.view&&claim&&<InsightCard severity={CAUSE[claim]?.sev??'info'} eyebrow={tx('tr.ws.dhHipNoHecho')} title={CAUSE[claim]?tx(CAUSE[claim].l):tx('tr.ws.dhEstadoCausal')} sentence={<>{data.causality.view.claim.probableCause?<strong>{data.causality.view.claim.probableCause}</strong>:tx('tr.ws.dhSinCausa')}. {data.causality.view.claim.reason}</>} footer={<span className="chip">{tx('tr.ws.dhEvalVigente')}</span>}/>}
  {children}
  <Drawer open={open} onClose={()=>setOpen(false)} width={640} title={tx('exp.evidencia')} subtitle={tx('tr.ws.dhDrawerSub')}>{evidence}</Drawer>
 </>;
}
