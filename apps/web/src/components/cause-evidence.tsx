'use client';
import {RovaqCargando} from './rovaq-cargando';
import {useAutoRefresh} from './ui/use-auto-refresh';
import {useCallback,useEffect,useRef,useState} from 'react';
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
export function CauseEvidence({problemId}:{problemId:string}){
 const generation=useRef(0);const [data,setData]=useState<CauseView|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [symptom,setSymptom]=useState(''),[cause,setCause]=useState(''),[state,setState]=useState('hypothesis'),[reason,setReason]=useState(''),[refs,setRefs]=useState<string[]>([]),[approved,setApproved]=useState(false);
 const [recordId,setRecordId]=useState(''),[sourceKind,setSourceKind]=useState('inspection'),[observedAt,setObservedAt]=useState(''),[report,setReport]=useState(''),[stance,setStance]=useState('supports'),[status,setStatus]=useState('active'),[batch,setBatch]=useState(''),[carrier,setCarrier]=useState(''),[sku,setSku]=useState(''),[attested,setAttested]=useState(false),[evOpen,setEvOpen]=useState(false),[revOpen,setRevOpen]=useState(false);
 const clear=useCallback(()=>{setData(null);setBusy(false);setSymptom('');setCause('');setReason('');setRefs([]);setApproved(false);setRecordId('');setReport('');setObservedAt('');setBatch('');setCarrier('');setSku('');setAttested(false);},[]);
 const request=useCallback(async(body?:unknown)=>{const epoch=++generation.current;setBusy(true);try{const r=await fetchCupo('/api/problems/'+encodeURIComponent(problemId)+'/causality',{method:body?'POST':'GET',cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});if(epoch!==generation.current)return;if(r.status===401||r.status===403){generation.current++;clear();setError('Autorización revocada.');return;}const value=await r.json();if(epoch!==generation.current)return;if(!r.ok)throw Error(r.status===409?'La versión o la evidencia cambió. Vuelve a intentarlo: la evaluación se relee sola.':'No se pudo completar la evaluación.');setData(value.data);setSymptom(value.data.claim.symptom);setCause(value.data.claim.probableCause??'');setRefs([]);setApproved(false);setAttested(false);setError('');}catch(e){if(epoch===generation.current){clear();setError(e instanceof Error?e.message:'Error de consulta');}}finally{if(epoch===generation.current)setBusy(false);}},[problemId,clear]);
 const invalidate=useCallback(()=>{generation.current++;},[]);
 // Datos nuevos: relectura en segundo plano; solo actualiza la vista, sin tocar lo que la persona está escribiendo.
 const busyRef=useRef(false);busyRef.current=busy;
 const recargarSilencioso=useCallback(async()=>{if(busyRef.current)return;const epoch=generation.current;try{const r=await fetchCupo('/api/problems/'+encodeURIComponent(problemId)+'/causality',{method:'GET',cache:'no-store'});if(!r.ok||epoch!==generation.current||busyRef.current)return;const value=await r.json();if(epoch===generation.current&&value?.data?.claim)setData(value.data);}catch{/* se conserva lo pintado */}},[problemId]);
 useAutoRefresh(recargarSilencioso,{ocupado:()=>busyRef.current});
 useEffect(()=>{void Promise.resolve().then(()=>request());return invalidate;},[request,invalidate]);
 const current=data?.evidence.filter(e=>!data.evidence.some(other=>other.recordId===e.recordId&&other.version>e.version))??[]; const stateTone=(v:string):'ok'|'warn'|'muted'|'info'=>v==='confirmed'?'ok':v==='retracted'?'muted':'info';
 const stateLabel=(v:string)=>v==='confirmed'?'Confirmada':v==='retracted'?'Retirada':v==='hypothesis'?'Hipótesis':v;
 const activeEv=current.filter(e=>e.status==='active');
 return <section aria-label="Evaluación causal" className={css.stack}>
  <div className="card-title"><div><h3>Síntoma, hipótesis y confirmación operacional</h3><p>Una agrupación o confianza estadística no confirma causalidad.</p></div></div>
  {error&&<p role="alert" className="notice-bar"><Icon name="alert" size={14}/>{error}</p>}
  {!data&&!error&&<RovaqCargando compacto mensaje="Cargando evaluación causal"/>}
  {data&&<>
   {data.claim.criticalReview&&<p role="alert" className="notice-bar">Posible riesgo severo: revisión humana prioritaria, incluso con baja corroboración. No demuestra un defecto de lote. No activa recall ni reembolso.</p>}
   <Stepper label="Avance de la evaluación causal" steps={[{key:'sym',label:'Síntoma',state:'done'},{key:'hyp',label:'Hipótesis',state:data.claim.probableCause?'done':'current'},{key:'ev',label:'Evidencia ('+activeEv.length+')',state:activeEv.length?'done':data.claim.probableCause?'current':'todo'},{key:'conf',label:'Confirmación',state:data.claim.state==='confirmed'?'done':activeEv.length?'current':'todo'}]}/>
   <dl className={css.factGrid}>
    <div><dt>Síntoma</dt><dd>{data.claim.symptom}</dd></div>
    <div><dt>Causa probable</dt><dd>{data.claim.probableCause??'Desconocida'}</dd></div>
    <div><dt>Estado operacional</dt><dd><StatusChip tone={stateTone(data.claim.state)}>{stateLabel(data.claim.state)}</StatusChip> · versión {data.claim.version}</dd></div>
    <div><dt>Lote</dt><dd>{data.claim.facts.batch??'Desconocido'}</dd></div>
    <div><dt>Transportista</dt><dd>{data.claim.facts.carrier??'Desconocido'}</dd></div>
    <div><dt>SKU</dt><dd>{data.claim.facts.sku??'Desconocido'}</dd></div>
   </dl>
   {data.canRecord&&<div className={css.actions}><Button size="sm" onClick={()=>setEvOpen(true)}>Aportar prueba operacional</Button><Button size="sm" variant="primary" onClick={()=>setRevOpen(true)}>Revisar evaluación causal</Button></div>}
   <h4>Evidencia operacional y contraria</h4>
   {!current.length?<EmptyState art="doc" compact title="Sin pruebas operacionales" body="Aporta una inspección, ensayo o registro del transportista."/>:<Timeline events={current.map(e=>({key:e.id,icon:e.stance==='contradicts'?'x':'check',title:<>{e.recordId} · versión {e.version}</>,meta:<StatusChip tone={e.stance==='contradicts'?'warn':'ok'}>{e.stance==='contradicts'?'Contradice':'Apoya'}</StatusChip>,body:<><p className={css.muted}>{e.sourceKind} · {e.status}</p><details><summary>Informe operacional</summary><pre className={css.pre}>{e.report}</pre></details><IdChip value={e.digest} label="Huella" head={8} tail={4}/></>}))}/>}
   <details><summary>Historial inmutable de evaluaciones y pruebas</summary>{data.history.map(h=><article key={h.version}><p>Versión {h.version}: {h.state}, actor {h.actorId}</p><p>{h.symptom} · {h.probableCause??'Sin causa afirmada'} · {h.reason}</p></article>)}{data.evidence.map(e=><p key={e.id}>{e.recordId} v{e.version}: {e.stance}, {e.status}, actor {e.actorId}, huella {e.digest}</p>)}</details>
   <Drawer open={evOpen} onClose={()=>setEvOpen(false)} title="Aportar o rectificar prueba" subtitle="Prueba operacional independiente del ticket" footer={<><Button size="sm" variant="ghost" onClick={()=>setEvOpen(false)}>Cancelar</Button><Button size="sm" variant="primary" type="submit" form="ce-evidence" disabled={busy||!attested}>Guardar evidencia operacional</Button></>}>
    <form id="ce-evidence" className={css.form} onSubmit={e=>{e.preventDefault();const old=current.find(x=>x.recordId===recordId);setEvOpen(false);void request({operation:'evidence',expectedVersion:data.claim.version,expectedEvidenceVersion:old?.version??0,recordId,sourceKind,observedAt:new Date(observedAt).toISOString(),report,stance,status,facts:{batch:batch.trim()||null,carrier:carrier.trim()||null,sku:sku.trim()||null},attested});}}><fieldset disabled={busy}><legend className="sr-only">Aportar o rectificar prueba operacional independiente</legend>
     <label>Identificador del registro operacional<input required maxLength={200} value={recordId} onChange={e=>{setRecordId(e.target.value);setAttested(false);}}/></label>
     <div className={css.cols}><label>Procedencia<select value={sourceKind} onChange={e=>setSourceKind(e.target.value)}><option value="inspection">Inspección física</option><option value="lab">Ensayo de laboratorio</option><option value="carrier_record">Registro del transportista</option></select></label><label>Fecha de observación<input required type="datetime-local" value={observedAt} onChange={e=>setObservedAt(e.target.value)}/></label>
     <label>Relación con la hipótesis<select value={stance} onChange={e=>setStance(e.target.value)}><option value="supports">Apoya</option><option value="contradicts">Contradice</option></select></label><label>Estado de la prueba<select value={status} onChange={e=>setStatus(e.target.value)}><option value="active">Vigente</option><option value="withdrawn">Retirada mediante nueva versión</option></select></label></div>
     <label>Informe operacional: método y observaciones<textarea required minLength={20} maxLength={16000} value={report} onChange={e=>{setReport(e.target.value);setAttested(false);}}/></label>
     <div className={css.cols}><label>Lote documentado, opcional<input value={batch} onChange={e=>setBatch(e.target.value)}/></label><label>Transportista documentado, opcional<input value={carrier} onChange={e=>setCarrier(e.target.value)}/></label><label>SKU documentado, opcional<input value={sku} onChange={e=>setSku(e.target.value)}/></label></div>
     <label className="check"><input type="checkbox" checked={attested} onChange={e=>setAttested(e.target.checked)}/>Atestiguo que revisé este registro operacional independiente del ticket y que los datos indicados constan en él.</label>
    </fieldset></form>
   </Drawer>
   <Drawer open={revOpen} onClose={()=>setRevOpen(false)} title="Revisar la evaluación causal" subtitle="Revisión humana; no ordena acciones externas" footer={<><Button size="sm" variant="ghost" onClick={()=>setRevOpen(false)}>Cancelar</Button><Button size="sm" variant="primary" type="submit" form="ce-review" disabled={busy||!approved||(state==='confirmed'&&(!cause.trim()||!refs.length))}>Guardar revisión causal</Button></>}>
    <form id="ce-review" className={css.form} onSubmit={e=>{e.preventDefault();setRevOpen(false);void request({operation:'revise',expectedVersion:data.claim.version,symptom,probableCause:cause.trim()||null,state,evidenceIds:refs,reason,approved});}}><fieldset disabled={busy}><legend className="sr-only">Revisar la evaluación causal</legend>
     <label>Síntoma observado<textarea required value={symptom} onChange={e=>{setSymptom(e.target.value);setApproved(false);}}/></label>
     <label>Causa probable, opcional<textarea value={cause} onChange={e=>{setCause(e.target.value);setApproved(false);}}/></label>
     <label>Decisión<select value={state} onChange={e=>{setState(e.target.value);setApproved(false);}}><option value="hypothesis">Hipótesis, sin confirmación</option>{data.canConfirm&&<option value="confirmed">Confirmación operacional humana</option>}<option value="retracted">Rectificar o retirar confirmación</option></select></label>
     {activeEv.length>0&&<div className="check-row">{activeEv.map(x=><label key={x.id} className="check-chip"><input type="checkbox" checked={refs.includes(x.id)} onChange={e=>{setRefs(v=>e.target.checked?[...v,x.id]:v.filter(id=>id!==x.id));setApproved(false);}}/>{x.recordId} · {x.stance}</label>)}</div>}
     <label>Motivo y valoración de evidencia contraria<textarea required value={reason} onChange={e=>{setReason(e.target.value);setApproved(false);}}/></label>
     <label className="check"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/>Confirmo esta revisión humana y su alcance; no ordena acciones externas.</label>
    </fieldset></form>
   </Drawer>
  </>}
 </section>;
}
