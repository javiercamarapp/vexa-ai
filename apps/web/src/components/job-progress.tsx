 'use client';
import Link from 'next/link';
import {CanonicalHistory} from './canonical-history';
import {useEffect,useState} from 'react';
type Progress={can_select:boolean;id:string;state:string;checkpoint:number;counters:{total:string;accepted:string;rejected:string;duplicates:string;pending:string};last_progress_at:string|null};
async function fetchProgress(id:string,signal?:AbortSignal):Promise<Progress>{const r=await fetch('/api/jobs/'+id,{cache:'no-store',signal});const j=await r.json();if(!r.ok)throw Error(r.status===503?'Configura la conexión SQL y Auth del servidor y habilita el worker en Configurar worker.':r.status+': '+j.error.code);return j.data;}
export function JobProgress({id}:{id:string}){const [job,setJob]=useState<Progress|null>(null),[error,setError]=useState('');
 async function refresh(){try{setJob(await fetchProgress(id));setError('');}catch(e){setError(e instanceof Error?e.message:'No disponible');}}
 useEffect(()=>{
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
  async function poll(){
   try{const next=await fetchProgress(id,controller.signal);if(!controller.signal.aborted){setJob(next);setError('');}}
   catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'No disponible');}
   finally{if(!controller.signal.aborted)timer=setTimeout(()=>void poll(),2000);}
  }
  void poll();return()=>{controller.abort();clearTimeout(timer);};
 },[id]);
 async function cancel(action='cancel'){try{const r=await fetch('/api/jobs/'+id+'/'+action,{method:'POST'});if(!r.ok)throw Error('Cancelación rechazada');await refresh();}catch(e){setError(e instanceof Error?e.message:'No disponible');}}
 return <section><h1>Progreso de ingestión</h1><p>Un 202 confirma entrada a la cola. Ingestión terminada no significa análisis de IA completado.</p>{error&&<p role="alert">{error}</p>}{job?<><p role="status">{job.state} · {job.checkpoint} filas confirmadas</p><p>Aceptadas {job.counters.accepted}, rechazadas {job.counters.rejected}, duplicadas {job.counters.duplicates}.</p><p>Último progreso: {job.last_progress_at??'Sin progreso'}</p>{['queued','running'].includes(job.state)&&<button onClick={()=>void cancel()}>Cancelar ingestión</button>}{job.can_select&&['failed','cancelled'].includes(job.state)&&<button onClick={()=>void cancel('replay')}>Reintentar ingestión (owner)</button>}<a href={'/api/jobs/'+id+'/errors'}>Descargar errores persistidos CSV</a>{job.can_select&&<CanonicalHistory key={id} jobId={id} progressKey={job.state+':'+job.checkpoint}/>}<Link href='/jobs/setup'>Configurar worker</Link></>:<p>Cargando estado real…</p>}<button onClick={()=>void refresh()}>Actualizar / reintentar</button><Link href="/imports">Volver a importaciones</Link></section>;
}
