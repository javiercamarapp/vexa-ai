'use client';
import {useWorkspaceNavigation,workspaceLocation} from '../workspace/navigation-lifecycle';
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {leerConCache,leerSwr,claveSwr,guardarSwr,invalidarSwr} from '../../lib/workspace/swr.mjs';
import {LineaCache} from '../ui/linea-cache';
import {consultaFijada} from '../../lib/workspace/precalentar.mjs';
import {useVistaPersistente} from '../workspace/vista-persistente';
import type {RecommendationList} from '../../../../../packages/recommendations/index.mjs';
import type {Scope} from '../../lib/workspace/contracts';
import {ScopeBar} from '../workspace/scope-bar';
import {Button,LinkButton,Refresh,Arrow} from '../ui/button';
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
function failure(status:number){return status===401||status===403?'Tu acceso cambió. Vuelve a iniciar sesión o selecciona una organización autorizada.':status===404?'No hay una recomendación o evidencia autorizada para este alcance.':status===409?'La versión o la evidencia cambió. Actualiza y revisa la propuesta antes de continuar.':status===400?'Revisa los campos y el alcance de la solicitud.':'No se pudo verificar la operación. Conserva tu borrador y reintenta; no se confirma ningún cambio.';}
const RANK={critical:0,high:1,normal:2} as const;
const useAntesDePintar=typeof window==='undefined'?useEffect:useLayoutEffect;
const validaMeta=(j:unknown)=>(j as {data?:{meta?:{scope?:unknown}}})?.data?.meta?.scope?j:null;
const validaLista=(j:unknown)=>{const d=(j as {data?:RecommendationList})?.data;return d&&Array.isArray(d.items)&&Array.isArray(d.problemOptions)&&Array.isArray(d.members)?j:null;};
export function RecommendationsPanel({initialQuery,vista='por-decidir'}:{initialQuery:string;vista?:VistaAccion}){
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
   const snapshot=await leerConCache('/api/workspace?'+p.toString(),{signal:abort.signal,valida:validaMeta,soloFresca:true,forzar});if(abort.signal.aborted||epoch!==generation.current)return;if(snapshot.status<200||snapshot.status>=300)throw Error(failure(snapshot.status));const envelope=snapshot.json as {data?:{meta?:{scope:Filters;snapshot_id:string|null;scope_hash:string|null}}};const meta=envelope.data?.meta;if(!meta?.scope)throw Error('No se pudo verificar la publicación solicitada.');setScope({...meta.scope,exponent:meta.scope.exponent??undefined});if(!meta.snapshot_id||!meta.scope_hash){setView(null);setEmpty(true);return;}
   const fixed=pinnedQuery(meta.scope,meta.snapshot_id,meta.scope_hash);const ok=(d:RecommendationList|undefined)=>!!d&&Array.isArray(d.items)&&Array.isArray(d.problemOptions)&&Array.isArray(d.members)&&d.snapshotId===meta.snapshot_id&&d.scopeHash===meta.scope_hash;
   const response=await leerConCache('/api/recommendations?'+fixed.toString(),{signal:abort.signal,valida:validaLista,forzar,onCache:(j,e)=>{const d=(j as {data?:RecommendationList}).data;if(ok(d)&&!abort.signal.aborted&&epoch===generation.current){setView(d!);setEdad(e);pintado=true;}}});if(abort.signal.aborted||epoch!==generation.current)return;
   if(response.fallo){if(pintado){setViejo(true);return;}throw Error(failure(response.status||503));}
   if(response.status<200||response.status>=300)throw Error(failure(response.status));const data=(response.json as {data?:RecommendationList}).data;if(!ok(data))throw Error('No se pudo verificar el alcance de las recomendaciones.');if(workspaceLocation()!==sourceLocation)return;resolved.current=fixed.toString();window.history.replaceState(null,'',window.location.pathname+'?'+fixed.toString()+(vista==='por-decidir'?'':'&vista='+vista)+window.location.hash);setView(data!);setEdad(response.deCache?response.edadMs:null);try{sessionStorage.setItem('vexa:rec-count',String(data!.items.length));}catch{/* opcional */}
  }catch(e){if(!abort.signal.aborted&&epoch===generation.current){if(pintado){setViejo(true);return;}setView(null);setError(e instanceof Error?e.message:'No se pudo consultar las recomendaciones.');}}
  finally{if(!abort.signal.aborted&&epoch===generation.current){inFlight.current=false;setBusy(false);}}
 },[vista]);
 useEffect(()=>{let active=true;void Promise.resolve().then(()=>{if(active)void load(query);});return()=>{active=false;invalidate();};},[query,load,invalidate]);
 useEffect(()=>{const back=()=>{invalidate();const next=cleanQuery(window.location.search.slice(1)).toString();resolved.current=next;setProblem('');if(next===query)void load(next);else setQuery(next);};window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back);},[invalidate,load,query]);
 const apply=(next:URLSearchParams)=>{invalidate();const changed=['date_start','date_end','currency','basis','exponent'].some(k=>{const old=new URLSearchParams(resolved.current).get(k)??'';return(next.get(k)??'')!==old;});if(changed&&next.get('snapshot_id')===scope.snapshot_id)next.delete('snapshot_id');next.delete('scope_hash');setView(null);setProblem('');setError('');setBusy(true);const value=cleanQuery(next.toString()).toString();resolved.current=value;window.history.pushState(null,'',window.location.pathname+'?'+value+(vista==='por-decidir'?'':'&vista='+vista));if(value===query)void load(value);else setQuery(value);};
 const operate:Operation=async(url,body)=>{if(inFlight.current)return false;inFlight.current=true;controller.current?.abort();const abort=new AbortController();controller.current=abort;const epoch=++generation.current;setBusy(true);setError('');setNotice('');let saved=false;
  try{const response=await fetchCupo(url,{method:'POST',cache:'no-store',signal:abort.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(abort.signal.aborted||epoch!==generation.current)return false;if(!response.ok){if([401,403,404].includes(response.status)){setView(null);setProblem('');}if(response.status===409)setConflict(true);throw Error(failure(response.status));}const result=await response.json();if(abort.signal.aborted||epoch!==generation.current)return false;if(!result.data)throw Error('No se pudo verificar el resultado de la operación.');saved=true;invalidarSwr({prefijo:'/api/recommendations'});
   const refreshed=await fetchCupo('/api/recommendations?'+resolved.current,{cache:'no-store',signal:abort.signal});if(abort.signal.aborted||epoch!==generation.current)return false;if(!refreshed.ok){if([401,403,404].includes(refreshed.status))setView(null);throw Error('La operación se guardó, pero no se pudo verificar la vista actual. Actualiza antes de continuar.');}const json=await refreshed.json();if(abort.signal.aborted||epoch!==generation.current)return false;const next=json.data as RecommendationList;const fixed=new URLSearchParams(resolved.current);if(!next||!Array.isArray(next.items)||next.snapshotId!==fixed.get('snapshot_id')||next.scopeHash!==fixed.get('scope_hash'))throw Error('La operación se guardó, pero la vista recibida no coincide con su alcance.');setView(next);setEdad(null);setViejo(false);guardarSwr(claveSwr('/api/recommendations?'+resolved.current),{data:next});setNotice('Cambio guardado y verificado.');return true;
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
  {label:'Por decidir',value:nf.format(rf.decidir.n),c:6,chip:rf.decidir.urgentes>0?{texto:nf.format(rf.decidir.urgentes)+(rf.decidir.urgentes===1?' urgente':' urgentes'),tono:'bad' as const}:undefined,partes:partes(['Urgentes',rf.decidir.urgentes],['Altas',rf.decidir.altas],['Normales',rf.decidir.normales]),nota:'Urgentes '+rf.decidir.urgentes+' · altas '+rf.decidir.altas+' · normales '+rf.decidir.normales},
  {label:'Evidencia',value:nf.format(rf.decidir.citas),c:6,partes:evidenciaPorAccion(g.decidir).map(e=>({label:etiquetaCategoria(e.titulo),value:e.citas})),nota:'citas verificadas al guardar; se vuelven a verificar al abrir'},
  {label:'Sin responsable',value:nf.format(rf.decidir.sinResponsable)+' de '+nf.format(rf.decidir.n),c:6,partes:partes(['Con responsable',rf.decidir.n-rf.decidir.sinResponsable],['Sin responsable',rf.decidir.sinResponsable]),nota:'Quien aprueba asigna responsable y fecha'},
  {label:'Dinero en juego',value:'—',vacio:true,c:6,chip:{texto:'Sin estimar'},nota:'Aún no hay importe por problema: no se estima un ahorro'}]
 :vista==='en-curso'?[
  {label:'En curso',value:nf.format(rf.curso.n),c:6,partes:partes(['Aprobadas',rf.curso.aprobadas],['En curso',rf.curso.enCurso]),nota:rf.curso.aprobadas+' aprobadas · '+rf.curso.enCurso+' en curso'},
  {label:'Compromisos ≤ 7 días',value:nf.format(rf.curso.proximas+rf.curso.vencidas),c:6,chip:rf.curso.vencidas>0?{texto:nf.format(rf.curso.vencidas)+(rf.curso.vencidas===1?' vencida':' vencidas'),tono:'bad' as const}:undefined,partes:partes(['Vencidas',rf.curso.vencidas],['Próximas',rf.curso.proximas],['Más adelante',rf.curso.n-rf.curso.vencidas-rf.curso.proximas-rf.curso.sinFecha]),nota:rf.curso.sinFecha?rf.curso.sinFecha+' sin fecha de compromiso':'Fecha fijada al aprobar'},
  {label:'Intervenciones',value:intv?nf.format((intv.porEstado.draft??0)+(intv.porEstado.approved??0)+(intv.porEstado.active??0)+(intv.porEstado.measuring??0)):'—',vacio:!intv,c:6,partes:partes(['Borrador',intv?.porEstado.draft??0],['Plan aprobado',intv?.porEstado.approved??0],['En ejecución',intv?.porEstado.active??0],['En medición',intv?.porEstado.measuring??0]),nota:intv?'Borrador, plan aprobado, ejecución o medición':'Cargando intervenciones…'},
  {label:'Con borradores',value:nf.format(g.curso.filter(i=>i.drafts.length>0).length),c:6,partes:partes(['Con borrador',g.curso.filter(i=>i.drafts.length>0).length],['Sin borrador',g.curso.filter(i=>i.drafts.length===0).length]),nota:'Correo, FAQ y listas de SKU: los envía una persona'}]
 :[
  {label:'Con resultado',value:nf.format(rf.resultado.n),c:6,partes:partes(['Sí se resolvió',rf.resultado.si],['En parte',rf.resultado.parcial],['No',rf.resultado.no]),nota:rf.resultado.si+' sí · '+rf.resultado.parcial+' en parte · '+rf.resultado.no+' no'},
  {label:'Con antes y después',value:nf.format(rf.resultado.conComparacion)+' de '+nf.format(rf.resultado.n),c:6,partes:partes(['Con medición',rf.resultado.conComparacion],['Sin medición',rf.resultado.n-rf.resultado.conComparacion]),nota:'Solo con ingreso observado en dos periodos'},
  {label:'Descartadas',value:nf.format(rf.descartadas),c:6,partes:partes(['Descartadas',rf.descartadas],['Vigentes',rf.total-rf.descartadas]),nota:'Reversibles: reabrir crea un evento nuevo'},
  {label:'Mediciones cerradas',value:intv?nf.format(intv.porEstado.closed??0):'—',vacio:!intv,c:6,partes:partes(['Cerradas',intv?.porEstado.closed??0],['Abiertas',intv?intv.total-(intv.porEstado.closed??0):0]),nota:intv?'Intervenciones con medición cerrada':'Cargando intervenciones…'}];
 const cuentas={'por-decidir':rs.decidir.n,'en-curso':rs.curso.n,resultados:rs.resultado.n};
 const sinFlujoAviso=view&&!flowAvailable&&todos.length>0;
 const actividad=actividadReciente(todos,6),evidencia=evidenciaPorAccion(g.decidir),maxCitas=Math.max(1,...evidencia.map(e=>e.citas));
 const compromisos=g.curso.map(i=>({i,e:(i.flow?.events??[]).find(x=>x.kind==='approved')})).filter(x=>x.e?.dueDate).sort((a,b)=>String(a.e!.dueDate).localeCompare(String(b.e!.dueDate)));
 const dias=(f:string)=>Math.floor((new Date(f+'T12:00:00Z').getTime()-hoy.getTime())/86400000);
 return <section aria-label="Acciones con evidencia" className="stack">
  <AccionesCabecera actual={vista} cuentas={view?cuentas:undefined} acciones={view?.canPropose?<Button variant="primary" icon={<Icon name="sparkle" size={14}/>} onClick={()=>setPropose(true)}>Proponer una recomendación</Button>:undefined}/>
  <ScopeBar scope={scope} onApply={apply} busy={busy} extra={view&&todos.length>0?<>
   <select aria-label="Responsable" value={responsable} onChange={e=>setResponsable(e.target.value)}><option value="">Responsable: todos</option><option value="sin">Sin responsable</option>{view.members.map(m=><option key={m.id} value={m.id}>{persona(m.id,view.members)}</option>)}</select>
   {filtrosActivos&&<button type="button" className="btn btn-ghost btn-sm" onClick={()=>{setResponsable('');setPrioridad('');}}>Limpiar</button>}
   <button type="button" className="btn btn-ghost btn-sm" aria-label="Actualizar" title="Actualizar" disabled={busy} onClick={()=>void load(resolved.current,true)}><Refresh/></button></>:undefined}/>
  {view&&<LineaCache edadMs={edad} actualizando={busy} viejo={viejo} onActualizar={()=>void load(resolved.current,true)}/>}
  {busy&&!view&&!error&&!empty&&<section className="pc-card" aria-busy="true"><Loading message="Cargando las acciones…"/><WaitStatus {...ESPERA.recomendaciones}/></section>}
  {proposing&&view&&<WaitStatus titulo="Proponiendo la recomendación y verificando su evidencia…" detalle="Puede tardar hasta 2 minutos; no cierres esta pestaña."/>}
  {error&&<ErrorState title="No se pudieron cargar las acciones" body={error} onRetry={()=>void load(resolved.current,true)}/>}
  {notice&&<Notice tone="info">{notice}</Notice>}
  {empty&&<EmptyState art="chart" title="Aún no hay un corte publicado" body="Publica un corte financiero para proponer acciones sobre evidencia verificable." action={<LinkButton href="/economics" variant="primary" size="sm" icon={<Arrow/>}>Revisar publicaciones</LinkButton>}/>}
  {view&&<>
   {sinFlujoAviso&&<Notice tone="warn" title="El flujo de aprobación no está habilitado en esta base de datos">Puedes leer las recomendaciones y crear intervenciones en borrador; Proceder, Ajustar y Descartar se activan al aplicar la migración del flujo.</Notice>}
   {view.unavailableCount>0&&<Notice tone="info">Hay recomendaciones que no pueden mostrarse con la evidencia y los permisos actuales.</Notice>}
   {!view.canPropose&&<Notice tone="info">Tu rol permite consultar las recomendaciones. Proponer o modificar requiere permisos de analista, operador o propietario.</Notice>}
   {view.canPropose&&<Modal open={propose} onClose={()=>setPropose(false)} title="Proponer una recomendación" footer={<Button type="submit" form="recommendation-form" variant="primary" disabled={busy||conflict||!view.problemOptions.some(p=>p.id===problem)}>Proponer recomendación</Button>}>
    <form id="recommendation-form" className="stack" aria-label="Proponer una recomendación" onSubmit={e=>{e.preventDefault();generate();setPropose(false);}}><label htmlFor="recommendation-problem">Problema para recomendar</label><select id="recommendation-problem" required disabled={busy} value={problem} onChange={e=>setProblem(e.target.value)}><option value="">Seleccionar problema</option>{view.problemOptions.map(p=><option key={p.id} value={p.id}>{p.label} · v{p.version}</option>)}</select><p className="card-lead">Se genera con reglas explícitas y evidencia autorizada. Requiere revisión humana.</p></form>
   </Modal>}
   {!todos.length?<EmptyState art="inbox" title="No hay recomendaciones para este alcance" body={view.canPropose?'Propón la primera sobre un problema publicado.':'Cuando se proponga una, aparecerá aquí.'} action={view.canPropose?<Button variant="primary" size="sm" onClick={()=>setPropose(true)}>Proponer una recomendación</Button>:undefined}/>:<>
    <KpiLinea items={kpis} label={'Indicadores de '+(vista==='por-decidir'?'por decidir':vista==='en-curso'?'en curso':'resultados')}/>
    {vista==='por-decidir'&&<>
     {lista('Por decidir','Cada una con su evidencia; Proceder crea la intervención y los borradores, que una persona revisa y envía.',g.decidir,'por-decidir',filtrosActivos?'Nada con este filtro.':'Nada por decidir. Revisa las brechas de ingreso para proponer la siguiente acción.')}
     <div className="pc-grid" data-cols="6-6">
      <section className="pc-card" aria-label="Evidencia por recomendación"><header className="pc-card-head"><div><h2>Evidencia por recomendación</h2><p>Citas verificadas al guardar</p></div></header><div className="pc-fill">{evidencia.length?evidencia.map(e=><BarraParte key={e.id} etiqueta={etiquetaCategoria(e.titulo)} valor={e.citas} max={maxCitas} c={6} fin={nf.format(e.citas)}/>):<p className="ac-vacio">Sin recomendaciones por decidir.</p>}</div></section>
      <section className="pc-card" aria-label="Última actividad"><header className="pc-card-head"><div><h2>Última actividad</h2><p>Cada decisión es un evento nuevo; nada se borra</p></div></header><div className="pc-fill">{actividad.length?<ul className="pc-lista ui-reset">{actividad.map(a=><li key={a.clave}><i className="pc-punto" data-tono={a.tipo==='dismissed'?'off':a.tipo==='resolved'?'ok':undefined} style={{['--c' as string]:'var(--chart-6)'}}/><span className="pc-grow"><span className="pc-t">{a.titulo} · {etiquetaCategoria(a.titulo2)}</span><span className="pc-s"><time dateTime={a.cuando}>{new Date(a.cuando).toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})}</time></span></span></li>)}</ul>:<p className="ac-vacio">Aún no hay decisiones registradas.</p>}</div></section>
     </div></>}
    {vista==='en-curso'&&<>
     {lista('En curso','Aprobadas y en marcha, con responsable, compromiso y borradores listos para revisar.',g.curso,'en-curso',filtrosActivos?'Nada con este filtro.':'Nada en curso. Cuando apruebes una recomendación aparece aquí con sus borradores.')}
     <div className="pc-grid" data-cols="8-4">
      <IntervencionesSeccion fixedQuery={fixedQuery} vista="en-curso" onResumen={setIntv}/>
      <section className="pc-card" aria-label="Compromisos"><header className="pc-card-head"><div><h2>Compromisos</h2><p>Por fecha de compromiso</p></div></header><div className="pc-fill">{compromisos.length?<ul className="pc-lista ui-reset">{compromisos.map(({i,e})=>{const d=dias(e!.dueDate!);return <li key={i.id}><i className="pc-punto" data-tono={d<0?'bad':d<=7?'warn':undefined} style={{['--c' as string]:'var(--chart-6)'}}/><span className="pc-grow"><span className="pc-t">{etiquetaCategoria(i.title)}</span><span className="pc-s">{new Date(e!.dueDate+'T12:00:00Z').toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})}</span></span><span className="pc-estado" data-tono={d<0?'bad':d<=7?'warn':'off'}>{d<0?'Vencida '+Math.abs(d)+' d':d===0?'Hoy':'En '+d+' d'}</span></li>;})}</ul>:<p className="ac-vacio">Sin compromisos con fecha.</p>}</div></section>
     </div></>}
    {vista==='resultados'&&<>
     {lista('Resultados','Lo que pasó con lo aprobado: antes y después solo con dato observado; nunca un ahorro supuesto.',g.resultado,'resultados',filtrosActivos?'Nada con este filtro.':'Aún no hay resultados registrados: registra uno desde En curso.')}
     <div className="pc-grid" data-cols="8-4">
      <IntervencionesSeccion fixedQuery={fixedQuery} vista="resultados" onResumen={setIntv}/>
      {lista('Descartadas','Reabrir deja constancia',g.descartada,'resultados','Ninguna descartada.',true)}
     </div></>}
   </>}
  </>}
 </section>;
}
