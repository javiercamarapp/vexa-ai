 'use client';
import {useEffect,useState} from 'react';
type Head={id:string;state:string;version:number;selected_revision_id:string|null};
type History={head:Head;selected_hash:string|null;revisions:{id:string;hash:string;snapshot:unknown}[]};
export function CanonicalHistory({jobId,progressKey}:{jobId:string;progressKey:string}){
 const [heads,setHeads]=useState<Head[]>([]),[history,setHistory]=useState<History|null>(null),[reason,setReason]=useState(''),[error,setError]=useState('');
 const base='/api/jobs/'+jobId+'/canonicals';
 async function load(id?:string){const r=await fetch(base+(id?'/'+id:''),{cache:'no-store'});const body=await r.json();if(!r.ok)throw Error('No se pudo consultar el historial: '+r.status);if(id)setHistory(body.data);else setHeads(body.data);setError('');}
 useEffect(()=>{
  const controller=new AbortController();
  async function initialize(){try{const r=await fetch(base,{cache:'no-store',signal:controller.signal});const body=await r.json();if(!r.ok)throw Error('No se pudo consultar el historial: '+r.status);if(!controller.signal.aborted){setHeads(body.data);setError('');}}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'No disponible');}}
  void initialize();return()=>controller.abort();
 },[base,progressKey]);
 async function refresh(){try{await load();if(history)await load(history.head.id);}catch(e){setError(e instanceof Error?e.message:'No disponible');}}
 async function select(revisionId:string){if(!history)return;try{const r=await fetch(base+'/'+history.head.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revisionId,expectedVersion:history.head.version,reason})});if(r.status===409){await load(history.head.id);setError('La versión cambió. Historial actualizado; revisa las revisiones y vuelve a elegir.');setReason('');return;}if(!r.ok)throw Error('Selección rechazada: '+r.status);setHistory((await r.json()).data);setReason('');setError('');await load();}catch(e){setError(e instanceof Error?e.message:'No disponible');}}
 return <section><h2>Historial canónico</h2><p>Una revisión ambigua requiere elección del owner. Los importes ambiguos son desconocidos y no se suman.</p>{error&&<p role="alert">{error}</p>}<button onClick={()=>void refresh()}>Actualizar historial</button>{heads.map(h=><button key={h.id} onClick={()=>void load(h.id).catch(e=>setError(e.message))}>{h.id} · {h.state}</button>)}{history&&<><p>Estado {history.head.state} · versión {history.head.version} · hash elegido {history.selected_hash??'Sin elección'}</p><label>Motivo de selección<input value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)}/></label>{history.revisions.map(r=><article key={r.id}><p>Revisión {r.id} · hash {r.hash}</p><pre>{JSON.stringify(r.snapshot,null,2)}</pre><button disabled={!reason.trim()} onClick={()=>void select(r.id)}>Elegir esta revisión</button></article>)}</>}</section>;
}
