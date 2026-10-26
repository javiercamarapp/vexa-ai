'use client';
import {RovaqCargando} from './rovaq-cargando';
import {useAutoRefresh} from './ui/use-auto-refresh';
import {useLayoutEffect,useCallback,useEffect,useRef,useState} from 'react';
import {PageHeader} from './ui/page-header';
import {KpiLinea} from './panel-comun/kpi-linea';
import './panel-comun/panel-comun.css';
import {Button,LinkButton} from './ui/button';
import {StatusChip} from './ui/status-chip';
import {BarList} from './ui/bar-list';
import {EmptyState} from './ui/empty-state';
import {Drawer} from './ui/overlay';
import {IdChip} from './ui/id-chip';
import {Timeline} from './ui/timeline';
import {Icon} from './ui/icons';
import {SkeletonStats} from './ui/skeletons';
import {DataState} from './workspace/data-state';
import {nf} from './ui/format';
import css from './ops-panels.module.css';
type Summary={status:string;kind:string;eligibleCases:number;utility:number|null;holdoutHash:string;resultHash:string};
type Result={id:string;candidateId:string;configHash:string;eligible:boolean;reason:string;summary:Summary|null};
type History={version:number;candidateId:string|null;configHash:string;operation:string};
type State={results:Result[];history:History[];version:number;activeCandidateId:string|null;next:{results:string|null;history:number|null}};
export function CandidatesPanel(){const[data,setData]=useState<State|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[receipt,setReceipt]=useState(''),[evidence,setEvidence]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[registering,setRegistering]=useState(false);const seq=useRef(0),controller=useRef<AbortController|null>(null);
 const load=useCallback(async()=>{const id=++seq.current;controller.current?.abort();const c=new AbortController();controller.current=c;setLoading(true);setConfirmed(false);setError('');try{const response=await fetch('/api/candidates',{cache:'no-store',signal:c.signal});if(!response.ok)throw Error('load');const value=await response.json();if(seq.current===id){setData(value);setError('');return true;}}catch{if(seq.current===id&&!c.signal.aborted){setData(null);setError('No se pudieron cargar los candidatos. Se reintentará solo para recuperar el estado confirmado.');}}finally{if(seq.current===id)setLoading(false);}return false;},[]);
 const stop=useCallback(()=>{seq.current++;controller.current?.abort();},[]);
 useEffect(()=>{let disposed=false;void Promise.resolve().then(()=>{if(!disposed)void load();});return()=>{disposed=true;stop();};},[load,stop]);
 // Datos nuevos: relectura en segundo plano; no corre durante una carga/escritura ni si se paginó (para no perder las páginas ya abiertas).
 const ocupado=useRef(true);useLayoutEffect(()=>{ocupado.current=busy||loading||registering||(data!==null&&(data.results.length>25||data.history.length>25));});
 const recargarSilencioso=useCallback(async()=>{if(ocupado.current)return;const id=seq.current;try{const response=await fetch('/api/candidates',{cache:'no-store'});if(!response.ok)return;const value=await response.json();if(seq.current===id&&!ocupado.current)setData(value);}catch{/* se conserva lo pintado */}},[]);
 useAutoRefresh(recargarSilencioso,{ocupado:()=>ocupado.current});
 async function more(kind:'results'|'history'){
  if(!data||busy||loading||data.next[kind]===null)return;const before=data;const id=++seq.current;controller.current?.abort();const c=new AbortController();controller.current=c;setLoading(true);setConfirmed(false);setError('');
  try{const query=new URLSearchParams({[kind==='results'?'resultsBefore':'historyBefore']:String(before.next[kind])});const response=await fetch('/api/candidates?'+query,{cache:'no-store',signal:c.signal});if(!response.ok)throw Error('page');const page:State=await response.json();if(seq.current!==id)return;if(page.version!==before.version){setData(null);setError('La selección cambió. Recarga los candidatos antes de continuar.');return;}
   setData({...before,[kind]:kind==='results'?[...before.results,...page.results.filter(r=>!before.results.some(old=>old.id===r.id))]:[...before.history,...page.history.filter(h=>!before.history.some(old=>old.version===h.version))],next:{...before.next,[kind]:page.next[kind]}});
  }catch{if(seq.current===id&&!c.signal.aborted){setData(null);setError('No se pudo verificar la siguiente página. Recarga los candidatos y comprueba tus permisos.');}}finally{if(seq.current===id)setLoading(false);}
 }
 async function mutate(body:object){if(busy||loading)return;setBusy(true);setConfirmed(false);setError('');try{const response=await fetch('/api/candidates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!response.ok){if(response.status===403)setData(null);if(response.status===409)await load();throw Error('write');}await load();}catch{setError('No se pudo confirmar el cambio. Verifica los permisos, la versión y el recibo firmado.');}finally{setBusy(false);}}
 const canChange=!!data&&!busy&&!loading&&confirmed&&/^[a-f0-9]{64}$/.test(evidence); const eligibleCount=data?data.results.filter(r=>r.eligible).length:0;
 const utilities=data?data.results.map(r=>r.summary?.utility??null):[];
 if(loading&&!data&&!error)return <RovaqCargando mensaje=""/>;
 return <section className="stack" style={{overflowWrap:'anywhere',minWidth:0}} aria-label="Candidatos de extracción" aria-busy={loading||busy}>
  <PageHeader eyebrow="Interno" title="Candidatos de extracción" description="Selección con evaluación independiente firmada y confirmación de un propietario." actions={<><LinkButton href="/evaluation">Volver a evaluación</LinkButton>{data&&<Button variant="primary" disabled={busy||loading} onClick={()=>setRegistering(true)}>Registrar evaluación</Button>}</>}/>
  {loading&&<p role="status" className="sr-only">Cargando estado confirmado…</p>}
  {loading&&!data&&!error&&<SkeletonStats count={4}/>}
  {error&&!data?<DataState state={{kind:'error',message:error,code:'candidates'}}/>:error&&<div role="alert" className="notice-bar"><Icon name="alert" size={14}/><p>{error}</p></div>}
  {data&&<>
   <KpiLinea label="Indicadores de candidatos" items={[
    {label:'Versión activa',value:nf.format(data.version),c:5,partes:[{label:'Activa',value:1}],nota:data.activeCandidateId?'Candidato '+data.activeCandidateId.slice(0,8):'Configuración predeterminada'},
    {label:'Evaluaciones firmadas',value:nf.format(data.results.length)+(data.next.results!==null?'+':''),c:3,partes:[{label:'Cumplen',value:eligibleCount},{label:'No cumplen',value:data.results.length-eligibleCount}],nota:'Con evaluación independiente'},
    {label:'Cumplen criterios',value:nf.format(eligibleCount),c:1,partes:[{label:'Cumplen',value:eligibleCount},{label:'No cumplen',value:data.results.length-eligibleCount}],nota:'de '+nf.format(data.results.length)+' cargadas'},
    {label:'Versiones en el historial',value:nf.format(data.history.length)+(data.next.history!==null?'+':''),c:7,partes:data.history.map((h,i)=>({label:'v'+i,value:1})),nota:'Cada cambio es un registro nuevo'}]}/>
   {!data.results.length?<EmptyState art="shield" title="Aún no hay evaluaciones firmadas" body="Registra el recibo del custodio para comparar candidatos." action={<Button variant="primary" onClick={()=>setRegistering(true)}>Registrar evaluación</Button>}/>
   :<>
   <div className="split" data-even>
    <section className="card" aria-label="Utilidad por candidato">
     <div className="card-title"><div><h2>Utilidad por candidato</h2><p>Longitud proporcional al valor mayor</p></div></div>
     <BarList c={6} empty="Sin utilidades registradas." max={Math.max(0,...utilities.map(u=>u??0))||1} items={data.results.map(r=>({key:r.id,label:r.candidateId,value:r.summary?r.summary.utility:null,display:r.summary?(r.summary.utility===null?'desconocida':String(r.summary.utility)):'sin firma',kind:'observed' as const,note:r.summary?nf.format(r.summary.eligibleCases)+' casos':undefined}))}/>
    </section>
    <section className="card" aria-label="Confirmación humana">
     <div className="card-title"><div><h2>Confirmación humana</h2><p>Necesaria para seleccionar o restaurar</p></div><StatusChip tone={canChange?'ok':'muted'}>{canChange?'Lista':'Pendiente'}</StatusChip></div>
     <div className={css.form}>
      <label>Hash de evidencia revisada<input value={evidence} onChange={e=>setEvidence(e.target.value)} maxLength={64}/></label>
      <label className="check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Confirmo que revisé la evidencia independiente y autorizo esta selección o rollback.</label>
      <details><summary>Criterios de selección</summary><p className={css.muted}>Gold humano completo, al menos 30 casos, utilidad mayor al 85% revisada por completo, cobertura y citas del 100%, sin fallos ni costos desconocidos.</p></details>
     </div>
    </section>
   </div>
   <section className="card" aria-label="Comparación de candidatos">
    <div className="card-title"><div><h2>Candidatos evaluados</h2><p>Holdouts distintos no son comparables directamente</p></div></div>
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Candidatos evaluados, desplazamiento horizontal"><table className="dtable"><thead><tr><th scope="col">Candidato</th><th scope="col">Evaluación</th><th scope="col" className="num">Casos</th><th scope="col" className="num">Utilidad</th><th scope="col">Selección</th><th scope="col" aria-label="Acción"></th></tr></thead>
     <tbody>{data.results.map(r=><tr key={r.id}><th scope="row"><strong>{r.candidateId}</strong><div><IdChip value={r.configHash} label="Config." head={6} tail={4}/></div></th><td>{r.summary?<><StatusChip tone={r.summary.status==='passed'||r.summary.status==='ok'?'ok':'info'}>{r.summary.status}</StatusChip> <span className="chip">{r.summary.kind}</span></>:<StatusChip tone="muted">Firma o custodio no disponible</StatusChip>}</td><td className="num">{r.summary?nf.format(r.summary.eligibleCases):'—'}</td><td className="num">{r.summary?(r.summary.utility===null?'desconocida':String(r.summary.utility)):'—'}</td><td>{r.eligible?<StatusChip tone="ok">Cumple criterios</StatusChip>:<><StatusChip tone="warn" title={'Selección bloqueada: '+r.reason}>Bloqueada</StatusChip><p className={css.muted}>{r.reason}</p></>}</td><td><Button size="sm" variant="primary" disabled={!canChange||!r.eligible} onClick={()=>void mutate({operation:'select',resultId:r.id,expectedVersion:data.version,confirmed:true,reason:'validated_evaluation',evidenceHash:evidence})}>Seleccionar {r.candidateId}</Button></td></tr>)}</tbody></table></div>
    {data.next.results!==null&&<div className={css.pager}><Button size="sm" variant="ghost" disabled={busy||loading} onClick={()=>void more('results')}>Cargar más evaluaciones</Button></div>}
   <details><summary>Cómo leer la comparación</summary><p className={css.muted}>La regla de exposición exige un nuevo holdout por candidato; estos valores no demuestran una mejora estadística.</p></details></section></>}
   <section className="card" aria-label="Historial y rollback">
    <div className="card-title"><div><h2>Historial y rollback</h2><p>Cada cambio conserva su versión anterior</p></div>{data.version>0&&<Button size="sm" disabled={!canChange} onClick={()=>void mutate({operation:'rollback',targetVersion:0,expectedVersion:data.version,confirmed:true,reason:'incident_recovery',evidenceHash:evidence})}>Restaurar configuración predeterminada</Button>}</div>
    {!data.history.length?<p className="state">Aún no hay versiones registradas; se usa la configuración predeterminada.</p>:<Timeline events={data.history.map(h=>({key:String(h.version),icon:h.version===data.version?'target':'clock',title:<>Versión {h.version}: {h.candidateId??'Predeterminada'}</>,meta:h.version===data.version?<StatusChip tone="ok">Activa</StatusChip>:undefined,body:<IdChip value={h.configHash} label="Config." head={8} tail={4}/>,actions:h.version<data.version?<Button size="sm" disabled={!canChange} onClick={()=>void mutate({operation:'rollback',targetVersion:h.version,expectedVersion:data.version,confirmed:true,reason:'quality_regression',evidenceHash:evidence})}>Restaurar versión {h.version}</Button>:undefined}))}/>}
    {data.next.history!==null&&<div className={css.pager}><Button size="sm" variant="ghost" disabled={busy||loading} onClick={()=>void more('history')}>Cargar más versiones</Button></div>}
   </section>
  </>}
  <Drawer open={registering} onClose={()=>setRegistering(false)} title="Registrar recibo del custodio" subtitle="Resumen firmado en JSON" footer={<><Button size="sm" variant="ghost" onClick={()=>setRegistering(false)}>Cancelar</Button><Button size="sm" variant="primary" type="submit" form="cand-register" disabled={busy||loading||!receipt}>Registrar evaluación firmada</Button></>}>
   <form id="cand-register" className={css.form} onSubmit={e=>{e.preventDefault();try{const envelope=JSON.parse(receipt);setRegistering(false);void mutate({operation:'register',requestId:crypto.randomUUID(),envelope});}catch{setRegistering(false);setError('El resumen firmado debe ser JSON válido.');}}}>
    <label>Resumen firmado<textarea value={receipt} onChange={e=>setReceipt(e.target.value)} maxLength={18000} rows={10}/></label>
    <p className={css.muted}>Los comentarios de desarrollo no acreditan una revisión humana de referencia.</p>
   </form>
  </Drawer>
 </section>;
}
