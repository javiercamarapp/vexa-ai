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
import {WaitStatus} from '../ui/wait-status';
import {ESPERA} from '../../lib/legibilidad/espera.mjs';
import {DEFINICION} from '../../../../../packages/workspace-service/critico.mjs';
import Link from './navigation-lifecycle';
import {pedirConReintento} from '../../lib/workspace/reintento.mjs';
type ViewScope=Scope & {basis:string;exponent?:number};
type ViewBundle=Omit<Bundle,'meta'> & {meta:Omit<Bundle['meta'],'scope_hash'> & {scope_hash:string|null;base_snapshot_id:string|null;base_scope_hash:string|null;cursor_auth_hash:string;scope:ViewScope;mapping_manifest_id:string|null;can_manage:boolean}};
function initialScope(query:string):ViewScope{
 const q=new URLSearchParams(query),now=new Date(),start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)),end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1));
 return {date_start:q.get('date_start')??start.toISOString(),date_end:q.get('date_end')??end.toISOString(),currency:q.get('currency')??'USD',timezone:'UTC',date_basis:q.get('date_basis')??'occurred_at',basis:q.get('basis')??'net',...(q.has('exponent')?{exponent:Number(q.get('exponent'))}:{}),sku:q.getAll('sku'),source:q.getAll('source'),snapshot_id:q.get('snapshot_id')};
}
class Missing extends Error{}
export function SharedWorkspacePanel({resource,initialQuery}:{resource:'metrics'|'problems';initialQuery:string}){
 const [query,setQuery]=useState(initialQuery),[reload,setReload]=useState(0),[bundle,setBundle]=useState<ViewBundle|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[missing,setMissing]=useState(false),[retrying,setRetrying]=useState(false);
 const generation=useRef(0),abort=useRef<AbortController|null>(null),resolved=useRef(initialQuery);
 const invalidate=useCallback(()=>{abort.current?.abort();generation.current++;},[]);
 useWorkspaceNavigation(invalidate);
 const navigate=useCallback((next:URLSearchParams)=>{next.delete('resource');next.delete('format');abort.current?.abort();generation.current++;setBundle(null);setError('');setMissing(false);setBusy(true);resolved.current=next.toString();window.history.pushState(null,'',window.location.pathname+(next.size?'?'+next.toString():''));setQuery(next.toString());setReload(n=>n+1);},[]);
 useEffect(()=>{
  const back=()=>{abort.current?.abort();generation.current++;setBundle(null);setError('');setMissing(false);setBusy(true);const next=window.location.search.slice(1);resolved.current=next;setQuery(next);setReload(n=>n+1);};
  window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back);
 },[]);
 useEffect(()=>{
  const epoch=++generation.current,controller=new AbortController();abort.current=controller;
  const load=async()=>{const sourceLocation=workspaceLocation();if(controller.signal.aborted||epoch!==generation.current)return;setBusy(true);setBundle(null);setError('');setMissing(false);setRetrying(false);const search=new URLSearchParams(query);search.set('resource',resource);
   try{
    // La primera carga en frío puede pasar de 25 s: plazos más largos y UN reintento automático («Reintentando…») antes de mostrar el error.
    const result=await pedirConReintento(async signal=>{const r=await fetch('/api/workspace?'+search.toString(),{cache:'no-store',signal});return {status:r.status,json:r.status===404?null:await r.json().catch(()=>null)};},{signal:controller.signal,onReintentando:()=>{if(epoch===generation.current)setRetrying(true);}});
    if(controller.signal.aborted||epoch!==generation.current)return;
    if(result.timedOut){setBundle(null);setError('Las cifras del corte tardaron demasiado en responder, incluso después de reintentar (la publicación financiera es grande). La cobertura y la tendencia mensual de abajo sí se calcularon; reintenta con «Actualizar» en unos segundos.');return;}
    // Absence of a publication is a normal state (404), not a failure.
    if(result.status===404){setMissing(true);return;}
    const json=result.json as {data?:unknown}|null;
    if(result.status<200||result.status>=300)throw Error(result.status===401||result.status===403?'Tu acceso cambió. Vuelve a iniciar sesión o selecciona una organización autorizada.':result.status===400?'El alcance no es válido. Revisa fechas, moneda, base y publicación.':'No se pudo consultar la vista. Reintenta cuando el servicio esté disponible.');
    const next=json?.data as ViewBundle;if(!next||!Array.isArray(next.items)||!next.meta||!next.meta.scope)throw Error('La respuesta no se pudo verificar.');
    const pinned=pinWorkspaceQuery(query,next.meta);
    if(workspaceLocation()!==sourceLocation)return;resolved.current=pinned.toString();window.history.replaceState(null,'',window.location.pathname+(pinned.size?'?'+pinned.toString():'')+window.location.hash);setBundle(next);
   }catch(e){if(!controller.signal.aborted&&epoch===generation.current){setBundle(null);setError(e instanceof Error&&!(e instanceof Missing)?e.message:'No se pudo consultar la vista.');}}
   finally{if(!controller.signal.aborted&&epoch===generation.current){setBusy(false);setRetrying(false);}}
  };
  void Promise.resolve().then(load);return()=>{controller.abort();invalidate();};
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
  {bundle.meta.next_cursor&&!bundle.meta.catalog&&<Button icon={<Arrow/>} onClick={()=>{const next=new URLSearchParams(pinned);next.set('cursor',bundle.meta.next_cursor!);navigate(next);}}>Página siguiente</Button>}
  {bundle.meta.can_manage&&<><LinkButton href="/economics" variant="ghost" size="sm" icon={<Arrow/>}>{isOverview?'Fuentes y publicaciones':'Revisar fuentes, clasificación de órdenes y publicaciones'}</LinkButton><LinkButton href="/problems/manage" variant="ghost" size="sm" icon={<Arrow/>}>{isOverview?'Catálogo de problemas':'Gestionar el catálogo de problemas'}</LinkButton></>}
 </div>;
 const notice=bundle?.meta.critical_notice&&<aside className="notice-bar" role="alert"><Icon name="alert" size={14}/><strong>Revisión crítica, independiente del importe</strong><p>{bundle.meta.critical_notice}{bundle.meta.catalog&&<> <a className="row-link-inline" href="#senales-criticas">Ver cuáles son</a></>}</p><details><summary>Qué cuenta como crítico</summary><p>{DEFINICION.senal}</p><p>{DEFINICION.grupo}</p></details></aside>
 const criticalPending=!bundle?.meta.critical_notice&&bundle?.meta.critical_notice_state==='unavailable'&&<aside className="notice-bar" role="status"><Icon name="info" size={14}/><strong>Señales críticas pendientes</strong><p>Aún no se calcularon las señales críticas en esta carga; no significa que no existan.{' '}{isOverview?<>Puedes volver a calcularlas o consultarlas en <Link href={'/problems'+(pinned.size?'?'+pinned.toString():'')} className="row-link-inline">Problemas</Link>.</>:<>Vuelve a calcularlas.</>}</p><Button size="sm" onClick={update}>Volver a calcular</Button></aside>;
 return <section className="stack" aria-label={isOverview?'Resumen con alcance compartido':'Problemas con alcance compartido'}>
  <PageHeader title={isOverview?'Resumen ejecutivo':'Problemas de negocio'} guide={isOverview?'resumen':'problemas'} actions={actions}/>
  {bar}
  {busy&&(isOverview?<div className="stack"><WaitStatus {...ESPERA.resumen}>{retrying&&<p className="wait-retry">Reintentando…</p>}</WaitStatus><div aria-hidden="true"><SkeletonStats/><SkeletonChart height={220}/></div></div>:<div className="stack"><WaitStatus {...ESPERA.problemas}>{retrying&&<p className="wait-retry">Reintentando…</p>}</WaitStatus><div aria-hidden="true"><SkeletonCards count={3}/></div></div>)}
  {error&&<DataState state={{kind:'error',code:'workspace_request_failed',message:error}}/>}
  {isOverview&&!bundle&&!missing&&<div className="stack"><CoverageBand/><TrendCharts/></div>}
  {missing&&!busy&&<EmptyState art="chart" title="Aún no hay un corte publicado para este alcance" body="Cuando se publique un corte con este periodo y estos filtros, sus cifras aparecerán aquí. Mientras tanto puedes probar con la última publicación disponible." action={<Button variant="primary" size="sm" onClick={latest}>Ver la última publicación</Button>} secondary={<LinkButton href="/imports" size="sm" icon={<Arrow/>}>Importar datos</LinkButton>}/>}
  {bundle&&!busy&&<>
   {notice}{criticalPending}
   {isOverview?<>{state!=='empty'&&state&&state!=='ready'&&<DataState state={{kind:state,coverage:bundle.meta.coverage,watermark:bundle.meta.watermark}}/>}<OverviewDashboard key={`${bundle.meta.snapshot_id}:${bundle.meta.scope_hash}`} bundle={bundle} pinned={pinned}/></>
    :bundle.meta.catalog&&state==='partial'?<ProblemsView bundle={bundle} query={pinned.toString()}/>:<DataState state={state==='empty'?{kind:'empty'}:{kind:state??'partial',coverage:bundle.meta.coverage,watermark:bundle.meta.watermark}}><ProblemsView bundle={bundle} query={pinned.toString()}/></DataState>}
   {footer}
  </>}
 </section>;
}
