'use client';
import {PageHeader} from './ui/page-header';
import {Button,LinkButton,Arrow,Download,Refresh} from './ui/button';
import {StatCard} from './ui/stat-card';
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
import {useCallback,useEffect,useRef,useState} from 'react';
const exclusionReasons:Record<string,string>={customer_unknown:'No hay cliente canónico identificado.',customer_binding_unavailable:'El vínculo con el cliente ya no está disponible.',temporal_cutoff_excluded:'El evento o su disponibilidad supera el corte.',result_changed_or_erased:'El resultado cambió o fue borrado.',source_unavailable:'La fuente ya no está disponible.'};
type Cohort={id:string;connectionId:string;cutoff:string;count:number;taxonomy:string[];taxonomyHash:string;taxonomyVersion:string};
type Feedback={version:number;labels:string[];verdict:string;topicCorrect:boolean;evidenceSufficient:boolean;decisionPossible:boolean};
type Item={ordinal:number;runId:string;conversationId:string;eligible:boolean;reason:string|null;labels?:string[];status?:string;resultHash:string;manifestHash:string;taxonomyHash:string;revisionCount?:number;feedback?:Feedback|null};
type State={connections:Array<{id:string;source:string}>;cohorts:Cohort[];cohortNextCursor:string|null};
type Page={cohort:Cohort;items:Item[];nextCursor:number|null};
export function EvaluationPanel(){const [cohortCursor,setCohortCursor]=useState<string|null>(null);const [state,setState]=useState<State|null>(null),[connection,setConnection]=useState(''),[taxonomies,setTaxonomies]=useState<Array<{hash:string;labels:string[]}>>([]),[taxonomy,setTaxonomy]=useState(''),[start,setStart]=useState('2000-01-01T00:00'),[cutoff,setCutoff]=useState(''),[cohort,setCohort]=useState(''),[cursor,setCursor]=useState(0),[page,setPage]=useState<Page|null>(null),[itemId,setItemId]=useState(''),[labels,setLabels]=useState<string[]>([]),[verdict,setVerdict]=useState('correction'),[topic,setTopic]=useState(false),[evidence,setEvidence]=useState(false),[decision,setDecision]=useState(false),[attest,setAttest]=useState(false),[working,setBusy]=useState(false),[loading,setLoading]=useState(true),[pageLoading,setPageLoading]=useState(false),[taxonomyLoading,setTaxonomyLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[refresh,setRefresh]=useState(0),[creating,setCreating]=useState(false);const pending=useRef(false),loadEpoch=useRef(0);const busy=working||loading||pageLoading||taxonomyLoading;const item=page?.items.find(x=>String(x.ordinal)===itemId);
 const clear=useCallback(()=>{setItemId('');setLabels([]);setAttest(false);},[]);
 const load=useCallback(async(signal?:AbortSignal)=>{const generation=++loadEpoch.current;setLoading(true);let failure='No se pudo consultar evaluación. Reintenta.';try{const r=await fetch('/api/evaluation'+(cohortCursor?'?'+new URLSearchParams({cohortCursor}):''),{cache:'no-store',signal});if(!r.ok){failure=r.status===403?'Se requiere un propietario activo.':'No se pudo consultar evaluación. Reintenta.';throw Error(failure);}const data=await r.json();if(!signal?.aborted&&generation===loadEpoch.current){setState(data);setError('');}}catch{if(!signal?.aborted&&generation===loadEpoch.current){setState(null);setPage(null);clear();setError(failure);}}finally{if(!signal?.aborted&&generation===loadEpoch.current)setLoading(false);}},[clear,cohortCursor]);
 useEffect(()=>{const controller=new AbortController();void Promise.resolve().then(()=>load(controller.signal));return()=>controller.abort();},[load]);
 useEffect(()=>{const controller=new AbortController();if(connection)void(async()=>{setTaxonomyLoading(true);try{const r=await fetch('/api/evaluation?'+new URLSearchParams({connectionId:connection}),{signal:controller.signal,cache:'no-store'});if(!r.ok)throw Error('No se pudieron consultar las taxonomías.');const data=await r.json();if(!controller.signal.aborted)setTaxonomies(data.items);}catch{if(!controller.signal.aborted){setTaxonomies([]);setError('No se pudieron consultar las taxonomías. Reintenta.');}}finally{if(!controller.signal.aborted)setTaxonomyLoading(false);}})();return()=>controller.abort();},[connection]);
 useEffect(()=>{const controller=new AbortController();if(cohort)void(async()=>{setPageLoading(true);try{const r=await fetch('/api/evaluation?'+new URLSearchParams({cohortId:cohort,cursor:String(cursor)}),{signal:controller.signal,cache:'no-store'});if(!r.ok)throw Error('No se pudo recuperar la cohorte autorizada.');const data=await r.json();if(!controller.signal.aborted)setPage(data);}catch{if(!controller.signal.aborted){setPage(null);clear();setError('No se pudo recuperar la cohorte autorizada. Reintenta.');}}finally{if(!controller.signal.aborted)setPageLoading(false);}})();return()=>controller.abort();},[cohort,cursor,refresh,clear]);
 function choose(value:string){setItemId(value);const selected=page?.items.find(x=>String(x.ordinal)===value);setLabels(selected?.feedback?.labels??selected?.labels??[]);setVerdict(selected?.feedback?.verdict??'correction');setTopic(selected?.feedback?.topicCorrect??false);setEvidence(selected?.feedback?.evidenceSufficient??false);setDecision(selected?.feedback?.decisionPossible??false);setAttest(false);}
 async function action(operation:string,input:Record<string,unknown>){if(pending.current)return;pending.current=true;setBusy(true);setError('');setNotice('');let failure='No se pudo completar la operación. Reintenta.';try{const r=await fetch('/api/evaluation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({operation,...input})});if(!r.ok){const d=await r.json();failure=r.status===409?'La versión o fuente cambió. Actualiza y revisa otra vez.':r.status===413?'El alcance supera el límite. Selecciona una ventana menor.':r.status===403?'La autorización ya no está vigente.':'No se pudo completar la operación. Revisa los datos y reintenta.';void d;throw Error(failure);}if(operation==='export'){const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='historical-development.json';a.click();URL.revokeObjectURL(url);setNotice('Dataset de desarrollo descargado. Incluye las exclusiones y no contiene holdout ni gold certificado.');}else{const {data}=await r.json();clear();if(operation==='create'){setCreating(false);await load();setCohort(data.id);setCursor(0);}setRefresh(n=>n+1);setNotice(operation==='create'?'Cohorte registrada.':'Feedback versionado guardado.');}}catch{setPage(null);clear();await load();setRefresh(n=>n+1);setError(failure);}finally{pending.current=false;setBusy(false);}} const items=page?.items??[];
 const okCount=items.filter(x=>x.eligible).length,excludedCount=items.length-okCount;
 const reasonRows=Object.entries(items.filter(x=>!x.eligible).reduce<Record<string,number>>((acc,x)=>{const k=x.reason??'unknown';acc[k]=(acc[k]??0)+1;return acc;},{}));
 const withFeedback=items.filter(x=>(x.feedback?.version??0)>0).length;
 const when=(value:string)=>{const d=new Date(value);return Number.isNaN(d.getTime())?value:d.toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'});};
 const reasonText=(reason:string|null)=>exclusionReasons[reason??'']??'Requiere revisión de la fuente.';
 return <section className="stack" aria-label="Evaluación histórica" aria-busy={busy}>
  <PageHeader title="Evaluación histórica" description="Cohortes de desarrollo con resultados existentes: sin ejecutar modelos ni exponer holdout." actions={<><Button size="sm" icon={<Refresh/>} disabled={busy} onClick={()=>{clear();setPage(null);setRefresh(n=>n+1);void load();}}>Actualizar evaluación</Button>{state&&<Button size="sm" variant="primary" disabled={busy} onClick={()=>setCreating(true)}>Nueva cohorte</Button>}</>}/>
  {(loading||pageLoading||taxonomyLoading)&&<p role="status" className="sr-only">Cargando evaluación…</p>}
  {error&&!state?<DataState state={{kind:'error',message:error,code:'evaluation'}}/>:error&&<div role="alert" className="notice-bar"><Icon name="alert" size={14}/><p>{error}</p></div>}
  {notice&&<div role="status" className="notice-bar" data-tone="info"><Icon name="check" size={14}/><p>{notice}</p></div>}
  {!state&&loading&&!error&&<SkeletonStats count={2}/>}
  {state&&<>
   <div className="stat-grid">
    <StatCard label="Cohortes guardadas" icon="layers" kind="observed" value={nf.format(state.cohorts.length)+(state.cohortNextCursor?'+':'')} foot={state.cohortNextCursor?'Hay más cohortes en la siguiente página.':undefined}/>
    <StatCard label="Conexiones históricas" icon="plug" kind="observed" value={nf.format(state.connections.length)}/>
    {page&&<><StatCard label="Conversaciones en la cohorte" icon="message" kind="observed" value={nf.format(page.cohort.count)} foot={'Corte '+when(page.cohort.cutoff)}/>
    <StatCard label="Elegibles en esta página" icon="check" kind="observed" value={nf.format(okCount)} foot={'de '+nf.format(items.length)+' casos mostrados'}/></>}
   </div>
   {!state.cohorts.length?<EmptyState art="doc" title="Aún no hay cohortes de desarrollo" body="Crea una cohorte con un corte de fecha para revisar resultados existentes." action={<Button variant="primary" onClick={()=>setCreating(true)}>Crear cohorte</Button>}/>
   :<section className="card" aria-label="Cohortes guardadas">
    <div className="card-title"><div><h2>Cohortes guardadas</h2><p>Elige una para revisar sus casos</p></div></div>
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Cohortes guardadas, desplazamiento horizontal"><table className="dtable"><thead><tr><th scope="col">Corte exclusivo</th><th scope="col" className="num">Conversaciones</th><th scope="col">Taxonomía</th><th scope="col" aria-label="Acción"></th></tr></thead>
     <tbody>{state.cohorts.map(c=><tr key={c.id} aria-current={c.id===cohort||undefined}><th scope="row">{when(c.cutoff)}</th><td className="num">{nf.format(c.count)}</td><td><span className="chip" title={c.taxonomy.join(', ')||'Sin etiquetas'}>{nf.format(c.taxonomy.length)} etiquetas · {c.taxonomyVersion}</span></td><td><Button size="sm" variant={c.id===cohort?'primary':'secondary'} disabled={busy} aria-label={'Revisar cohorte del '+when(c.cutoff)} onClick={()=>{setCohort(c.id);setPageLoading(true);setCursor(0);setPage(null);clear();}}>{c.id===cohort?'En revisión':'Revisar'}</Button></td></tr>)}</tbody></table></div>
    {(cohortCursor||state.cohortNextCursor)&&<div className={css.pager}><Button size="sm" variant="ghost" disabled={busy||!cohortCursor} onClick={()=>setCohortCursor(null)}>Primeras cohortes</Button><Button size="sm" variant="ghost" disabled={busy||!state.cohortNextCursor} onClick={()=>setCohortCursor(state.cohortNextCursor)}>Siguientes cohortes</Button></div>}
   </section>}
   {page&&<section aria-label="Cohorte de desarrollo" className="stack">
    <div className="split" data-even>
     <section className="card" aria-label="Elegibilidad de los casos">
      <div className="card-title"><div><h2>Elegibilidad</h2><p>Casos de esta página · taxonomía {page.cohort.taxonomyVersion}</p></div></div>
      <DonutChart title="Casos elegibles y excluidos en esta página" centerValue={nf.format(items.length)} centerLabel="casos" segments={[{key:'ok',label:'Elegibles',value:okCount,display:nf.format(okCount),tone:1},{key:'ex',label:'Excluidos',value:excludedCount,display:nf.format(excludedCount),tone:5}]}/>
     </section>
     <section className="card" aria-label="Motivos de exclusión">
      <div className="card-title"><div><h2>Motivos de exclusión</h2><p>{nf.format(withFeedback)} con comentario versionado</p></div></div>
      <BarList empty="Ningún caso de esta página fue excluido." items={reasonRows.map(([key,n])=>({key,label:reasonText(key==='unknown'?null:key),value:n,display:nf.format(n),kind:'observed' as const}))}/>
     </section>
    </div>
    <section className="card" aria-label="Casos de la cohorte">
     <div className="card-title"><div><h2>Casos</h2><p>Total seleccionado: {nf.format(page.cohort.count)}</p></div><Button size="sm" icon={<Download/>} disabled={busy} onClick={()=>void action('export',{cohortId:cohort})}>Descargar desarrollo compatible con CLI</Button></div>
     <div className="table-wrap" tabIndex={0} role="region" aria-label="Casos, desplazamiento horizontal"><table className="dtable"><thead><tr><th scope="col" className="num">Caso</th><th scope="col">Ejecución</th><th scope="col">Estado</th><th scope="col">Etiquetas</th><th scope="col" className="num">Feedback</th><th scope="col" aria-label="Acción"></th></tr></thead>
      <tbody>{items.map(x=><tr key={x.ordinal}><th scope="row" className="num">{x.ordinal}</th><td><IdChip value={x.runId} head={6} tail={4}/></td><td>{x.eligible?<StatusChip tone="ok">Elegible</StatusChip>:<StatusChip tone="warn" title={reasonText(x.reason)}>Excluido</StatusChip>}{!x.eligible&&<p className={css.muted}>{reasonText(x.reason)}</p>}</td><td>{x.labels?(x.labels.length?x.labels.map(l=><span key={l} className="chip">{l}</span>):<span className="chip">abstención</span>):'—'}</td><td className="num">v{x.feedback?.version??0}</td><td>{x.labels&&<Button size="sm" disabled={busy} aria-label={'Comentar caso '+x.ordinal} onClick={()=>choose(String(x.ordinal))}>Comentar</Button>}</td></tr>)}</tbody></table></div>
     <div className={css.pager}><Button size="sm" variant="ghost" disabled={busy||cursor===0} onClick={()=>{setCursor(0);setPage(null);clear();}}>Primera página de casos</Button><Button size="sm" variant="ghost" disabled={busy||page.nextCursor===null} onClick={()=>{setCursor(page.nextCursor!);setPage(null);clear();}}>Siguientes casos</Button></div>
    </section>
   </section>}
   <details><summary>Límites de esta evaluación</summary><p className={css.muted}>No ejecuta modelos, no expone holdout ni aprueba cambios. El feedback de un owner no equivale a doble anotación humana ciega.</p></details>
   <div><LinkButton href="/evaluation/candidates" size="sm" variant="ghost" icon={<Arrow/>}>Ver candidatos evaluados</LinkButton></div>
  </>}
  <Drawer open={creating} onClose={()=>setCreating(false)} title="Nueva cohorte de desarrollo" subtitle="Hasta 500 conversaciones" footer={<><Button size="sm" variant="ghost" onClick={()=>setCreating(false)}>Cancelar</Button><Button size="sm" variant="primary" type="submit" form="eval-create" disabled={busy||!taxonomy||!cutoff}>Registrar cohorte</Button></>}>
   <form id="eval-create" className={css.form} onSubmit={e=>{e.preventDefault();void action('create',{connectionId:connection,taxonomyHash:taxonomy,windowStart:new Date(start).toISOString(),cutoff:new Date(cutoff).toISOString(),requestId:crypto.randomUUID()});}}>
    <p className={css.muted}>Se selecciona el último resultado anterior al corte de cada conversación para la taxonomía elegida. Fechas del evento y disponibilidad posteriores se excluyen al revisar o exportar.</p>
    <label>Conexión histórica<select aria-label="Conexión histórica" required disabled={busy} value={connection} onChange={e=>{setConnection(e.target.value);setTaxonomyLoading(!!e.target.value);setTaxonomy('');setTaxonomies([]);}}><option value="">Selecciona conexión</option>{state?.connections.map(c=><option key={c.id} value={c.id}>{c.source} · {c.id.slice(0,8)}</option>)}</select></label>
    <label>Taxonomía exacta<select aria-label="Taxonomía exacta" required disabled={busy} value={taxonomy} onChange={e=>setTaxonomy(e.target.value)}><option value="">Selecciona taxonomía</option>{taxonomies.map(t=><option key={t.hash} value={t.hash}>{t.labels.join(', ')} · {t.hash.slice(0,12)}</option>)}</select></label>
    <div className={css.cols}><label>Inicio de disponibilidad<input type="datetime-local" required value={start} disabled={busy} onChange={e=>setStart(e.target.value)}/></label><label>Corte exclusivo<input type="datetime-local" required value={cutoff} disabled={busy} onChange={e=>setCutoff(e.target.value)}/></label></div>
   </form>
  </Drawer>
  <Drawer open={!!item} onClose={clear} title="Comentar resultado" subtitle={item&&<>Caso {item.ordinal} · {item.revisionCount??0} revisiones · feedback v{item.feedback?.version??0}</>} footer={item&&<><Button size="sm" variant="ghost" onClick={clear}>Cancelar</Button><Button size="sm" variant="primary" type="submit" form="eval-feedback" disabled={busy||!attest}>Guardar comentario versionado</Button></>}>
   {item&&page&&<form id="eval-feedback" className={css.form} onSubmit={e=>{e.preventDefault();void action('feedback',{cohortId:cohort,ordinal:item.ordinal,expectedVersion:item.feedback?.version??0,resultHash:item.resultHash,manifestHash:item.manifestHash,taxonomyHash:item.taxonomyHash,verdict,labels,topicCorrect:topic,evidenceSufficient:evidence,decisionPossible:decision,reviewConfirmed:true});}}>
    <div className={css.row}><LinkButton href={'/analysis/'+item.runId} target="_blank" size="sm" icon={<Icon name="external" size={14}/>}>Revisar evidencia autorizada del resultado</LinkButton><IdChip value={item.runId} label="Resultado" head={6} tail={4}/></div>
    <label>Valoración<select aria-label="Valoración" disabled={busy} value={verdict} onChange={e=>{setVerdict(e.target.value);setAttest(false);if(e.target.value==='abstain')setLabels([]);if(e.target.value==='correct')setLabels(item.labels??[]);}}><option value="correction">Corregir etiquetas</option><option value="correct">Etiquetas correctas</option><option value="abstain">Abstenerse</option></select></label>
    <fieldset disabled={busy||verdict!=='correction'}><legend>Etiquetas revisadas</legend><div className="check-row">{page.cohort.taxonomy.map(label=><label key={label} className="check-chip"><input type="checkbox" checked={labels.includes(label)} onChange={e=>{setLabels(old=>e.target.checked?[...old,label]:old.filter(x=>x!==label));setAttest(false);}}/>{label}</label>)}</div></fieldset>
    <div className="check-row"><label className="check-chip"><input type="checkbox" checked={topic} onChange={e=>{setTopic(e.target.checked);setAttest(false);}}/>Tema correcto</label><label className="check-chip"><input type="checkbox" checked={evidence} onChange={e=>{setEvidence(e.target.checked);setAttest(false);}}/>Evidencia suficiente</label><label className="check-chip"><input type="checkbox" checked={decision} onChange={e=>{setDecision(e.target.checked);setAttest(false);}}/>Permite decidir</label></div>
    <label className="check"><input type="checkbox" checked={attest} onChange={e=>setAttest(e.target.checked)}/>Confirmo que este comentario es mi revisión humana del resultado indicado.</label>
   </form>}
  </Drawer>
 </section>;
}
