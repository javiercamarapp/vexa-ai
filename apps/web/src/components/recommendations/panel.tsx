'use client';
import {useWorkspaceNavigation,workspaceLocation} from '../workspace/navigation-lifecycle';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Recommendation,RecommendationList} from '../../../../../packages/recommendations/index.mjs';
import type {Scope} from '../../lib/workspace/contracts';
import {ScopeBar} from '../workspace/scope-bar';
import {DataState} from '../workspace/data-state';
import {PageHeader} from '../ui/page-header';
import {Button,LinkButton,Refresh,Arrow} from '../ui/button';
import {Citation} from '../ui/citation';
import {IdChip} from '../ui/id-chip';
import {Icon} from '../ui/icons';
import {StatusChip} from '../ui/status-chip';
import {SegmentedControl} from '../ui/segmented';
import {Drawer,Modal} from '../ui/overlay';
import {EmptyState} from '../ui/empty-state';
import {SkeletonCards} from '../ui/skeletons';
import {nf} from '../ui/format';
import css from './panel.module.css';
type Filters=Scope & {basis:string;exponent?:number};
type Operation=(url:string,body:unknown)=>Promise<boolean>;
function cleanQuery(value:string){const q=new URLSearchParams(value);for(const key of ['problem_id','detail_hash','resource','format','cursor','limit','root_kind','root_id','component_id','event_id'])q.delete(key);return q;}
function initialScope(value:string):Filters{const q=cleanQuery(value),now=new Date(),start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)),end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1));return {date_start:q.get('date_start')??start.toISOString(),date_end:q.get('date_end')??end.toISOString(),timezone:'UTC',date_basis:q.get('date_basis')??'occurred_at',currency:q.get('currency')??'USD',basis:q.get('basis')??'net',sku:q.getAll('sku'),source:q.getAll('source'),snapshot_id:q.get('snapshot_id'),...(q.has('exponent')?{exponent:Number(q.get('exponent'))}:{})};}
function pinnedQuery(scope:Scope,snapshot:string,hash:string){const q=new URLSearchParams({date_start:scope.date_start.slice(0,10),date_end:scope.date_end.slice(0,10),timezone:scope.timezone,date_basis:scope.date_basis,currency:scope.currency,basis:scope.basis??'net',snapshot_id:snapshot,scope_hash:hash});if(scope.exponent!==null&&scope.exponent!==undefined)q.set('exponent',String(scope.exponent));for(const sku of scope.sku)q.append('sku',sku);for(const source of scope.source)q.append('source',source);return q;}
function failure(status:number){return status===401||status===403?'Tu acceso cambió. Vuelve a iniciar sesión o selecciona una organización autorizada.':status===404?'No hay una recomendación o evidencia autorizada para este alcance.':status===409?'La versión o la evidencia cambió. Actualiza y revisa la propuesta antes de continuar.':status===400?'Revisa los campos y el alcance de la solicitud.':'No se pudo verificar la operación. Conserva tu borrador y reintenta; no se confirma ningún cambio.';}
const PRIORITY={critical:{label:'Revisión humana urgente',sev:'high',tone:'bad'},high:{label:'Prioridad alta',sev:'medium',tone:'warn'},normal:{label:'Prioridad normal',sev:'low',tone:'ok'}} as const;
const CAUSAL:Record<string,string>={hypothesis:'Hipótesis',candidate:'Candidata',supported:'Con respaldo',unsupported:'Sin respaldo',insufficient:'Evidencia insuficiente'};
const RANK={critical:0,high:1,normal:2} as const;
function RecommendationCard({item,members,busy,conflict,operate,first}:{item:Recommendation;members:RecommendationList['members'];busy:boolean;conflict:boolean;operate:Operation;first:boolean}){
 const [action,setAction]=useState(item.action),[conditions,setConditions]=useState(item.preconditions.join('\n')),[rationale,setRationale]=useState(item.rationale),[owner,setOwner]=useState(item.ownerId??''),[reason,setReason]=useState(''),[stateReason,setStateReason]=useState(''),[evidence,setEvidence]=useState(false),[edit,setEdit]=useState(false);
 const draftKey=useRef<string|null>(null);const locked=busy||conflict||!item.canMutate;const endpoint='/api/recommendations/'+item.id;
 const create=()=>{draftKey.current??=crypto.randomUUID();void operate(endpoint+'/interventions',{expectedVersion:item.version,requestKey:draftKey.current});};
 const evidenceQuery=pinnedQuery(item.scope,item.snapshotId,item.scopeHash);evidenceQuery.set('detail_hash',item.detailHash);
 const pr=PRIORITY[item.priority]??PRIORITY.normal,dismissed=item.status==='dismissed',highlight=first&&!dismissed;
 const close=(ok:Promise<boolean>)=>{void ok.then(()=>setEdit(false));};
 return <article className="card insight" aria-label={'Recomendación: '+item.title} data-severity={pr.sev} data-highlight={highlight||undefined} data-dismissed={dismissed||undefined}>
  <header className="insight-head"><span className="insight-icon" aria-hidden="true"><Icon name={highlight?'target':'sparkle'} size={16}/></span><div className="insight-titles"><span className="insight-eyebrow">{highlight?'Hacer primero':dismissed?'Descartada':'Recomendación'}</span><h3>{item.title}</h3></div><StatusChip tone={pr.tone}>{pr.label}</StatusChip></header>
  <p className="insight-sentence"><strong>{item.action}</strong></p>
  {item.preconditions.length>0&&<ul className="insight-signals" aria-label="Condiciones para considerar esta acción">{item.preconditions.slice(0,3).map((v,i)=><li key={i}><Icon name="check" size={14}/><span>{v}</span></li>)}</ul>}
  <div className={css.chips}><StatusChip tone={dismissed?'muted':'info'}>{dismissed?'Descartada':'Propuesta'} · v{item.version}</StatusChip><span className="chip">Esfuerzo: revisión diagnóstica</span><span className="chip">Estado causal: {CAUSAL[item.causalState]??item.causalState}</span><span className="chip">Responsable: {item.ownerId?'asignado':'sin asignar'}</span></div>
  {item.stale&&<p className="state" role="status">El problema o su evidencia ha cambiado. Esta versión se conserva como historial y requiere una propuesta vigente antes de actuar.</p>}
  {item.drafts.length>0&&<section aria-label="Borradores de intervención" className={css.drafts}><h4>Intervención guardada como borrador</h4><ul className="row-list">{item.drafts.map(d=><li key={d.id} className={css.draft}><span className={css.draftTitle}>{d.hypothesis}</span><span className="chip">{d.status}</span><LinkButton href={'/interventions?'+pinnedQuery(item.scope,item.snapshotId,item.scopeHash).toString()+'#intervention-'+d.id} size="sm" variant="ghost" icon={<Arrow/>}>Abrir intervención</LinkButton></li>)}</ul></section>}
  <footer className="insight-foot">
   <div className={css.secondary}><Button size="sm" icon={<Icon name="eye" size={14}/>} onClick={()=>setEvidence(true)}>{'Ver evidencia ('+item.evidenceRefs.length+')'}</Button>{item.canMutate&&<Button size="sm" variant="ghost" icon={<Icon name="settings" size={14}/>} onClick={()=>setEdit(true)}>Editar o gestionar</Button>}</div>
   {item.canMutate&&item.status==='proposed'&&<Button variant="primary" size="sm" disabled={locked||item.drafts.length>0} onClick={create}>Crear intervención borrador</Button>}
  </footer>
  {!item.canMutate&&<p className="insight-sentence">Esta versión es de consulta con tus permisos y la evidencia vigentes.</p>}
  <Drawer open={evidence} onClose={()=>setEvidence(false)} width={560} title={item.title} subtitle="Evidencia y contexto de la recomendación" footer={<LinkButton href={'/problems/'+item.problemId+'?'+evidenceQuery.toString()} size="sm" variant="primary" icon={<Arrow/>}>Ver problema y evidencia</LinkButton>}>
   <div className="stack">
    <p className="card-lead">{item.rationale}</p>
    <p className="card-lead">Esta propuesta no demuestra causalidad ni garantiza un ahorro.</p>
    <section><h3>Condiciones para considerar esta acción</h3><ul>{item.preconditions.map((v,i)=><li key={i}>{v}</li>)}</ul></section>
    <section><h3>{'Evidencia de la recomendación ('+item.evidenceRefs.length+')'}</h3>{item.evidenceRefs.map((e,i)=><Citation key={e.runId+':'+e.messageRevisionId+':'+i} quote={e.quote} role={e.role} category={e.category} messageRevisionId={e.messageRevisionId}/>)}</section>
    <div className="meta-row"><span className="chip">Problema v{item.problemVersion}</span><IdChip value={item.snapshotId} label="Publicación"/><IdChip value={item.scopeHash} label="Alcance"/></div>
    <details><summary>{'Historial de versiones ('+item.history.length+')'}</summary><ol>{item.history.map(v=><li key={v.version}><strong>v{v.version} · {v.status==='dismissed'?'Descartada':'Propuesta'}</strong><p>{v.action}</p><p>{v.reason}</p><p>Responsable: {v.ownerId??'Sin asignar'} · Registrado por {v.actorId} · <time>{v.createdAt}</time></p></li>)}</ol></details>
   </div>
  </Drawer>
  {item.canMutate&&<Drawer open={edit} onClose={()=>setEdit(false)} width={560} title="Editar o gestionar" subtitle={item.title}>
   <div className="stack">
    <section><h3>Revisar la propuesta</h3><form className="action-form" aria-label="Revisar recomendación" onSubmit={e=>{e.preventDefault();if(!locked)close(operate(endpoint,{operation:'revise',expectedVersion:item.version,action,preconditions:conditions.split(/\r?\n/).map(v=>v.trim()).filter(Boolean),rationale,ownerId:owner||null,reason}));}}>
     <label htmlFor={item.id+'-action'}>Acción propuesta</label><textarea id={item.id+'-action'} required minLength={20} maxLength={2000} value={action} onChange={e=>setAction(e.target.value)} disabled={busy}/>
     <label htmlFor={item.id+'-conditions'}>Condiciones previas, una por línea</label><textarea id={item.id+'-conditions'} required value={conditions} onChange={e=>setConditions(e.target.value)} disabled={busy}/>
     <label htmlFor={item.id+'-rationale'}>Justificación de la recomendación</label><textarea id={item.id+'-rationale'} required minLength={20} maxLength={4000} value={rationale} onChange={e=>setRationale(e.target.value)} disabled={busy}/>
     <label htmlFor={item.id+'-owner'}>Responsable de la recomendación</label><select id={item.id+'-owner'} value={owner} onChange={e=>setOwner(e.target.value)} disabled={busy}><option value="">Sin asignar</option>{members.map(m=><option key={m.id} value={m.id}>{m.id} · {m.role}</option>)}</select>
     <label htmlFor={item.id+'-reason'}>Razón del cambio</label><textarea id={item.id+'-reason'} required minLength={20} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)} disabled={busy}/>
     <div className="btn-group"><Button type="submit" variant="primary" size="sm" disabled={locked}>Guardar revisión</Button></div>
    </form></section>
    <details className={css.fold}><summary>{item.status==='dismissed'?'Reabrir':'Descartar'} la recomendación</summary><form className="action-form" aria-label="Cambiar estado de la recomendación" onSubmit={e=>{e.preventDefault();if(!locked)close(operate(endpoint,{operation:'state',expectedVersion:item.version,status:item.status==='dismissed'?'proposed':'dismissed',reason:stateReason}));}}>
     <label htmlFor={item.id+'-state-reason'}>Razón para cambiar el estado</label><textarea id={item.id+'-state-reason'} required minLength={20} maxLength={2000} value={stateReason} onChange={e=>setStateReason(e.target.value)} disabled={busy}/>
     <div className="btn-group"><Button type="submit" size="sm" disabled={locked}>{item.status==='dismissed'?'Reabrir recomendación':'Descartar recomendación'}</Button></div>
    </form></details>
   </div>
  </Drawer>}
 </article>;
}
export function RecommendationsPanel({initialQuery}:{initialQuery:string}){
 const [query,setQuery]=useState(cleanQuery(initialQuery).toString()),[scope,setScope]=useState<Filters>(()=>initialScope(initialQuery)),[view,setView]=useState<RecommendationList|null>(null),[busy,setBusy]=useState(true),[empty,setEmpty]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[conflict,setConflict]=useState(false),[problem,setProblem]=useState(new URLSearchParams(initialQuery).get('problem_id')??'');
 const generation=useRef(0),controller=useRef<AbortController|null>(null),resolved=useRef(query),inFlight=useRef(false),generateKey=useRef<{fingerprint:string;key:string}|null>(null);
 const invalidate=useCallback(()=>{controller.current?.abort();generation.current++;inFlight.current=false;},[]);
 useWorkspaceNavigation(invalidate);
 const load=useCallback(async(input:string)=>{const sourceLocation=workspaceLocation();controller.current?.abort();const abort=new AbortController();controller.current=abort;const epoch=++generation.current;inFlight.current=true;setBusy(true);setView(null);setError('');setEmpty(false);setNotice('');setConflict(false);
  try{const p=cleanQuery(input);p.set('resource','problems');const snapshot=await fetch('/api/workspace?'+p.toString(),{cache:'no-store',signal:abort.signal});if(abort.signal.aborted||epoch!==generation.current)return;if(!snapshot.ok)throw Error(failure(snapshot.status));const envelope=await snapshot.json();if(abort.signal.aborted||epoch!==generation.current)return;const meta=envelope.data?.meta;if(!meta?.scope)throw Error('No se pudo verificar la publicación solicitada.');setScope({...meta.scope,exponent:meta.scope.exponent??undefined});if(!meta.snapshot_id||!meta.scope_hash){setEmpty(true);return;}
   const fixed=pinnedQuery(meta.scope,meta.snapshot_id,meta.scope_hash);const response=await fetch('/api/recommendations?'+fixed.toString(),{cache:'no-store',signal:abort.signal});if(abort.signal.aborted||epoch!==generation.current)return;if(!response.ok)throw Error(failure(response.status));const json=await response.json();if(abort.signal.aborted||epoch!==generation.current)return;const data=json.data as RecommendationList;if(!data||!Array.isArray(data.items)||!Array.isArray(data.problemOptions)||!Array.isArray(data.members)||data.snapshotId!==meta.snapshot_id||data.scopeHash!==meta.scope_hash)throw Error('No se pudo verificar el alcance de las recomendaciones.');if(workspaceLocation()!==sourceLocation)return;resolved.current=fixed.toString();window.history.replaceState(null,'',window.location.pathname+'?'+fixed.toString()+window.location.hash);setView(data);
  }catch(e){if(!abort.signal.aborted&&epoch===generation.current){setView(null);setError(e instanceof Error?e.message:'No se pudo consultar las recomendaciones.');}}
  finally{if(!abort.signal.aborted&&epoch===generation.current){inFlight.current=false;setBusy(false);}}
 },[]);
 useEffect(()=>{let active=true;void Promise.resolve().then(()=>{if(active)void load(query);});return()=>{active=false;invalidate();};},[query,load,invalidate]);
 useEffect(()=>{const back=()=>{invalidate();const next=cleanQuery(window.location.search.slice(1)).toString();resolved.current=next;setProblem('');if(next===query)void load(next);else setQuery(next);};window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back);},[invalidate,load,query]);
 const apply=(next:URLSearchParams)=>{invalidate();const changed=['date_start','date_end','currency','basis','exponent'].some(k=>{const old=new URLSearchParams(resolved.current).get(k)??'';return(next.get(k)??'')!==old;});if(changed&&next.get('snapshot_id')===scope.snapshot_id)next.delete('snapshot_id');next.delete('scope_hash');setView(null);setProblem('');setError('');setBusy(true);const value=cleanQuery(next.toString()).toString();resolved.current=value;window.history.pushState(null,'',window.location.pathname+'?'+value);if(value===query)void load(value);else setQuery(value);};
 const operate:Operation=async(url,body)=>{if(inFlight.current)return false;inFlight.current=true;controller.current?.abort();const abort=new AbortController();controller.current=abort;const epoch=++generation.current;setBusy(true);setError('');setNotice('');let saved=false;
  try{const response=await fetch(url,{method:'POST',cache:'no-store',signal:abort.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(abort.signal.aborted||epoch!==generation.current)return false;if(!response.ok){if([401,403,404].includes(response.status)){setView(null);setProblem('');}if(response.status===409)setConflict(true);throw Error(failure(response.status));}const result=await response.json();if(abort.signal.aborted||epoch!==generation.current)return false;if(!result.data)throw Error('No se pudo verificar el resultado de la operación.');saved=true;
   const refreshed=await fetch('/api/recommendations?'+resolved.current,{cache:'no-store',signal:abort.signal});if(abort.signal.aborted||epoch!==generation.current)return false;if(!refreshed.ok){if([401,403,404].includes(refreshed.status))setView(null);throw Error('La operación se guardó, pero no se pudo verificar la vista actual. Actualiza antes de continuar.');}const json=await refreshed.json();if(abort.signal.aborted||epoch!==generation.current)return false;const next=json.data as RecommendationList;const fixed=new URLSearchParams(resolved.current);if(!next||!Array.isArray(next.items)||next.snapshotId!==fixed.get('snapshot_id')||next.scopeHash!==fixed.get('scope_hash'))throw Error('La operación se guardó, pero la vista recibida no coincide con su alcance.');setView(next);setNotice('Cambio guardado y verificado.');return true;
  }catch(e){if(!abort.signal.aborted&&epoch===generation.current){if(saved)setConflict(true);setError(e instanceof Error?e.message:failure(503));}return false;}
  finally{if(!abort.signal.aborted&&epoch===generation.current){inFlight.current=false;setBusy(false);}}
 };
 const generate=()=>{if(!view||!problem||busy||conflict)return;const fingerprint=JSON.stringify({query:resolved.current,problemId:problem,problemVersion:view.problemOptions.find(p=>p.id===problem)?.version});if(generateKey.current?.fingerprint!==fingerprint)generateKey.current={fingerprint,key:crypto.randomUUID()};void operate('/api/recommendations',{operation:'generate',query:resolved.current,problemId:problem,requestKey:generateKey.current.key});};
 const [seg,setSeg]=useState<'all'|'proposed'|'dismissed'>('all'),[propose,setPropose]=useState(false);
 const items=view?[...view.items].sort((a,b)=>(RANK[a.priority]??2)-(RANK[b.priority]??2)):[];
 const nProposed=items.filter(i=>i.status==='proposed').length,nDismissed=items.filter(i=>i.status==='dismissed').length;
 const shown=items.filter(i=>seg==='all'||i.status===seg);
 const firstId=items.find(i=>i.status==='proposed')?.id;
 return <section aria-label="Recomendaciones con evidencia" className="stack">
  <PageHeader eyebrow="Decisiones y seguimiento" title="Recomendaciones" description="Acciones propuestas, ordenadas por prioridad, con la evidencia que las respalda." actions={<><Button icon={<Refresh/>} loading={busy} onClick={()=>void load(resolved.current)}>Actualizar recomendaciones</Button>{view?.canPropose&&<Button icon={<Icon name="sparkle" size={14}/>} onClick={()=>setPropose(true)}>Proponer una recomendación</Button>}</>}/>
  <ScopeBar scope={scope} onApply={apply} busy={busy}/>
  {busy&&!view&&<div role="status" aria-label="Verificando recomendaciones"><SkeletonCards count={2}/></div>}{error&&<p className="state state-error" role="alert">{error}</p>}{notice&&<p className="state" role="status">{notice}</p>}{empty&&<DataState state={{kind:'empty'}}/>}
  {empty&&<EmptyState art="chart" title="Aún no hay un corte publicado" body="Publica un corte financiero para proponer acciones sobre evidencia verificable." action={<LinkButton href="/economics" variant="primary" size="sm" icon={<Arrow/>}>Revisar publicaciones</LinkButton>}/>}
  {view&&<>{view.unavailableCount>0&&<p className="state" role="status">Hay recomendaciones que no pueden mostrarse con la evidencia y los permisos actuales.</p>}
   {view.canPropose&&<Modal open={propose} onClose={()=>setPropose(false)} title="Proponer una recomendación" footer={<Button type="submit" form="recommendation-form" variant="primary" disabled={busy||conflict||!view.problemOptions.some(p=>p.id===problem)}>Proponer recomendación</Button>}>
    <form id="recommendation-form" className="stack" aria-label="Proponer una recomendación" onSubmit={e=>{e.preventDefault();generate();setPropose(false);}}><label htmlFor="recommendation-problem">Problema para recomendar</label><select id="recommendation-problem" required disabled={busy} value={problem} onChange={e=>setProblem(e.target.value)}><option value="">Seleccionar problema</option>{view.problemOptions.map(p=><option key={p.id} value={p.id}>{p.label} · v{p.version}</option>)}</select><p className="card-lead">Se genera con reglas explícitas y evidencia autorizada. Requiere revisión humana.</p></form>
   </Modal>}
   {!view.canPropose&&<p className="state">Tu rol permite consultar las recomendaciones. Proponer o modificar requiere permisos de analista, operador o propietario.</p>}
   {items.length>0&&<div className="toolbar"><SegmentedControl label="Estado de las recomendaciones" value={seg} onChange={setSeg} options={[{value:'all',label:'Todas',count:items.length},{value:'proposed',label:'Propuestas',count:nProposed},{value:'dismissed',label:'Descartadas',count:nDismissed}]}/><span className="toolbar-spacer"/><IdChip value={view.snapshotId} label="Publicación"/></div>}
   {!items.length&&<EmptyState art="inbox" title="No hay recomendaciones para este alcance" body={view.canPropose?'Propón la primera sobre un problema publicado.':'Cuando se proponga una, aparecerá aquí.'} action={view.canPropose?<Button variant="primary" size="sm" onClick={()=>setPropose(true)}>Proponer una recomendación</Button>:undefined}/>}
   {items.length>0&&!shown.length&&<p className="state">No hay recomendaciones {seg==='dismissed'?'descartadas':'propuestas'} en este alcance ({nf.format(items.length)} en total).</p>}
   <div className={css.stack+' reveal'}>{shown.map(item=><RecommendationCard key={item.id+':'+item.version} item={item} members={view.members} busy={busy} conflict={conflict} operate={operate} first={item.id===firstId}/>)}</div>
  </>}
 </section>;
}
