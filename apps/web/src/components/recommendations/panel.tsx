'use client';
import {useT} from '../i18n/proveedor';
import type {Traductor} from '../../lib/i18n';
import {RovaqCargando} from '../rovaq-cargando';
import {useAutoRefresh} from '../ui/use-auto-refresh';
import {useWorkspaceNavigation,workspaceLocation} from '../workspace/navigation-lifecycle';
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {leerConCache,leerSwr,claveSwr,guardarSwr,invalidarSwr} from '../../lib/workspace/swr.mjs';
import {LineaCache} from '../ui/linea-cache';
import {consultaFijada} from '../../lib/workspace/precalentar.mjs';
import {useVistaPersistente} from '../workspace/vista-persistente';
import type {RecommendationList} from '../../../../../packages/recommendations/index.mjs';
import type {Scope} from '../../lib/workspace/contracts';
import {ScopeBar} from '../workspace/scope-bar';
import {Button,LinkButton,Arrow} from '../ui/button';
import {Icon} from '../ui/icons';
import {Modal} from '../ui/overlay';
import {EmptyState} from '../ui/empty-state';
import {ErrorState} from '../ui/error-state';
import {Notice} from '../ui/notice';
import {Loading} from '../ui/loading';
import {WaitStatus} from '../ui/wait-status';
import {ESPERA} from '../../lib/legibilidad/espera.mjs';
import {nf} from '../ui/format';
import {persona,type FlowItem} from './flujo-vista';
import {AccionesCabecera} from '../acciones/acciones-cabecera';
import {AccionFila,type VistaAccion} from '../acciones/accion-fila';
import {agrupar,filtrar,resumir,actividadReciente,evidenciaPorAccion} from '../acciones/acciones-modelo.mjs';
import {KpiLinea,BarraParte} from '../panel-comun/kpi-linea';
import {IntervencionesSeccion,type ResumenIntervenciones} from '../interventions/panel';
import {etiquetaCategoria} from '../../lib/legibilidad/categorias.mjs';
import {fetchCupo} from '../../lib/workspace/cupo.mjs';
import '../acciones/acciones.css';
type Filters=Scope & {basis:string;exponent?:number};
type Operation=(url:string,body:unknown)=>Promise<boolean>;
function cleanQuery(value:string){const q=new URLSearchParams(value);for(const key of ['problem_id','detail_hash','resource','format','cursor','limit','root_kind','root_id','component_id','event_id','vista'])q.delete(key);return q;}
function initialScope(value:string):Filters{const q=cleanQuery(value),now=new Date(),start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)),end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1));return {date_start:q.get('date_start')??start.toISOString(),date_end:q.get('date_end')??end.toISOString(),timezone:'UTC',date_basis:q.get('date_basis')??'occurred_at',currency:q.get('currency')??'USD',basis:q.get('basis')??'net',sku:q.getAll('sku'),source:q.getAll('source'),snapshot_id:q.get('snapshot_id'),...(q.has('exponent')?{exponent:Number(q.get('exponent'))}:{})};}
const pinnedQuery=(scope:Scope,snapshot:string,hash:string)=>consultaFijada(scope,snapshot,hash);
function falla(status:number,t:Traductor){return status===401||status===403?t('recs.f401'):status===404?t('recs.f404'):status===409?t('recs.f409'):status===400?t('recs.f400'):t('recs.fOtro');}
const RANK={critical:0,high:1,normal:2} as const;
const useAntesDePintar=typeof window==='undefined'?useEffect:useLayoutEffect;
const validaMeta=(j:unknown)=>(j as {data?:{meta?:{scope?:unknown}}})?.data?.meta?.scope?j:null;
const validaLista=(j:unknown)=>{const d=(j as {data?:RecommendationList})?.data;return d&&Array.isArray(d.items)&&Array.isArray(d.problemOptions)&&Array.isArray(d.members)?j:null;};
export function RecommendationsPanel({initialQuery,vista='por-decidir'}:{initialQuery:string;vista?:VistaAccion}){
 const t=useT();
 const failure=useCallback((status:number)=>falla(status,t),[t]);
 const [query,setQuery]=useState(cleanQuery(initialQuery).toString()),[scope,setScope]=useState<Filters>(()=>initialScope(initialQuery)),[view,setView]=useState<RecommendationList|null>(null),[busy,setBusy]=useState(true),[empty,setEmpty]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[conflict,setConflict]=useState(false),[problem,setProblem]=useState(new URLSearchParams(initialQuery).get('problem_id')??''),[edad,setEdad]=useState<number|null>(null),[viejo,setViejo]=useState(false);
 const viewRef=useRef<RecommendationList|null>(null);useEffect(()=>{viewRef.current=view;},[view]);
 const generation=useRef(0),controller=useRef<AbortController|null>(null),resolved=useRef(query),inFlight=useRef(false),generateKey=useRef<{fingerprint:string;key:string}|null>(null);
 const invalidate=useCallback(()=>{controller.current?.abort();generation.current++;inFlight.current=false;},[]);
 useWorkspaceNavigation(invalidate);
 // Antes de pintar: si el alcance y su lista ya están en la caché, la primera imagen es el dato (rotulado), no un esqueleto.
 useAntesDePintar(()=>{const p=cleanQuery(query);p.set('resource','problems');p.set('meta_only','1');const m=leerSwr(claveSwr('/api/workspace?'+p.toString())),meta=(m?.datos as {data?:{meta?:{scope:Filters;snapshot_id:string|null;scope_hash:string|null}}}|undefined)?.data?.meta;
  if(!meta?.scope||!meta.snapshot_id||!meta.scope_hash)return;const l=leerSwr(claveSwr('/api/recommendations?'+pinnedQuery(meta.scope,meta.snapshot_id,meta.scope_hash).toString())),d=(l?.datos as {data?:RecommendationList}|undefined)?.data;
  if(l&&d&&validaLista(l.datos)&&d.snapshotId===meta.snapshot_id&&d.scopeHash===meta.scope_hash){setScope({...meta.scope,exponent:meta.scope.exponent??undefined});setView(d);setEdad(l.edadMs);if(l.fresca)setBusy(false);}},[query]);
 const load=useCallback(async(input:string,forzar=false)=>{const sourceLocation=workspaceLocation();controller.current?.abort();const abort=new AbortController();controller.current=abort;const epoch=++generation.current;inFlight.current=true;setBusy(true);setError('');setEmpty(false);setNotice('');setConflict(false);setViejo(false);let pintado=viewRef.current!==null;
  try{const p=cleanQuery(input);p.set('resource','problems');p.set('meta_only','1');
   // La fijación del alcance solo vale fresca (≤5 min): un corte nuevo debe verse; si la red falla se usa la última conocida.
   const snapshot=await leerConCache('/api/workspace?'+p.toString(),{signal:abort.signal,valida:validaMeta,soloFresca:true,forzar});if(abort.signal.aborted||epoch!==generation.current)return;if(snapshot.status<200||snapshot.status>=300)throw Error(failure(snapshot.status));const envelope=snapshot.json as {data?:{meta?:{scope:Filters;snapshot_id:string|null;scope_hash:string|null}}};const meta=envelope.data?.meta;if(!meta?.scope)throw Error(t('recs.eMeta'));setScope({...meta.scope,exponent:meta.scope.exponent??undefined});if(!meta.snapshot_id||!meta.scope_hash){setView(null);setEmpty(true);return;}
   const fixed=pinnedQuery(meta.scope,meta.snapshot_id,meta.scope_hash);const ok=(d:RecommendationList|undefined)=>!!d&&Array.isArray(d.items)&&Array.isArray(d.problemOptions)&&Array.isArray(d.members)&&d.snapshotId===meta.snapshot_id&&d.scopeHash===meta.scope_hash;
   const response=await leerConCache('/api/recommendations?'+fixed.toString(),{signal:abort.signal,valida:validaLista,forzar,onCache:(j,e)=>{const d=(j as {data?:RecommendationList}).data;if(ok(d)&&!abort.signal.aborted&&epoch===generation.current){setView(d!);setEdad(e);pintado=true;}}});if(abort.signal.aborted||epoch!==generation.current)return;
   if(response.fallo){if(pintado){setViejo(true);return;}throw Error(failure(response.status||503));}
   if(response.status<200||response.status>=300)throw Error(failure(response.status));const data=(response.json as {data?:RecommendationList}).data;if(!ok(data))throw Error(t('recs.eAlcance'));if(workspaceLocation()!==sourceLocation)return;resolved.current=fixed.toString();window.history.replaceState(null,'',window.location.pathname+'?'+fixed.toString()+(vista==='por-decidir'?'':'&vista='+vista)+window.location.hash);setView(data!);setEdad(response.deCache?response.edadMs:null);try{sessionStorage.setItem('vexa:rec-count',String(data!.items.length));}catch{/* opcional */}
  }catch(e){if(!abort.signal.aborted&&epoch===generation.current){if(pintado){setViejo(true);return;}setView(null);setError(e instanceof Error?e.message:t('recs.eConsulta'));}}
  finally{if(!abort.signal.aborted&&epoch===generation.current){inFlight.current=false;setBusy(false);}}
 },[vista,failure,t]);
 useEffect(()=>{let active=true;void Promise.resolve().then(()=>{if(active)void load(query);});return()=>{active=false;invalidate();};},[query,load,invalidate]);
 // Datos nuevos: relectura en segundo plano (conserva las acciones pintadas); no corre durante una carga u operación.
 useAutoRefresh(()=>load(resolved.current,true),{ocupado:()=>inFlight.current});
 useEffect(()=>{const back=()=>{invalidate();const next=cleanQuery(window.location.search.slice(1)).toString();resolved.current=next;setProblem('');if(next===query)void load(next);else setQuery(next);};window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back);},[invalidate,load,query]);
 const apply=(next:URLSearchParams)=>{invalidate();const changed=['date_start','date_end','currency','basis','exponent'].some(k=>{const old=new URLSearchParams(resolved.current).get(k)??'';return(next.get(k)??'')!==old;});if(changed&&next.get('snapshot_id')===scope.snapshot_id)next.delete('snapshot_id');next.delete('scope_hash');setView(null);setProblem('');setError('');setBusy(true);const value=cleanQuery(next.toString()).toString();resolved.current=value;window.history.pushState(null,'',window.location.pathname+'?'+value+(vista==='por-decidir'?'':'&vista='+vista));if(value===query)void load(value);else setQuery(value);};
 const operate:Operation=async(url,body)=>{if(inFlight.current)return false;inFlight.current=true;controller.current?.abort();const abort=new AbortController();controller.current=abort;const epoch=++generation.current;setBusy(true);setError('');setNotice('');let saved=false;
  try{const response=await fetchCupo(url,{method:'POST',cache:'no-store',signal:abort.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(abort.signal.aborted||epoch!==generation.current)return false;if(!response.ok){if([401,403,404].includes(response.status)){setView(null);setProblem('');}if(response.status===409)setConflict(true);throw Error(failure(response.status));}const result=await response.json();if(abort.signal.aborted||epoch!==generation.current)return false;if(!result.data)throw Error(t('recs.eResultado'));saved=true;invalidarSwr({prefijo:'/api/recommendations'});
   const refreshed=await fetchCupo('/api/recommendations?'+resolved.current,{cache:'no-store',signal:abort.signal});if(abort.signal.aborted||epoch!==generation.current)return false;if(!refreshed.ok){if([401,403,404].includes(refreshed.status))setView(null);throw Error(t('recs.eVista'));}const json=await refreshed.json();if(abort.signal.aborted||epoch!==generation.current)return false;const next=json.data as RecommendationList;const fixed=new URLSearchParams(resolved.current);if(!next||!Array.isArray(next.items)||next.snapshotId!==fixed.get('snapshot_id')||next.scopeHash!==fixed.get('scope_hash'))throw Error(t('recs.eNoCoincide'));setView(next);setEdad(null);setViejo(false);guardarSwr(claveSwr('/api/recommendations?'+resolved.current),{data:next});setNotice(t('recs.guardado'));return true;
  }catch(e){if(!abort.signal.aborted&&epoch===generation.current){if(saved)setConflict(true);setError(e instanceof Error?e.message:failure(503));}return false;}
  finally{if(!abort.signal.aborted&&epoch===generation.current){inFlight.current=false;setBusy(false);}}
 };
 const [proposing,setProposing]=useState(false);
 const generate=()=>{if(!view||!problem||busy||conflict)return;const fingerprint=JSON.stringify({query:resolved.current,problemId:problem,problemVersion:view.problemOptions.find(p=>p.id===problem)?.version});if(generateKey.current?.fingerprint!==fingerprint)generateKey.current={fingerprint,key:crypto.randomUUID()};setProposing(true);void operate('/api/recommendations',{operation:'generate',query:resolved.current,problemId:problem,requestKey:generateKey.current.key}).finally(()=>setProposing(false));};
 const [propose,setPropose]=useState(false),[responsable,setResponsable]=useVistaPersistente('acciones:resp',''),[prioridad,setPrioridad]=useVistaPersistente('acciones:prio',''),[intv,setIntv]=useState<ResumenIntervenciones|null>(null);
 const flowAvailable=(view as (RecommendationList&{flowAvailable?:boolean})|null)?.flowAvailable===true;
 const todos=useMemo(()=>view?([...view.items] as FlowItem[]).sort((a,b)=>(RANK[a.priority]??2)-(RANK[b.priority]??2)):[],[view]);
 const hoy=useMemo(()=>new Date(),[]);
 const visibles=useMemo(()=>filtrar(todos,{responsable,prioridad}) as FlowItem[],[todos,responsable,prioridad]);
 const g=useMemo(()=>agrupar(visibles) as {decidir:FlowItem[];curso:FlowItem[];resultado:FlowItem[];descartada:FlowItem[]},[visibles]);
 const rs=useMemo(()=>resumir(todos,hoy),[todos,hoy]),rf=useMemo(()=>resumir(visibles,hoy),[visibles,hoy]);
 const fixedQuery=useMemo(()=>view?pinnedQuery(scope,view.snapshotId,view.scopeHash).toString():null,[view,scope]);
 const filtrosActivos=!!(responsable||prioridad);
 const onRegenerate=view?.canPropose&&vista==='por-decidir'?(id:string)=>{setProblem(id);setPropose(true);}:undefined;
 const fila=(item:FlowItem,v:VistaAccion,descartada=false)=><AccionFila key={item.id+':'+item.version} item={item} members={view!.members} busy={busy} conflict={conflict} operate={operate} vista={v} descartada={descartada} flowAvailable={flowAvailable} onRegenerate={onRegenerate}/>;
 const lista=(titulo:string,sub:string,items:FlowItem[],v:VistaAccion,vacio:string,descartada=false)=><section className="pc-card" data-flush aria-label={titulo}><header className="pc-card-head"><div><h2>{titulo} <span className="pc-count">{nf.format(items.length)}</span></h2><p>{sub}</p></div></header>{items.length?<div className="ac-lista">{items.map(i=>fila(i,v,descartada))}</div>:<p className="ac-vacio" style={{margin:'0 14px 14px'}}>{vacio}</p>}</section>;
 const partes=(...l:[string,number][])=>l.map(([label,value])=>({label,value}));
 const kpis=vista==='por-decidir'?[
  {label:t('recs.kPorDecidir'),value:nf.format(rf.decidir.n),c:6,chip:rf.decidir.urgentes>0?{texto:nf.format(rf.decidir.urgentes)+' '+(rf.decidir.urgentes===1?t('recs.urgente'):t('recs.urgentes')),tono:'bad' as const}:undefined,partes:partes([t('recs.pUrgentes'),rf.decidir.urgentes],[t('recs.pAltas'),rf.decidir.altas],[t('recs.pNormales'),rf.decidir.normales]),nota:t('recs.notaPrio',{u:rf.decidir.urgentes,a:rf.decidir.altas,n:rf.decidir.normales})},
  {label:t('recs.kEvidencia'),value:nf.format(rf.decidir.citas),c:6,partes:evidenciaPorAccion(g.decidir).map(e=>({label:etiquetaCategoria(e.titulo),value:e.citas})),nota:t('recs.notaEvid')},
  {label:t('recs.kSinResp'),value:t('recs.deN',{a:nf.format(rf.decidir.sinResponsable),b:nf.format(rf.decidir.n)}),c:6,partes:partes([t('recs.pConResp'),rf.decidir.n-rf.decidir.sinResponsable],[t('recs.kSinResp'),rf.decidir.sinResponsable]),nota:t('recs.notaResp')},
  {label:t('recs.kDinero'),value:'—',vacio:true,c:6,chip:{texto:t('recs.sinEstimar')},nota:t('recs.notaDinero')}]
 :vista==='en-curso'?[
  {label:t('recs.kEnCurso'),value:nf.format(rf.curso.n),c:6,partes:partes([t('recs.pAprobadas'),rf.curso.aprobadas],[t('recs.kEnCurso'),rf.curso.enCurso]),nota:t('recs.notaCurso',{a:rf.curso.aprobadas,b:rf.curso.enCurso})},
  {label:t('recs.kCompromisos'),value:nf.format(rf.curso.proximas+rf.curso.vencidas),c:6,chip:rf.curso.vencidas>0?{texto:nf.format(rf.curso.vencidas)+' '+(rf.curso.vencidas===1?t('recs.vencida1'):t('recs.vencidas')),tono:'bad' as const}:undefined,partes:partes([t('recs.pVencidas'),rf.curso.vencidas],[t('recs.pProximas'),rf.curso.proximas],[t('recs.pMasAdelante'),rf.curso.n-rf.curso.vencidas-rf.curso.proximas-rf.curso.sinFecha]),nota:rf.curso.sinFecha?t('recs.sinFechaComp',{n:rf.curso.sinFecha}):t('recs.fechaAprobar')},
  {label:t('recs.kInterv'),value:intv?nf.format((intv.porEstado.draft??0)+(intv.porEstado.approved??0)+(intv.porEstado.active??0)+(intv.porEstado.measuring??0)):'—',vacio:!intv,c:6,partes:partes([t('recs.pBorrador'),intv?.porEstado.draft??0],[t('recs.pPlanAprob'),intv?.porEstado.approved??0],[t('recs.pEjecucion'),intv?.porEstado.active??0],[t('recs.pMedicion'),intv?.porEstado.measuring??0]),nota:intv?t('recs.notaInterv'):t('recs.sinLecturaInterv')},
  {label:t('recs.kBorradores'),value:nf.format(g.curso.filter(i=>i.drafts.length>0).length),c:6,partes:partes([t('recs.pConBorrador'),g.curso.filter(i=>i.drafts.length>0).length],[t('recs.pSinBorrador'),g.curso.filter(i=>i.drafts.length===0).length]),nota:t('recs.notaBorradores')}]
 :[
  {label:t('recs.kConResultado'),value:nf.format(rf.resultado.n),c:6,partes:partes([t('recs.pSiResolvio'),rf.resultado.si],[t('recs.pEnParte'),rf.resultado.parcial],[t('recs.pNo'),rf.resultado.no]),nota:t('recs.notaResultado',{a:rf.resultado.si,b:rf.resultado.parcial,c:rf.resultado.no})},
  {label:t('recs.kAntesDespues'),value:t('recs.deN',{a:nf.format(rf.resultado.conComparacion),b:nf.format(rf.resultado.n)}),c:6,partes:partes([t('recs.pConMedicion'),rf.resultado.conComparacion],[t('recs.pSinMedicion'),rf.resultado.n-rf.resultado.conComparacion]),nota:t('recs.notaAntes')},
  {label:t('recs.kDescartadas'),value:nf.format(rf.descartadas),c:6,partes:partes([t('recs.kDescartadas'),rf.descartadas],[t('recs.pVigentes'),rf.total-rf.descartadas]),nota:t('recs.notaDesc')},
  {label:t('recs.kMedCerradas'),value:intv?nf.format(intv.porEstado.closed??0):'—',vacio:!intv,c:6,partes:partes([t('recs.pCerradas'),intv?.porEstado.closed??0],[t('recs.pAbiertas'),intv?intv.total-(intv.porEstado.closed??0):0]),nota:intv?t('recs.notaMedCerr'):t('recs.sinLecturaInterv')}];
 const cuentas={'por-decidir':rs.decidir.n,'en-curso':rs.curso.n,resultados:rs.resultado.n};
 const sinFlujoAviso=view&&!flowAvailable&&todos.length>0;
 const actividad=actividadReciente(todos,6),evidencia=evidenciaPorAccion(g.decidir),maxCitas=Math.max(1,...evidencia.map(e=>e.citas));
 const compromisos=g.curso.map(i=>({i,e:(i.flow?.events??[]).find(x=>x.kind==='approved')})).filter(x=>x.e?.dueDate).sort((a,b)=>String(a.e!.dueDate).localeCompare(String(b.e!.dueDate)));
 const dias=(f:string)=>Math.floor((new Date(f+'T12:00:00Z').getTime()-hoy.getTime())/86400000);
 if(busy&&!view&&!error&&!empty)return <RovaqCargando mensaje=""/>;
 return <section aria-label={t('recs.sec')} className="stack">
  <AccionesCabecera actual={vista} cuentas={view?cuentas:undefined} acciones={view?.canPropose?<Button variant="primary" icon={<Icon name="sparkle" size={14}/>} onClick={()=>setPropose(true)}>{t('recs.proponer')}</Button>:undefined}/>
  <ScopeBar scope={scope} onApply={apply} busy={busy} extra={view&&todos.length>0?<>
   <select aria-label={t('recs.responsable')} value={responsable} onChange={e=>setResponsable(e.target.value)}><option value="">{t('recs.respTodos')}</option><option value="sin">{t('recs.sinResp')}</option>{view.members.map(m=><option key={m.id} value={m.id}>{persona(m.id,view.members)}</option>)}</select>
   {filtrosActivos&&<button type="button" className="btn btn-ghost btn-sm" onClick={()=>{setResponsable('');setPrioridad('');}}>{t('recs.limpiar')}</button>}</>:undefined}/>
  {view&&<LineaCache edadMs={edad} actualizando={busy} viejo={viejo}/>}
  {busy&&!view&&!error&&!empty&&<section className="pc-card" aria-busy="true"><Loading message={t('recs.cargando')}/><WaitStatus {...ESPERA.recomendaciones}/></section>}
  {proposing&&view&&<WaitStatus titulo={t('recs.proponiendo')} detalle={t('recs.proponiendoDet')}/>}
  {error&&<ErrorState title={t('recs.errTitulo')} body={error} onRetry={()=>void load(resolved.current,true)}/>}
  {notice&&<Notice tone="info">{notice}</Notice>}
  {empty&&<EmptyState art="chart" title={t('recs.sinCorteT')} body={t('recs.sinCorteB')} action={<LinkButton href="/economics" variant="primary" size="sm" icon={<Arrow/>}>{t('recs.revisarPub')}</LinkButton>}/>}
  {view&&<>
   {sinFlujoAviso&&<Notice tone="warn" title={t('recs.sinFlujoT')}>{t('recs.sinFlujoB')}</Notice>}
   {view.unavailableCount>0&&<Notice tone="info">{t('recs.noMostrables')}</Notice>}
   {!view.canPropose&&<Notice tone="info">{t('recs.soloLeer')}</Notice>}
   {view.canPropose&&<Modal open={propose} onClose={()=>setPropose(false)} title={t('recs.proponer')} footer={<Button type="submit" form="recommendation-form" variant="primary" disabled={busy||conflict||!view.problemOptions.some(p=>p.id===problem)}>{t('recs.proponerRec')}</Button>}>
    <form id="recommendation-form" className="stack" aria-label={t('recs.proponer')} onSubmit={e=>{e.preventDefault();generate();setPropose(false);}}><label htmlFor="recommendation-problem">{t('recs.problemaRec')}</label><select id="recommendation-problem" required disabled={busy} value={problem} onChange={e=>setProblem(e.target.value)}><option value="">{t('recs.selProblema')}</option>{view.problemOptions.map(p=><option key={p.id} value={p.id}>{p.label} · v{p.version}</option>)}</select><p className="card-lead">{t('recs.generaReglas')}</p></form>
   </Modal>}
   {!todos.length?<EmptyState art="inbox" title={t('recs.vacioT')} body={view.canPropose?t('recs.vacioProp'):t('recs.vacioAparecera')} action={view.canPropose?<Button variant="primary" size="sm" onClick={()=>setPropose(true)}>{t('recs.proponer')}</Button>:undefined}/>:<>
    <KpiLinea items={kpis} label={t('recs.indDe',{vista:vista==='por-decidir'?t('recs.vPorDecidir'):vista==='en-curso'?t('recs.vEnCurso'):t('recs.vResultados')})}/>
    {vista==='por-decidir'&&<>
     {lista(t('recs.tPorDecidir'),t('recs.subPorDecidir'),g.decidir,'por-decidir',filtrosActivos?t('recs.nada'):t('recs.nadaPorDecidir'))}
     <div className="pc-grid" data-cols="6-6">
      <section className="pc-card" aria-label={t('recs.evidPorRec')}><header className="pc-card-head"><div><h2>{t('recs.evidPorRec')}</h2><p>{t('recs.citasVerif')}</p></div></header><div className="pc-fill">{evidencia.length?evidencia.map(e=><BarraParte key={e.id} etiqueta={etiquetaCategoria(e.titulo)} valor={e.citas} max={maxCitas} c={6} fin={nf.format(e.citas)}/>):<p className="ac-vacio">{t('recs.sinRecsDecidir')}</p>}</div></section>
      <section className="pc-card" aria-label={t('recs.ultAct')}><header className="pc-card-head"><div><h2>{t('recs.ultAct')}</h2><p>{t('recs.ultActSub')}</p></div></header><div className="pc-fill">{actividad.length?<ul className="pc-lista ui-reset">{actividad.map(a=><li key={a.clave}><i className="pc-punto" data-tono={a.tipo==='dismissed'?'off':a.tipo==='resolved'?'ok':undefined} style={{['--c' as string]:'var(--chart-6)'}}/><span className="pc-grow"><span className="pc-t">{a.titulo} · {etiquetaCategoria(a.titulo2)}</span><span className="pc-s"><time dateTime={a.cuando}>{new Date(a.cuando).toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})}</time></span></span></li>)}</ul>:<p className="ac-vacio">{t('recs.sinDecisiones')}</p>}</div></section>
     </div></>}
    {vista==='en-curso'&&<>
     {lista(t('recs.tEnCurso'),t('recs.subEnCurso'),g.curso,'en-curso',filtrosActivos?t('recs.nada'):t('recs.nadaEnCurso'))}
     <div className="pc-grid" data-cols="8-4">
      <IntervencionesSeccion fixedQuery={fixedQuery} vista="en-curso" onResumen={setIntv}/>
      <section className="pc-card" aria-label={t('recs.compromisos')}><header className="pc-card-head"><div><h2>{t('recs.compromisos')}</h2><p>{t('recs.porFechaComp')}</p></div></header><div className="pc-fill">{compromisos.length?<ul className="pc-lista ui-reset">{compromisos.map(({i,e})=>{const d=dias(e!.dueDate!);return <li key={i.id}><i className="pc-punto" data-tono={d<0?'bad':d<=7?'warn':undefined} style={{['--c' as string]:'var(--chart-6)'}}/><span className="pc-grow"><span className="pc-t">{etiquetaCategoria(i.title)}</span><span className="pc-s">{new Date(e!.dueDate+'T12:00:00Z').toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})}</span></span><span className="pc-estado" data-tono={d<0?'bad':d<=7?'warn':'off'}>{d<0?t('recs.vencida',{n:Math.abs(d)}):d===0?t('recs.hoy'):t('recs.enDias',{n:d})}</span></li>;})}</ul>:<p className="ac-vacio">{t('recs.sinCompromisos')}</p>}</div></section>
     </div></>}
    {vista==='resultados'&&<>
     {lista(t('recs.tResultados'),t('recs.subResultados'),g.resultado,'resultados',filtrosActivos?t('recs.nada'):t('recs.nadaResultados'))}
     <div className="pc-grid" data-cols="8-4">
      <IntervencionesSeccion fixedQuery={fixedQuery} vista="resultados" onResumen={setIntv}/>
      {lista(t('recs.descartadas'),t('recs.reabrirConst'),g.descartada,'resultados',t('recs.ningunaDesc'),true)}
     </div></>}
   </>}
  </>}
 </section>;
}
