'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import type {EvidenceView,EvidenceSpan} from '../../../../packages/intelligence/evidence-repository.mjs';
function Quote({span}:{span:EvidenceSpan}){return <figure><blockquote>{span.quote}</blockquote><figcaption>{span.role==='customer'?'Cliente':span.role==='agent'?'Agente':'Nota interna'} · Revisión {span.message_revision_id}</figcaption></figure>;}
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
 },[runId]);
 return <section><Link href="/analysis">Volver a análisis</Link><h1>Evidencia del análisis</h1>{error?<p role="alert">{error}</p>:!data?<p>Cargando evidencia…</p>:<>
 {data.state==='historical'&&<p role="status">Histórico: estas citas pertenecen a una revisión anterior. No representan una extracción de la revisión vigente.</p>}
 <p>Modelo: {data.model}. Las citas usan la revisión redactada que recibió el análisis; no confirman por sí solas una causa.</p>
 {data.abstention?<p>No hubo evidencia suficiente para una clasificación concluyente.</p>:data.issues.map((issue,index)=><article key={index}><h2>{issue.category}</h2><p>Severidad: {({low:'Baja',medium:'Media',high:'Alta',critical:'Crítica',unknown:'Sin determinar'} as Record<string,string>)[issue.severity]??issue.severity}</p>{issue.evidence.map((span,i)=><Quote key={i} span={span}/>)}</article>)}
 {data.entities.length>0&&<section><h2>Menciones respaldadas</h2>{data.entities.map((entity,index)=><article key={index}><h3>{entity.value}</h3>{entity.evidence.map((span,i)=><Quote key={i} span={span}/>)}</article>)}</section>}
 </>}</section>;
}
