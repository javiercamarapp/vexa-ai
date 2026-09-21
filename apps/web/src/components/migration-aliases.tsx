'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {AliasEvent,AliasIdentity} from '../../../../packages/connectors/aliases.mjs';
import {MigrationComparison} from './migration-comparison';
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
 const last=history.at(-1),validDecision=confirmed&&evidence.trim().length>0&&reason.trim().length>0;
 return <section aria-labelledby="migration-aliases-title"><h2 id="migration-aliases-title">Aliases de conversaciones</h2>
 <p>Relaciona identidades de la misma organización con evidencia y aprobación humana. Una coincidencia de email o texto no confirma una identidad.</p>
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{busy&&<p role="status">Procesando aliases…</p>}
 <button disabled={busy} onClick={()=>void action(reload)}>Actualizar aliases</button>
 {listing&&<><p>{listing.groups===null?'No se puede resolver el conjunto de aliases: hay identidades ambiguas o procedencia pendiente. Revisa el historial antes de decidir.':`${listing.groups.length} conversaciones resueltas en esta organización.`}</p>
 {!listing.conversations.length&&<p>No hay conversaciones disponibles en esta página.</p>}
 <label>Conversación origen<select value={source} disabled={busy} onChange={event=>selectSource(event.target.value)}><option value="">Selecciona la identidad original</option>{listing.conversations.map(row=><option key={row.id} value={row.id}>{label(row)}</option>)}</select></label>
 {listing.nextCursor&&<button disabled={busy} onClick={()=>void action(async()=>{const value:Listing=await authorizedApi(undefined,'?'+new URLSearchParams({cursor:listing.nextCursor!}));setListing(previous=>previous?{...value,conversations:[...previous.conversations,...value.conversations.filter(row=>!previous.conversations.some(old=>old.id===row.id))]}:value);})}>Cargar más conversaciones</button>}
 {listing.canPropose&&<><label>Conversación destino<select value={target} disabled={busy} onChange={event=>{setTarget(event.target.value);setProposal(null);setConfirmed(false);}}><option value="">Selecciona la identidad canónica</option>{listing.conversations.filter(row=>row.id!==source).map(row=><option key={row.id} value={row.id}>{label(row)}</option>)}</select></label>
 <button disabled={busy||!source||!target||source===target} onClick={()=>void action(async()=>{const value=await authorizedApi({operation:'propose',sourceConversationId:source,targetConversationId:target});setProposal(value.proposal);setConfirmed(false);})}>Preparar propuesta</button></>}
 {proposal&&<section aria-label="Propuesta de alias"><h3>Propuesta pendiente de aprobación</h3><p>{proposal.source.source} / {proposal.source.account_id} / {proposal.source.external_id} → {proposal.target.source} / {proposal.target.account_id} / {proposal.target.external_id}</p><p>Versión esperada: {proposal.expectedVersion}. Esta propuesta no modifica las fuentes ni confirma el alias.</p>{proposal.legacyUnresolved&&<p>Existe un alias antiguo sin aprobación resuelta; revisa su procedencia.</p>}</section>}
 {listing.canApprove&&source&&<fieldset disabled={busy||historyBusy||Boolean(historyError)}><legend>Decisión del propietario</legend>
 <label>Referencia de evidencia<input required maxLength={2000} value={evidence} onChange={event=>setEvidence(event.target.value)}/></label>
 <label>Motivo de la decisión<textarea required maxLength={1000} value={reason} onChange={event=>setReason(event.target.value)}/></label>
 <label><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>Confirmo esta decisión de identidad</label>
 <button disabled={!proposal||!validDecision} onClick={()=>void action(()=>decide('confirm'))}>Confirmar alias</button>
 <button disabled={!last||last.operation!=='confirm'||!validDecision} onClick={()=>void action(()=>decide('undo'))}>Deshacer alias</button>
 </fieldset>}
 {!listing.canApprove&&<p>Sólo el propietario puede confirmar o deshacer una propuesta.</p>}
 </>}
 {source&&<section aria-label="Historial de aliases"><h3>Historial y procedencia de la identidad</h3>{historyBusy&&<p role="status">Cargando historial…</p>}{historyError&&<p role="alert">{historyError}</p>}{!historyBusy&&!historyError&&!history.length&&<p>Esta identidad no tiene decisiones de alias.</p>}{history.map(event=><article key={event.id}><h4>Versión {event.version}: {event.operation==='confirm'?'Alias confirmado':event.operation==='undo'?'Alias deshecho':'Alias antiguo pendiente'}</h4><p>Motivo: {event.reason??'No registrado'}</p><p>Evidencia: {event.evidence_ref??'No registrada'}</p><p>Aprobador: {event.approved_by??'No registrado'} · {new Date(event.created_at).toLocaleString('es-MX')}</p><details><summary>Procedencia de la versión {event.version}</summary><pre>{JSON.stringify({source:event.source,accountId:event.account_id,externalId:event.external_id,sourceConversationId:event.source_conversation_id,canonicalId:event.canonical_id,previousVersion:event.previous_version,provenance:event.provenance},null,2)}</pre></details></article>)}</section>}
 <p>Después de una decisión, congela un corte nuevo para comparar el recuento actualizado. Los cortes anteriores no se reescriben.</p>
 </section>;
}
export function MigrationWorkspace(){const [revision,setRevision]=useState(0);return <><MigrationComparison key={revision}/><MigrationAliases onChange={()=>setRevision(value=>value+1)}/></>;}
