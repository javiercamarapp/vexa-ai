'use client';
import {useAutoRefresh} from './ui/use-auto-refresh';
import {useEffect,useState} from 'react';
import {useT} from './i18n/proveedor';
type Head={id:string;state:string;version:number;selected_revision_id:string|null};
type History={head:Head;selected_hash:string|null;revisions:{id:string;hash:string;snapshot:unknown}[]};
export function CanonicalHistory({jobId,progressKey}:{jobId:string;progressKey:string}){
 const t=useT();
 const [heads,setHeads]=useState<Head[]>([]),[history,setHistory]=useState<History|null>(null),[reason,setReason]=useState(''),[error,setError]=useState('');
 const base='/api/jobs/'+jobId+'/canonicals';
 async function load(id?:string){const r=await fetch(base+(id?'/'+id:''),{cache:'no-store'});const body=await r.json();if(!r.ok)throw Error(t('hist.canConsulta',{n:r.status}));if(id)setHistory(body.data);else setHeads(body.data);setError('');}
 useEffect(()=>{
  const controller=new AbortController();
  async function initialize(){try{const r=await fetch(base,{cache:'no-store',signal:controller.signal});const body=await r.json();if(!r.ok)throw Error(t('hist.canConsulta',{n:r.status}));if(!controller.signal.aborted){setHeads(body.data);setError('');}}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:t('hist.canNoDisp'));}}
  void initialize();return()=>controller.abort();
 },[base,progressKey,t]);
 // Datos nuevos: relectura en segundo plano del historial abierto; conserva lo pintado si falla.
 async function refresh(){try{await load();if(history)await load(history.head.id);}catch{/* se conserva lo pintado */}}
 useAutoRefresh(refresh);
 async function select(revisionId:string){if(!history)return;try{const r=await fetch(base+'/'+history.head.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revisionId,expectedVersion:history.head.version,reason})});if(r.status===409){await load(history.head.id);setError(t('hist.canVersion'));setReason('');return;}if(!r.ok)throw Error(t('hist.canSeleccion',{n:r.status}));setHistory((await r.json()).data);setReason('');setError('');await load();}catch(e){setError(e instanceof Error?e.message:t('hist.canNoDisp'));}}
 return <section><h2>{t('hist.canTitulo')}</h2><p>{t('hist.canIntro')}</p>{error&&<p role="alert">{error}</p>}{heads.map(h=><button key={h.id} onClick={()=>void load(h.id).catch(e=>setError(e.message))}>{h.id} · {h.state}</button>)}{history&&<><p>{t('hist.canEstado',{estado:history.head.state,version:history.head.version,hash:history.selected_hash??t('hist.canSinEleccion')})}</p><label>{t('hist.canMotivo')}<input value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)}/></label>{history.revisions.map(r=><article key={r.id}><p>{t('hist.canRevision',{id:r.id,hash:r.hash})}</p><pre>{JSON.stringify(r.snapshot,null,2)}</pre><button disabled={!reason.trim()} onClick={()=>void select(r.id)}>{t('hist.canElegir')}</button></article>)}</>}</section>;
}
