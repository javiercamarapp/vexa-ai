'use client';
import {RovaqCargando} from './rovaq-cargando';
import {useAutoRefresh} from './ui/use-auto-refresh';
import {useLayoutEffect,useCallback,useEffect,useRef,useState} from 'react';
import {Button} from './ui/button';
import {StatusChip} from './ui/status-chip';
import {Stepper} from './ui/stepper';
import {Timeline} from './ui/timeline';
import {Drawer} from './ui/overlay';
import {IdChip} from './ui/id-chip';
import {EmptyState} from './ui/empty-state';
import {Icon} from './ui/icons';
import css from './ops-panels.module.css';
import type {CauseView} from '../../../../packages/problems/causality.mjs';
import {fetchCupo} from '../lib/workspace/cupo.mjs';
import {useT} from './i18n/proveedor';
export function CauseEvidence({problemId}:{problemId:string}){
 const t=useT(),tRef=useRef(t);useLayoutEffect(()=>{tRef.current=t;});
 const generation=useRef(0);const [data,setData]=useState<CauseView|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [symptom,setSymptom]=useState(''),[cause,setCause]=useState(''),[state,setState]=useState('hypothesis'),[reason,setReason]=useState(''),[refs,setRefs]=useState<string[]>([]),[approved,setApproved]=useState(false);
 const [recordId,setRecordId]=useState(''),[sourceKind,setSourceKind]=useState('inspection'),[observedAt,setObservedAt]=useState(''),[report,setReport]=useState(''),[stance,setStance]=useState('supports'),[status,setStatus]=useState('active'),[batch,setBatch]=useState(''),[carrier,setCarrier]=useState(''),[sku,setSku]=useState(''),[attested,setAttested]=useState(false),[evOpen,setEvOpen]=useState(false),[revOpen,setRevOpen]=useState(false);
 const clear=useCallback(()=>{setData(null);setBusy(false);setSymptom('');setCause('');setReason('');setRefs([]);setApproved(false);setRecordId('');setReport('');setObservedAt('');setBatch('');setCarrier('');setSku('');setAttested(false);},[]);
 const request=useCallback(async(body?:unknown)=>{const epoch=++generation.current;setBusy(true);try{const r=await fetchCupo('/api/problems/'+encodeURIComponent(problemId)+'/causality',{method:body?'POST':'GET',cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});if(epoch!==generation.current)return;if(r.status===401||r.status===403){generation.current++;clear();setError(tRef.current('ce.errRevocada'));return;}const value=await r.json();if(epoch!==generation.current)return;if(!r.ok)throw Error(r.status===409?tRef.current('ce.err409'):tRef.current('ce.errGeneral'));setData(value.data);setSymptom(value.data.claim.symptom);setCause(value.data.claim.probableCause??'');setRefs([]);setApproved(false);setAttested(false);setError('');}catch(e){if(epoch===generation.current){clear();setError(e instanceof Error?e.message:tRef.current('ce.errConsulta'));}}finally{if(epoch===generation.current)setBusy(false);}},[problemId,clear]);
 const invalidate=useCallback(()=>{generation.current++;},[]);
 // Datos nuevos: relectura en segundo plano; solo actualiza la vista, sin tocar lo que la persona está escribiendo.
 const busyRef=useRef(false);useLayoutEffect(()=>{busyRef.current=busy;});
 const recargarSilencioso=useCallback(async()=>{if(busyRef.current)return;const epoch=generation.current;try{const r=await fetchCupo('/api/problems/'+encodeURIComponent(problemId)+'/causality',{method:'GET',cache:'no-store'});if(!r.ok||epoch!==generation.current||busyRef.current)return;const value=await r.json();if(epoch===generation.current&&value?.data?.claim)setData(value.data);}catch{/* se conserva lo pintado */}},[problemId]);
 useAutoRefresh(recargarSilencioso,{ocupado:()=>busyRef.current});
 useEffect(()=>{void Promise.resolve().then(()=>request());return invalidate;},[request,invalidate]);
 const current=data?.evidence.filter(e=>!data.evidence.some(other=>other.recordId===e.recordId&&other.version>e.version))??[]; const stateTone=(v:string):'ok'|'warn'|'muted'|'info'=>v==='confirmed'?'ok':v==='retracted'?'muted':'info';
 const stateLabel=(v:string)=>v==='confirmed'?t('ce.confirmada'):v==='retracted'?t('ce.retirada'):v==='hypothesis'?t('ce.hipotesis'):v;
 const activeEv=current.filter(e=>e.status==='active');
 return <section data-eval-causal aria-label={t('ce.evaluacion')} className={css.stack}>
  <div className="card-title"><div><h3>{t('ce.sintomaHipConf')}</h3><p>{t('ce.agrupNoConfirma')}</p></div></div>
  {error&&<p role="alert" className="notice-bar"><Icon name="alert" size={14}/>{error}</p>}
  {!data&&!error&&<RovaqCargando compacto mensaje={t('ce.cargando')}/>}
  {data&&<>
   {data.claim.criticalReview&&<p role="alert" className="notice-bar">{t('ce.riesgoSevero')}</p>}
   <Stepper label={t('ce.avance')} steps={[{key:'sym',label:t('ce.sintoma'),state:'done'},{key:'hyp',label:t('ce.hipotesis'),state:data.claim.probableCause?'done':'current'},{key:'ev',label:t('ce.evidenciaN',{n:activeEv.length}),state:activeEv.length?'done':data.claim.probableCause?'current':'todo'},{key:'conf',label:t('ce.confirmacion'),state:data.claim.state==='confirmed'?'done':activeEv.length?'current':'todo'}]}/>
   <dl className={css.factGrid}>
    <div><dt>{t('ce.sintoma')}</dt><dd>{data.claim.symptom}</dd></div>
    <div><dt>{t('ce.causaProbable')}</dt><dd>{data.claim.probableCause??t('ce.desconocida')}</dd></div>
    <div><dt>{t('ce.estadoOp')}</dt><dd><StatusChip tone={stateTone(data.claim.state)}>{stateLabel(data.claim.state)}</StatusChip> · {t('ce.version',{v:data.claim.version})}</dd></div>
    <div><dt>{t('ce.lote')}</dt><dd>{data.claim.facts.batch??t('ce.desconocido')}</dd></div>
    <div><dt>{t('ce.transportista')}</dt><dd>{data.claim.facts.carrier??t('ce.desconocido')}</dd></div>
    <div><dt>SKU</dt><dd>{data.claim.facts.sku??t('ce.desconocido')}</dd></div>
   </dl>
   {data.canRecord&&<div className={css.actions}><Button size="sm" onClick={()=>setEvOpen(true)}>{t('ce.aportarPrueba')}</Button><Button size="sm" variant="primary" onClick={()=>setRevOpen(true)}>{t('ce.revisarEval')}</Button></div>}
   <h4>{t('ce.evOpYContraria')}</h4>
   {!current.length?<EmptyState art="doc" compact title={t('ce.sinPruebas')} body={t('ce.aportaInspeccion')}/>:<Timeline events={current.map(e=>({key:e.id,icon:e.stance==='contradicts'?'x':'check',title:<>{e.recordId} · {t('ce.version',{v:e.version})}</>,meta:<StatusChip tone={e.stance==='contradicts'?'warn':'ok'}>{e.stance==='contradicts'?t('ce.contradice'):t('ce.apoya')}</StatusChip>,body:<><p className={css.muted}>{e.sourceKind} · {e.status}</p><details><summary>{t('ce.informeOp')}</summary><pre className={css.pre}>{e.report}</pre></details><IdChip value={e.digest} label={t('ce.huella')} head={8} tail={4}/></>}))}/>}
   <details><summary>{t('ce.historialInmutable')}</summary>{data.history.map(h=><article key={h.version}><p>{t('ce.histVersion',{v:h.version,s:h.state,a:String(h.actorId ?? '')})}</p><p>{h.symptom} · {h.probableCause??t('ce.sinCausaAfirmada')} · {h.reason}</p></article>)}{data.evidence.map(e=><p key={e.id}>{t('ce.histEv',{r:e.recordId,v:e.version,st:e.stance,es:e.status,a:e.actorId,d:e.digest})}</p>)}</details>
   <Drawer open={evOpen} onClose={()=>setEvOpen(false)} title={t('ce.aportarORect')} subtitle={t('ce.pruebaIndep')} footer={<><Button size="sm" variant="ghost" onClick={()=>setEvOpen(false)}>{t('ce.cancelar')}</Button><Button size="sm" variant="primary" type="submit" form="ce-evidence" disabled={busy||!attested}>{t('ce.guardarEv')}</Button></>}>
    <form id="ce-evidence" className={css.form} onSubmit={e=>{e.preventDefault();const old=current.find(x=>x.recordId===recordId);setEvOpen(false);void request({operation:'evidence',expectedVersion:data.claim.version,expectedEvidenceVersion:old?.version??0,recordId,sourceKind,observedAt:new Date(observedAt).toISOString(),report,stance,status,facts:{batch:batch.trim()||null,carrier:carrier.trim()||null,sku:sku.trim()||null},attested});}}><fieldset disabled={busy}><legend className="sr-only">{t('ce.legendEv')}</legend>
     <label>{t('ce.idRegistro')}<input required maxLength={200} value={recordId} onChange={e=>{setRecordId(e.target.value);setAttested(false);}}/></label>
     <div className={css.cols}><label>{t('ce.procedencia')}<select value={sourceKind} onChange={e=>setSourceKind(e.target.value)}><option value="inspection">{t('ce.inspeccion')}</option><option value="lab">{t('ce.ensayo')}</option><option value="carrier_record">{t('ce.regTransportista')}</option></select></label><label>{t('ce.fechaObs')}<input required type="datetime-local" value={observedAt} onChange={e=>setObservedAt(e.target.value)}/></label>
     <label>{t('ce.relacionHip')}<select value={stance} onChange={e=>setStance(e.target.value)}><option value="supports">{t('ce.apoya')}</option><option value="contradicts">{t('ce.contradice')}</option></select></label><label>{t('ce.estadoPrueba')}<select value={status} onChange={e=>setStatus(e.target.value)}><option value="active">{t('ce.vigente')}</option><option value="withdrawn">{t('ce.retiradaNuevaVer')}</option></select></label></div>
     <label>{t('ce.informeMetodo')}<textarea required minLength={20} maxLength={16000} value={report} onChange={e=>{setReport(e.target.value);setAttested(false);}}/></label>
     <div className={css.cols}><label>{t('ce.loteDoc')}<input value={batch} onChange={e=>setBatch(e.target.value)}/></label><label>{t('ce.transpDoc')}<input value={carrier} onChange={e=>setCarrier(e.target.value)}/></label><label>{t('ce.skuDoc')}<input value={sku} onChange={e=>setSku(e.target.value)}/></label></div>
     <label className="check"><input type="checkbox" checked={attested} onChange={e=>setAttested(e.target.checked)}/>{t('ce.atestiguo')}</label>
    </fieldset></form>
   </Drawer>
   <Drawer open={revOpen} onClose={()=>setRevOpen(false)} title={t('ce.revisarLaEval')} subtitle={t('ce.revHumanaNoOrdena')} footer={<><Button size="sm" variant="ghost" onClick={()=>setRevOpen(false)}>{t('ce.cancelar')}</Button><Button size="sm" variant="primary" type="submit" form="ce-review" disabled={busy||!approved||(state==='confirmed'&&(!cause.trim()||!refs.length))}>{t('ce.guardarRev')}</Button></>}>
    <form id="ce-review" className={css.form} onSubmit={e=>{e.preventDefault();setRevOpen(false);void request({operation:'revise',expectedVersion:data.claim.version,symptom,probableCause:cause.trim()||null,state,evidenceIds:refs,reason,approved});}}><fieldset disabled={busy}><legend className="sr-only">{t('ce.revisarLaEval')}</legend>
     <label>{t('ce.sintomaObs')}<textarea required value={symptom} onChange={e=>{setSymptom(e.target.value);setApproved(false);}}/></label>
     <label>{t('ce.causaOpc')}<textarea value={cause} onChange={e=>{setCause(e.target.value);setApproved(false);}}/></label>
     <label>{t('ce.decision')}<select value={state} onChange={e=>{setState(e.target.value);setApproved(false);}}><option value="hypothesis">{t('ce.hipSinConf')}</option>{data.canConfirm&&<option value="confirmed">{t('ce.confOpHumana')}</option>}<option value="retracted">{t('ce.rectificarRetirar')}</option></select></label>
     {activeEv.length>0&&<div className="check-row">{activeEv.map(x=><label key={x.id} className="check-chip"><input type="checkbox" checked={refs.includes(x.id)} onChange={e=>{setRefs(v=>e.target.checked?[...v,x.id]:v.filter(id=>id!==x.id));setApproved(false);}}/>{x.recordId} · {x.stance}</label>)}</div>}
     <label>{t('ce.motivoValoracion')}<textarea required value={reason} onChange={e=>{setReason(e.target.value);setApproved(false);}}/></label>
     <label className="check"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/>{t('ce.confirmoRev')}</label>
    </fieldset></form>
   </Drawer>
  </>}
 </section>;
}
