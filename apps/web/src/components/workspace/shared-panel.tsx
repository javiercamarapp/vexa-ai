'use client';
import {useWorkspaceNavigation,workspaceLocation} from './navigation-lifecycle';
import {pinWorkspaceQuery,latestWorkspaceQuery} from '../../../../../packages/workspace-service/navigation.mjs';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Bundle,Scope} from '../../lib/workspace/contracts';
import {DataState} from './data-state';
import {ScopeBar} from './scope-bar';
import {CurrentProblems} from './current-problems';
import {OverviewDashboard} from './overview-dashboard';
import {CoverageBand} from '../ui/coverage-band';
import {TrendCharts} from '../ui/trend-chart';
import {ProblemsView} from './problems-view';
import {PageHeader} from '../ui/page-header';
import {Button,LinkButton,Refresh,Download,Arrow} from '../ui/button';
import {Popover} from '../ui/overlay';
import {IdChip} from '../ui/id-chip';
import {EmptyState} from '../ui/empty-state';
import {Icon} from '../ui/icons';
import {SkeletonStats,SkeletonChart,SkeletonCards} from '../ui/skeletons';
type ViewScope=Scope & {basis:string;exponent?:number};
type ViewBundle=Omit<Bundle,'meta'> & {meta:Omit<Bundle['meta'],'scope_hash'> & {scope_hash:string|null;base_snapshot_id:string|null;base_scope_hash:string|null;cursor_auth_hash:string;scope:ViewScope;mapping_manifest_id:string|null;can_manage:boolean}};
function initialScope(query:string):ViewScope{
 const q=new URLSearchParams(query),now=new Date(),start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)),end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1));
 return {date_start:q.get('date_start')??start.toISOString(),date_end:q.get('date_end')??end.toISOString(),currency:q.get('currency')??'USD',timezone:'UTC',date_basis:q.get('date_basis')??'occurred_at',basis:q.get('basis')??'net',...(q.has('exponent')?{exponent:Number(q.get('exponent'))}:{}),sku:q.getAll('sku'),source:q.getAll('source'),snapshot_id:q.get('snapshot_id')};
}
class Missing extends Error{}
export function SharedWorkspacePanel({resource,initialQuery}:{resource:'metrics'|'problems';initialQuery:string}){
 const [query,setQuery]=useState(initialQuery),[reload,setReload]=useState(0),[bundle,setBundle]=useState<ViewBundle|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[missing,setMissing]=useState(false);
 const generation=useRef(0),abort=useRef<AbortController|null>(null),resolved=useRef(initialQuery);
 const invalidate=useCallback(()=>{abort.current?.abort();generation.current++;},[]);
 useWorkspaceNavigation(invalidate);
 const navigate=useCallback((next:URLSearchParams)=>{next.delete('resource');next.delete('format');abort.current?.abort();generation.current++;setBundle(null);setError('');setMissing(false);setBusy(true);resolved.current=next.toString();window.history.pushState(null,'',window.location.pathname+(next.size?'?'+next.toString():''));setQuery(next.toString());setReload(n=>n+1);},[]);
 useEffect(()=>{
  const back=()=>{abort.current?.abort();generation.current++;setBundle(null);setError('');setMissing(false);setBusy(true);const next=window.location.search.slice(1);resolved.current=next;setQuery(next);setReload(n=>n+1);};
  window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back);
 },[]);
 useEffect(()=>{
  const epoch=++generation.current,controller=new AbortController();abort.current=controller;let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort();},25000);
  const load=async()=>{const sourceLocation=workspaceLocation();if(controller.signal.aborted||epoch!==generation.current)return;setBusy(true);setBundle(null);setError('');setMissing(false);const search=new URLSearchParams(query);search.set('resource',resource);
   try{const response=await fetch('/api/workspace?'+search.toString(),{cache:'no-store',signal:controller.signal});if(controller.signal.aborted||epoch!==generation.current)return;
    // Absence of a publication is a normal state (404), not a failure.
    if(response.status===404){setMissing(true);return;}
    const json=await response.json();if(controller.signal.aborted||epoch!==generation.current)return;
    if(!response.ok)throw Error(response.status===401||response.status===403?'Tu acceso cambió. Vuelve a iniciar sesión o selecciona una organización autorizada.':response.status===400?'El alcance no es válido. Revisa fechas, moneda, base y publicación.':'No se pudo consultar la vista. Reintenta cuando el servicio esté disponible.');
    const next=json.data as ViewBundle;if(!next||!Array.isArray(next.items)||!next.meta||!next.meta.scope)throw Error('La respuesta no se pudo verificar.');
    const pinned=pinWorkspaceQuery(query,next.meta);
    if(workspaceLocation()!==sourceLocation)return;resolved.current=pinned.toString();window.history.replaceState(null,'',window.location.pathname+(pinned.size?'?'+pinned.toString():'')+window.location.hash);setBundle(next);
   }catch(e){if(timedOut&&epoch===generation.current){setBundle(null);setError('Las cifras del corte tardaron demasiado en responder (la publicación financiera es grande). La cobertura y la tendencia mensual de abajo sí se calcularon; reintenta con «Actualizar» en unos segundos.');}else if(!controller.signal.aborted&&epoch===generation.current){setBundle(null);setError(e instanceof Error&&!(e instanceof Missing)?e.message:'No se pudo consultar la vista.');}}
   finally{clearTimeout(timer);if((timedOut||!controller.signal.aborted)&&epoch===generation.current)setBusy(false);}
  };
  void Promise.resolve().then(load);return()=>{clearTimeout(timer);controller.abort();invalidate();};
 },[query,reload,resource,invalidate]);
 const scope=bundle?.meta.scope??initialScope(query),pinned=bundle?pinWorkspaceQuery(query,bundle.meta):new URLSearchParams(query);pinned.delete('cursor');
 const apply=(next:URLSearchParams)=>{
  const changedBase=['date_start','date_end'].some(key=>next.get(key)!==scope[key as 'date_start'|'date_end'].slice(0,10))||next.get('currency')!==scope.currency||next.get('basis')!==scope.basis||(next.has('exponent')&&Number(next.get('exponent'))!==scope.exponent);
  if(changedBase&&bundle?.meta.snapshot_id&&next.get('snapshot_id')===bundle.meta.snapshot_id)next.delete('snapshot_id');
  next.delete('cursor');next.delete('scope_hash');navigate(next);
 };
 const update=()=>{setQuery(resolved.current);setReload(n=>n+1);window.dispatchEvent(new Event('vexa:refresh'));};
 const latest=()=>navigate(latestWorkspaceQuery(resolved.current));
 const exportUrl=(format:string)=>{const next=new URLSearchParams(pinned);next.set('resource',resource);next.set('format',format);return '/api/workspace/export?'+next.toString();};
 const canExport=!!(bundle?.meta.snapshot_id&&bundle.meta.scope_hash);
 const isOverview=resource==='metrics';
 const actions=<><Button icon={<Refresh/>} loading={busy} onClick={update}>Actualizar</Button>{canExport&&<Popover align="end" width={220} label="Exportar" trigger={<><Icon name="download" size={14}/><span className="btn-label">Exportar</span></>}>{close=><div className="menu-list"><LinkButton download="workspace.json" href={exportUrl('json')} variant="ghost" size="sm" icon={<Download/>} onClick={close}>{isOverview?'Exportar JSON':'Descargar JSON de este alcance'}</LinkButton><LinkButton download="workspace.csv" href={exportUrl('csv')} variant="ghost" size="sm" icon={<Download/>} onClick={close}>{isOverview?'Exportar CSV':'Descargar CSV de este alcance'}</LinkButton></div>}</Popover>}</>;
 const state=bundle?.meta.state;
 const bar=<ScopeBar scope={scope} onApply={apply} onLatest={latest} busy={busy} extra={resource==='problems'?<CurrentProblems/>:undefined}/>;
 const footer=bundle&&<div className="btn-group more-row">
  <details className="more"><summary>Identidad de la publicación</summary><div className="meta-row"><IdChip value={bundle.meta.snapshot_id??'Sin publicación'} label="Publicación"/><IdChip value={bundle.meta.scope_hash??'Sin vista publicada'} label="Alcance"/></div>{bundle.meta.mapping_manifest_id&&<p className="snapshot">Corte base: {bundle.meta.base_snapshot_id} · Alcance base: {bundle.meta.base_scope_hash} · Versión de clasificación: {bundle.meta.mapping_manifest_id}</p>}</details>
  {bundle.meta.next_cursor&&<Button icon={<Arrow/>} onClick={()=>{const next=new URLSearchParams(pinned);next.set('cursor',bundle.meta.next_cursor!);navigate(next);}}>Página siguiente</Button>}
  {bundle.meta.can_manage&&<><LinkButton href="/economics" variant="ghost" size="sm" icon={<Arrow/>}>{isOverview?'Fuentes y publicaciones':'Revisar fuentes, clasificación de órdenes y publicaciones'}</LinkButton><LinkButton href="/problems/manage" variant="ghost" size="sm" icon={<Arrow/>}>{isOverview?'Catálogo de problemas':'Gestionar el catálogo de problemas'}</LinkButton></>}
 </div>;
 const notice=bundle?.meta.critical_notice&&<aside className="notice-bar" role="alert"><Icon name="alert" size={14}/><strong>Revisión crítica, independiente del importe</strong><p>{bundle.meta.critical_notice}</p></aside>
 const criticalPending=!bundle?.meta.critical_notice&&bundle?.meta.critical_notice_state==='unavailable'&&<aside className="notice-bar" role="status"><Icon name="info" size={14}/><strong>Señales críticas no calculadas ahora</strong><p>No alcanzaron a calcularse en el tiempo permitido; eso no significa que no existan. Revísalas en Problemas.</p></aside>;
 return <section className="stack" aria-label={isOverview?'Resumen con alcance compartido':'Problemas con alcance compartido'}>
  <PageHeader title={isOverview?'Resumen ejecutivo':'Problemas de negocio'} description={isOverview?'Cifras del corte publicado con su cobertura, su clase y su fuente.':'Prioridades con evidencia. La exposición compartida entre problemas no se suma ni equivale a pérdida.'} actions={actions}/>
  {bar}
  {busy&&(isOverview?<div className="stack" role="status" aria-busy="true"><SkeletonStats/><SkeletonChart height={220}/></div>:<div className="stack"><SkeletonCards count={3}/></div>)}
  {error&&<DataState state={{kind:'error',code:'workspace_request_failed',message:error}}/>}
  {isOverview&&!bundle&&!missing&&<div className="stack"><CoverageBand/><TrendCharts/></div>}
  {missing&&!busy&&<EmptyState art="chart" title="Aún no hay un corte publicado para este alcance" body="Cuando se publique un corte con este periodo y estos filtros, sus cifras aparecerán aquí. Mientras tanto puedes probar con la última publicación disponible." action={<Button variant="primary" size="sm" onClick={latest}>Ver la última publicación</Button>} secondary={<LinkButton href="/imports" size="sm" icon={<Arrow/>}>Importar datos</LinkButton>}/>}
  {bundle&&!busy&&<>
   {notice}{criticalPending}
   {isOverview?<>{state!=='empty'&&state&&state!=='ready'&&<DataState state={{kind:state,coverage:bundle.meta.coverage,watermark:bundle.meta.watermark}}/>}<OverviewDashboard key={`${bundle.meta.snapshot_id}:${bundle.meta.scope_hash}`} bundle={bundle} pinned={pinned}/></>
    :<DataState state={state==='empty'?{kind:'empty'}:{kind:state??'partial',coverage:bundle.meta.coverage,watermark:bundle.meta.watermark}}><ProblemsView bundle={bundle} query={pinned.toString()}/></DataState>}
   {footer}
  </>}
 </section>;
}
