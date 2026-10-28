'use client';
import {RovaqCargando} from './rovaq-cargando';
import Link from 'next/link';
import {CanonicalHistory} from './canonical-history';
import {useEffect,useState} from 'react';
import {StatusChip} from './ui/status-chip';
import {Button} from './ui/button';
import {tonoCarga,ultimoProgreso,errorDeCarga,reintentable,hayErroresParaDescargar} from '../lib/jobs/progreso.mjs';
import {useT,useLocaleIntl} from './i18n/proveedor';
import type {Clave} from '../lib/i18n';
const ESTADO_CLAVE:Record<string,Clave>={queued:'conx.j.st.queued',running:'conx.j.st.running',succeeded:'conx.j.st.succeeded',partial:'conx.j.st.partial',failed:'conx.j.st.failed',cancelled:'conx.j.st.cancelled'};
const ERROR_CLAVE:Record<string,Clave>={inexistente:'conx.j.err.inexistente','sin-acceso':'conx.j.err.sinAcceso','no-configurado':'conx.j.err.noConfig',reintentar:'conx.j.err.reintentar'};
type Progress={can_select:boolean;id:string;state:string;checkpoint:number;counters:{total:string;accepted:string;rejected:string;duplicates:string;pending:string};last_progress_at:string|null};
type Fallo={tipo:ReturnType<typeof errorDeCarga>['tipo'];mensaje:string};
async function fetchProgress(id:string,signal?:AbortSignal):Promise<Progress>{
 const r=await fetch('/api/jobs/'+id,{cache:'no-store',signal});
 const j=await r.json().catch(()=>null);
 if(!r.ok)throw Object.assign(Error('carga'),{fallo:errorDeCarga(r.status,j?.error?.code)});
 return j.data;
}
const comoFallo=(e:unknown):Fallo=>(e as {fallo?:Fallo})?.fallo??errorDeCarga(undefined);
export function JobProgress({id}:{id:string}){const t=useT(),loc=useLocaleIntl();const filas=(n:unknown)=>{const v=Number(n);return Number.isFinite(v)?t(v===1?'conx.j.filaUna':'conx.j.filasVarias',{n:v.toLocaleString(loc)}):t('conx.j.filasPorConf');},msgFallo=(f:Fallo)=>(ERROR_CLAVE[f.tipo]?t(ERROR_CLAVE[f.tipo]):f.mensaje);const [job,setJob]=useState<Progress|null>(null),[fallo,setFallo]=useState<Fallo|null>(null);
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
 async function cancel(action='cancel'){try{const r=await fetch('/api/jobs/'+id+'/'+action,{method:'POST'});if(!r.ok)throw Error('Cancelación rechazada');await refresh();}catch{setFallo({tipo:'reintentar',mensaje:t('conx.j.errAccion')});}}
 // Una carga que no existe (o a la que no se tiene acceso) no es «cargando»: pantalla amable, sin estado intermedio ni código.
 if(!job&&fallo&&(fallo.tipo==='inexistente'||fallo.tipo==='sin-acceso'))return <section className="task-page stack"><h1>{t('conx.j.titulo')}</h1><article className="task-card stack" aria-label={t('conx.j.noDisp')}><p role="status"><strong>{msgFallo(fallo)}</strong></p><p>{t('conx.j.noDispD')}</p><div className="btn-group"><Link prefetch={false} className="btn btn-primary" href="/imports">{t('conx.j.volver')}</Link></div></article></section>;
 if(!job&&!fallo)return <RovaqCargando mensaje=""/>;
 return <section className="task-page stack"><h1>{t('conx.j.titulo')}</h1><p>{t('conx.j.aviso')}</p>{fallo&&<p role="alert">{msgFallo(fallo)}</p>}{job?<article className="task-card stack" aria-label={t('conx.j.estadoCarga')}><p role="status"><StatusChip tone={tonoCarga(job.state)}>{ESTADO_CLAVE[job.state]?t(ESTADO_CLAVE[job.state]):t('conx.j.st.otro')}</StatusChip> {filas(job.checkpoint)}</p><p>{t('conx.j.conteos',{a:job.counters.accepted,r:job.counters.rejected,d:job.counters.duplicates})}</p><p>{t('conx.j.ultimo',{valor:job.last_progress_at?ultimoProgreso(job.last_progress_at):t('conx.j.sinProgreso')})}</p><div className="btn-group">{['queued','running'].includes(job.state)&&<Button onClick={()=>void cancel()}>{t('conx.j.cancelar')}</Button>}{job.can_select&&['failed','cancelled'].includes(job.state)&&<Button onClick={()=>void cancel('replay')}>{t('conx.j.reintentar')}</Button>}{hayErroresParaDescargar(job.counters.rejected)&&<a className="btn btn-secondary" href={'/api/jobs/'+id+'/errors'}>{t('conx.j.descErrores')}</a>}</div>{job.can_select&&<CanonicalHistory key={id} jobId={id} progressKey={job.state+':'+job.checkpoint}/>}<Link prefetch={false} href='/jobs/setup'>{t('conx.j.configProceso')}</Link></article>:!fallo?<RovaqCargando compacto mensaje={t('conx.j.cargandoReal')}/>:null}<div className="btn-group"><Link prefetch={false} className="btn btn-secondary" href="/imports">{t('conx.j.volver')}</Link></div></section>;
}
