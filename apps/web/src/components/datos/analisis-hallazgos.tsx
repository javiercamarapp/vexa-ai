'use client';
import {useEffect,useMemo,useState} from 'react';
import type {TrendsView} from '../../../../../packages/workspace-service/trends.mjs';
import {resumenEvidencia,severidadDe,tonoSeveridad,type ResumenEvidencia} from '../../lib/legibilidad/hallazgos.mjs';
import {coberturaDeTendencias} from '../../lib/legibilidad/resumen-ejecutivo.mjs';
import {fechaCorteLegible} from '../../lib/legibilidad/fechas.mjs';
import {StatusChip} from '../ui/status-chip';
import {KindBadge} from '../ui/kind-badge';
import {LinkButton,Arrow} from '../ui/button';
import {useJson} from '../ui/use-json';
import {Tip} from '../ui/tip';
import {nf} from '../ui/format';
import {useIdioma,useT} from '../i18n/proveedor';
import {etiquetaCategoria} from '../../lib/legibilidad/categorias.mjs';
import type {Clave} from '../../lib/i18n';
import Link from '../workspace/navigation-lifecycle';
import './datos.css';

export type JobFila={id:string;runId:string|null;conversationId:string;state:string;runStatus:string|null;reason:string|null;createdAt?:string};
const ESTADO:Record<string,{texto:Clave;tono:'ok'|'warn'|'info'|'muted'}>={queued:{texto:'tr.datos.anEnCola',tono:'info'},running:{texto:'tr.datos.anAnalizando',tono:'info'},succeeded:{texto:'tr.datos.anTerminado',tono:'ok'},failed:{texto:'tr.datos.anAtencion',tono:'warn'},cancelled:{texto:'tr.datos.anCancelado',tono:'muted'}};
const acceptTrends=(j:unknown)=>{const d=(j as {data?:TrendsView})?.data;return d?.conversations?d:null;};
type Estado={[runId:string]:ResumenEvidencia|'error'|undefined};

