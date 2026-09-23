'use client';
import Link from 'next/link';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Bundle,Scope} from '../../lib/workspace/contracts';
import {formatMinorUnits} from '../../../../../packages/metrics/money.mjs';
import {DataState} from './data-state';
import {SharedFilters} from './shared-filters';
type ViewScope=Scope & {basis:string;exponent?:number};
type ViewBundle=Omit<Bundle,'meta'> & {meta:Omit<Bundle['meta'],'scope_hash'> & {scope_hash:string|null;base_snapshot_id:string|null;base_scope_hash:string|null;cursor_auth_hash:string;scope:ViewScope;mapping_manifest_id:string|null;can_manage:boolean}};
function initialScope(query:string):ViewScope{
 const q=new URLSearchParams(query),now=new Date(),start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)),end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1));
 return {date_start:q.get('date_start')??start.toISOString(),date_end:q.get('date_end')??end.toISOString(),currency:q.get('currency')??'USD',timezone:'UTC',date_basis:q.get('date_basis')??'occurred_at',basis:q.get('basis')??'net',...(q.has('exponent')?{exponent:Number(q.get('exponent'))}:{}),sku:q.getAll('sku'),source:q.getAll('source'),snapshot_id:q.get('snapshot_id')};
}
export function SharedWorkspacePanel({resource,initialQuery}:{resource:'metrics'|'problems';initialQuery:string}){
 const [query,setQuery]=useState(initialQuery),[reload,setReload]=useState(0),[bundle,setBundle]=useState<ViewBundle|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const generation=useRef(0),abort=useRef<AbortController|null>(null),resolved=useRef(initialQuery);
 const invalidate=useCallback(()=>{generation.current++;},[]);
 const navigate=useCallback((next:URLSearchParams)=>{next.delete('resource');next.delete('format');abort.current?.abort();generation.current++;setBundle(null);setError('');setBusy(true);resolved.current=next.toString();window.history.pushState(null,'',window.location.pathname+(next.size?'?'+next.toString():''));setQuery(next.toString());setReload(n=>n+1);},[]);
 useEffect(()=>{
  const back=()=>{abort.current?.abort();generation.current++;setBundle(null);setError('');setBusy(true);const next=window.location.search.slice(1);resolved.current=next;setQuery(next);setReload(n=>n+1);};
  window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back);
 },[]);
 useEffect(()=>{
  const epoch=++generation.current,controller=new AbortController();abort.current=controller;
  const load=async()=>{if(controller.signal.aborted||epoch!==generation.current)return;setBusy(true);setBundle(null);setError('');const search=new URLSearchParams(query);search.set('resource',resource);
   try{const response=await fetch('/api/workspace?'+search.toString(),{cache:'no-store',signal:controller.signal});if(controller.signal.aborted||epoch!==generation.current)return;
    const json=await response.json();if(controller.signal.aborted||epoch!==generation.current)return;
    if(!response.ok)throw Error(response.status===401||response.status===403?'Tu acceso cambió. Vuelve a iniciar sesión o selecciona una organización autorizada.':response.status===400?'El alcance no es válido. Revisa fechas, moneda, base y snapshot.':response.status===404?'No hay una publicación accesible para ese snapshot y alcance.':'No se pudo consultar la vista. Reintenta cuando el servicio esté disponible.');
    const next=json.data as ViewBundle;if(!next||!Array.isArray(next.items)||!next.meta||!next.meta.scope)throw Error('La respuesta no se pudo verificar.');
    const pinned=new URLSearchParams(query);pinned.delete('resource');pinned.delete('format');if(next.meta.snapshot_id)pinned.set('snapshot_id',next.meta.snapshot_id);else pinned.delete('snapshot_id');if(next.meta.scope_hash)pinned.set('scope_hash',next.meta.scope_hash);else pinned.delete('scope_hash');
    resolved.current=pinned.toString();window.history.replaceState(null,'',window.location.pathname+(pinned.size?'?'+pinned.toString():''));setBundle(next);
   }catch(e){if(!controller.signal.aborted&&epoch===generation.current){setBundle(null);setError(e instanceof Error?e.message:'No se pudo consultar la vista.');}}
   finally{if(!controller.signal.aborted&&epoch===generation.current)setBusy(false);}
  };
  void Promise.resolve().then(load);return()=>{controller.abort();invalidate();};
 },[query,reload,resource,invalidate]);
 const scope=bundle?.meta.scope??initialScope(query),pinned=new URLSearchParams(query);pinned.delete('cursor');if(bundle?.meta.snapshot_id)pinned.set('snapshot_id',bundle.meta.snapshot_id);if(bundle?.meta.scope_hash)pinned.set('scope_hash',bundle.meta.scope_hash);
 const apply=(next:URLSearchParams)=>{
  const changedBase=['date_start','date_end'].some(key=>next.get(key)!==scope[key as 'date_start'|'date_end'].slice(0,10))||next.get('currency')!==scope.currency||next.get('basis')!==scope.basis||(next.has('exponent')&&Number(next.get('exponent'))!==scope.exponent);
  if(changedBase&&bundle?.meta.snapshot_id&&next.get('snapshot_id')===bundle.meta.snapshot_id)next.delete('snapshot_id');
  next.delete('cursor');next.delete('scope_hash');navigate(next);
 };
 const update=()=>{setQuery(resolved.current);setReload(n=>n+1);};
 const latest=()=>{const next=new URLSearchParams(resolved.current);next.delete('snapshot_id');next.delete('scope_hash');next.delete('cursor');navigate(next);};
 const exportUrl=(format:string)=>{const next=new URLSearchParams(pinned);next.set('resource',resource);next.set('format',format);return '/api/workspace/export?'+next.toString();};
 const state=bundle?.meta.state;
 return <section aria-label={resource==='metrics'?'Resumen con alcance compartido':'Problemas con alcance compartido'}>
  <p className="eyebrow">Decisiones con evidencia</p><h1>{resource==='metrics'?'Resumen ejecutivo':'Problemas de negocio'}</h1>
  <p className="intro">Cifras y cobertura de una publicación fija. La exposición compartida entre problemas no se suma ni equivale a pérdida.</p>
  <SharedFilters key={JSON.stringify(scope)} scope={scope} onApply={apply}/>
  <button type="button" disabled={busy} onClick={update}>Actualizar vista</button><button type="button" disabled={busy} onClick={latest}>Ver publicación más reciente</button>
  {busy&&<DataState state={{kind:'loading'}}/>}{error&&<DataState state={{kind:'error',code:'workspace_request_failed',message:error}}/>}
  {bundle&&!busy&&<>
   <p className="snapshot">Snapshot: {bundle.meta.snapshot_id??'Sin publicación'} · Alcance: {bundle.meta.scope_hash??'Sin vista publicada'}</p>
   {bundle.meta.mapping_manifest_id&&<details><summary>Identidad de esta vista</summary><p className="snapshot">Snapshot base: {bundle.meta.base_snapshot_id} · Alcance base: {bundle.meta.base_scope_hash} · Versión de clasificación: {bundle.meta.mapping_manifest_id}</p></details>}
   {bundle.meta.critical_notice&&<aside className="state-panel partial" role="alert"><strong>Revisión crítica, independiente del importe</strong><p>{bundle.meta.critical_notice}</p></aside>}
   {bundle.meta.snapshot_id&&bundle.meta.scope_hash&&<p><a download="workspace.json" href={exportUrl('json')}>Descargar JSON de este alcance</a>{' · '}<a download="workspace.csv" href={exportUrl('csv')}>Descargar CSV de este alcance</a></p>}
   <DataState state={state==='empty'?{kind:'empty'}:{kind:state??'partial',coverage:bundle.meta.coverage,watermark:bundle.meta.watermark}}>
    <div className="record-grid">{bundle.items.map(item=><article key={item.id} className="record-card"><header><span className="status">{item.status}</span><h2>{resource==='problems'?<Link href={'/problems/'+item.id+'?'+pinned.toString()}>{item.title}</Link>:item.title}</h2></header><p>{item.summary}</p>
     <dl className="metric-grid">{item.metrics.map((metric,index)=><div key={index}><dt>{metric.label}</dt><dd>{formatMinorUnits(metric.amount_minor,metric.currency,metric.exponent)}<small>{metric.kind} · Referencia: {metric.source_ref}</small>{metric.amount_minor===null&&metric.known_subtotal!==null&&<p>Subtotal conocido: {formatMinorUnits(metric.known_subtotal,metric.currency,metric.exponent)}; no es el total.</p>}</dd></div>)}</dl>
     <dl className="record-details">{item.details.map((detail,index)=><div key={index}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}<div><dt>Versión</dt><dd>{item.version}</dd></div></dl>
     {item.evidence.length>0&&<details><summary>Evidencia autorizada ({item.evidence.length})</summary>{item.evidence.map(e=><figure key={e.id}><blockquote>{e.quote}</blockquote><figcaption>{e.role} · {e.source_ref}</figcaption></figure>)}</details>}
    </article>)}</div>
   </DataState>
   {bundle.meta.next_cursor&&<button type="button" onClick={()=>{const next=new URLSearchParams(pinned);next.set('cursor',bundle.meta.next_cursor!);navigate(next);}}>Página siguiente</button>}
   {bundle.meta.can_manage&&<p><Link href="/economics">Revisar fuentes, clasificación de órdenes y publicaciones</Link>{' · '}<Link href="/problems/manage">Gestionar el catálogo de problemas</Link></p>}
  </>}
 </section>;
}
