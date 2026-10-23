 'use client';
import Link from 'next/link';
import {CanonicalHistory} from './canonical-history';
import {useEffect,useState} from 'react';
import {StatusChip} from './ui/status-chip';
import {Button} from './ui/button';
import {estadoCarga,tonoCarga,filasConfirmadas,ultimoProgreso} from '../lib/jobs/progreso.mjs';
type Progress={can_select:boolean;id:string;state:string;checkpoint:number;counters:{total:string;accepted:string;rejected:string;duplicates:string;pending:string};last_progress_at:string|null};
async function fetchProgress(id:string,signal?:AbortSignal):Promise<Progress>{const r=await fetch('/api/jobs/'+id,{cache:'no-store',signal});const j=await r.json();if(!r.ok)throw Error(r.status===503?'Configura la conexión a la base de datos y la autenticación del servidor y habilita el proceso en segundo plano en «Configurar proceso».':r.status+': '+j.error.code);return j.data;}
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
 return <section className="task-page stack"><h1>Progreso de la carga</h1><p>Que la carga termine no significa que el análisis de IA esté completo: el análisis es una etapa posterior.</p>{error&&<p role="alert">{error}</p>}{job?<article className="task-card stack" aria-label="Estado de la carga"><p role="status"><StatusChip tone={tonoCarga(job.state)}>{estadoCarga(job.state)}</StatusChip> {filasConfirmadas(job.checkpoint)}</p><p>Aceptadas {job.counters.accepted} · rechazadas {job.counters.rejected} · duplicadas {job.counters.duplicates}.</p><p>Último progreso: {ultimoProgreso(job.last_progress_at)}</p><div className="btn-group">{['queued','running'].includes(job.state)&&<Button onClick={()=>void cancel()}>Cancelar carga</Button>}{job.can_select&&['failed','cancelled'].includes(job.state)&&<Button onClick={()=>void cancel('replay')}>Reintentar carga</Button>}<a className="btn btn-secondary" href={'/api/jobs/'+id+'/errors'}>Descargar errores (CSV)</a></div>{job.can_select&&<CanonicalHistory key={id} jobId={id} progressKey={job.state+':'+job.checkpoint}/>}<Link href='/jobs/setup'>Configurar proceso en segundo plano</Link></article>:<p>Cargando estado real…</p>}<div className="btn-group"><Button onClick={()=>void refresh()}>Actualizar</Button><Link className="btn btn-secondary" href="/imports">Volver a importaciones</Link></div></section>;
}
