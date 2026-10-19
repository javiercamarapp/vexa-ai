'use client';
import {Button,LinkButton,Refresh,Arrow} from '../ui/button';
import {useEffect,useRef,useState} from 'react';
type Problem={id:string;label:string;version:number;state:string;conversationIds:string[]};
function problems(value:unknown):Problem[]{
 if(!value||typeof value!=='object'||!('problems' in value)||!Array.isArray(value.problems))throw Error('Respuesta de catálogo no verificable.');
 for(const row of value.problems)if(!row||typeof row.id!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(row.id)||typeof row.label!=='string'||!Number.isInteger(row.version)||!['active','retired'].includes(row.state)||!Array.isArray(row.conversationIds)||row.conversationIds.some((id:unknown)=>typeof id!=='string'))throw Error('Respuesta de catálogo no verificable.');
 return value.problems.filter((row:Problem)=>row.state==='active');
}
export function CurrentProblems(){
 const [rows,setRows]=useState<Problem[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),[revision,setRevision]=useState(0);
 const generation=useRef(0);
 useEffect(()=>{
  const epoch=++generation.current,controller=new AbortController();
  const load=async()=>{
   try{
    const response=await fetch('/api/problems',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error(response.status===401||response.status===403?'Tu acceso cambió. Vuelve a iniciar sesión o selecciona una organización autorizada.':'No se pudo consultar el catálogo. Reintenta.');
    const next=problems(await response.json());
    if(!controller.signal.aborted&&epoch===generation.current){setRows(next);setError('');}
   }catch(e){if(!controller.signal.aborted&&epoch===generation.current){setRows(null);setError(e instanceof Error?e.message:'No se pudo consultar el catálogo.');}}
   finally{if(!controller.signal.aborted&&epoch===generation.current)setBusy(false);}
  };
  void load();return()=>{controller.abort();};
 },[revision]);
 function reload(){generation.current++;setRows(null);setError('');setBusy(true);setRevision(n=>n+1);}
 return <section className="card" aria-label="Catálogo actual de problemas">
  <div className="card-head"><div><p className="eyebrow">Catálogo</p><h2>Problemas de las conversaciones</h2></div><Button size="sm" icon={<Refresh/>} loading={busy} onClick={reload}>Actualizar catálogo</Button></div>
  <p className="card-lead">Incluye problemas sin asociación financiera. Muestra el estado actual y no cambia con los filtros de la publicación financiera.</p>
  {busy&&<div className="skeleton-stack" role="status" aria-label="Consultando problemas autorizados"><span className="skeleton skeleton-line"/><span className="skeleton skeleton-line"/></div>}
  {error&&<p className="state state-error" role="alert">{error}</p>}
  {!busy&&rows&&(!rows.length?<p className="state">No hay problemas activos con evidencia accesible.</p>:<ul className="catalog-list">{rows.map(row=><li key={row.id}><div className="catalog-copy"><LinkButton href={'/problems/'+row.id} className="catalog-link" icon={<Arrow/>}>{row.label}</LinkButton><span className="chip">{row.conversationIds.length} {row.conversationIds.length===1?'conversación':'conversaciones'}</span><span className="chip">v{row.version}</span></div></li>)}</ul>)}
 </section>;
}
