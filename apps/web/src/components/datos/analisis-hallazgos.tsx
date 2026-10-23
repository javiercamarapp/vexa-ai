'use client';
import {useEffect,useMemo,useState} from 'react';
import type {TrendsView} from '../../../../../packages/workspace-service/trends.mjs';
import {resumenEvidencia,SEVERIDAD,tonoSeveridad,type ResumenEvidencia} from '../../lib/legibilidad/hallazgos.mjs';
import {coberturaDeTendencias} from '../../lib/legibilidad/resumen-ejecutivo.mjs';
import {fechaCorteLegible} from '../../lib/legibilidad/fechas.mjs';
import {StatusChip} from '../ui/status-chip';
import {KindBadge} from '../ui/kind-badge';
import {LinkButton,Arrow} from '../ui/button';
import {useJson} from '../ui/use-json';
import {nf} from '../ui/format';
import Link from '../workspace/navigation-lifecycle';
import './datos.css';

export type JobFila={id:string;runId:string|null;conversationId:string;state:string;runStatus:string|null;reason:string|null;createdAt?:string};
const ESTADO:Record<string,{texto:string;tono:'ok'|'warn'|'info'|'muted'}>={queued:{texto:'En cola',tono:'info'},running:{texto:'Analizando',tono:'info'},succeeded:{texto:'Terminado',tono:'ok'},failed:{texto:'Requiere atención',tono:'warn'},cancelled:{texto:'Cancelado',tono:'muted'}};
const acceptTrends=(j:unknown)=>{const d=(j as {data?:TrendsView})?.data;return d?.conversations?d:null;};
type Estado={[runId:string]:ResumenEvidencia|'error'|undefined};

/** Cobertura honesta («6 de N») y tabla de hallazgos: un asunto legible por análisis en vez de un identificador y seis botones iguales. */
export function HallazgosAnalisis({jobs,fuentes,masPaginas}:{jobs:JobFila[];fuentes:Record<string,string>;masPaginas:boolean}){
 const [ev,setEv]=useState<Estado>({});
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
   <div className="card-title"><div><h2 id="an-cob-t">Cobertura del análisis</h2><p>{cob.pct===null&&trends.busy?'Calculando la cobertura…':cob.texto}</p></div>{total!==null&&<KindBadge kind={cob.estimado?'estimated':'observed'}/>}</div>
   <div className="dn-bar" role="img" aria-label={cob.pct===null?'Cobertura no disponible':`Analizadas: ${cob.pct.toLocaleString('es-MX')} % de las conversaciones cargadas`}>{cob.pct!==null&&<span className="dn-in" style={{width:Math.max(1,Math.min(100,cob.pct))+'%'}}/>}</div>
   <p className="dn-meta">{cob.nota} Esta lista muestra {nf.format(enPagina)} {enPagina===1?'conversación analizada':'conversaciones analizadas'} en la página actual{masPaginas?' (hay más trabajos en otras páginas)':''}; no es la cobertura. Con hallazgo concluyente: {nf.format(conHallazgo)} de {nf.format(runs.length)} análisis terminados que se pudieron leer.</p>
  </section>
  <section className="card" aria-labelledby="an-tab-t">
   <div className="card-title"><div><h2 id="an-tab-t">Hallazgos por análisis</h2><p>Lo que encontró cada análisis, con su evidencia citada.</p></div></div>
   <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla de hallazgos, desplazamiento horizontal">
    <table className="dn-tabla"><thead><tr><th scope="col">Hallazgo</th><th scope="col">Severidad</th><th scope="col">Conversación</th><th scope="col">Problema asociado</th><th scope="col">Fecha</th><th scope="col">Estado</th><th scope="col"><span className="sr-only">Evidencia</span></th></tr></thead>
    <tbody>{jobs.map(j=>{const e=j.runId?ev[j.runId]:undefined,st=ESTADO[j.state]??{texto:j.state,tono:'muted' as const};
     const termino=j.runStatus==='succeeded';
     return <tr key={j.id}>
      <th scope="row" className="dn-asunto">{!termino?<span className="muted">{j.state==='failed'?'Sin resultado':j.state==='succeeded'?'Sin hallazgo concluyente':'Pendiente de análisis'}</span>:e===undefined?<span className="muted">Leyendo…</span>:e==='error'?<span className="muted">No disponible ahora</span>:e.sinConclusion?<span className="muted">Sin hallazgo concluyente</span>:<>{e.titulo}{e.otros>0&&<small className="muted"> · y {e.otros} más</small>}<small className="muted"> · {nf.format(e.citas)} {e.citas===1?'cita':'citas'}</small></>}</th>
      <td>{termino&&e&&e!=='error'&&e.severidad?<StatusChip tone={tonoSeveridad(e.severidad)}>{SEVERIDAD[e.severidad]}</StatusChip>:<span className="muted">—</span>}</td>
      <td>{fuentes[j.conversationId]??'Conversación'} · <code className="dn-code">{j.conversationId.slice(0,8)}</code></td>
      <td><span className="muted" title="Este análisis no está vinculado a un problema agrupado.">Sin vínculo registrado</span></td>
      <td>{fechaCorteLegible(j.createdAt,{hora:false}).replace(' (UTC)','')||'No disponible'}</td>
      <td><StatusChip tone={st.tono}>{st.texto}</StatusChip></td>
      <td>{j.runId&&termino?<LinkButton href={'/analysis/'+j.runId} size="sm" icon={<Arrow/>}>Ver evidencia</LinkButton>:null}</td>
     </tr>;})}</tbody></table>
   </div>
   <p className="dn-meta">Los problemas agrupados se explican en <Link href="/problems">Problemas</Link>: un análisis suelto no se une a un problema sin vínculo registrado.</p>
  </section>
 </>;
}
