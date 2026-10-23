'use client';
import {PageHeader} from './ui/page-header';
import {LinkButton} from './ui/button';
import {StatCard} from './ui/stat-card';
import {StatusChip} from './ui/status-chip';
import {BarList} from './ui/bar-list';
import {Citation} from './ui/citation';
import {EmptyState} from './ui/empty-state';
import {SkeletonStats} from './ui/skeletons';
import {DataState} from './workspace/data-state';
import {nf} from './ui/format';
import {useEffect,useState} from 'react';
import {etiquetaCategoria} from '../lib/legibilidad/categorias.mjs';
import {CategoryVolume} from './ui/category-volume';
import type {EvidenceView,EvidenceSpan} from '../../../../packages/intelligence/evidence-repository.mjs';
function Quote({span,category}:{span:EvidenceSpan;category?:string}){return <Citation quote={span.quote} role={span.role} messageRevisionId={span.message_revision_id} category={category}/>;}
export function EvidencePanel({runId}:{runId:string}){
 const [data,setData]=useState<EvidenceView|null>(null),[error,setError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  let generation=0;
  async function refresh(){
   const current=++generation;
   try{
    const response=await fetch('/api/extraction/'+encodeURIComponent(runId)+'/evidence',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error('No se puede mostrar evidencia autorizada de esta ejecución. Comprueba tus permisos y el estado de la fuente.');
    const result=await response.json();
    if(!controller.signal.aborted&&current===generation){setData(result.data);setError('');}
   }catch(e){
    if(!controller.signal.aborted&&current===generation){setData(null);setError(e instanceof Error?e.message:'No se pudo consultar la evidencia.');}
   }
  }
  void refresh();const timer=setInterval(refresh,10000);
  return()=>{controller.abort();clearInterval(timer);};
 },[runId]); const sev:Record<string,string>={low:'Baja',medium:'Media',high:'Alta',critical:'Crítica',unknown:'Sin determinar'};
 const tone=(v:string):'ok'|'warn'|'bad'|'info'|'neutral'=>v==='critical'||v==='high'?'bad':v==='medium'?'warn':v==='low'?'ok':'neutral';
 const spans=data?data.issues.reduce((n,i)=>n+i.evidence.length,0):0;
 return <section className="stack">
  <PageHeader title="Evidencia del análisis" description="Las citas usan la revisión redactada que recibió el análisis; no confirman por sí solas una causa." actions={<LinkButton href="/analysis" size="sm">Volver a análisis</LinkButton>}/>
  {error?<DataState state={{kind:'error',message:error,code:'evidence'}}/>:!data?<><p role="status" className="sr-only">Cargando evidencia…</p><SkeletonStats count={3}/></>:<>
  {data.state==='historical'&&<p role="status" className="notice-bar">Histórico: estas citas pertenecen a una revisión anterior. No representan una extracción de la revisión vigente.</p>}
  <div className="stat-grid">
   <StatCard label="Hallazgos" icon="flag" kind="observed" value={nf.format(data.abstention?0:data.issues.length)} foot={'Modelo '+data.model}/>
   <StatCard label="Citas" icon="message" kind="observed" value={nf.format(spans)}/>
   <StatCard label="Menciones respaldadas" icon="link" kind="observed" value={nf.format(data.entities.length)}/>
  </div>
  {data.abstention?<EmptyState art="shield" compact title="Sin clasificación concluyente" body="No hubo evidencia suficiente para clasificar esta conversación."/>:<>
  {data.issues.length>1&&<section className="card" aria-label="Citas por hallazgo"><div className="card-title"><div><h2>Citas por hallazgo</h2></div></div><BarList c={7} items={data.issues.map((issue,i)=>({key:String(i),label:etiquetaCategoria(issue.category),value:issue.evidence.length,display:nf.format(issue.evidence.length),kind:'observed' as const}))}/></section>}
  {data.issues.length>1&&<CategoryVolume title="Incidencias de este análisis por categoría" rows={data.issues.map(i=>({category:i.category,count:1}))}/>}
  <div className="cards-grid">{data.issues.map((issue,index)=><article key={index} className="card"><div className="card-title"><div><h2>{etiquetaCategoria(issue.category)}</h2></div><StatusChip tone={tone(issue.severity)}>Severidad {(sev[issue.severity]??issue.severity).toLowerCase()}</StatusChip></div>{issue.evidence.map((span,i)=><Quote key={i} span={span}/>)}</article>)}</div></>}
  {data.entities.length>0&&<section className="stack"><h2>Menciones respaldadas</h2><div className="cards-grid">{data.entities.map((entity,index)=><article key={index} className="card"><h3>{entity.value}</h3>{entity.evidence.map((span,i)=><Quote key={i} span={span}/>)}</article>)}</div></section>}
  </>}
 </section>;
}
