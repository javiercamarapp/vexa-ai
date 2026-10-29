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
import {useT} from './i18n/proveedor';
type Summary={status:string;kind:string;eligibleCases:number;utility:number|null;holdoutHash:string;resultHash:string};
type Result={id:string;candidateId:string;configHash:string;eligible:boolean;reason:string;summary:Summary|null};
type History={version:number;candidateId:string|null;configHash:string;operation:string};
type State={results:Result[];history:History[];version:number;activeCandidateId:string|null;next:{results:string|null;history:number|null}};
export function CandidatesPanel(){const t=useT();const[data,setData]=useState<State|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[receipt,setReceipt]=useState(''),[evidence,setEvidence]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[registering,setRegistering]=useState(false);const seq=useRef(0),controller=useRef<AbortController|null>(null);
 const load=useCallback(async()=>{const id=++seq.current;controller.current?.abort();const c=new AbortController();controller.current=c;setLoading(true);setConfirmed(false);setError('');try{const response=await fetch('/api/candidates',{cache:'no-store',signal:c.signal});if(!response.ok)throw Error('load');const value=await response.json();if(seq.current===id){setData(value);setError('');return true;}}catch{if(seq.current===id&&!c.signal.aborted){setData(null);setError(t('tr.cand.eCarga'));}}finally{if(seq.current===id)setLoading(false);}return false;},[t]);
 const stop=useCallback(()=>{seq.current++;controller.current?.abort();},[]);
 useEffect(()=>{let disposed=false;void Promise.resolve().then(()=>{if(!disposed)void load();});return()=>{disposed=true;stop();};},[load,stop]);
 // Datos nuevos: relectura en segundo plano; no corre durante una carga/escritura ni si se paginó (para no perder las páginas ya abiertas).
 const ocupado=useRef(true);useLayoutEffect(()=>{ocupado.current=busy||loading||registering||(data!==null&&(data.results.length>25||data.history.length>25));});
 const recargarSilencioso=useCallback(async()=>{if(ocupado.current)return;const id=seq.current;try{const response=await fetch('/api/candidates',{cache:'no-store'});if(!response.ok)return;const value=await response.json();if(seq.current===id&&!ocupado.current)setData(value);}catch{/* se conserva lo pintado */}},[]);
 useAutoRefresh(recargarSilencioso,{ocupado:()=>ocupado.current});
 async function more(kind:'results'|'history'){
  if(!data||busy||loading||data.next[kind]===null)return;const before=data;const id=++seq.current;controller.current?.abort();const c=new AbortController();controller.current=c;setLoading(true);setConfirmed(false);setError('');
  try{const query=new URLSearchParams({[kind==='results'?'resultsBefore':'historyBefore']:String(before.next[kind])});const response=await fetch('/api/candidates?'+query,{cache:'no-store',signal:c.signal});if(!response.ok)throw Error('page');const page:State=await response.json();if(seq.current!==id)return;if(page.version!==before.version){setData(null);setError(t('tr.cand.eSeleccion'));return;}
   setData({...before,[kind]:kind==='results'?[...before.results,...page.results.filter(r=>!before.results.some(old=>old.id===r.id))]:[...before.history,...page.history.filter(h=>!before.history.some(old=>old.version===h.version))],next:{...before.next,[kind]:page.next[kind]}});
  }catch{if(seq.current===id&&!c.signal.aborted){setData(null);setError(t('tr.cand.ePagina'));}}finally{if(seq.current===id)setLoading(false);}
 }
 async function mutate(body:object){if(busy||loading)return;setBusy(true);setConfirmed(false);setError('');try{const response=await fetch('/api/candidates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!response.ok){if(response.status===403)setData(null);if(response.status===409)await load();throw Error('write');}await load();}catch{setError(t('tr.cand.eCambio'));}finally{setBusy(false);}}
 const canChange=!!data&&!busy&&!loading&&confirmed&&/^[a-f0-9]{64}$/.test(evidence); const eligibleCount=data?data.results.filter(r=>r.eligible).length:0;
 const utilities=data?data.results.map(r=>r.summary?.utility??null):[];
 if(loading&&!data&&!error)return <RovaqCargando mensaje=""/>;
 return <section className="stack" style={{overflowWrap:'anywhere',minWidth:0}} aria-label={t('tr.cand.aria')} aria-busy={loading||busy}>
  <PageHeader eyebrow={t('tr.cand.interno')} title={t('tr.cand.aria')} description={t('tr.cand.desc')} actions={<><LinkButton href="/evaluation">{t('tr.cand.volverEval')}</LinkButton>{data&&<Button variant="primary" disabled={busy||loading} onClick={()=>setRegistering(true)}>{t('tr.cand.registrarEval')}</Button>}</>}/>
  {loading&&<p role="status" className="sr-only">{t('tr.cand.cargandoConf')}</p>}
  {loading&&!data&&!error&&<SkeletonStats count={4}/>}
  {error&&!data?<DataState state={{kind:'error',message:error,code:'candidates'}}/>:error&&<div role="alert" className="notice-bar"><Icon name="alert" size={14}/><p>{error}</p></div>}
  {data&&<>
   <KpiLinea label={t('tr.cand.indicadores')} items={[
    {label:t('tr.cand.versionActiva'),value:nf.format(data.version),c:5,partes:[{label:t('tr.cand.activa'),value:1}],nota:data.activeCandidateId?t('tr.cand.candidato',{id:data.activeCandidateId.slice(0,8)}):t('tr.cand.configPred')},
    {label:t('tr.cand.evalFirmadas'),value:nf.format(data.results.length)+(data.next.results!==null?'+':''),c:3,partes:[{label:t('tr.cand.cumplen'),value:eligibleCount},{label:t('tr.cand.noCumplen'),value:data.results.length-eligibleCount}],nota:t('tr.cand.conEvalInd')},
    {label:t('tr.cand.cumplenCrit'),value:nf.format(eligibleCount),c:1,partes:[{label:t('tr.cand.cumplen'),value:eligibleCount},{label:t('tr.cand.noCumplen'),value:data.results.length-eligibleCount}],nota:t('tr.cand.deCargadas',{n:nf.format(data.results.length)})},
    {label:t('tr.cand.versionesHist'),value:nf.format(data.history.length)+(data.next.history!==null?'+':''),c:7,partes:data.history.map((h,i)=>({label:'v'+i,value:1})),nota:t('tr.cand.cadaCambio')}]}/>
   {!data.results.length?<EmptyState art="shield" title={t('tr.cand.aunNoEval')} body={t('tr.cand.registraRecibo')} action={<Button variant="primary" onClick={()=>setRegistering(true)}>{t('tr.cand.registrarEval')}</Button>}/>
   :<>
   <div className="split" data-even>
    <section className="card" aria-label={t('tr.cand.utilidadPor')}>
     <div className="card-title"><div><h2>{t('tr.cand.utilidadPor')}</h2><p>{t('tr.cand.longProp')}</p></div></div>
     <BarList c={6} empty={t('tr.cand.sinUtilidades')} max={Math.max(0,...utilities.map(u=>u??0))||1} items={data.results.map(r=>({key:r.id,label:r.candidateId,value:r.summary?r.summary.utility:null,display:r.summary?(r.summary.utility===null?t('tr.cand.desconocida'):String(r.summary.utility)):t('tr.cand.sinFirma'),kind:'observed' as const,note:r.summary?t('tr.cand.nCasos',{n:nf.format(r.summary.eligibleCases)}):undefined}))}/>
    </section>
    <section className="card" aria-label={t('tr.cand.confHumana')}>
     <div className="card-title"><div><h2>{t('tr.cand.confHumana')}</h2><p>{t('tr.cand.necesaria')}</p></div><StatusChip tone={canChange?'ok':'muted'}>{canChange?t('tr.cand.lista'):t('tr.cand.pendiente')}</StatusChip></div>
     <div className={css.form}>
      <label>{t('tr.cand.hashEvid')}<input value={evidence} onChange={e=>setEvidence(e.target.value)} maxLength={64}/></label>
      <label className="check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>{t('tr.cand.confirmo')}</label>
      <details><summary>{t('tr.cand.criteriosSel')}</summary><p className={css.muted}>{t('tr.cand.criteriosTxt',{casos:30,util:85,cov:100})}</p></details>
     </div>
    </section>
   </div>
   <section className="card" aria-label={t('tr.cand.compAria')}>
    <div className="card-title"><div><h2>{t('tr.cand.evaluados')}</h2><p>{t('tr.cand.holdouts')}</p></div></div>
    <div className="table-wrap" tabIndex={0} role="region" aria-label={t('tr.cand.evaluadosAria')}><table className="dtable"><thead><tr><th scope="col">{t('tr.cand.thCandidato')}</th><th scope="col">{t('tr.cand.thEvaluacion')}</th><th scope="col" className="num">{t('tr.cand.thCasos')}</th><th scope="col" className="num">{t('tr.cand.thUtilidad')}</th><th scope="col">{t('tr.cand.thSeleccion')}</th><th scope="col" aria-label={t('tr.cand.thAccion')}></th></tr></thead>
     <tbody>{data.results.map(r=><tr key={r.id}><th scope="row"><strong>{r.candidateId}</strong><div><IdChip value={r.configHash} label={t('tr.cand.config')} head={6} tail={4}/></div></th><td>{r.summary?<><StatusChip tone={r.summary.status==='passed'||r.summary.status==='ok'?'ok':'info'}>{r.summary.status}</StatusChip> <span className="chip">{r.summary.kind}</span></>:<StatusChip tone="muted">{t('tr.cand.sinFirmaCust')}</StatusChip>}</td><td className="num">{r.summary?nf.format(r.summary.eligibleCases):'—'}</td><td className="num">{r.summary?(r.summary.utility===null?t('tr.cand.desconocida'):String(r.summary.utility)):'—'}</td><td>{r.eligible?<StatusChip tone="ok">{t('tr.cand.cumpleCrit')}</StatusChip>:<><StatusChip tone="warn" title={t('tr.cand.selBloqueada',{motivo:r.reason})}>{t('tr.cand.bloqueada')}</StatusChip><p className={css.muted}>{r.reason}</p></>}</td><td><Button size="sm" variant="primary" disabled={!canChange||!r.eligible} onClick={()=>void mutate({operation:'select',resultId:r.id,expectedVersion:data.version,confirmed:true,reason:'validated_evaluation',evidenceHash:evidence})}>{t('tr.cand.seleccionar',{id:r.candidateId})}</Button></td></tr>)}</tbody></table></div>
    {data.next.results!==null&&<div className={css.pager}><Button size="sm" variant="ghost" disabled={busy||loading} onClick={()=>void more('results')}>{t('tr.cand.cargarEval')}</Button></div>}
   <details><summary>{t('tr.cand.comoLeer')}</summary><p className={css.muted}>{t('tr.cand.comoLeerTxt')}</p></details></section></>}
   <section className="card" aria-label={t('tr.cand.histRollback')}>
    <div className="card-title"><div><h2>{t('tr.cand.histRollback')}</h2><p>{t('tr.cand.conservaAnt')}</p></div>{data.version>0&&<Button size="sm" disabled={!canChange} onClick={()=>void mutate({operation:'rollback',targetVersion:0,expectedVersion:data.version,confirmed:true,reason:'incident_recovery',evidenceHash:evidence})}>{t('tr.cand.restPred')}</Button>}</div>
    {!data.history.length?<p className="state">{t('tr.cand.sinVersiones')}</p>:<Timeline events={data.history.map(h=>({key:String(h.version),icon:h.version===data.version?'target':'clock',title:<>{t('tr.cand.versionN',{v:h.version,c:h.candidateId??t('tr.cand.predeterminada')})}</>,meta:h.version===data.version?<StatusChip tone="ok">{t('tr.cand.activa')}</StatusChip>:undefined,body:<IdChip value={h.configHash} label={t('tr.cand.config')} head={8} tail={4}/>,actions:h.version<data.version?<Button size="sm" disabled={!canChange} onClick={()=>void mutate({operation:'rollback',targetVersion:h.version,expectedVersion:data.version,confirmed:true,reason:'quality_regression',evidenceHash:evidence})}>{t('tr.cand.restVersion',{v:h.version})}</Button>:undefined}))}/>}
    {data.next.history!==null&&<div className={css.pager}><Button size="sm" variant="ghost" disabled={busy||loading} onClick={()=>void more('history')}>{t('tr.cand.cargarVersiones')}</Button></div>}
   </section>
  </>}
  <Drawer open={registering} onClose={()=>setRegistering(false)} title={t('tr.cand.regRecibo')} subtitle={t('tr.cand.resumenJson')} footer={<><Button size="sm" variant="ghost" onClick={()=>setRegistering(false)}>{t('tr.cand.cancelar')}</Button><Button size="sm" variant="primary" type="submit" form="cand-register" disabled={busy||loading||!receipt}>{t('tr.cand.regFirmada')}</Button></>}>
   <form id="cand-register" className={css.form} onSubmit={e=>{e.preventDefault();try{const envelope=JSON.parse(receipt);setRegistering(false);void mutate({operation:'register',requestId:crypto.randomUUID(),envelope});}catch{setRegistering(false);setError(t('tr.cand.eJson'));}}}>
    <label>{t('tr.cand.resumenFirmado')}<textarea value={receipt} onChange={e=>setReceipt(e.target.value)} maxLength={18000} rows={10}/></label>
    <p className={css.muted}>{t('tr.cand.comentariosDev')}</p>
   </form>
  </Drawer>
 </section>;
}
