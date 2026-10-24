'use client';
import {useAutoRefresh} from './ui/use-auto-refresh';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link,{useWorkspaceNavigation} from './workspace/navigation-lifecycle';
import {ScrollTable} from './workspace/scroll-table';
import {Button} from './ui/button';
import {Drawer} from './ui/overlay';
import {SegmentedControl} from './ui/segmented';
import {StatusChip} from './ui/status-chip';
import {StatCard} from './ui/stat-card';
import {EmptyState} from './ui/empty-state';
import {Icon} from './ui/icons';
import {nf} from './ui/format';
import {useJson} from './ui/use-json';
import styles from './history.module.css';
import {ESTADO_VINCULO,FILTROS_VINCULO,motivoVinculo,detalleAsociaciones} from '../lib/history/historico.mjs';

type Fact={id:string;ticket_id:string;contact_id:string;provider:string;portal_id:string;source_connection_id:string;resolution_state:string;reason:string|null;version:number;selected_evidence_hash:string|null;first_evidence_hash:string};
type Candidate={id:string;connectionId:string;externalId:string;headVersion:number;revisionId:string};
type Evidence={id:string;import_id:string;row_ref:string|number;state:string;result:{evidence_hash:string;status:string;evidence?:{nativePair?:unknown;source?:unknown;bridge?:{property:{status:string;value:string|null};notes:{gorgiasId:string}[];archivedTicket:boolean}}};sharedRawUnavailable?:boolean};
type Binding={id:string;conversation_id?:string;customer_id?:string;conversationId?:string;customerId?:string;active?:boolean;current?:boolean;state?:string};
type Detail={fact:Fact&{candidates?:{conversations:Candidate[];customers:Candidate[];nextCursor:string|null}};evidence:{items:Evidence[];nextCursor:string|null};bindings:Binding[];canResolve:boolean;sharedRawUnavailable:boolean};
type Entry={importId:string;connectionId:string;fileHash:string;mappingVersion:string;provider:string;portalId:string;namespace:string;sourceManifestHash:string;sourceInventoryHash:string;sourceReceiptHash:string};
type Origin={approvalId:string;version:number;state:string;manifestHash:string;entries:Entry[];entryHashes:string[]};
type OriginFile={manifestHash:string;entries:Entry[]};
const unique=<T extends {id:string}>(old:T[],next:T[])=>[...new Map([...old,...next].map(x=>[x.id,x])).values()];
const stateLabel=(state:string)=>ESTADO_VINCULO[state]??'Estado por revisar';
const stateTone=(state:string)=>state==='resolved'?'ok':state==='blocked'?'bad':state==='retained'?'muted':'warn';
const FILTERS=[...FILTROS_VINCULO];
class RequestError extends Error {constructor(message:string,public status:number){super(message);}}
async function request<T>(params:Record<string,string>,signal:AbortSignal,body?:unknown):Promise<T>{
 const response=await fetch('/api/associations?'+new URLSearchParams(params),{method:body===undefined?'GET':'POST',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal});
 const result=await response.json();if(!response.ok){const message=response.status===409?'La información cambió. Recarga y revisa la selección antes de decidir.':response.status===401||response.status===403?'Tu acceso no permite esta acción. Revisa la sesión y el espacio seleccionado.':response.status===413?'La respuesta o el archivo excede el límite permitido. Revisa el lote.':'No se pudo completar la consulta o acción.';throw new RequestError(message+' '+(result.error?.code??''),response.status);}return result.data as T;
}
export function AssociationPanel(){
 const [facts,setFacts]=useState<Fact[]>([]),[next,setNext]=useState<string|null>(null),[filter,setFilter]=useState(''),[scope,setScope]=useState<{conversationId?:string;customerId?:string}>({});
 const [detail,setDetail]=useState<Detail|null>(null),[evidence,setEvidence]=useState<Evidence[]>([]),[conversations,setConversations]=useState<Candidate[]>([]),[customers,setCustomers]=useState<Candidate[]>([]);
 const [conversation,setConversation]=useState(''),[customer,setCustomer]=useState(''),[proof,setProof]=useState(''),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false);
 const [canResolveFacts,setCanResolveFacts]=useState(false),[origins,setOrigins]=useState<Origin[]>([]),[originNext,setOriginNext]=useState<string|null>(null),[canApprove,setCanApprove]=useState(false),[originFile,setOriginFile]=useState<OriginFile|null>(null),[originName,setOriginName]=useState(''),[originText,setOriginText]=useState(''),[originReason,setOriginReason]=useState(''),[originConfirmed,setOriginConfirmed]=useState(false),[revoke,setRevoke]=useState<Origin|null>(null);
 const [busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[originOpen,setOriginOpen]=useState(false);
 const {data:assoc}=useJson<{total:number;incorporated:number;detail:string[]}>('/api/coverage',j=>{const list=(j as {data?:{sources?:{key:string;total:number;incorporated:number;detail:string[]}[]}})?.data?.sources;const a=Array.isArray(list)?list.find(x=>x.key==='associations'):null;return a&&a.total>0?{total:a.total,incorporated:a.incorporated,detail:a.detail??[]}:null;});
 const generation=useRef(0),controller=useRef<AbortController|null>(null),mutation=useRef<{fingerprint:string;requestId:string;approvalId:string}|null>(null);
 const invalidate=useCallback(()=>{generation.current++;controller.current?.abort();},[]);useWorkspaceNavigation(invalidate);
 function clearSelection(){setDetail(null);setEvidence([]);setConversations([]);setCustomers([]);setConversation('');setCustomer('');setProof('');setReason('');setConfirmed(false);}
 async function perform(work:(signal:AbortSignal,current:()=>boolean)=>Promise<void>){
  invalidate();const abort=new AbortController(),epoch=generation.current;controller.current=abort;const current=()=>!abort.signal.aborted&&epoch===generation.current;setBusy(true);setError('');
  try{await work(abort.signal,current);}catch(e){if(current()){setError(e instanceof RequestError?e.message:'No se pudo confirmar la respuesta. Recarga para comprobar el estado; no se reintenta automáticamente.');setConfirmed(false);setOriginConfirmed(false);if(e instanceof RequestError&&[401,403].includes(e.status)){clearSelection();setFacts([]);setOrigins([]);setCanApprove(false);}}}finally{if(current())setBusy(false);}
 }
 async function loadFacts(signal:AbortSignal,current:()=>boolean,params:typeof scope,state:string,cursor?:string){const data=await request<{items:Fact[];nextCursor:string|null;canResolve:boolean}>({view:'facts',limit:'25',...params,...(state?{state}:{}),...(cursor?{cursor}:{})},signal);if(current()){setFacts(previous=>cursor?unique(previous,data.items):data.items);setNext(data.nextCursor);setCanResolveFacts(data.canResolve===true);}}
 async function loadOrigins(signal:AbortSignal,current:()=>boolean,cursor?:string){const data=await request<{items:Origin[];nextCursor:string|null;canApprove:boolean}>({view:'origins',limit:'25',...(cursor?{cursor}:{})},signal);if(current()){setOrigins(previous=>cursor?[...new Map([...previous,...data.items].map(x=>[x.approvalId,x])).values()]:data.items);setOriginNext(data.nextCursor);setCanApprove(data.canApprove);}}
 // Datos nuevos: relectura en segundo plano de vínculos y orígenes; conserva la selección y el formulario, y no corre durante una operación ni tras paginar.
 const busyRef=useRef(true),scopeRef=useRef(scope),filterRef=useRef(filter);busyRef.current=busy||facts.length>25||origins.length>25;scopeRef.current=scope;filterRef.current=filter;
 useAutoRefresh(async()=>{if(busyRef.current)return;const abort=new AbortController(),epoch=generation.current,current=()=>!abort.signal.aborted&&epoch===generation.current&&!busyRef.current;try{await loadFacts(abort.signal,current,scopeRef.current,filterRef.current);await loadOrigins(abort.signal,current);}catch{/* se conserva lo pintado */}},{ocupado:()=>busyRef.current});
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
  await mutate(revoke?{operation:'revoke_origin',approvalId:revoke.approvalId,expectedVersion:revoke.version,reason:originReason.trim()}:{operation:'approve_origin',expectedVersion:0,...originFile,reason:originReason.trim()},signal);if(!current())return;mutation.current=null;setOriginConfirmed(false);setOriginFile(null);setOriginName('');setOriginText('');setRevoke(null);setOriginReason('');clearSelection();setNotice('Decisión de origen guardada. Revisa los vínculos con la autoridad actual.');setOriginOpen(false);await loadOrigins(signal,current);await loadFacts(signal,current,scope,filter);
 }
 const closeDetail=()=>clearSelection();
 const closeOrigin=()=>{setOriginOpen(false);setOriginFile(null);setOriginName('');setOriginText('');setOriginReason('');setOriginConfirmed(false);setRevoke(null);};
 return <section className="task-page stack" aria-labelledby="association-heading"><div className="card-title"><div><h2 id="association-heading">Vínculos entre conversaciones y clientes</h2><p>Relaciona cada ticket con el cliente al que pertenece. Los vínculos con certeza se usan en el análisis; el resto queda sin identificar hasta tener evidencia.</p></div></div>
  {error&&<p role="alert" className="state state-error">{error}</p>}<p role="status" aria-live="polite" className={busy||notice?'notice-bar':'sr-only'} data-tone="info">{busy?'Consultando vínculos…':notice}</p>
  {assoc&&<div className="stat-grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))'}}><StatCard icon="link" label="Relaciones ticket–contacto" kind="observed" value={nf.format(assoc.total)} foot={detalleAsociaciones(assoc.detail[0])}/>{/^[\d.,]+ /.test(assoc.detail[1]??'')&&<StatCard icon="users" label="Vínculos conversación–cliente" kind="observed" value={assoc.detail[1].split(' ')[0]} foot={assoc.detail[1].split(' ').slice(1).join(' ')}/>}</div>}
  {(scope.conversationId||scope.customerId)&&<p>Vista filtrada por {scope.conversationId?'conversación':'cliente'}. <Link href="/history">Ver todos los vínculos</Link></p>}
  <details className={styles.tech}><summary>Ver detalle técnico: tickets y contactos</summary>
  <div className="toolbar"><SegmentedControl label="Estado del vínculo" size="sm" value={filter} onChange={state=>{if(busy)return;setFilter(state);clearSelection();void perform((signal,current)=>loadFacts(signal,current,scope,state));}} options={FILTERS}/><span className="toolbar-spacer"/></div>
  {facts.length?<section className="card"><ScrollTable label="Vínculos de conversaciones y clientes"><table className="dtable"><caption className="sr-only">Relaciones originales importadas</caption><thead><tr><th>Ticket</th><th>Contacto</th><th>Estado</th>{canResolveFacts&&<th>Revisión</th>}</tr></thead><tbody>{facts.map(f=><tr key={f.id}><td><code>{f.ticket_id}</code></td><td><code>{f.contact_id}</code></td><td><StatusChip tone={stateTone(f.resolution_state)}>{stateLabel(f.resolution_state)}</StatusChip>{f.reason&&<small className={styles.note}> {motivoVinculo(f.reason)}</small>}</td>{canResolveFacts&&<td><Button size="sm" disabled={busy} aria-label={'Revisar vínculo '+f.ticket_id+' · '+f.contact_id} onClick={()=>void perform((signal,current)=>loadDetail(f.id,signal,current))}>Revisar</Button></td>}</tr>)}</tbody></table></ScrollTable></section>:!busy&&!error&&<EmptyState art="link" compact title="No hay vínculos para este filtro" body="Cuando se importen relaciones ticket–contacto aparecerán aquí."/>}
  {next&&<div className="btn-group"><Button disabled={busy} onClick={()=>void perform((signal,current)=>loadFacts(signal,current,scope,filter,next))}>Más vínculos</Button></div>}
  </details>
  <Drawer open={!!detail} onClose={closeDetail} width={600} title={detail?'Ticket '+detail.fact.ticket_id+' · Contacto '+detail.fact.contact_id:''} subtitle={detail&&<><StatusChip tone={stateTone(detail.fact.resolution_state)}>{stateLabel(detail.fact.resolution_state)}</StatusChip> · Versión {detail.fact.version}</>}>
   {detail&&<section className="stack" aria-label="Detalle del vínculo">{detail.sharedRawUnavailable&&<p className="notice-bar" data-tone="warn"><Icon name="info" size={14}/>El archivo original compartido no está disponible por retención. Esto no acredita que las relaciones estén completas.</p>}
   <h3>Evidencia de origen</h3>{evidence.map(e=><article key={e.id} className="record-card"><p>Fila {e.row_ref} · {e.state} · {e.result.status}</p>{e.sharedRawUnavailable&&<p>Archivo original no disponible por retención.</p>}{e.result.evidence?.bridge&&<><p>Propiedad del ticket: {e.result.evidence.bridge.property.value??({missing:'Ausente',malformed:'Inválida'}[e.result.evidence.bridge.property.status]??'Desconocida')}</p><p>Referencias en notas: {e.result.evidence.bridge.notes.map(n=>n.gorgiasId).join(', ')||'Sin referencia explícita'}.</p>{e.result.evidence.bridge.archivedTicket&&<p>Ticket archivado.</p>}</>}{e.result.evidence&&<details><summary>Ver prueba y procedencia de esta fila</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(e.result.evidence,null,2)}</pre></details>}</article>)}
   {detail.evidence.nextCursor&&<div className="btn-group"><Button size="sm" disabled={busy} onClick={()=>void perform((signal,current)=>loadDetail(detail.fact.id,signal,current,{evidenceCursor:detail.evidence.nextCursor!}))}>Más evidencia</Button></div>}
   <h3>Vínculos vigentes</h3>{detail.bindings.length?<ul className="row-list">{detail.bindings.map(b=><li key={b.id}>{b.current===true?'Vínculo vigente verificado':'No vigente'} · Conversación {b.conversation_id??b.conversationId} · Cliente {b.customer_id??b.customerId}</li>)}</ul>:<p>Sin vínculos vigentes verificados.</p>}
   {detail.canResolve&&detail.fact.resolution_state!=='retained'&&<fieldset disabled={busy} className="form-grid"><legend>Decisión del propietario</legend><label className="field field-wide">Evidencia para la decisión<select value={proof} onChange={e=>{setProof(e.target.value);setConfirmed(false);}}><option value="">Selecciona la evidencia revisada</option>{[...new Map(evidence.map(e=>[e.result.evidence_hash,e])).values()].map(e=><option key={e.result.evidence_hash} value={e.result.evidence_hash}>Fila {e.row_ref} · {e.result.evidence_hash.slice(0,12)}</option>)}</select></label>
    <label className="field field-wide">Conversación verificada<select value={conversation} onChange={e=>{setConversation(e.target.value);setConfirmed(false);}}><option value="">Selecciona una conversación</option>{conversations.map(c=><option key={c.id} value={c.id}>{c.externalId} · origen {c.connectionId}</option>)}</select></label>
    <label className="field field-wide">Cliente verificado<select value={customer} onChange={e=>{setCustomer(e.target.value);setConfirmed(false);}}><option value="">Selecciona un cliente</option>{customers.map(c=><option key={c.id} value={c.id}>{c.externalId} · origen {c.connectionId}</option>)}</select></label>
    {detail.fact.candidates?.nextCursor&&<div className="field-wide"><Button size="sm" onClick={()=>void perform((signal,current)=>loadDetail(detail.fact.id,signal,current,{candidateCursor:detail.fact.candidates!.nextCursor!}))}>Más candidatos verificados</Button></div>}
    {(!conversations.length||!customers.length)&&<p className="form-note field-wide">Faltan candidatos con origen aprobado y revisiones vigentes. Revisa las aprobaciones de origen.</p>}
    <label className="field field-wide">Motivo de la decisión<textarea rows={3} value={reason} maxLength={1000} onChange={e=>{setReason(e.target.value);setConfirmed(false);}}/></label><label className="check-chip field-wide"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>Revisé la evidencia y confirmo esta decisión.</span></label>
    <div className="btn-group field-wide"><Button variant="primary" disabled={!confirmed||!proof||!reason.trim()||!conversation||!customer} onClick={()=>void perform((signal,current)=>resolve('bind',signal,current))}>Guardar vínculo seleccionado</Button><Button disabled={!confirmed||!proof||!reason.trim()} onClick={()=>void perform((signal,current)=>resolve('none',signal,current))}>Registrar que no corresponde vincular</Button></div>
   </fieldset>}
  </section>}</Drawer>
  {canApprove&&<details className={styles.tech} open={originOpen}><summary>Herramientas del propietario: origen de las importaciones</summary>
  <section className="card" aria-labelledby="association-origin-heading"><div className="card-title"><div><h3 id="association-origin-heading">Origen aprobado de las importaciones</h3><p>La aprobación identifica qué archivos respaldan los clientes y conversaciones.</p></div>{canApprove&&<Button size="sm" disabled={busy} icon={<Icon name="shield" size={14}/>} onClick={()=>{setRevoke(null);setOriginOpen(true);}}>Revisar aprobación de origen</Button>}</div>
   {origins.length?<ul className="row-list">{origins.map(o=><li key={o.approvalId} className={styles.originRow}><span>Lote de origen ({o.entries.length} importaciones, ref. {o.manifestHash.slice(0,8)}) · <StatusChip tone={o.state==='approved'?'ok':'muted'}>{o.state==='approved'?'Aprobado':'Revocado'}</StatusChip></span>{canApprove&&o.state==='approved'&&<Button size="sm" variant="ghost" disabled={busy} onClick={()=>{setRevoke(o);setOriginFile(null);setOriginText('');setOriginConfirmed(false);setOriginReason('');setOriginOpen(true);}}>Revocar aprobación</Button>}</li>)}</ul>:!busy&&!error&&<EmptyState art="shield" compact title="No hay lotes de origen aprobados" body="Un propietario puede aprobar el lote de origen de las importaciones."/>}
   {originNext&&<div className="btn-group"><Button disabled={busy} onClick={()=>void perform((signal,current)=>loadOrigins(signal,current,originNext))}>Más lotes de origen</Button></div>}
  </section>
  </details>}
  <Drawer open={originOpen&&canApprove} onClose={closeOrigin} width={600} title={revoke?'Revocar lote de origen':'Revisar aprobación de origen'} subtitle="Cada lote se revisa por separado.">
   <fieldset disabled={busy} className="form-grid"><legend className="sr-only">Revisar aprobación de origen</legend>{!revoke&&<><label className="field field-wide">Archivo del lote de origen<input type="file" accept="application/json,.json" onChange={e=>{const file=e.target.files?.[0];setOriginText('');void perform((signal,current)=>readOriginFile(file,signal,current));}}/></label>
    <label className="field field-wide">JSON del lote de origen<textarea rows={4} value={originText} spellCheck={false} autoComplete="off" onChange={e=>{setOriginText(e.target.value);setOriginFile(null);setOriginName('');setOriginConfirmed(false);setOriginReason('');setRevoke(null);}}/></label><p className="form-note field-wide">Pega el contenido completo del lote revisado. Máximo 16 KiB y 16 importaciones.</p>
    <div className="field-wide"><Button size="sm" disabled={!originText.trim()} onClick={()=>void perform((signal,current)=>readOriginFile(new File([originText],'lote-pegado.json',{type:'application/json'}),signal,current))}>Validar JSON del lote de origen</Button></div></>}
    {originFile&&<div className="field-wide stack"><p>{originName} · {originFile.entries.length} importaciones. Manifiesto: {originFile.manifestHash}</p><ScrollTable label="Entradas del lote de origen"><table className="dtable"><thead><tr><th>Tipo de origen</th><th>Portal</th><th>Importación</th><th>Archivo verificado</th></tr></thead><tbody>{originFile.entries.map((e,i)=><tr key={i}><td>{e.namespace}</td><td>{e.portalId}</td><td>{e.importId}</td><td>{e.fileHash}</td></tr>)}</tbody></table></ScrollTable></div>}
    {revoke&&<p className="notice-bar field-wide" data-tone="warn"><Icon name="alert" size={14}/>Vas a revocar el lote {revoke.manifestHash}. Sus vínculos dependientes dejarán de ser válidos.</p>}
    {(originFile||revoke)&&<><label className="field field-wide">Motivo de la aprobación o revocación<textarea rows={3} value={originReason} maxLength={1000} onChange={e=>{setOriginReason(e.target.value);setOriginConfirmed(false);}}/></label><label className="check-chip field-wide"><input type="checkbox" checked={originConfirmed} onChange={e=>setOriginConfirmed(e.target.checked)}/><span>{revoke?'Confirmo la revocación de este lote.':'Revisé los archivos originales, su procedencia y este lote completo.'}</span></label><div className="field-wide"><Button variant="primary" disabled={!originConfirmed||!originReason.trim()} onClick={()=>void perform(originAction)}>{revoke?'Confirmar revocación del origen':'Aprobar lote de origen revisado'}</Button></div></>}
   </fieldset>
  </Drawer>
 </section>;
}
