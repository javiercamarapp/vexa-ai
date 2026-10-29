'use client';
import {RovaqCargando} from './rovaq-cargando';
import {useAutoRefresh} from './ui/use-auto-refresh';
import {PageHeader} from './ui/page-header';
import {KpiLinea} from './panel-comun/kpi-linea';
import './panel-comun/panel-comun.css';
import {Button,LinkButton,Arrow,Download} from './ui/button';
import {StatusChip} from './ui/status-chip';
import {DonutChart} from './ui/donut-chart';
import {BarList} from './ui/bar-list';
import {EmptyState} from './ui/empty-state';
import {Drawer} from './ui/overlay';
import {IdChip} from './ui/id-chip';
import {SkeletonStats} from './ui/skeletons';
import {DataState} from './workspace/data-state';
import {nf} from './ui/format';
import {Icon} from './ui/icons';
import css from './ops-panels.module.css';
import {useLayoutEffect,useCallback,useEffect,useRef,useState} from 'react';
import {useT} from './i18n/proveedor';
import type {Clave} from '../lib/i18n';
const exclusionReasons:Record<string,Clave>={customer_unknown:'tr.eval.xCliente',customer_binding_unavailable:'tr.eval.xVinculo',temporal_cutoff_excluded:'tr.eval.xTemporal',result_changed_or_erased:'tr.eval.xResultado',source_unavailable:'tr.eval.xFuente'};
type Cohort={id:string;connectionId:string;cutoff:string;count:number;taxonomy:string[];taxonomyHash:string;taxonomyVersion:string};
type Feedback={version:number;labels:string[];verdict:string;topicCorrect:boolean;evidenceSufficient:boolean;decisionPossible:boolean};
type Item={ordinal:number;runId:string;conversationId:string;eligible:boolean;reason:string|null;labels?:string[];status?:string;resultHash:string;manifestHash:string;taxonomyHash:string;revisionCount?:number;feedback?:Feedback|null};
type State={connections:Array<{id:string;source:string}>;cohorts:Cohort[];cohortNextCursor:string|null};
type Page={cohort:Cohort;items:Item[];nextCursor:number|null};
export function EvaluationPanel(){const t=useT();const [cohortCursor,setCohortCursor]=useState<string|null>(null);const [state,setState]=useState<State|null>(null),[connection,setConnection]=useState(''),[taxonomies,setTaxonomies]=useState<Array<{hash:string;labels:string[]}>>([]),[taxonomy,setTaxonomy]=useState(''),[start,setStart]=useState('2000-01-01T00:00'),[cutoff,setCutoff]=useState(''),[cohort,setCohort]=useState(''),[cursor,setCursor]=useState(0),[page,setPage]=useState<Page|null>(null),[itemId,setItemId]=useState(''),[labels,setLabels]=useState<string[]>([]),[verdict,setVerdict]=useState('correction'),[topic,setTopic]=useState(false),[evidence,setEvidence]=useState(false),[decision,setDecision]=useState(false),[attest,setAttest]=useState(false),[working,setBusy]=useState(false),[loading,setLoading]=useState(true),[pageLoading,setPageLoading]=useState(false),[taxonomyLoading,setTaxonomyLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[refresh,setRefresh]=useState(0),[creating,setCreating]=useState(false);const pending=useRef(false),loadEpoch=useRef(0);const busy=working||loading||pageLoading||taxonomyLoading;const item=page?.items.find(x=>String(x.ordinal)===itemId);
 const clear=useCallback(()=>{setItemId('');setLabels([]);setAttest(false);},[]);
 const load=useCallback(async(signal?:AbortSignal)=>{const generation=++loadEpoch.current;setLoading(true);let failure=t('tr.eval.eConsulta');try{const r=await fetch('/api/evaluation'+(cohortCursor?'?'+new URLSearchParams({cohortCursor}):''),{cache:'no-store',signal});if(!r.ok){failure=r.status===403?t('tr.eval.ePropietario'):t('tr.eval.eConsulta');throw Error(failure);}const data=await r.json();if(!signal?.aborted&&generation===loadEpoch.current){setState(data);setError('');}}catch{if(!signal?.aborted&&generation===loadEpoch.current){setState(null);setPage(null);clear();setError(failure);}}finally{if(!signal?.aborted&&generation===loadEpoch.current)setLoading(false);}},[clear,cohortCursor,t]);
 useEffect(()=>{const controller=new AbortController();void Promise.resolve().then(()=>load(controller.signal));return()=>controller.abort();},[load]);
 // Datos nuevos: relectura en segundo plano del estado; conserva cohorte y formulario, y no corre durante una operación.
 const ocupadoRef=useRef(true);useLayoutEffect(()=>{ocupadoRef.current=busy;});
 const recargarSilencioso=useCallback(async()=>{if(ocupadoRef.current)return;const generation=loadEpoch.current;try{const r=await fetch('/api/evaluation'+(cohortCursor?'?'+new URLSearchParams({cohortCursor}):''),{cache:'no-store'});if(!r.ok)return;const data=await r.json();if(generation===loadEpoch.current&&!ocupadoRef.current)setState(data);}catch{/* se conserva lo pintado */}},[cohortCursor]);
 useAutoRefresh(recargarSilencioso,{ocupado:()=>ocupadoRef.current});
 useEffect(()=>{const controller=new AbortController();if(connection)void(async()=>{setTaxonomyLoading(true);try{const r=await fetch('/api/evaluation?'+new URLSearchParams({connectionId:connection}),{signal:controller.signal,cache:'no-store'});if(!r.ok)throw Error(t('tr.eval.eTaxonomias'));const data=await r.json();if(!controller.signal.aborted)setTaxonomies(data.items);}catch{if(!controller.signal.aborted){setTaxonomies([]);setError(t('tr.eval.eTaxonomiasRe'));}}finally{if(!controller.signal.aborted)setTaxonomyLoading(false);}})();return()=>controller.abort();},[connection,t]);
 useEffect(()=>{const controller=new AbortController();if(cohort)void(async()=>{setPageLoading(true);try{const r=await fetch('/api/evaluation?'+new URLSearchParams({cohortId:cohort,cursor:String(cursor)}),{signal:controller.signal,cache:'no-store'});if(!r.ok)throw Error(t('tr.eval.eCohorte'));const data=await r.json();if(!controller.signal.aborted)setPage(data);}catch{if(!controller.signal.aborted){setPage(null);clear();setError(t('tr.eval.eCohorteRe'));}}finally{if(!controller.signal.aborted)setPageLoading(false);}})();return()=>controller.abort();},[cohort,cursor,refresh,clear,t]);
 function choose(value:string){setItemId(value);const selected=page?.items.find(x=>String(x.ordinal)===value);setLabels(selected?.feedback?.labels??selected?.labels??[]);setVerdict(selected?.feedback?.verdict??'correction');setTopic(selected?.feedback?.topicCorrect??false);setEvidence(selected?.feedback?.evidenceSufficient??false);setDecision(selected?.feedback?.decisionPossible??false);setAttest(false);}
 async function action(operation:string,input:Record<string,unknown>){if(pending.current)return;pending.current=true;setBusy(true);setError('');setNotice('');let failure=t('tr.eval.eOperacion');try{const r=await fetch('/api/evaluation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({operation,...input})});if(!r.ok){const d=await r.json();failure=r.status===409?t('tr.eval.eVersion'):r.status===413?t('tr.eval.eAlcance'):r.status===403?t('tr.eval.eAutorizacion'):t('tr.eval.eDatos');void d;throw Error(failure);}if(operation==='export'){const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='historical-development.json';a.click();URL.revokeObjectURL(url);setNotice(t('tr.eval.nDescarga'));}else{const {data}=await r.json();clear();if(operation==='create'){setCreating(false);await load();setCohort(data.id);setCursor(0);}setRefresh(n=>n+1);setNotice(operation==='create'?t('tr.eval.nCohorte'):t('tr.eval.nFeedback'));}}catch{setPage(null);clear();await load();setRefresh(n=>n+1);setError(failure);}finally{pending.current=false;setBusy(false);}} const items=page?.items??[];
 const okCount=items.filter(x=>x.eligible).length,excludedCount=items.length-okCount;
 const reasonRows=Object.entries(items.filter(x=>!x.eligible).reduce<Record<string,number>>((acc,x)=>{const k=x.reason??'unknown';acc[k]=(acc[k]??0)+1;return acc;},{}));
 const withFeedback=items.filter(x=>(x.feedback?.version??0)>0).length;
 const when=(value:string)=>{const d=new Date(value);return Number.isNaN(d.getTime())?value:d.toLocaleDateString(t('tr.eval.locale'),{day:'numeric',month:'short',year:'numeric'});};
 const reasonText=(reason:string|null)=>t(exclusionReasons[reason??'']??'tr.eval.xDefault');
 if(loading&&!state&&!error)return <RovaqCargando mensaje=""/>;
 return <section className="stack" aria-label={t('tr.eval.aria')} aria-busy={busy}>
  <PageHeader eyebrow={t('tr.eval.interno')} title={t('tr.eval.aria')} description={t('tr.eval.desc')} actions={<>{state&&<Button variant="primary" disabled={busy} onClick={()=>setCreating(true)}>{t('tr.eval.nuevaCohorte')}</Button>}</>}/>
  {(loading||pageLoading||taxonomyLoading)&&<p role="status" className="sr-only">{t('tr.eval.cargando')}</p>}
  {error&&!state?<DataState state={{kind:'error',message:error,code:'evaluation'}}/>:error&&<div role="alert" className="notice-bar"><Icon name="alert" size={14}/><p>{error}</p></div>}
  {notice&&<div role="status" className="notice-bar" data-tone="info"><Icon name="check" size={14}/><p>{notice}</p></div>}
  {!state&&loading&&!error&&<SkeletonStats count={2}/>}
  {state&&<>
   <KpiLinea label={t('tr.eval.indicadores')} items={[
    {label:t('tr.eval.cohortesGuardadas'),value:nf.format(state.cohorts.length)+(state.cohortNextCursor?'+':''),c:5,partes:state.cohorts.map(c=>({label:when(c.cutoff),value:c.count})),nota:state.cohortNextCursor?t('tr.eval.hayMas'):t('tr.eval.convPorCohorte')},
    {label:t('tr.eval.conexHist'),value:nf.format(state.connections.length),c:3,partes:state.connections.map(c=>({label:c.source,value:1})),nota:state.connections.map(c=>c.source).join(', ')||t('tr.eval.sinConex')},
    {label:t('tr.eval.convEnCohorte'),value:page?nf.format(page.cohort.count):'—',vacio:!page,c:1,partes:page?[{label:t('tr.eval.elegibles'),value:okCount},{label:t('tr.eval.excluidas'),value:excludedCount}]:undefined,nota:page?t('tr.eval.corte',{fecha:when(page.cohort.cutoff)}):t('tr.eval.eligeCohorte')},
    {label:t('tr.eval.elegiblesPag'),value:page?nf.format(okCount):'—',vacio:!page,c:7,partes:page?[{label:t('tr.eval.elegibles'),value:okCount},{label:t('tr.eval.excluidos'),value:excludedCount}]:undefined,nota:page?t('tr.eval.deCasos',{n:nf.format(items.length)}):t('tr.eval.sinCohorteAb')}]}/>
   {!state.cohorts.length?<EmptyState art="doc" title={t('tr.eval.aunNoCohortes')} body={t('tr.eval.creaCohorte')} action={<Button variant="primary" onClick={()=>setCreating(true)}>{t('tr.eval.crearCohorte')}</Button>}/>
   :<section className="card" aria-label={t('tr.eval.cohortesGuardadas')}>
    <div className="card-title"><div><h2>{t('tr.eval.cohortesGuardadas')}</h2><p>{t('tr.eval.eligeUna')}</p></div></div>
    <div className="table-wrap" tabIndex={0} role="region" aria-label={t('tr.eval.cohortesAria')}><table className="dtable"><thead><tr><th scope="col">{t('tr.eval.thCorteExcl')}</th><th scope="col" className="num">{t('tr.eval.thConversaciones')}</th><th scope="col">{t('tr.eval.thTaxonomia')}</th><th scope="col" aria-label={t('tr.eval.thAccion')}></th></tr></thead>
     <tbody>{state.cohorts.map(c=><tr key={c.id} aria-current={c.id===cohort||undefined}><th scope="row">{when(c.cutoff)}</th><td className="num">{nf.format(c.count)}</td><td><span className="chip" title={c.taxonomy.join(', ')||t('tr.eval.sinEtiquetas')}>{t('tr.eval.nEtiquetas',{n:nf.format(c.taxonomy.length),v:c.taxonomyVersion})}</span></td><td><Button size="sm" variant={c.id===cohort?'primary':'secondary'} disabled={busy} aria-label={t('tr.eval.revisarDel',{fecha:when(c.cutoff)})} onClick={()=>{setCohort(c.id);setPageLoading(true);setCursor(0);setPage(null);clear();}}>{c.id===cohort?t('tr.eval.enRevision'):t('tr.eval.revisar')}</Button></td></tr>)}</tbody></table></div>
    {(cohortCursor||state.cohortNextCursor)&&<div className={css.pager}><Button size="sm" variant="ghost" disabled={busy||!cohortCursor} onClick={()=>setCohortCursor(null)}>{t('tr.eval.primerasCohortes')}</Button><Button size="sm" variant="ghost" disabled={busy||!state.cohortNextCursor} onClick={()=>setCohortCursor(state.cohortNextCursor)}>{t('tr.eval.siguientesCohortes')}</Button></div>}
   </section>}
   {page&&<section aria-label={t('tr.eval.cohorteDesarrollo')} className="stack">
    <div className="split" data-even>
     <section className="card" aria-label={t('tr.eval.elegAria')}>
      <div className="card-title"><div><h2>{t('tr.eval.elegibilidad')}</h2><p>{t('tr.eval.casosPagTax',{v:page.cohort.taxonomyVersion})}</p></div></div>
      <DonutChart title={t('tr.eval.donutTitulo')} centerValue={nf.format(items.length)} centerLabel={t('tr.eval.casosLbl')} segments={[{key:'ok',label:t('tr.eval.elegibles'),value:okCount,display:nf.format(okCount),tone:1},{key:'ex',label:t('tr.eval.excluidos'),value:excludedCount,display:nf.format(excludedCount),tone:5}]}/>
     </section>
     <section className="card" aria-label={t('tr.eval.motivosAria')}>
      <div className="card-title"><div><h2>{t('tr.eval.motivosAria')}</h2><p>{t('tr.eval.conComentario',{n:nf.format(withFeedback)})}</p></div></div>
      <BarList c={5} empty={t('tr.eval.ningunExcluido')} items={reasonRows.map(([key,n])=>({key,label:reasonText(key==='unknown'?null:key),value:n,display:nf.format(n),kind:'observed' as const}))}/>
     </section>
    </div>
    <section className="card" aria-label={t('tr.eval.casosAria')}>
     <div className="card-title"><div><h2>{t('tr.eval.casos')}</h2><p>{t('tr.eval.totalSel',{n:nf.format(page.cohort.count)})}</p></div><Button size="sm" icon={<Download/>} disabled={busy} onClick={()=>void action('export',{cohortId:cohort})}>{t('tr.eval.descargarDev')}</Button></div>
     <div className="table-wrap" tabIndex={0} role="region" aria-label={t('tr.eval.casosTablaAria')}><table className="dtable"><thead><tr><th scope="col" className="num">{t('tr.eval.thCaso')}</th><th scope="col">{t('tr.eval.thEjecucion')}</th><th scope="col">{t('tr.eval.thEstado')}</th><th scope="col">{t('tr.eval.thEtiquetas')}</th><th scope="col" className="num">{t('tr.eval.thFeedback')}</th><th scope="col" aria-label={t('tr.eval.thAccion')}></th></tr></thead>
      <tbody>{items.map(x=><tr key={x.ordinal}><th scope="row" className="num">{x.ordinal}</th><td><IdChip value={x.runId} head={6} tail={4}/></td><td>{x.eligible?<StatusChip tone="ok">{t('tr.eval.elegible')}</StatusChip>:<StatusChip tone="warn" title={reasonText(x.reason)}>{t('tr.eval.excluido')}</StatusChip>}{!x.eligible&&<p className={css.muted}>{reasonText(x.reason)}</p>}</td><td>{x.labels?(x.labels.length?x.labels.map(l=><span key={l} className="chip">{l}</span>):<span className="chip">{t('tr.eval.abstencion')}</span>):'—'}</td><td className="num">v{x.feedback?.version??0}</td><td>{x.labels&&<Button size="sm" disabled={busy} aria-label={t('tr.eval.comentarCaso',{n:x.ordinal})} onClick={()=>choose(String(x.ordinal))}>{t('tr.eval.comentar')}</Button>}</td></tr>)}</tbody></table></div>
     <div className={css.pager}><Button size="sm" variant="ghost" disabled={busy||cursor===0} onClick={()=>{setCursor(0);setPage(null);clear();}}>{t('tr.eval.primeraPagCasos')}</Button><Button size="sm" variant="ghost" disabled={busy||page.nextCursor===null} onClick={()=>{setCursor(page.nextCursor!);setPage(null);clear();}}>{t('tr.eval.siguientesCasos')}</Button></div>
    </section>
   </section>}
   <details><summary>{t('tr.eval.limites')}</summary><p className={css.muted}>{t('tr.eval.limitesTxt')}</p></details>
   <div><LinkButton href="/evaluation/candidates" size="sm" variant="ghost" icon={<Arrow/>}>{t('tr.eval.verCandidatos')}</LinkButton></div>
  </>}
  <Drawer open={creating} onClose={()=>setCreating(false)} title={t('tr.eval.nuevaDev')} subtitle={t('tr.eval.hasta500',{n:500})} footer={<><Button size="sm" variant="ghost" onClick={()=>setCreating(false)}>{t('tr.eval.cancelar')}</Button><Button size="sm" variant="primary" type="submit" form="eval-create" disabled={busy||!taxonomy||!cutoff}>{t('tr.eval.registrarCohorte')}</Button></>}>
   <form id="eval-create" className={css.form} onSubmit={e=>{e.preventDefault();void action('create',{connectionId:connection,taxonomyHash:taxonomy,windowStart:new Date(start).toISOString(),cutoff:new Date(cutoff).toISOString(),requestId:crypto.randomUUID()});}}>
    <p className={css.muted}>{t('tr.eval.seleccionUltimo')}</p>
    <label>{t('tr.eval.conexHistLbl')}<select aria-label={t('tr.eval.conexHistLbl')} required disabled={busy} value={connection} onChange={e=>{setConnection(e.target.value);setTaxonomyLoading(!!e.target.value);setTaxonomy('');setTaxonomies([]);}}><option value="">{t('tr.eval.seleccionaConex')}</option>{state?.connections.map(c=><option key={c.id} value={c.id}>{c.source} · {c.id.slice(0,8)}</option>)}</select></label>
    <label>{t('tr.eval.taxExacta')}<select aria-label={t('tr.eval.taxExacta')} required disabled={busy} value={taxonomy} onChange={e=>setTaxonomy(e.target.value)}><option value="">{t('tr.eval.seleccionaTax')}</option>{taxonomies.map(x=><option key={x.hash} value={x.hash}>{x.labels.join(', ')} · {x.hash.slice(0,12)}</option>)}</select></label>
    <div className={css.cols}><label>{t('tr.eval.inicioDisp')}<input type="datetime-local" required value={start} disabled={busy} onChange={e=>setStart(e.target.value)}/></label><label>{t('tr.eval.corteExcl')}<input type="datetime-local" required value={cutoff} disabled={busy} onChange={e=>setCutoff(e.target.value)}/></label></div>
   </form>
  </Drawer>
  <Drawer open={!!item} onClose={clear} title={t('tr.eval.comentarResultado')} subtitle={item&&<>{t('tr.eval.subCaso',{n:item.ordinal,rev:item.revisionCount??0,v:item.feedback?.version??0})}</>} footer={item&&<><Button size="sm" variant="ghost" onClick={clear}>{t('tr.eval.cancelar')}</Button><Button size="sm" variant="primary" type="submit" form="eval-feedback" disabled={busy||!attest}>{t('tr.eval.guardarComentario')}</Button></>}>
   {item&&page&&<form id="eval-feedback" className={css.form} onSubmit={e=>{e.preventDefault();void action('feedback',{cohortId:cohort,ordinal:item.ordinal,expectedVersion:item.feedback?.version??0,resultHash:item.resultHash,manifestHash:item.manifestHash,taxonomyHash:item.taxonomyHash,verdict,labels,topicCorrect:topic,evidenceSufficient:evidence,decisionPossible:decision,reviewConfirmed:true});}}>
    <div className={css.row}><LinkButton href={'/analysis/'+item.runId} target="_blank" size="sm" icon={<Icon name="external" size={14}/>}>{t('tr.eval.revisarEvid')}</LinkButton><IdChip value={item.runId} label={t('tr.eval.resultado')} head={6} tail={4}/></div>
    <label>{t('tr.eval.valoracion')}<select aria-label={t('tr.eval.valoracion')} disabled={busy} value={verdict} onChange={e=>{setVerdict(e.target.value);setAttest(false);if(e.target.value==='abstain')setLabels([]);if(e.target.value==='correct')setLabels(item.labels??[]);}}><option value="correction">{t('tr.eval.corregirEt')}</option><option value="correct">{t('tr.eval.etCorrectas')}</option><option value="abstain">{t('tr.eval.abstenerse')}</option></select></label>
    <fieldset disabled={busy||verdict!=='correction'}><legend>{t('tr.eval.etRevisadas')}</legend><div className="check-row">{page.cohort.taxonomy.map(label=><label key={label} className="check-chip"><input type="checkbox" checked={labels.includes(label)} onChange={e=>{setLabels(old=>e.target.checked?[...old,label]:old.filter(x=>x!==label));setAttest(false);}}/>{label}</label>)}</div></fieldset>
    <div className="check-row"><label className="check-chip"><input type="checkbox" checked={topic} onChange={e=>{setTopic(e.target.checked);setAttest(false);}}/>{t('tr.eval.temaCorrecto')}</label><label className="check-chip"><input type="checkbox" checked={evidence} onChange={e=>{setEvidence(e.target.checked);setAttest(false);}}/>{t('tr.eval.evidSuficiente')}</label><label className="check-chip"><input type="checkbox" checked={decision} onChange={e=>{setDecision(e.target.checked);setAttest(false);}}/>{t('tr.eval.permiteDecidir')}</label></div>
    <label className="check"><input type="checkbox" checked={attest} onChange={e=>setAttest(e.target.checked)}/>{t('tr.eval.confirmoRevision')}</label>
   </form>}
  </Drawer>
 </section>;
}
