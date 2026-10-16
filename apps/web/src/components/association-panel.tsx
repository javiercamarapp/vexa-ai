'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link,{useWorkspaceNavigation} from './workspace/navigation-lifecycle';
import {ScrollTable} from './workspace/scroll-table';

type Fact={id:string;ticket_id:string;contact_id:string;provider:string;portal_id:string;source_connection_id:string;resolution_state:string;reason:string|null;version:number;selected_evidence_hash:string|null;first_evidence_hash:string};
type Candidate={id:string;connectionId:string;externalId:string;headVersion:number;revisionId:string};
type Evidence={id:string;import_id:string;row_ref:string|number;state:string;result:{evidence_hash:string;status:string;evidence?:{nativePair?:unknown;source?:unknown;bridge?:{property:{status:string;value:string|null};notes:{gorgiasId:string}[];archivedTicket:boolean}}};sharedRawUnavailable?:boolean};
type Binding={id:string;conversation_id?:string;customer_id?:string;conversationId?:string;customerId?:string;active?:boolean;current?:boolean;state?:string};
type Detail={fact:Fact&{candidates?:{conversations:Candidate[];customers:Candidate[];nextCursor:string|null}};evidence:{items:Evidence[];nextCursor:string|null};bindings:Binding[];canResolve:boolean;sharedRawUnavailable:boolean};
type Entry={importId:string;connectionId:string;fileHash:string;mappingVersion:string;provider:string;portalId:string;namespace:string;sourceManifestHash:string;sourceInventoryHash:string;sourceReceiptHash:string};
type Origin={approvalId:string;version:number;state:string;manifestHash:string;entries:Entry[];entryHashes:string[]};
type OriginFile={manifestHash:string;entries:Entry[]};
const labels:Record<string,string>={pending:'Pendiente de resolver',resolved:'Resuelto',blocked:'Requiere revisión',retained:'Datos sujetos a retención'};
const unique=<T extends {id:string}>(old:T[],next:T[])=>[...new Map([...old,...next].map(x=>[x.id,x])).values()];
const stateLabel=(state:string)=>labels[state]??state;
class RequestError extends Error {constructor(message:string,public status:number){super(message);}}
async function request<T>(params:Record<string,string>,signal:AbortSignal,body?:unknown):Promise<T>{
 const response=await fetch('/api/associations?'+new URLSearchParams(params),{method:body===undefined?'GET':'POST',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal});
 const result=await response.json();if(!response.ok){const message=response.status===409?'La información cambió. Recarga y revisa la selección antes de decidir.':response.status===401||response.status===403?'Tu acceso no permite esta acción. Revisa la sesión y el espacio seleccionado.':response.status===413?'La respuesta o el archivo excede el límite permitido. Revisa el lote.':'No se pudo completar la consulta o acción.';throw new RequestError(message+' '+(result.error?.code??''),response.status);}return result.data as T;
}
export function AssociationPanel(){
 const [facts,setFacts]=useState<Fact[]>([]),[next,setNext]=useState<string|null>(null),[filter,setFilter]=useState(''),[scope,setScope]=useState<{conversationId?:string;customerId?:string}>({});
 const [detail,setDetail]=useState<Detail|null>(null),[evidence,setEvidence]=useState<Evidence[]>([]),[conversations,setConversations]=useState<Candidate[]>([]),[customers,setCustomers]=useState<Candidate[]>([]);
 const [conversation,setConversation]=useState(''),[customer,setCustomer]=useState(''),[proof,setProof]=useState(''),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false);
 const [origins,setOrigins]=useState<Origin[]>([]),[originNext,setOriginNext]=useState<string|null>(null),[canApprove,setCanApprove]=useState(false),[originFile,setOriginFile]=useState<OriginFile|null>(null),[originName,setOriginName]=useState(''),[originText,setOriginText]=useState(''),[originReason,setOriginReason]=useState(''),[originConfirmed,setOriginConfirmed]=useState(false),[revoke,setRevoke]=useState<Origin|null>(null);
 const [busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const generation=useRef(0),controller=useRef<AbortController|null>(null),mutation=useRef<{fingerprint:string;requestId:string;approvalId:string}|null>(null);
 const invalidate=useCallback(()=>{generation.current++;controller.current?.abort();},[]);useWorkspaceNavigation(invalidate);
 function clearSelection(){setDetail(null);setEvidence([]);setConversations([]);setCustomers([]);setConversation('');setCustomer('');setProof('');setReason('');setConfirmed(false);}
 async function perform(work:(signal:AbortSignal,current:()=>boolean)=>Promise<void>){
  invalidate();const abort=new AbortController(),epoch=generation.current;controller.current=abort;const current=()=>!abort.signal.aborted&&epoch===generation.current;setBusy(true);setError('');
  try{await work(abort.signal,current);}catch(e){if(current()){setError(e instanceof RequestError?e.message:'No se pudo confirmar la respuesta. Recarga para comprobar el estado; no se reintenta automáticamente.');setConfirmed(false);setOriginConfirmed(false);if(e instanceof RequestError&&[401,403].includes(e.status)){clearSelection();setFacts([]);setOrigins([]);setCanApprove(false);}}}finally{if(current())setBusy(false);}
 }
 async function loadFacts(signal:AbortSignal,current:()=>boolean,params:typeof scope,state:string,cursor?:string){const data=await request<{items:Fact[];nextCursor:string|null;canResolve:boolean}>({view:'facts',limit:'25',...params,...(state?{state}:{}),...(cursor?{cursor}:{})},signal);if(current()){setFacts(previous=>cursor?unique(previous,data.items):data.items);setNext(data.nextCursor);}}
 async function loadOrigins(signal:AbortSignal,current:()=>boolean,cursor?:string){const data=await request<{items:Origin[];nextCursor:string|null;canApprove:boolean}>({view:'origins',limit:'25',...(cursor?{cursor}:{})},signal);if(current()){setOrigins(previous=>cursor?[...new Map([...previous,...data.items].map(x=>[x.approvalId,x])).values()]:data.items);setOriginNext(data.nextCursor);setCanApprove(data.canApprove);}}
 useEffect(()=>{
  const load=()=>{const params=new URLSearchParams(window.location.search),selected={...(params.has('conversationId')?{conversationId:params.get('conversationId')!}:{}),...(params.has('customerId')?{customerId:params.get('customerId')!}:{})};
   void perform(async(signal,current)=>{setScope(selected);setFilter('');clearSelection();await loadFacts(signal,current,selected,'');await loadOrigins(signal,current);});};
  const start=Promise.resolve().then(load);void start;window.addEventListener('popstate',load);return()=>{invalidate();window.removeEventListener('popstate',load);};
  // Initial URL and popstate define the scope. Explicit controls load their own state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[invalidate]);
 async function loadDetail(id:string,signal:AbortSignal,current:()=>boolean,extra:Record<string,string>={}){
  const data=await request<Detail>({view:'fact',factId:id,...extra},signal);if(!current())return;
  const append=detail?.fact.id===id&&detail.fact.version===data.fact.version&&Object.keys(extra).length>0;
  setDetail(data);setEvidence(previous=>append?unique(previous,data.evidence.items):data.evidence.items);setConversations(previous=>append?unique(previous,data.fact.candidates?.conversations??[]):data.fact.candidates?.conversations??[]);setCustomers(previous=>append?unique(previous,data.fact.candidates?.customers??[]):data.fact.candidates?.customers??[]);
  if(!append){setConversation('');setCustomer('');setProof('');setReason('');setConfirmed(false);}
 }
 async function mutate(body:Record<string,unknown>,signal:AbortSignal){const fingerprint=JSON.stringify(body);if(mutation.current?.fingerprint!==fingerprint)mutation.current={fingerprint,requestId:crypto.randomUUID(),approvalId:crypto.randomUUID()};const attempt=mutation.current!;return request({},signal,{...body,...(body.operation==='approve_origin'?{approvalId:attempt.approvalId}:{}),requestId:attempt.requestId});}
 async function resolve(decision:'bind'|'none',signal:AbortSignal,current:()=>boolean){
  if(!detail||!confirmed||!reason.trim()||!proof)throw new RequestError('Revisa la evidencia, justifica la decisión y confirma.',400);
  const c=conversations.find(x=>x.id===conversation),u=customers.find(x=>x.id===customer);if(decision==='bind'&&(!c||!u))throw new RequestError('Selecciona una conversación y un cliente verificados.',400);
  const targets=decision==='bind'&&c&&u?[{conversationId:c.id,customerId:u.id,conversationHeadVersion:c.headVersion,customerHeadVersion:u.headVersion,conversationRevisionId:c.revisionId,customerRevisionId:u.revisionId}]:[];
  await mutate({operation:'resolve',factId:detail.fact.id,expectedVersion:detail.fact.version,evidenceHash:proof,decision,targets,reason:reason.trim()},signal);if(!current())return;mutation.current=null;setNotice('Decisión guardada. Los vínculos se vuelven a comprobar al consultarlos.');await loadDetail(detail.fact.id,signal,current);await loadFacts(signal,current,scope,filter);
 }
 async function readOriginFile(file:File|undefined,signal:AbortSignal,current:()=>boolean){
  setOriginFile(null);setOriginName('');setOriginConfirmed(false);setRevoke(null);if(!file)return;if(file.size>16384)throw new RequestError('Selecciona un lote de origen de hasta 16 KiB y 16 importaciones.',413);
  const data=JSON.parse(await file.text()) as OriginFile;if(signal.aborted||!current())return;
  if(!data||Object.keys(data).sort().join(',')!=='entries,manifestHash'||!/^[a-f0-9]{64}$/.test(data.manifestHash)||!Array.isArray(data.entries)||!data.entries.length||data.entries.length>16)throw new RequestError('El archivo debe contener un manifiesto y entre 1 y 16 entradas de origen.',400);
  const fields=['importId','connectionId','fileHash','mappingVersion','provider','portalId','namespace','sourceManifestHash','sourceInventoryHash','sourceReceiptHash'].sort().join(',');
  if(data.entries.some(x=>!x||Object.keys(x).sort().join(',')!==fields||Object.values(x).some(v=>typeof v!=='string')))throw new RequestError('El lote de origen contiene entradas incompletas o campos desconocidos.',400);
  setOriginFile(data);setOriginName(file.name);
 }
 async function originAction(signal:AbortSignal,current:()=>boolean){if(!originConfirmed||!originReason.trim()||(!revoke&&!originFile))throw new RequestError('Revisa el lote y confirma la decisión.',400);
  await mutate(revoke?{operation:'revoke_origin',approvalId:revoke.approvalId,expectedVersion:revoke.version,reason:originReason.trim()}:{operation:'approve_origin',expectedVersion:0,...originFile,reason:originReason.trim()},signal);if(!current())return;mutation.current=null;setOriginConfirmed(false);setOriginFile(null);setOriginName('');setOriginText('');setRevoke(null);setOriginReason('');clearSelection();setNotice('Decisión de origen guardada. Revisa los vínculos con la autoridad actual.');await loadOrigins(signal,current);await loadFacts(signal,current,scope,filter);
 }
 return <section className="task-page" aria-labelledby="association-heading"><h2 id="association-heading">Vínculos entre conversaciones y clientes</h2><p>Las relaciones conservan sus pruebas de origen. Una fila importada puede seguir pendiente de resolución.</p>
  {error&&<p role="alert">{error}</p>}<p role="status" aria-live="polite">{busy?'Consultando vínculos…':notice}</p>
  {(scope.conversationId||scope.customerId)&&<p>Vista filtrada por {scope.conversationId?'conversación':'cliente'}. <Link href="/history">Ver todos los vínculos</Link></p>}
  <label>Estado del vínculo<select value={filter} disabled={busy} onChange={event=>{const state=event.target.value;setFilter(state);clearSelection();void perform((signal,current)=>loadFacts(signal,current,scope,state));}}><option value="">Todos los estados</option>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
  <button disabled={busy} onClick={()=>void perform(async(signal,current)=>{clearSelection();await loadFacts(signal,current,scope,filter);await loadOrigins(signal,current);})}>Recargar vínculos y comprobar estado</button>
  {facts.length?<ScrollTable label="Vínculos de conversaciones y clientes"><table><caption>Relaciones originales importadas</caption><thead><tr><th>Ticket</th><th>Contacto</th><th>Estado</th><th>Revisión</th></tr></thead><tbody>{facts.map(f=><tr key={f.id}><td>{f.ticket_id}</td><td>{f.contact_id}</td><td>{stateLabel(f.resolution_state)}{f.reason&&<small>{f.reason}</small>}</td><td><button disabled={busy} onClick={()=>void perform((signal,current)=>loadDetail(f.id,signal,current))}>Revisar vínculo {f.ticket_id} · {f.contact_id}</button></td></tr>)}</tbody></table></ScrollTable>:!busy&&!error&&<p>No hay vínculos para este filtro.</p>}
  {next&&<button disabled={busy} onClick={()=>void perform((signal,current)=>loadFacts(signal,current,scope,filter,next))}>Más vínculos</button>}
  {detail&&<section aria-label="Detalle del vínculo"><h3>Ticket {detail.fact.ticket_id} · Contacto {detail.fact.contact_id}</h3><p>{stateLabel(detail.fact.resolution_state)} · Versión {detail.fact.version}</p>{detail.sharedRawUnavailable&&<p>El archivo original compartido no está disponible por retención. Esto no acredita que las relaciones estén completas.</p>}
   <h4>Evidencia de origen</h4>{evidence.map(e=><article key={e.id} className="record-card"><p>Fila {e.row_ref} · {e.state} · {e.result.status}</p>{e.sharedRawUnavailable&&<p>Archivo original no disponible por retención.</p>}{e.result.evidence?.bridge&&<><p>Propiedad del ticket: {e.result.evidence.bridge.property.value??({missing:'Ausente',malformed:'Inválida'}[e.result.evidence.bridge.property.status]??'Desconocida')}</p><p>Referencias en notas: {e.result.evidence.bridge.notes.map(n=>n.gorgiasId).join(', ')||'Sin referencia explícita'}.</p>{e.result.evidence.bridge.archivedTicket&&<p>Ticket archivado.</p>}</>}{e.result.evidence&&<details><summary>Ver prueba y procedencia de esta fila</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(e.result.evidence,null,2)}</pre></details>}</article>)}
   {detail.evidence.nextCursor&&<button disabled={busy} onClick={()=>void perform((signal,current)=>loadDetail(detail.fact.id,signal,current,{evidenceCursor:detail.evidence.nextCursor!}))}>Más evidencia</button>}
   <h4>Vínculos vigentes</h4>{detail.bindings.length?<ul>{detail.bindings.map(b=><li key={b.id}>{b.current===true?'Vínculo vigente verificado':'No vigente'} · Conversación {b.conversation_id??b.conversationId} · Cliente {b.customer_id??b.customerId}</li>)}</ul>:<p>Sin vínculos vigentes verificados.</p>}
   {detail.canResolve&&detail.fact.resolution_state!=='retained'&&<fieldset disabled={busy}><legend>Decisión del propietario</legend><label>Evidencia para la decisión<select value={proof} onChange={e=>{setProof(e.target.value);setConfirmed(false);}}><option value="">Selecciona la evidencia revisada</option>{[...new Map(evidence.map(e=>[e.result.evidence_hash,e])).values()].map(e=><option key={e.result.evidence_hash} value={e.result.evidence_hash}>Fila {e.row_ref} · {e.result.evidence_hash.slice(0,12)}</option>)}</select></label>
    <label>Conversación verificada<select value={conversation} onChange={e=>{setConversation(e.target.value);setConfirmed(false);}}><option value="">Selecciona una conversación</option>{conversations.map(c=><option key={c.id} value={c.id}>{c.externalId} · origen {c.connectionId}</option>)}</select></label>
    <label>Cliente verificado<select value={customer} onChange={e=>{setCustomer(e.target.value);setConfirmed(false);}}><option value="">Selecciona un cliente</option>{customers.map(c=><option key={c.id} value={c.id}>{c.externalId} · origen {c.connectionId}</option>)}</select></label>
    {detail.fact.candidates?.nextCursor&&<button onClick={()=>void perform((signal,current)=>loadDetail(detail.fact.id,signal,current,{candidateCursor:detail.fact.candidates!.nextCursor!}))}>Más candidatos verificados</button>}
    {(!conversations.length||!customers.length)&&<p>Faltan candidatos con origen aprobado y revisiones vigentes. Revisa las aprobaciones de origen.</p>}
    <label>Motivo de la decisión<textarea value={reason} maxLength={1000} onChange={e=>{setReason(e.target.value);setConfirmed(false);}}/></label><label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Revisé la evidencia y confirmo esta decisión.</label>
    <button disabled={!confirmed||!proof||!reason.trim()||!conversation||!customer} onClick={()=>void perform((signal,current)=>resolve('bind',signal,current))}>Guardar vínculo seleccionado</button><button disabled={!confirmed||!proof||!reason.trim()} onClick={()=>void perform((signal,current)=>resolve('none',signal,current))}>Registrar que no corresponde vincular</button>
   </fieldset>}
  </section>}
  <section aria-labelledby="association-origin-heading"><h3 id="association-origin-heading">Origen aprobado de las importaciones</h3><p>La aprobación identifica qué archivos respaldan los clientes y conversaciones. Cada lote se revisa por separado.</p>
   {origins.length?<ul>{origins.map(o=><li key={o.approvalId}>Lote {o.manifestHash.slice(0,12)} · {o.entries.length} entradas · {o.state==='approved'?'Aprobado':'Revocado'}{canApprove&&o.state==='approved'&&<button disabled={busy} onClick={()=>{setRevoke(o);setOriginFile(null);setOriginText('');setOriginConfirmed(false);setOriginReason('');}}>Revisar revocación de este lote</button>}</li>)}</ul>:!busy&&!error&&<p>No hay lotes de origen aprobados.</p>}
   {originNext&&<button disabled={busy} onClick={()=>void perform((signal,current)=>loadOrigins(signal,current,originNext))}>Más lotes de origen</button>}
   {canApprove&&<fieldset disabled={busy}><legend>Revisar aprobación de origen</legend><label>Archivo del lote de origen<input type="file" accept="application/json,.json" onChange={e=>{const file=e.target.files?.[0];setOriginText('');void perform((signal,current)=>readOriginFile(file,signal,current));}}/></label>
    <label>JSON del lote de origen<textarea value={originText} spellCheck={false} autoComplete="off" onChange={e=>{setOriginText(e.target.value);setOriginFile(null);setOriginName('');setOriginConfirmed(false);setOriginReason('');setRevoke(null);}}/></label><p>Pega el contenido completo del lote revisado. Máximo 16 KiB y 16 importaciones.</p>
    <button disabled={!originText.trim()} onClick={()=>void perform((signal,current)=>readOriginFile(new File([originText],'lote-pegado.json',{type:'application/json'}),signal,current))}>Validar JSON del lote de origen</button>
    {originFile&&<><p>{originName} · {originFile.entries.length} importaciones. Manifiesto: {originFile.manifestHash}</p><ScrollTable label="Entradas del lote de origen"><table><thead><tr><th>Tipo de origen</th><th>Portal</th><th>Importación</th><th>Archivo verificado</th></tr></thead><tbody>{originFile.entries.map((e,i)=><tr key={i}><td>{e.namespace}</td><td>{e.portalId}</td><td>{e.importId}</td><td>{e.fileHash}</td></tr>)}</tbody></table></ScrollTable></>}
    {revoke&&<p>Vas a revocar el lote {revoke.manifestHash}. Sus vínculos dependientes dejarán de ser válidos.</p>}
    {(originFile||revoke)&&<><label>Motivo de la aprobación o revocación<textarea value={originReason} maxLength={1000} onChange={e=>{setOriginReason(e.target.value);setOriginConfirmed(false);}}/></label><label><input type="checkbox" checked={originConfirmed} onChange={e=>setOriginConfirmed(e.target.checked)}/>{revoke?'Confirmo la revocación de este lote.':'Revisé los archivos originales, su procedencia y este lote completo.'}</label><button disabled={!originConfirmed||!originReason.trim()} onClick={()=>void perform(originAction)}>{revoke?'Confirmar revocación del origen':'Aprobar lote de origen revisado'}</button></>}
   </fieldset>}
  </section>
 </section>;
}
