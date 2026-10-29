'use client';
import {useT} from '../i18n/proveedor';
import {RovaqCargando} from '../rovaq-cargando';
import {useWorkspaceNavigation,workspaceLocation} from './navigation-lifecycle';
import {pinWorkspaceQuery,latestWorkspaceQuery} from '../../../../../packages/workspace-service/navigation.mjs';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {Bundle,Scope} from '../../lib/workspace/contracts';
import {DataState} from './data-state';
import {ScopeBar} from './scope-bar';
import {CurrentProblems} from './current-problems';
import {OverviewDashboard} from './overview-dashboard';
import {CoverageBand} from '../ui/coverage-band';
import {TrendCharts} from '../ui/trend-chart';
import {ProblemsView} from './problems-view';
import {PageHeader} from '../ui/page-header';
import {Notice} from '../ui/notice';
import {Button,LinkButton,Download,Arrow} from '../ui/button';
import {Popover} from '../ui/overlay';
import {IdChip} from '../ui/id-chip';
import {EmptyState} from '../ui/empty-state';
import {Icon} from '../ui/icons';
import {SkeletonStats,SkeletonChart,SkeletonCards} from '../ui/skeletons';
import {WaitStatus} from '../ui/wait-status';
import {ESPERA} from '../../lib/legibilidad/espera.mjs';
import {lineaProblemas} from '../../lib/legibilidad/guias.mjs';
import {DEFINICION,fraseCriticos} from '../../../../../packages/workspace-service/critico.mjs';
import Link from './navigation-lifecycle';
import {pedirConReintento,mensajeDeError,esErrorDeRed} from '../../lib/workspace/reintento.mjs';
import {claveCache,guardarCache,leerCache,invalidarCache} from '../../lib/workspace/cache.mjs';
import {pedirSwr} from '../../lib/workspace/swr.mjs';
import {LineaCache} from '../ui/linea-cache';
type ViewScope=Scope & {basis:string;exponent?:number};
type ViewBundle=Omit<Bundle,'meta'> & {meta:Omit<Bundle['meta'],'scope_hash'> & {scope_hash:string|null;base_snapshot_id:string|null;base_scope_hash:string|null;cursor_auth_hash:string;scope:ViewScope;mapping_manifest_id:string|null;can_manage:boolean}};
function initialScope(query:string):ViewScope{
 const q=new URLSearchParams(query),now=new Date(),start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)),end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1));
 return {date_start:q.get('date_start')??start.toISOString(),date_end:q.get('date_end')??end.toISOString(),currency:q.get('currency')??'USD',timezone:'UTC',date_basis:q.get('date_basis')??'occurred_at',basis:q.get('basis')??'net',...(q.has('exponent')?{exponent:Number(q.get('exponent'))}:{}),sku:q.getAll('sku'),source:q.getAll('source'),snapshot_id:q.get('snapshot_id')};
}
class Missing extends Error{}
const useAntesDePintar=typeof window==='undefined'?useEffect:useLayoutEffect;
export function SharedWorkspacePanel({resource,initialQuery}:{resource:'metrics'|'problems';initialQuery:string}){
 const [query,setQuery]=useState(initialQuery),[reload,setReload]=useState(0),[bundle,setBundle]=useState<ViewBundle|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[missing,setMissing]=useState(false),[retrying,setRetrying]=useState(false),[sinRed,setSinRed]=useState(false),[edadCache,setEdadCache]=useState<number|null>(null),[viejo,setViejo]=useState(false);
 const t=useT(),tRef=useRef(t);useEffect(()=>{tRef.current=t;},[t]);// Los mensajes de error se arman dentro del efecto de carga: leen el idioma vigente sin relanzar la lectura.
 const generation=useRef(0),abort=useRef<AbortController|null>(null),resolved=useRef(initialQuery),frescas=useRef(false),bundleRef=useRef<ViewBundle|null>(null);
 useEffect(()=>{bundleRef.current=bundle;},[bundle]);
 const invalidate=useCallback(()=>{abort.current?.abort();generation.current++;},[]);
 useWorkspaceNavigation(invalidate);
 const navigate=useCallback((next:URLSearchParams)=>{next.delete('resource');next.delete('format');abort.current?.abort();generation.current++;setBundle(null);setError('');setMissing(false);setBusy(true);resolved.current=next.toString();window.history.pushState(null,'',window.location.pathname+(next.size?'?'+next.toString():''));setQuery(next.toString());setReload(n=>n+1);},[]);
 useEffect(()=>{
  const back=()=>{abort.current?.abort();generation.current++;setBundle(null);setError('');setMissing(false);setBusy(true);const next=window.location.search.slice(1);resolved.current=next;setQuery(next);setReload(n=>n+1);};
  window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back);
 },[]);
 // Antes de pintar: si ya hay una lectura de este alcance en la caché, la primera imagen es el dato, no un esqueleto.
 useAntesDePintar(()=>{const g=leerCache(claveCache(resource,query)),b=g?.datos as ViewBundle|undefined;if(g&&b&&Array.isArray(b.items)&&b.meta?.scope){setBundle(b);setEdadCache(g.edadMs);if(g.fresca)setBusy(false);}},[query,resource]);
 useEffect(()=>{
  const epoch=++generation.current,controller=new AbortController();abort.current=controller;
  const load=async()=>{const sourceLocation=workspaceLocation();if(controller.signal.aborted||epoch!==generation.current)return;setRetrying(false);setSinRed(false);setMissing(false);setViejo(false);setError('');const search=new URLSearchParams(query);search.set('resource',resource);
   // Stale-while-revalidate: la última lectura buena de este alcance (≤30 min) se pinta ya, rotulada con su antigüedad; si es fresca (≤5 min) no se vuelve a pedir,
   // y si no, se revalida en segundo plano SIN vaciar la pantalla. La lectura «frescas» fuerza la relectura pero conserva lo que se ve.
   const clave=claveCache(resource,query),guardada=leerCache(clave),forzar=frescas.current;frescas.current=false;
   const previo=guardada&&Array.isArray((guardada.datos as ViewBundle)?.items)&&(guardada.datos as ViewBundle).meta?.scope?guardada:null;
   let pintado=false;
   try{
    if(previo){const b=previo.datos as ViewBundle,fijado=pinWorkspaceQuery(query,b.meta);if(workspaceLocation()!==sourceLocation)return;resolved.current=fijado.toString();window.history.replaceState(null,'',window.location.pathname+(fijado.size?'?'+fijado.toString():'')+window.location.hash);setEdadCache(previo.edadMs);setBundle(b);setError('');pintado=true;if(previo.fresca&&!forzar){setBusy(false);return;}}
    else if(forzar&&bundleRef.current){pintado=true;}
    else{setBundle(null);setError('');setEdadCache(null);}
    setBusy(true);
    // La primera carga en frío puede pasar de 25 s: plazos más largos y UN reintento automático («Reintentando…») antes de mostrar el error.
    const result=await pedirConReintento(async signal=>{const r=await pedirSwr('/api/workspace?'+search.toString(),{signal,valida:j=>{const d=(j as {data?:ViewBundle})?.data;return d&&Array.isArray(d.items)&&d.meta?.scope?j:null;}});return {status:r.status,json:r.json};},{signal:controller.signal,onReintentando:(_i,causa)=>{if(epoch===generation.current){setRetrying(true);setSinRed(esErrorDeRed(causa));}}});
    if(controller.signal.aborted||epoch!==generation.current)return;
    if(result.timedOut){if(pintado){setViejo(true);return;}setBundle(null);setError(tRef.current('panel.err.timeout'));return;}
    // Absence of a publication is a normal state (404), not a failure.
    if(result.status===404){setBundle(null);setEdadCache(null);setMissing(true);return;}
    const json=result.json as {data?:unknown}|null;
    if(result.status<200||result.status>=300)throw Error(result.status===401||result.status===403?tRef.current('panel.err.acceso'):result.status===400?tRef.current('panel.err.alcance'):tRef.current('panel.err.consulta'));
    const next=json?.data as ViewBundle;if(!next||!Array.isArray(next.items)||!next.meta||!next.meta.scope)throw Error(tRef.current('panel.err.verificar'));
    const pinned=pinWorkspaceQuery(query,next.meta);
    if(workspaceLocation()!==sourceLocation)return;resolved.current=pinned.toString();window.history.replaceState(null,'',window.location.pathname+(pinned.size?'?'+pinned.toString():'')+window.location.hash);guardarCache(claveCache(resource,query),next);guardarCache(claveCache(resource,pinned.toString()),next);setEdadCache(null);setViejo(false);setBundle(next);
   }catch(e){if(!controller.signal.aborted&&epoch===generation.current){if(pintado){setViejo(true);return;}setBundle(null);setError(e instanceof Missing?tRef.current('panel.err.generico'):mensajeDeError(e,tRef.current('panel.err.generico')));}}
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
 // Datos nuevos (vigilante invisible) o «Volver a calcular» = evento vexa:refresh: el panel invalida su caché y relee SIN vaciar la pantalla.
 const refrescar=useCallback(()=>{invalidarCache();frescas.current=true;setQuery(resolved.current);setReload(n=>n+1);},[]);
 useEffect(()=>{window.addEventListener('vexa:refresh',refrescar);return()=>window.removeEventListener('vexa:refresh',refrescar);},[refrescar]);
 const update=()=>{window.dispatchEvent(new Event('vexa:refresh'));};
 const latest=()=>navigate(latestWorkspaceQuery(resolved.current));
 const exportUrl=(format:string)=>{const next=new URLSearchParams(pinned);next.set('resource',resource);next.set('format',format);return '/api/workspace/export?'+next.toString();};
 const canExport=!!(bundle?.meta.snapshot_id&&bundle.meta.scope_hash);
 const isOverview=resource==='metrics';
 const actions=<>{canExport&&<Popover align="end" width={220} label={t('panel.exportar')} trigger={<><Icon name="download" size={14}/><span className="btn-label">{t('panel.exportar')}</span></>}>{close=><div className="menu-list"><LinkButton download="workspace.json" href={exportUrl('json')} variant="ghost" size="sm" icon={<Download/>} onClick={close}>{isOverview?t('panel.exportarJson'):t('panel.descargarJson')}</LinkButton><LinkButton download="workspace.csv" href={exportUrl('csv')} variant="ghost" size="sm" icon={<Download/>} onClick={close}>{isOverview?t('panel.exportarCsv'):t('panel.descargarCsv')}</LinkButton></div>}</Popover>}</>;
 const state=bundle?.meta.state;
 const bar=<ScopeBar scope={scope} onApply={apply} onLatest={latest} busy={busy} extra={resource==='problems'?<CurrentProblems/>:undefined}/>;
 const footer=bundle&&<div className="btn-group more-row">
  <details className="more"><summary>{t('panel.identidad')}</summary><div className="meta-row"><IdChip value={bundle.meta.snapshot_id??t('panel.sinPublicacion')} label={t('panel.publicacion')}/><IdChip value={bundle.meta.scope_hash??t('panel.sinVista')} label={t('panel.alcance')}/></div>{bundle.meta.mapping_manifest_id&&<p className="snapshot">Corte base: {bundle.meta.base_snapshot_id} · Alcance base: {bundle.meta.base_scope_hash} · Versión de clasificación: {bundle.meta.mapping_manifest_id}</p>}</details>
  {bundle.meta.next_cursor&&!bundle.meta.catalog&&<Button icon={<Arrow/>} onClick={()=>{const next=new URLSearchParams(pinned);next.set('cursor',bundle.meta.next_cursor!);navigate(next);}}>{t('panel.siguiente')}</Button>}
  {bundle.meta.can_manage&&<><LinkButton href="/economics" variant="ghost" size="sm" icon={<Arrow/>}>{isOverview?t('panel.fuentesPub'):t('panel.fuentesPubLargo')}</LinkButton><LinkButton href="/problems/manage" variant="ghost" size="sm" icon={<Arrow/>}>{isOverview?t('panel.catalogo'):t('panel.catalogoLargo')}</LinkButton></>}
 </div>;
 // El desplazamiento lo restaura RestaurarVista (shell) para todas las pantallas.
 const clave=bundle?.meta.scope_hash?'vexa:criticos:'+bundle.meta.scope_hash:null,[ultimo,setUltimo]=useState<{groups:number;signals:number|null}|null>(null);
 useEffect(()=>{if(!clave)return;let nuevo:{groups:number;signals:number|null}|null=null;try{if(bundle?.meta.critical_counts)sessionStorage.setItem(clave,JSON.stringify(bundle.meta.critical_counts));else{const v=sessionStorage.getItem(clave);nuevo=v?JSON.parse(v):null;}}catch{nuevo=null;}void Promise.resolve().then(()=>setUltimo(nuevo));},[clave,bundle?.meta.critical_counts]);
 const notice=bundle?.meta.critical_notice&&<Notice tone="warn" title={t('panel.critico')} actions={bundle.meta.catalog?<a className="row-link-inline" href="#senales-criticas">{t('panel.verCuales')}</a>:undefined}><span title={DEFINICION.senal+' '+DEFINICION.grupo}>{bundle.meta.critical_notice}</span></Notice>;
 const criticalPending=!bundle?.meta.critical_notice&&bundle?.meta.critical_notice_state==='unavailable'&&<Notice tone="info" title={ultimo?t('panel.criticoUltima'):t('panel.criticoPendiente')} actions={ultimo?undefined:<Button size="sm" onClick={update}>{t('panel.recalcular')}</Button>}>{ultimo?<>{t('panel.criticoUltimaFrase',{frase:fraseCriticos({grupos:ultimo.groups,senales:ultimo.signals})})} </>:<>{t('panel.criticoNoCalculadas')} </>}{isOverview&&<>{t('panel.consultalas')} <Link href={'/problems'+(pinned.size?'?'+pinned.toString():'')} className="row-link-inline">Problemas</Link>.</>}</Notice>;
 if(busy&&!bundle&&!error&&!missing)return <RovaqCargando mensaje=""/>;
 return <section className="stack" aria-label={isOverview?t('panel.aria.resumen'):t('panel.aria.problemas')}>
  {!isOverview&&<PageHeader nivel={1} eyebrow={t('panel.eyebrowProblemas')} title={t('panel.tituloProblemas')} guide={isOverview?'resumen':'problemas'} linea={isOverview?undefined:lineaProblemas(bundle?bundle.items.some(i=>i.metrics.some(m=>m.kind==='exposure'&&m.amount_minor!==null&&/^-?\d+$/.test(m.amount_minor))):null,t)} actions={actions}/>}
  {bar}
  {busy&&!bundle&&(isOverview?<div className="stack"><WaitStatus {...ESPERA.resumen}>{retrying&&<p className="wait-retry">{sinRed?t('panel.sinRed'):t('panel.reintentando')}</p>}</WaitStatus><div aria-hidden="true"><SkeletonStats/><SkeletonChart height={220}/></div></div>:<div className="stack"><WaitStatus {...ESPERA.problemas}>{retrying&&<p className="wait-retry">{sinRed?t('panel.sinRed'):t('panel.reintentando')}</p>}</WaitStatus><div aria-hidden="true"><SkeletonCards count={3}/></div></div>)}
  {error&&<DataState state={{kind:'error',code:'workspace_request_failed',message:error}}/>}
  {isOverview&&!bundle&&!missing&&<div className="stack"><CoverageBand/><TrendCharts/></div>}
  {missing&&!busy&&!bundle&&<EmptyState art="chart" title={t('panel.vacioTitulo')} body={t('panel.vacioCuerpo')} action={<Button variant="primary" size="sm" onClick={latest}>{t('panel.verUltima')}</Button>} secondary={<LinkButton href="/imports" size="sm" icon={<Arrow/>}>{t('panel.importar')}</LinkButton>}/>}
  {bundle&&<>
   {!isOverview&&<LineaCache edadMs={edadCache} actualizando={busy} viejo={viejo}/>}
   {!isOverview&&<>{notice}{criticalPending}</>}
   {isOverview?<OverviewDashboard key={`${bundle.meta.snapshot_id}:${bundle.meta.scope_hash}`} bundle={bundle} pinned={pinned} cache={{edadMs:edadCache,actualizando:busy,viejo}} avisos={[...(notice?[{key:'critico',node:notice}]:[]),...(criticalPending?[{key:'pendiente',node:criticalPending}]:[]),...(state&&state!=='empty'&&state!=='ready'?[{key:'parcial',node:<DataState state={{kind:state,coverage:bundle.meta.coverage,watermark:bundle.meta.watermark}}/>}]:[])]}/>
    :bundle.meta.catalog&&state==='partial'?<ProblemsView bundle={bundle} query={pinned.toString()}/>:<DataState state={state==='empty'?{kind:'empty'}:{kind:state??'partial',coverage:bundle.meta.coverage,watermark:bundle.meta.watermark}}><ProblemsView bundle={bundle} query={pinned.toString()}/></DataState>}
   {footer}
  </>}
 </section>;
}
