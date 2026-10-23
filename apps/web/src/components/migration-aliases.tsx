'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {AliasEvent,AliasIdentity} from '../../../../packages/connectors/aliases.mjs';
import {MigrationComparison} from './migration-comparison';
import {Button,Refresh} from './ui/button';
import {KpiLinea} from './panel-comun/kpi-linea';
import './panel-comun/panel-comun.css';
import {StatusChip} from './ui/status-chip';
import {DonutChart} from './ui/donut-chart';
import {EmptyState} from './ui/empty-state';
import {IdChip} from './ui/id-chip';
import {Timeline} from './ui/timeline';
import {Icon} from './ui/icons';
import {nf} from './ui/format';
import css from './ops-panels.module.css';
type Conversation={id:string;source:string;accountId:string;externalId:string;revisionState:string|null};
type Listing={conversations:Conversation[];groups:Array<{canonical_id:string;conversation_ids:string[]}>|null;projectionState:'resolved'|'unresolved';canPropose:boolean;canApprove:boolean;nextCursor:string|null};
type Proposal={source:AliasIdentity;target:AliasIdentity;expectedVersion:number;legacyUnresolved:boolean};
async function api(body?:unknown,query='',signal?:AbortSignal){
 const response=await fetch('/api/migrations/aliases'+query,{method:body===undefined?'GET':'POST',cache:'no-store',signal,headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 if(!response.ok)throw Object.assign(Error(response.status===409?'La identidad o su versión cambió. Actualiza los aliases y prepara otra decisión.':response.status===403?'Tu rol no permite esta acción. Sólo el propietario puede confirmar o deshacer aliases.':response.status===400?'Revisa las identidades, el motivo, la evidencia y la confirmación.':'No se pudo consultar el servicio de aliases. Reintenta.'),{status:response.status});
 return response.json();
}
export function MigrationAliases({onChange}:{onChange:()=>void}){
 const historyRequest=useRef(0),accessGeneration=useRef(0);
 const [listing,setListing]=useState<Listing|null>(null),[source,setSource]=useState(''),[target,setTarget]=useState(''),[proposal,setProposal]=useState<Proposal|null>(null),[history,setHistory]=useState<AliasEvent[]>([]),[historyBusy,setHistoryBusy]=useState(false),[historyError,setHistoryError]=useState('');
 const [busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[evidence,setEvidence]=useState(''),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false);
 const authorizedApi=useCallback(async(body?:unknown,query='',signal?:AbortSignal)=>{
  const generation=accessGeneration.current;
  try{
   const value=await api(body,query,signal);
   if(signal?.aborted||generation!==accessGeneration.current)throw new DOMException('Respuesta obsoleta','AbortError');
   return value;
  }catch(error){
   if(signal?.aborted||generation!==accessGeneration.current)throw new DOMException('Respuesta obsoleta','AbortError');
   if([401,403].includes((error as {status?:number})?.status??0)){
    accessGeneration.current++;historyRequest.current++;setListing(null);setSource('');setTarget('');setHistory([]);setProposal(null);setEvidence('');setReason('');setConfirmed(false);setHistoryBusy(false);setHistoryError('');setNotice('');setBusy(false);setError('Ya no tienes autorización para consultar o modificar estos aliases.');
   }
   throw error;
  }
 },[]);
 const refresh=useCallback(async(signal?:AbortSignal)=>{const value=await authorizedApi(undefined,'',signal);if(!signal?.aborted)setListing(value);},[authorizedApi]);
 useEffect(()=>{const controller=new AbortController(),generation=accessGeneration.current;void Promise.resolve().then(()=>refresh(controller.signal)).catch(e=>{if(!controller.signal.aborted&&e.name!=='AbortError')setError(e.message);}).finally(()=>{if(!controller.signal.aborted&&generation===accessGeneration.current)setBusy(false);});return()=>controller.abort();},[refresh]);
 useEffect(()=>{if(!source)return;const requestId=++historyRequest.current,controller=new AbortController();void Promise.resolve().then(()=>authorizedApi(undefined,'?'+new URLSearchParams({sourceConversationId:source}),controller.signal)).then(value=>{if(!controller.signal.aborted&&requestId===historyRequest.current)setHistory(value.history);}).catch(e=>{if(!controller.signal.aborted&&requestId===historyRequest.current&&e.name!=='AbortError')setHistoryError(e.message);}).finally(()=>{if(!controller.signal.aborted&&requestId===historyRequest.current)setHistoryBusy(false);});return()=>controller.abort();},[source,authorizedApi]);
 async function action(work:()=>Promise<void>){const generation=accessGeneration.current;setError('');setNotice('');setBusy(true);try{await work();}catch(e){if(!(e instanceof Error&&e.name==='AbortError'))setError(e instanceof Error?e.message:'No se pudo completar la decisión.');}finally{if(generation===accessGeneration.current)setBusy(false);}}
 function selectSource(value:string){setSource(value);setProposal(null);setHistory([]);setHistoryBusy(Boolean(value));setHistoryError('');setConfirmed(false);setNotice('');}
 async function reload(){const requestId=++historyRequest.current;await refresh();setProposal(null);setConfirmed(false);if(source){try{const value=await authorizedApi(undefined,'?'+new URLSearchParams({sourceConversationId:source}));if(requestId===historyRequest.current){setHistory(value.history);setHistoryError('');}}finally{if(requestId===historyRequest.current)setHistoryBusy(false);}}}
 async function decide(operation:'confirm'|'undo'){
  const version=operation==='confirm'?proposal?.expectedVersion:history.at(-1)?.version;
  if(version===undefined||!confirmed)return;
  await authorizedApi({operation,sourceConversationId:source,...(operation==='confirm'?{targetConversationId:proposal?.target.conversation_id}:{}),expectedVersion:version,evidenceRef:evidence,reason,approved:true});
  setProposal(null);setConfirmed(false);setHistory([]);setEvidence('');setReason('');setNotice(operation==='confirm'?'Alias confirmado. Las fuentes originales y los cortes históricos se conservan.':'Alias deshecho mediante un evento compensatorio. Las fuentes originales y los cortes históricos se conservan.');onChange();await reload();
 }
 const label=(row:Conversation)=>`${row.source} · ${row.accountId} · ${row.externalId}${row.revisionState==='ambiguous'?' · identidad ambigua':''}`;
 const last=history.at(-1),validDecision=confirmed&&evidence.trim().length>0&&reason.trim().length>0; const ambiguous=listing?listing.conversations.filter(row=>row.revisionState==='ambiguous').length:0;
 const eventTitle=(event:AliasEvent)=>event.operation==='confirm'?'Alias confirmado':event.operation==='undo'?'Alias deshecho':'Alias antiguo pendiente';
 const node=(i:AliasIdentity)=><span className={css.flowNode}><strong>{i.source}</strong><span>{i.account_id}</span><IdChip value={i.external_id} head={10} tail={4}/></span>;
 return <section className="stack" aria-labelledby="migration-aliases-title">
  <div className="card-title"><div><h2 id="migration-aliases-title">Aliases de conversaciones</h2><p>Identidades de la misma organización, con evidencia y aprobación humana. Un email o texto parecido no confirma una identidad.</p></div><Button size="sm" icon={<Refresh/>} disabled={busy} onClick={()=>void action(reload)}>Actualizar aliases</Button></div>
  {error&&<p role="alert" className="notice-bar"><Icon name="alert" size={14}/>{error}</p>}{notice&&<p role="status" className="notice-bar" data-tone="info"><Icon name="check" size={14}/>{notice}</p>}{busy&&<p role="status" className="sr-only">Procesando aliases…</p>}
  {listing&&<>
  <div className="split" data-even>
   <KpiLinea label="Indicadores de identidades" items={[
    {label:'Conversaciones cargadas',value:nf.format(listing.conversations.length)+(listing.nextCursor?'+':''),c:8,partes:[{label:'Sin ambigüedad',value:listing.conversations.length-ambiguous},{label:'Ambiguas',value:ambiguous}],nota:'En esta página'},
    {label:'Identidades resueltas',value:listing.groups===null?'Sin resolver':nf.format(listing.groups.length),vacio:listing.groups===null,c:8,partes:listing.groups===null?undefined:[{label:'Resueltas',value:listing.groups.length}],nota:listing.groups===null?'Hay identidades ambiguas o procedencia pendiente.':'en esta organización'},
    {label:'Ambiguas',value:nf.format(ambiguous),c:8,chip:ambiguous>0?{texto:'Revisar',tono:'warn'}:{texto:'Ninguna',tono:'ok'},partes:[{label:'Ambiguas',value:ambiguous},{label:'Sin ambigüedad',value:listing.conversations.length-ambiguous}],nota:'en las cargadas'}]}/>
   <section className="card" aria-label="Estado de las identidades"><div className="card-title"><div><h2>Estado de identidades</h2><p>Conversaciones cargadas</p></div></div>
    <DonutChart title="Identidades por estado de revisión" centerValue={nf.format(listing.conversations.length)} centerLabel="en total" segments={[{key:'clear',label:'Sin ambigüedad',value:listing.conversations.length-ambiguous,display:nf.format(listing.conversations.length-ambiguous),tone:1},{key:'amb',label:'Identidad ambigua',value:ambiguous,display:nf.format(ambiguous),tone:5}]}/>
   </section>
  </div>
  {listing.groups===null&&<p role="status" className="notice-bar"><Icon name="info" size={14}/>No se puede resolver el conjunto de aliases: hay identidades ambiguas o procedencia pendiente. Revisa el historial antes de decidir.</p>}
  {!listing.conversations.length?<EmptyState art="inbox" compact title="No hay conversaciones disponibles en esta página."/>:
  <section className="card" aria-label="Preparar alias">
   <div className="card-title"><div><h2>Preparar un alias</h2><p>Origen y destino canónico</p></div>{listing.nextCursor&&<Button size="sm" variant="ghost" disabled={busy} onClick={()=>void action(async()=>{const value:Listing=await authorizedApi(undefined,'?'+new URLSearchParams({cursor:listing.nextCursor!}));setListing(previous=>previous?{...value,conversations:[...previous.conversations,...value.conversations.filter(row=>!previous.conversations.some(old=>old.id===row.id))]}:value);})}>Cargar más conversaciones</Button>}</div>
   <div className={css.pickRow+' '+css.form}>
    <label>Conversación origen<select value={source} disabled={busy} onChange={event=>selectSource(event.target.value)}><option value="">Selecciona la identidad original</option>{listing.conversations.map(row=><option key={row.id} value={row.id}>{label(row)}</option>)}</select></label>
    {listing.canPropose&&<><label>Conversación destino<select value={target} disabled={busy} onChange={event=>{setTarget(event.target.value);setProposal(null);setConfirmed(false);}}><option value="">Selecciona la identidad canónica</option>{listing.conversations.filter(row=>row.id!==source).map(row=><option key={row.id} value={row.id}>{label(row)}</option>)}</select></label>
    <div><Button size="sm" variant="primary" disabled={busy||!source||!target||source===target} onClick={()=>void action(async()=>{const value=await authorizedApi({operation:'propose',sourceConversationId:source,targetConversationId:target});setProposal(value.proposal);setConfirmed(false);})}>Preparar propuesta</Button></div></>}
   </div>
  </section>}
  {proposal&&<section className="card" aria-label="Propuesta de alias"><div className="card-title"><div><h3>Propuesta pendiente de aprobación</h3><p>Versión esperada: {proposal.expectedVersion}. Esta propuesta no modifica las fuentes ni confirma el alias.</p></div><StatusChip tone="warn">Pendiente</StatusChip></div>
   <div className={css.flow}>{node(proposal.source)}<Icon name="arrow-right" size={16}/>{node(proposal.target)}</div>
   {proposal.legacyUnresolved&&<p className="notice-bar" style={{marginTop:'var(--sp-3)'}}><Icon name="info" size={14}/>Existe un alias antiguo sin aprobación resuelta; revisa su procedencia.</p>}</section>}
  {listing.canApprove&&source&&<fieldset className={'card '+css.form} style={{margin:0}} disabled={busy||historyBusy||Boolean(historyError)}><legend className="sr-only">Decisión del propietario</legend>
   <div className="card-title"><div><h3>Decisión del propietario</h3><p>Se registra con evidencia y motivo</p></div></div>
   <div className={css.cols}><label>Referencia de evidencia<input required maxLength={2000} value={evidence} onChange={event=>setEvidence(event.target.value)}/></label>
   <label>Motivo de la decisión<textarea required maxLength={1000} value={reason} onChange={event=>setReason(event.target.value)}/></label></div>
   <label className="check"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>Confirmo esta decisión de identidad</label>
   <div className={css.actions}><Button size="sm" variant="primary" disabled={!proposal||!validDecision} onClick={()=>void action(()=>decide('confirm'))}>Confirmar alias</Button><Button size="sm" disabled={!last||last.operation!=='confirm'||!validDecision} onClick={()=>void action(()=>decide('undo'))}>Deshacer alias</Button></div>
  </fieldset>}
  {!listing.canApprove&&<p className="notice-bar" data-tone="calm"><Icon name="lock" size={14}/>Sólo el propietario puede confirmar o deshacer una propuesta.</p>}
  </>}
  {source&&<section className="card" aria-label="Historial de aliases"><div className="card-title"><div><h3>Historial y procedencia de la identidad</h3></div></div>{historyBusy&&<p role="status">Cargando historial…</p>}{historyError&&<p role="alert" className="notice-bar">{historyError}</p>}{!historyBusy&&!historyError&&!history.length&&<p className="state">Esta identidad no tiene decisiones de alias.</p>}
   {history.length>0&&<Timeline events={history.map(event=>({key:event.id,icon:event.operation==='confirm'?'link':event.operation==='undo'?'refresh':'clock',title:<>Versión {event.version}: {eventTitle(event)}</>,meta:new Date(event.created_at).toLocaleString('es-MX'),body:<><p>Motivo: {event.reason??'No registrado'}</p><p>Evidencia: {event.evidence_ref??'No registrada'}</p><p>Aprobador: {event.approved_by??'No registrado'}</p><details><summary>Procedencia de la versión {event.version}</summary><pre className={css.pre}>{JSON.stringify({source:event.source,accountId:event.account_id,externalId:event.external_id,sourceConversationId:event.source_conversation_id,canonicalId:event.canonical_id,previousVersion:event.previous_version,provenance:event.provenance},null,2)}</pre></details></>}))}/>}
  </section>}
  <p className={css.muted}>Después de una decisión, congela un corte nuevo para comparar el recuento actualizado. Los cortes anteriores no se reescriben.</p>
 </section>;
}
export function MigrationWorkspace(){const [revision,setRevision]=useState(0);return <><MigrationComparison key={revision}/><MigrationAliases onChange={()=>setRevision(value=>value+1)}/></>;}
