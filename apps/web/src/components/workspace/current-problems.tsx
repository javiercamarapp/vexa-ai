'use client';
import Link from 'next/link';
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
 return <section aria-label="Catálogo actual de problemas">
  <h2>Problemas de las conversaciones</h2>
  <p>Incluye problemas sin asociación financiera. Este catálogo muestra el estado actual y no cambia con los filtros de la publicación financiera.</p>
  <button type="button" disabled={busy} onClick={reload}>Actualizar catálogo</button>
  {busy&&<p role="status">Consultando problemas autorizados…</p>}
  {error&&<p role="alert">{error}</p>}
  {!busy&&rows&&(!rows.length?<p>No hay problemas activos con evidencia accesible.</p>:<ul>{rows.map(row=><li key={row.id}><Link href={'/problems/'+row.id}>{row.label}</Link> · {row.conversationIds.length} conversaciones · versión {row.version}</li>)}</ul>)}
 </section>;
}
