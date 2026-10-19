'use client';
import {useWorkspaceNavigation,workspaceLocation} from './navigation-lifecycle';
import {pinWorkspaceQuery,latestWorkspaceQuery} from '../../../../../packages/workspace-service/navigation.mjs';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Bundle,Scope} from '../../lib/workspace/contracts';
import {formatMinorUnits} from '../../../../../packages/metrics/money.mjs';
import {ratioBps} from './cfo-model.mjs';
import {DataState} from './data-state';
import {SharedFilters} from './shared-filters';
import {CurrentProblems} from './current-problems';
import {GettingStarted} from './getting-started';
import {CfoOverview} from './cfo-overview';
import cfo from './cfo-overview.module.css';
import {PageHeader} from '../ui/page-header';
import {Button,LinkButton,Refresh,Download,Arrow} from '../ui/button';
import {CoverageBand} from '../ui/coverage-band';
import {KindBadge} from '../ui/kind-badge';
import {Citation} from '../ui/citation';
import {IdChip} from '../ui/id-chip';
import {BarChart,type BarDatum} from '../ui/bar-chart';
import {epistemicKind} from '../../lib/epistemic.mjs';
type ViewScope=Scope & {basis:string;exponent?:number};
type ViewBundle=Omit<Bundle,'meta'> & {meta:Omit<Bundle['meta'],'scope_hash'> & {scope_hash:string|null;base_snapshot_id:string|null;base_scope_hash:string|null;cursor_auth_hash:string;scope:ViewScope;mapping_manifest_id:string|null;can_manage:boolean}};
function initialScope(query:string):ViewScope{
 const q=new URLSearchParams(query),now=new Date(),start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)),end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1));
 return {date_start:q.get('date_start')??start.toISOString(),date_end:q.get('date_end')??end.toISOString(),currency:q.get('currency')??'USD',timezone:'UTC',date_basis:q.get('date_basis')??'occurred_at',basis:q.get('basis')??'net',...(q.has('exponent')?{exponent:Number(q.get('exponent'))}:{}),sku:q.getAll('sku'),source:q.getAll('source'),snapshot_id:q.get('snapshot_id')};
}
export function SharedWorkspacePanel({resource,initialQuery}:{resource:'metrics'|'problems';initialQuery:string}){
 const [query,setQuery]=useState(initialQuery),[reload,setReload]=useState(0),[bundle,setBundle]=useState<ViewBundle|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const generation=useRef(0),abort=useRef<AbortController|null>(null),resolved=useRef(initialQuery);
 const invalidate=useCallback(()=>{abort.current?.abort();generation.current++;},[]);
 useWorkspaceNavigation(invalidate);
 const navigate=useCallback((next:URLSearchParams)=>{next.delete('resource');next.delete('format');abort.current?.abort();generation.current++;setBundle(null);setError('');setBusy(true);resolved.current=next.toString();window.history.pushState(null,'',window.location.pathname+(next.size?'?'+next.toString():''));setQuery(next.toString());setReload(n=>n+1);},[]);
 useEffect(()=>{
  const back=()=>{abort.current?.abort();generation.current++;setBundle(null);setError('');setBusy(true);const next=window.location.search.slice(1);resolved.current=next;setQuery(next);setReload(n=>n+1);};
  window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back);
 },[]);
 useEffect(()=>{
  const epoch=++generation.current,controller=new AbortController();abort.current=controller;
  const load=async()=>{const sourceLocation=workspaceLocation();if(controller.signal.aborted||epoch!==generation.current)return;setBusy(true);setBundle(null);setError('');const search=new URLSearchParams(query);search.set('resource',resource);
   try{const response=await fetch('/api/workspace?'+search.toString(),{cache:'no-store',signal:controller.signal});if(controller.signal.aborted||epoch!==generation.current)return;
    const json=await response.json();if(controller.signal.aborted||epoch!==generation.current)return;
    if(!response.ok)throw Error(response.status===401||response.status===403?'Tu acceso cambió. Vuelve a iniciar sesión o selecciona una organización autorizada.':response.status===400?'El alcance no es válido. Revisa fechas, moneda, base y snapshot.':response.status===404?'No hay una publicación accesible para ese snapshot y alcance.':'No se pudo consultar la vista. Reintenta cuando el servicio esté disponible.');
    const next=json.data as ViewBundle;if(!next||!Array.isArray(next.items)||!next.meta||!next.meta.scope)throw Error('La respuesta no se pudo verificar.');
    const pinned=pinWorkspaceQuery(query,next.meta);
    if(workspaceLocation()!==sourceLocation)return;resolved.current=pinned.toString();window.history.replaceState(null,'',window.location.pathname+(pinned.size?'?'+pinned.toString():'')+window.location.hash);setBundle(next);
   }catch(e){if(!controller.signal.aborted&&epoch===generation.current){setBundle(null);setError(e instanceof Error?e.message:'No se pudo consultar la vista.');}}
   finally{if(!controller.signal.aborted&&epoch===generation.current)setBusy(false);}
  };
  void Promise.resolve().then(load);return()=>{controller.abort();invalidate();};
 },[query,reload,resource,invalidate]);
 const scope=bundle?.meta.scope??initialScope(query),pinned=bundle?pinWorkspaceQuery(query,bundle.meta):new URLSearchParams(query);pinned.delete('cursor');
 const apply=(next:URLSearchParams)=>{
  const changedBase=['date_start','date_end'].some(key=>next.get(key)!==scope[key as 'date_start'|'date_end'].slice(0,10))||next.get('currency')!==scope.currency||next.get('basis')!==scope.basis||(next.has('exponent')&&Number(next.get('exponent'))!==scope.exponent);
  if(changedBase&&bundle?.meta.snapshot_id&&next.get('snapshot_id')===bundle.meta.snapshot_id)next.delete('snapshot_id');
  next.delete('cursor');next.delete('scope_hash');navigate(next);
 };
 const update=()=>{setQuery(resolved.current);setReload(n=>n+1);};
 const latest=()=>navigate(latestWorkspaceQuery(resolved.current));
 const exportUrl=(format:string)=>{const next=new URLSearchParams(pinned);next.set('resource',resource);next.set('format',format);return '/api/workspace/export?'+next.toString();};
 const state=bundle?.meta.state;
 if(resource==='metrics')return <section className={cfo.page} aria-label="Resumen con alcance compartido">
  <PageHeader eyebrow="Control financiero" title="Resumen ejecutivo" description="Cifras del corte publicado con su cobertura, su clase (observado, estimado o inferido) y su fuente." actions={<><Button icon={<Refresh/>} loading={busy} onClick={update}>Actualizar</Button><Button disabled={busy} onClick={latest}>Última publicación de este alcance</Button></>}/>
  <CoverageBand/>
  <details className={cfo.scopeBox}><summary>Periodo y filtros <span>{scope.date_start.slice(0,10)} → {scope.date_end.slice(0,10)} (hasta exclusivo) · {scope.currency} · Base {scope.basis}</span></summary><SharedFilters key={JSON.stringify(scope)} scope={scope} onApply={apply}/></details>
  {busy&&<DataState state={{kind:'loading'}}/>}{error&&<DataState state={{kind:'error',code:'workspace_request_failed',message:error}}/>}
  {bundle&&!busy&&<>
   {bundle.meta.critical_notice&&<aside className="state-panel partial" role="alert"><strong>Revisión crítica, independiente del importe</strong><p>{bundle.meta.critical_notice}</p></aside>}
   {!bundle.meta.snapshot_id&&<GettingStarted canManage={bundle.meta.can_manage} pending={bundle.meta.state==='partial'}/> }
   <CfoOverview key={`${bundle.meta.snapshot_id}:${bundle.meta.scope_hash}`} bundle={bundle}/>
   <div className={cfo.publication}><details><summary>Identidad de la publicación</summary><p>Snapshot: {bundle.meta.snapshot_id??'Sin publicación'} · Alcance: {bundle.meta.scope_hash??'Sin vista publicada'}</p>{bundle.meta.mapping_manifest_id&&<p>Snapshot base: {bundle.meta.base_snapshot_id} · Alcance base: {bundle.meta.base_scope_hash} · Versión de clasificación: {bundle.meta.mapping_manifest_id}</p>}</details>{bundle.meta.snapshot_id&&bundle.meta.scope_hash&&<div className="btn-group"><LinkButton download="workspace.json" href={exportUrl('json')} variant="secondary" size="sm" icon={<Download/>}>Exportar JSON</LinkButton><LinkButton download="workspace.csv" href={exportUrl('csv')} variant="secondary" size="sm" icon={<Download/>}>Exportar CSV</LinkButton></div>}</div>
   {bundle.meta.next_cursor&&<div className="btn-group"><Button icon={<Arrow/>} onClick={()=>{const next=new URLSearchParams(pinned);next.set('cursor',bundle.meta.next_cursor!);navigate(next);}}>Página siguiente</Button></div>}
   {bundle.meta.can_manage&&<div className="btn-group"><LinkButton href="/economics" icon={<Arrow/>}>Fuentes y publicaciones</LinkButton><LinkButton href="/problems/manage" icon={<Arrow/>}>Catálogo de problemas</LinkButton></div>}
  </>}
 </section>;
 const statusLabel:Record<string,string>={ready:'Cobertura completa',partial:'Cobertura parcial',stale:'Corte anterior'};
 const chart:BarDatum[]=bundle?(()=>{const picks=bundle.items.map(item=>({item,m:item.metrics.find(x=>x.kind==='exposure')??item.metrics[0]}));const known=picks.filter(x=>x.m&&x.m.amount_minor!==null&&/^-?\d+$/.test(x.m.amount_minor));const max=known.reduce((a,x)=>{const n=BigInt(x.m.amount_minor!);const v=n<0n?-n:n;return v>a?v:a;},0n);
  return picks.map(({item,m})=>{const ok=m&&m.amount_minor!==null&&/^-?\d+$/.test(m.amount_minor);const n=ok?BigInt(m.amount_minor!):0n;return {key:item.id,label:item.title,value:ok&&max>0n?ratioBps(n<0n?-n:n,max):ok?0:null,display:!m?'Sin importe':ok?formatMinorUnits(m.amount_minor,m.currency,m.exponent):'Sin importe',kind:m?epistemicKind(m):'unclassified' as const,note:m&&!ok&&m.known_subtotal!==null?'Subtotal conocido: '+formatMinorUnits(m.known_subtotal,m.currency,m.exponent)+'; no es el total.':undefined};});})():[];
 return <section aria-label="Problemas con alcance compartido" className="stack">
  <PageHeader eyebrow="Decisiones con evidencia" title="Problemas de negocio" description="Cifras y cobertura de una publicación fija. La exposición compartida entre problemas no se suma ni equivale a pérdida." actions={<><Button icon={<Refresh/>} loading={busy} onClick={update}>Actualizar vista</Button><Button disabled={busy} onClick={latest}>Última publicación de este alcance</Button></>}/>
  {resource==='problems'&&<CurrentProblems/>}
  <SharedFilters key={JSON.stringify(scope)} scope={scope} onApply={apply}/>
  {busy&&<DataState state={{kind:'loading'}}/>}{error&&<DataState state={{kind:'error',code:'workspace_request_failed',message:error}}/>}
  {bundle&&!busy&&<>
   <div className="meta-row"><IdChip value={bundle.meta.snapshot_id??'Sin publicación'} label="Publicación"/><IdChip value={bundle.meta.scope_hash??'Sin vista publicada'} label="Alcance"/></div>
   {bundle.meta.mapping_manifest_id&&<details><summary>Identidad de esta vista</summary><p className="snapshot">Snapshot base: {bundle.meta.base_snapshot_id} · Alcance base: {bundle.meta.base_scope_hash} · Versión de clasificación: {bundle.meta.mapping_manifest_id}</p></details>}
   {bundle.meta.critical_notice&&<aside className="state-panel partial" role="alert"><strong>Revisión crítica, independiente del importe</strong><p>{bundle.meta.critical_notice}</p></aside>}
   {state!=='empty'&&<section className="card" aria-label="Comparación de exposición por problema"><BarChart title="Ingresos expuestos por problema" unit={'longitud proporcional · '+scope.currency} data={chart}/><p className="card-lead">La exposición es una cifra inferida por vínculo de evidencia: no es pérdida y no se suma entre problemas.</p></section>}
   <DataState state={state==='empty'?{kind:'empty'}:{kind:state??'partial',coverage:bundle.meta.coverage,watermark:bundle.meta.watermark}}>
    <div className="record-grid reveal">{bundle.items.map(item=><article key={item.id} className="card problem-card">
     <div className="card-head"><div><span className="status-pill" data-tone={item.status==='ready'?'ok':item.status==='stale'?'warn':undefined}>{statusLabel[item.status]??item.status}</span><h2>{item.title}</h2></div>{resource==='problems'&&<LinkButton href={'/problems/'+item.id+'?'+pinned.toString()} variant="secondary" size="sm" icon={<Arrow/>}>Ver detalle</LinkButton>}</div>
     <p className="card-lead">{item.summary}</p>
     <dl className="metric-grid">{item.metrics.map((metric,index)=><div key={index}><dt>{metric.label} <KindBadge metric={metric}/></dt><dd>{formatMinorUnits(metric.amount_minor,metric.currency,metric.exponent)}<small>Fuente: <code>{metric.source_ref}</code></small>{metric.amount_minor===null&&metric.known_subtotal!==null&&<p>Subtotal conocido: {formatMinorUnits(metric.known_subtotal,metric.currency,metric.exponent)}; no es el total.</p>}</dd></div>)}</dl>
     <dl className="record-details">{item.details.map((detail,index)=><div key={index}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}<div><dt>Versión</dt><dd>{item.version}</dd></div></dl>
     {item.evidence.length>0&&<details><summary>Evidencia autorizada ({item.evidence.length})</summary>{item.evidence.map(e=><Citation key={e.id} quote={e.quote} role={e.role} messageRevisionId={e.id}/>)}</details>}
    </article>)}</div>
   </DataState>
   {bundle.meta.snapshot_id&&bundle.meta.scope_hash&&<div className="btn-group"><LinkButton download="workspace.json" href={exportUrl('json')} variant="secondary" size="sm" icon={<Download/>}>Descargar JSON de este alcance</LinkButton><LinkButton download="workspace.csv" href={exportUrl('csv')} variant="secondary" size="sm" icon={<Download/>}>Descargar CSV de este alcance</LinkButton></div>}
   {bundle.meta.next_cursor&&<div className="btn-group"><Button icon={<Arrow/>} onClick={()=>{const next=new URLSearchParams(pinned);next.set('cursor',bundle.meta.next_cursor!);navigate(next);}}>Página siguiente</Button></div>}
   {bundle.meta.can_manage&&<div className="btn-group"><LinkButton href="/economics" icon={<Arrow/>}>Revisar fuentes, clasificación de órdenes y publicaciones</LinkButton><LinkButton href="/problems/manage" icon={<Arrow/>}>Gestionar el catálogo de problemas</LinkButton></div>}
  </>}
 </section>;
}
