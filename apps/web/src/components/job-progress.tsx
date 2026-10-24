'use client';
import Link from 'next/link';
import {CanonicalHistory} from './canonical-history';
import {useEffect,useState} from 'react';
import {StatusChip} from './ui/status-chip';
import {Button} from './ui/button';
import {estadoCarga,tonoCarga,filasConfirmadas,ultimoProgreso,errorDeCarga,reintentable,hayErroresParaDescargar} from '../lib/jobs/progreso.mjs';
type Progress={can_select:boolean;id:string;state:string;checkpoint:number;counters:{total:string;accepted:string;rejected:string;duplicates:string;pending:string};last_progress_at:string|null};
type Fallo={tipo:ReturnType<typeof errorDeCarga>['tipo'];mensaje:string};
async function fetchProgress(id:string,signal?:AbortSignal):Promise<Progress>{
 const r=await fetch('/api/jobs/'+id,{cache:'no-store',signal});
 const j=await r.json().catch(()=>null);
 if(!r.ok)throw Object.assign(Error('carga'),{fallo:errorDeCarga(r.status,j?.error?.code)});
 return j.data;
}
const comoFallo=(e:unknown):Fallo=>(e as {fallo?:Fallo})?.fallo??errorDeCarga(undefined);
export function JobProgress({id}:{id:string}){const [job,setJob]=useState<Progress|null>(null),[fallo,setFallo]=useState<Fallo|null>(null);
 async function refresh(){try{setJob(await fetchProgress(id));setFallo(null);}catch(e){setFallo(comoFallo(e));}}
 // auto-refresh: sondeo propio cada 2 s mientras la carga avanza (no depende del vigilante global).
 useEffect(()=>{
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
  async function poll(){
   let seguir=true;
   try{const next=await fetchProgress(id,controller.signal);if(!controller.signal.aborted){setJob(next);setFallo(null);}}
   catch(e){if(!controller.signal.aborted){const f=comoFallo(e);setFallo(f);seguir=reintentable(f.tipo);}}
   finally{if(!controller.signal.aborted&&seguir)timer=setTimeout(()=>void poll(),2000);}
  }
  void poll();return()=>{controller.abort();clearTimeout(timer);};
 },[id]);
 async function cancel(action='cancel'){try{const r=await fetch('/api/jobs/'+id+'/'+action,{method:'POST'});if(!r.ok)throw Error('Cancelación rechazada');await refresh();}catch{setFallo({tipo:'reintentar',mensaje:'No se pudo completar la acción sobre la carga. Intenta de nuevo; el estado se actualiza solo.'});}}
 // Una carga que no existe (o a la que no se tiene acceso) no es «cargando»: pantalla amable, sin estado intermedio ni código.
 if(!job&&fallo&&(fallo.tipo==='inexistente'||fallo.tipo==='sin-acceso'))return <section className="task-page stack"><h1>Progreso de la carga</h1><article className="task-card stack" aria-label="Carga no disponible"><p role="status"><strong>{fallo.mensaje}</strong></p><p>Puede haberse eliminado, o el enlace no es el correcto. Las cargas del espacio están en Importaciones.</p><div className="btn-group"><Link prefetch={false} className="btn btn-primary" href="/imports">Volver a importaciones</Link></div></article></section>;
 return <section className="task-page stack"><h1>Progreso de la carga</h1><p>Que la carga termine no significa que el análisis de IA esté completo: el análisis es una etapa posterior.</p>{fallo&&<p role="alert">{fallo.mensaje}</p>}{job?<article className="task-card stack" aria-label="Estado de la carga"><p role="status"><StatusChip tone={tonoCarga(job.state)}>{estadoCarga(job.state)}</StatusChip> {filasConfirmadas(job.checkpoint)}</p><p>Aceptadas {job.counters.accepted} · rechazadas {job.counters.rejected} · duplicadas {job.counters.duplicates}.</p><p>Último progreso: {ultimoProgreso(job.last_progress_at)}</p><div className="btn-group">{['queued','running'].includes(job.state)&&<Button onClick={()=>void cancel()}>Cancelar carga</Button>}{job.can_select&&['failed','cancelled'].includes(job.state)&&<Button onClick={()=>void cancel('replay')}>Reintentar carga</Button>}{hayErroresParaDescargar(job.counters.rejected)&&<a className="btn btn-secondary" href={'/api/jobs/'+id+'/errors'}>Descargar errores (CSV)</a>}</div>{job.can_select&&<CanonicalHistory key={id} jobId={id} progressKey={job.state+':'+job.checkpoint}/>}<Link prefetch={false} href='/jobs/setup'>Configurar proceso en segundo plano</Link></article>:!fallo?<p role="status">Cargando estado real…</p>:null}<div className="btn-group"><Link prefetch={false} className="btn btn-secondary" href="/imports">Volver a importaciones</Link></div></section>;
}