/** Cobertura honesta («6 de N») y tabla de hallazgos: un asunto legible por análisis en vez de un identificador y seis botones iguales. */
export function HallazgosAnalisis({jobs,fuentes,masPaginas}:{jobs:JobFila[];fuentes:Record<string,string>;masPaginas:boolean}){
 const tx=useT(),idioma=useIdioma(),[ev,setEv]=useState<Estado>({});
 const runs=useMemo(()=>[...new Set(jobs.filter(j=>j.runId&&['succeeded','abstained'].includes(j.runStatus??'')).map(j=>j.runId as string))].slice(0,15),[jobs]);
 useEffect(()=>{
  const c=new AbortController();
  (async()=>{for(const id of runs){if(c.signal.aborted)return;
   try{const r=await fetch('/api/extraction/'+encodeURIComponent(id)+'/evidence',{cache:'no-store',signal:c.signal});if(!r.ok)throw Error();const j=await r.json();if(!c.signal.aborted)setEv(p=>({...p,[id]:resumenEvidencia(j.data)??'error'}));}
   catch{if(!c.signal.aborted)setEv(p=>({...p,[id]:'error'}));}}})();
  return()=>c.abort();
 },[runs]);
 const trends=useJson<TrendsView>('/api/trends',acceptTrends);
 const conv=trends.data?.conversations,cob=coberturaDeTendencias(conv),total=cob.de;
 const enPagina=new Set(jobs.filter(j=>j.runStatus==='succeeded').map(j=>j.conversationId)).size;
 const conHallazgo=Object.values(ev).filter(x=>x&&x!=='error'&&!x.sinConclusion).length;
 return <>
  <section className="card" aria-labelledby="an-cob-t">
   <div className="card-title"><div><h2 id="an-cob-t">{tx('tr.datos.anCobTitulo')}</h2><p>{cob.pct===null&&trends.busy?<span className="sr-only">{tx('tr.datos.anCalculando')}</span>:cob.texto}</p></div>{total!==null&&<KindBadge kind={cob.estimado?'estimated':'observed'}/>}</div>
   <div className="dn-bar" role="img" aria-label={cob.pct===null?tx('tr.datos.anCobNoDisp'):tx('tr.datos.anAnalizadas',{pct:nf.format(cob.pct)})}>{cob.pct!==null&&<span className="dn-in" style={{width:Math.max(1,Math.min(100,cob.pct))+'%'}}/>}</div>
   <p className="dn-meta">{cob.nota} {tx(enPagina===1?'tr.datos.anLista1':'tr.datos.anListaN',{n:nf.format(enPagina),mas:masPaginas?tx('tr.datos.anMas'):'',a:nf.format(conHallazgo),b:nf.format(runs.length)})}</p>
  </section>
  <section className="card" aria-labelledby="an-tab-t">
   <div className="card-title"><div><h2 id="an-tab-t">{tx('tr.datos.anHalTitulo')}</h2><p>{tx('tr.datos.anHalSub')}</p></div></div>
   <div className="table-wrap" tabIndex={0} role="region" aria-label={tx('tr.ui.hmScroll',{titulo:tx('tr.datos.anTablaT')})}>
    <table className="dn-tabla"><thead><tr><th scope="col">{tx('tr.datos.thHallazgo')}</th><th scope="col">{tx('tr.datos.thSeveridad')}</th><th scope="col">{tx('det.conversacion')}</th><th scope="col">{tx('tr.datos.thProblemaAs')}</th><th scope="col">{tx('tr.datos.thFecha')}</th><th scope="col">{tx('tr.datos.thEstado')}</th><th scope="col"><span className="sr-only">{tx('tr.datos.thEvidencia')}</span></th></tr></thead>
    <tbody>{jobs.map(j=>{const e=j.runId?ev[j.runId]:undefined,st=ESTADO[j.state];
     const termino=j.runStatus==='succeeded';
     return <tr key={j.id}>
      <th scope="row" className="dn-asunto">{!termino?<span className="muted">{j.state==='failed'?tx('tr.datos.anSinResultado'):j.state==='succeeded'?tx('tr.datos.anSinConcluyente'):tx('tr.datos.anPendiente')}</span>:e===undefined?<span className="muted">{tx('tr.datos.anLeyendo')}</span>:e==='error'?<span className="muted">{tx('hoy.noDisponible')}</span>:e.sinConclusion?<span className="muted">{tx('tr.datos.anSinConcluyente')}</span>:<>{etiquetaCategoria(e.categoria,tx)}{e.otros>0&&<small className="muted"> · {tx('tr.datos.anYMas',{n:e.otros})}</small>}<small className="muted"> · {tx(e.citas===1?'tr.datos.anCita1':'tr.datos.anCitaN',{n:nf.format(e.citas)})}</small></>}</th>
      <td>{termino&&e&&e!=='error'&&e.severidad?<StatusChip tone={tonoSeveridad(e.severidad)}>{severidadDe(e.severidad,tx)}</StatusChip>:<span className="muted">—</span>}</td>
      <td>{fuentes[j.conversationId]??tx('det.conversacion')} · <code className="dn-code">{j.conversationId.slice(0,8)}</code></td>
      <td><Tip label={tx('tr.datos.anTip')}><span className="muted">{tx('tr.datos.anSinVinculo')}</span></Tip></td>
      <td>{fechaCorteLegible(j.createdAt,{hora:false,idioma}).replace(' (UTC)','')||tx('tr.ui.cbNoDisp')}</td>
      <td><StatusChip tone={st?st.tono:'muted'}>{st?tx(st.texto):j.state}</StatusChip></td>
      <td>{j.runId&&termino?<LinkButton href={'/analysis/'+j.runId} size="sm" icon={<Arrow/>}>{tx('tr.datos.anVerEvidencia')}</LinkButton>:null}</td>
     </tr>;})}</tbody></table>
   </div>
   <p className="dn-meta">{(()=>{const [a,b]=tx('tr.datos.anProb',{enlace:'\u0000'}).split('\u0000');return <>{a}<Link href="/problems">{tx('nav.item.problems')}</Link>{b}</>;})()}</p>
  </section>
 </>;
}
