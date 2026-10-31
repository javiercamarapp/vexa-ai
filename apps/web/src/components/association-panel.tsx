'use client';
import {RovaqCargando} from './rovaq-cargando';
import {useAutoRefresh} from './ui/use-auto-refresh';
import {useLayoutEffect,useCallback,useEffect,useRef,useState} from 'react';
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
import {FILTROS_VINCULO,motivoVinculo,detalleAsociaciones} from '../lib/history/historico.mjs';
import {useT} from './i18n/proveedor';
import type {Clave} from '../lib/i18n';

type Fact={id:string;ticket_id:string;contact_id:string;provider:string;portal_id:string;source_connection_id:string;resolution_state:string;reason:string|null;version:number;selected_evidence_hash:string|null;first_evidence_hash:string};
type Candidate={id:string;connectionId:string;externalId:string;headVersion:number;revisionId:string};
type Evidence={id:string;import_id:string;row_ref:string|number;state:string;result:{evidence_hash:string;status:string;evidence?:{nativePair?:unknown;source?:unknown;bridge?:{property:{status:string;value:string|null};notes:{gorgiasId:string}[];archivedTicket:boolean}}};sharedRawUnavailable?:boolean};
type Binding={id:string;conversation_id?:string;customer_id?:string;conversationId?:string;customerId?:string;active?:boolean;current?:boolean;state?:string};
type Detail={fact:Fact&{candidates?:{conversations:Candidate[];customers:Candidate[];nextCursor:string|null}};evidence:{items:Evidence[];nextCursor:string|null};bindings:Binding[];canResolve:boolean;sharedRawUnavailable:boolean};
type Entry={importId:string;connectionId:string;fileHash:string;mappingVersion:string;provider:string;portalId:string;namespace:string;sourceManifestHash:string;sourceInventoryHash:string;sourceReceiptHash:string};
type Origin={approvalId:string;version:number;state:string;manifestHash:string;entries:Entry[];entryHashes:string[]};
type OriginFile={manifestHash:string;entries:Entry[]};
const unique=<T extends {id:string}>(old:T[],next:T[])=>[...new Map([...old,...next].map(x=>[x.id,x])).values()];
const ESTADO_K:Record<string,Clave>={pending:'tr.assoc.sPending',resolved:'tr.assoc.sResolved',blocked:'tr.assoc.sBlocked',retained:'tr.assoc.sRetained'};
const FILTRO_K:Record<string,Clave>={'':'tr.assoc.fTodos',pending:'tr.assoc.sPending',resolved:'tr.assoc.fVinculados',blocked:'tr.assoc.fPorRevisar',retained:'tr.assoc.fRetenidos'};
const stateTone=(state:string)=>state==='resolved'?'ok':state==='blocked'?'bad':state==='retained'?'muted':'warn';
const FILTERS=[...FILTROS_VINCULO];
class RequestError extends Error {constructor(public key:Clave,public status:number,public suffix='',public vars?:Record<string,number>){super(key);}}
async function request<T>(params:Record<string,string>,signal:AbortSignal,body?:unknown):Promise<T>{
 const response=await fetch('/api/associations?'+new URLSearchParams(params),{method:body===undefined?'GET':'POST',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal});
 const result=await response.json();if(!response.ok){const message:Clave=response.status===409?'tr.assoc.e409':response.status===401||response.status===403?'tr.assoc.e401':response.status===413?'tr.assoc.e413':'tr.assoc.eGenerico';throw new RequestError(message,response.status,' '+(result.error?.code??''));}return result.data as T;
}
export function AssociationPanel(){
 const t=useT();
 const stateLabel=(state:string)=>t(ESTADO_K[state]??'tr.assoc.sDefault');
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
  try{await work(abort.signal,current);}catch(e){if(current()){setError(e instanceof RequestError?t(e.key,e.vars)+e.suffix:t('tr.assoc.noConfirmar'));setConfirmed(false);setOriginConfirmed(false);if(e instanceof RequestError&&[401,403].includes(e.status)){clearSelection();setFacts([]);setOrigins([]);setCanApprove(false);}}}finally{if(current())setBusy(false);}
 }
 async function loadFacts(signal:AbortSignal,current:()=>boolean,params:typeof scope,state:string,cursor?:string){const data=await request<{items:Fact[];nextCursor:string|null;canResolve:boolean}>({view:'facts',limit:'25',...params,...(state?{state}:{}),...(cursor?{cursor}:{})},signal);if(current()){setFacts(previous=>cursor?unique(previous,data.items):data.items);setNext(data.nextCursor);setCanResolveFacts(data.canResolve===true);}}
 async function loadOrigins(signal:AbortSignal,current:()=>boolean,cursor?:string){const data=await request<{items:Origin[];nextCursor:string|null;canApprove:boolean}>({view:'origins',limit:'25',...(cursor?{cursor}:{})},signal);if(current()){setOrigins(previous=>cursor?[...new Map([...previous,...data.items].map(x=>[x.approvalId,x])).values()]:data.items);setOriginNext(data.nextCursor);setCanApprove(data.canApprove);}}
 // Datos nuevos: relectura en segundo plano de vínculos y orígenes; conserva la selección y el formulario, y no corre durante una operación ni tras paginar.
 const busyRef=useRef(true),scopeRef=useRef(scope),filterRef=useRef(filter);useLayoutEffect(()=>{busyRef.current=busy||facts.length>25||origins.length>25;scopeRef.current=scope;filterRef.current=filter;});
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
  if(!detail||!confirmed||!reason.trim()||!proof)throw new RequestError('tr.assoc.revisaEvid',400);
  const c=conversations.find(x=>x.id===conversation),u=customers.find(x=>x.id===customer);if(decision==='bind'&&(!c||!u))throw new RequestError('tr.assoc.selConvCli',400);
  const targets=decision==='bind'&&c&&u?[{conversationId:c.id,customerId:u.id,conversationHeadVersion:c.headVersion,customerHeadVersion:u.headVersion,conversationRevisionId:c.revisionId,customerRevisionId:u.revisionId}]:[];
  await mutate({operation:'resolve',factId:detail.fact.id,expectedVersion:detail.fact.version,evidenceHash:proof,decision,targets,reason:reason.trim()},signal);if(!current())return;mutation.current=null;setNotice(t('tr.assoc.decisionGuardada'));await loadDetail(detail.fact.id,signal,current);await loadFacts(signal,current,scope,filter);
 }
 async function readOriginFile(file:File|undefined,signal:AbortSignal,current:()=>boolean){
  setOriginFile(null);setOriginName('');setOriginConfirmed(false);setRevoke(null);if(!file)return;if(file.size>16384)throw new RequestError('tr.assoc.lote16',413,'',{kib:16,n:16});
  const data=JSON.parse(await file.text()) as OriginFile;if(signal.aborted||!current())return;
  if(!data||Object.keys(data).sort().join(',')!=='entries,manifestHash'||!/^[a-f0-9]{64}$/.test(data.manifestHash)||!Array.isArray(data.entries)||!data.entries.length||data.entries.length>16)throw new RequestError('tr.assoc.archivoManifiesto',400,'',{min:1,max:16});
  const fields=['importId','connectionId','fileHash','mappingVersion','provider','portalId','namespace','sourceManifestHash','sourceInventoryHash','sourceReceiptHash'].sort().join(',');
  if(data.entries.some(x=>!x||Object.keys(x).sort().join(',')!==fields||Object.values(x).some(v=>typeof v!=='string')))throw new RequestError('tr.assoc.loteIncompleto',400);
  setOriginFile(data);setOriginName(file.name);
 }
 async function originAction(signal:AbortSignal,current:()=>boolean){if(!originConfirmed||!originReason.trim()||(!revoke&&!originFile))throw new RequestError('tr.assoc.revisaLote',400);
  await mutate(revoke?{operation:'revoke_origin',approvalId:revoke.approvalId,expectedVersion:revoke.version,reason:originReason.trim()}:{operation:'approve_origin',expectedVersion:0,...originFile,reason:originReason.trim()},signal);if(!current())return;mutation.current=null;setOriginConfirmed(false);setOriginFile(null);setOriginName('');setOriginText('');setRevoke(null);setOriginReason('');clearSelection();setNotice(t('tr.assoc.origenGuardado'));setOriginOpen(false);await loadOrigins(signal,current);await loadFacts(signal,current,scope,filter);
 }
 const closeDetail=()=>clearSelection();
 const closeOrigin=()=>{setOriginOpen(false);setOriginFile(null);setOriginName('');setOriginText('');setOriginReason('');setOriginConfirmed(false);setRevoke(null);};
 if(busy&&facts.length===0&&origins.length===0&&!error)return <RovaqCargando mensaje=""/>;
 return <section className="task-page stack" aria-labelledby="association-heading"><div className="card-title"><div><h2 id="association-heading">{t('tr.assoc.titulo')}</h2><p>{t('tr.assoc.desc')}</p></div></div>
  {error&&<p role="alert" className="state state-error">{error}</p>}<p role="status" aria-live="polite" className={busy||notice?'notice-bar':'sr-only'} data-tone="info">{busy?t('tr.assoc.consultando'):notice}</p>
  {assoc&&<div className="stat-grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))'}}><StatCard icon="link" label={t('tr.assoc.relTicket')} kind="observed" value={nf.format(assoc.total)} foot={detalleAsociaciones(assoc.detail[0],t)}/>{/^[\d.,]+ /.test(assoc.detail[1]??'')&&<StatCard icon="users" label={t('tr.assoc.vincConvCli')} kind="observed" value={assoc.detail[1].split(' ')[0]} foot={assoc.detail[1].split(' ').slice(1).join(' ')}/>}</div>}
  {(scope.conversationId||scope.customerId)&&<p>{scope.conversationId?t('tr.assoc.vistaFiltradaConv'):t('tr.assoc.vistaFiltradaCli')}<Link href="/history">{t('tr.assoc.verTodos')}</Link></p>}
  <details className={styles.tech}><summary>{t('tr.assoc.detalleTec')}</summary>
  <div className="toolbar"><SegmentedControl label={t('tr.assoc.estadoVinculo')} size="sm" value={filter} onChange={state=>{if(busy)return;setFilter(state);clearSelection();void perform((signal,current)=>loadFacts(signal,current,scope,state));}} options={FILTERS.map(o=>({...o,label:t(FILTRO_K[o.value]??'tr.assoc.sDefault')}))}/><span className="toolbar-spacer"/></div>
  {facts.length?<section className="card"><ScrollTable label={t('tr.assoc.tablaLabel')}><table className="dtable"><caption className="sr-only">{t('tr.assoc.relOriginales')}</caption><thead><tr><th>{t('tr.assoc.thTicket')}</th><th>{t('tr.assoc.thContacto')}</th><th>{t('tr.assoc.thEstado')}</th>{canResolveFacts&&<th>{t('tr.assoc.thRevision')}</th>}</tr></thead><tbody>{facts.map(f=><tr key={f.id}><td><code>{f.ticket_id}</code></td><td><code>{f.contact_id}</code></td><td><StatusChip tone={stateTone(f.resolution_state)}>{stateLabel(f.resolution_state)}</StatusChip>{f.reason&&<small className={styles.note}> {motivoVinculo(f.reason,t)}</small>}</td>{canResolveFacts&&<td><Button size="sm" disabled={busy} aria-label={t('tr.assoc.revisarVinculo',{ticket:f.ticket_id,contacto:f.contact_id})} onClick={()=>void perform((signal,current)=>loadDetail(f.id,signal,current))}>{t('tr.assoc.revisar')}</Button></td>}</tr>)}</tbody></table></ScrollTable></section>:!busy&&!error&&<EmptyState art="link" compact title={t('tr.assoc.sinVinculos')} body={t('tr.assoc.sinVinculosTxt')}/>}
  {next&&<div className="btn-group"><Button disabled={busy} onClick={()=>void perform((signal,current)=>loadFacts(signal,current,scope,filter,next))}>{t('tr.assoc.masVinculos')}</Button></div>}
  </details>
  <Drawer open={!!detail} onClose={closeDetail} width={600} title={detail?t('tr.assoc.drawerTitulo',{ticket:detail.fact.ticket_id,contacto:detail.fact.contact_id}):''} subtitle={detail&&<><StatusChip tone={stateTone(detail.fact.resolution_state)}>{stateLabel(detail.fact.resolution_state)}</StatusChip>{t('tr.assoc.versionN',{v:detail.fact.version})}</>}>
   {detail&&<section className="stack" aria-label={t('tr.assoc.detalleAria')}>{detail.sharedRawUnavailable&&<p className="notice-bar" data-tone="warn"><Icon name="info" size={14}/>{t('tr.assoc.rawNoDisp')}</p>}
   <h3>{t('tr.assoc.evidOrigen')}</h3>{evidence.map(e=><article key={e.id} className="record-card"><p>{t('tr.assoc.fila',{fila:e.row_ref,estado:e.state,res:e.result.status})}</p>{e.sharedRawUnavailable&&<p>{t('tr.assoc.rawRet')}</p>}{e.result.evidence?.bridge&&<><p>{t('tr.assoc.propTicket',{v:e.result.evidence.bridge.property.value??({missing:t('tr.assoc.ausente'),malformed:t('tr.assoc.invalida')}[e.result.evidence.bridge.property.status]??t('tr.assoc.desconocida'))})}</p><p>{t('tr.assoc.refNotas',{v:e.result.evidence.bridge.notes.map(n=>n.gorgiasId).join(', ')||t('tr.assoc.sinRefExpl')})}</p>{e.result.evidence.bridge.archivedTicket&&<p>{t('tr.assoc.ticketArch')}</p>}</>}{e.result.evidence&&<details><summary>{t('tr.assoc.verPrueba')}</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(e.result.evidence,null,2)}</pre></details>}</article>)}
   {detail.evidence.nextCursor&&<div className="btn-group"><Button size="sm" disabled={busy} onClick={()=>void perform((signal,current)=>loadDetail(detail.fact.id,signal,current,{evidenceCursor:detail.evidence.nextCursor!}))}>{t('tr.assoc.masEvid')}</Button></div>}
   <h3>{t('tr.assoc.vincVigentes')}</h3>{detail.bindings.length?<ul className="row-list">{detail.bindings.map(b=><li key={b.id}>{t('tr.assoc.bindLinea',{estado:b.current===true?t('tr.assoc.vigVerificado'):t('tr.assoc.noVigente'),conv:b.conversation_id??b.conversationId??'',cli:b.customer_id??b.customerId??''})}</li>)}</ul>:<p>{t('tr.assoc.sinVigentes')}</p>}
   {detail.canResolve&&detail.fact.resolution_state!=='retained'&&<fieldset disabled={busy} className="form-grid"><legend>{t('tr.assoc.decisionProp')}</legend><label className="field field-wide">{t('tr.assoc.evidDecision')}<select value={proof} onChange={e=>{setProof(e.target.value);setConfirmed(false);}}><option value="">{t('tr.assoc.selEvid')}</option>{[...new Map(evidence.map(e=>[e.result.evidence_hash,e])).values()].map(e=><option key={e.result.evidence_hash} value={e.result.evidence_hash}>{t('tr.assoc.filaHash',{fila:e.row_ref,hash:e.result.evidence_hash.slice(0,12)})}</option>)}</select></label>
    <label className="field field-wide">{t('tr.assoc.convVerif')}<select value={conversation} onChange={e=>{setConversation(e.target.value);setConfirmed(false);}}><option value="">{t('tr.assoc.selConv')}</option>{conversations.map(c=><option key={c.id} value={c.id}>{t('tr.assoc.candOrigen',{ext:c.externalId,conn:c.connectionId})}</option>)}</select></label>
    <label className="field field-wide">{t('tr.assoc.cliVerif')}<select value={customer} onChange={e=>{setCustomer(e.target.value);setConfirmed(false);}}><option value="">{t('tr.assoc.selCli')}</option>{customers.map(c=><option key={c.id} value={c.id}>{t('tr.assoc.candOrigen',{ext:c.externalId,conn:c.connectionId})}</option>)}</select></label>
    {detail.fact.candidates?.nextCursor&&<div className="field-wide"><Button size="sm" onClick={()=>void perform((signal,current)=>loadDetail(detail.fact.id,signal,current,{candidateCursor:detail.fact.candidates!.nextCursor!}))}>{t('tr.assoc.masCand')}</Button></div>}
    {(!conversations.length||!customers.length)&&<p className="form-note field-wide">{t('tr.assoc.faltanCand')}</p>}
    <label className="field field-wide">{t('tr.assoc.motivoDec')}<textarea rows={3} value={reason} maxLength={1000} onChange={e=>{setReason(e.target.value);setConfirmed(false);}}/></label><label className="check-chip field-wide"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>{t('tr.assoc.revisePConf')}</span></label>
    <div className="btn-group field-wide"><Button variant="primary" disabled={!confirmed||!proof||!reason.trim()||!conversation||!customer} onClick={()=>void perform((signal,current)=>resolve('bind',signal,current))}>{t('tr.assoc.guardarVinc')}</Button><Button disabled={!confirmed||!proof||!reason.trim()} onClick={()=>void perform((signal,current)=>resolve('none',signal,current))}>{t('tr.assoc.noCorresponde')}</Button></div>
   </fieldset>}
  </section>}</Drawer>
  {canApprove&&<details className={styles.tech} open={originOpen}><summary>{t('tr.assoc.herrProp')}</summary>
  <section className="card" aria-labelledby="association-origin-heading"><div className="card-title"><div><h3 id="association-origin-heading">{t('tr.assoc.origenAprobado')}</h3><p>{t('tr.assoc.aprobIdent')}</p></div>{canApprove&&<Button size="sm" disabled={busy} icon={<Icon name="shield" size={14}/>} onClick={()=>{setRevoke(null);setOriginOpen(true);}}>{t('tr.assoc.revisarAprob')}</Button>}</div>
   {origins.length?<ul className="row-list">{origins.map(o=><li key={o.approvalId} className={styles.originRow}><span>{t('tr.assoc.loteOrigen',{n:o.entries.length,ref:o.manifestHash.slice(0,8)})}<StatusChip tone={o.state==='approved'?'ok':'muted'}>{o.state==='approved'?t('tr.assoc.aprobado'):t('tr.assoc.revocado')}</StatusChip></span>{canApprove&&o.state==='approved'&&<Button size="sm" variant="ghost" disabled={busy} onClick={()=>{setRevoke(o);setOriginFile(null);setOriginText('');setOriginConfirmed(false);setOriginReason('');setOriginOpen(true);}}>{t('tr.assoc.revocarAprob')}</Button>}</li>)}</ul>:!busy&&!error&&<EmptyState art="shield" compact title={t('tr.assoc.sinLotes')} body={t('tr.assoc.sinLotesTxt')}/>}
   {originNext&&<div className="btn-group"><Button disabled={busy} onClick={()=>void perform((signal,current)=>loadOrigins(signal,current,originNext))}>{t('tr.assoc.masLotes')}</Button></div>}
  </section>
  </details>}
  <Drawer open={originOpen&&canApprove} onClose={closeOrigin} width={600} title={revoke?t('tr.assoc.revocarLote'):t('tr.assoc.revisarAprob')} subtitle={t('tr.assoc.cadaLote')}>
   <fieldset disabled={busy} className="form-grid"><legend className="sr-only">{t('tr.assoc.revisarAprob')}</legend>{!revoke&&<><label className="field field-wide">{t('tr.assoc.archivoLote')}<input type="file" accept="application/json,.json" onChange={e=>{const file=e.target.files?.[0];setOriginText('');void perform((signal,current)=>readOriginFile(file,signal,current));}}/></label>
    <label className="field field-wide">{t('tr.assoc.jsonLote')}<textarea rows={4} value={originText} spellCheck={false} autoComplete="off" onChange={e=>{setOriginText(e.target.value);setOriginFile(null);setOriginName('');setOriginConfirmed(false);setOriginReason('');setRevoke(null);}}/></label><p className="form-note field-wide">{t('tr.assoc.pegaContenido',{kib:16,n:16})}</p>
    <div className="field-wide"><Button size="sm" disabled={!originText.trim()} onClick={()=>void perform((signal,current)=>readOriginFile(new File([originText],'lote-pegado.json',{type:'application/json'}),signal,current))}>{t('tr.assoc.validarJson')}</Button></div></>}
    {originFile&&<div className="field-wide stack"><p>{t('tr.assoc.loteImp',{nombre:originName,n:originFile.entries.length,hash:originFile.manifestHash})}</p><ScrollTable label={t('tr.assoc.entradasLote')}><table className="dtable"><thead><tr><th>{t('tr.assoc.thTipoOrigen')}</th><th>{t('tr.assoc.thPortal')}</th><th>{t('tr.assoc.thImportacion')}</th><th>{t('tr.assoc.thArchivoVerif')}</th></tr></thead><tbody>{originFile.entries.map((e,i)=><tr key={i}><td>{e.namespace}</td><td>{e.portalId}</td><td>{e.importId}</td><td>{e.fileHash}</td></tr>)}</tbody></table></ScrollTable></div>}
    {revoke&&<p className="notice-bar field-wide" data-tone="warn"><Icon name="alert" size={14}/>{t('tr.assoc.vasRevocar',{hash:revoke.manifestHash})}</p>}
    {(originFile||revoke)&&<><label className="field field-wide">{t('tr.assoc.motivoAprob')}<textarea rows={3} value={originReason} maxLength={1000} onChange={e=>{setOriginReason(e.target.value);setOriginConfirmed(false);}}/></label><label className="check-chip field-wide"><input type="checkbox" checked={originConfirmed} onChange={e=>setOriginConfirmed(e.target.checked)}/><span>{revoke?t('tr.assoc.confirmoRevoc'):t('tr.assoc.reviseArchivos')}</span></label><div className="field-wide"><Button variant="primary" disabled={!originConfirmed||!originReason.trim()} onClick={()=>void perform(originAction)}>{revoke?t('tr.assoc.confirmarRevoc'):t('tr.assoc.aprobarLote')}</Button></div></>}
   </fieldset>
  </Drawer>
 </section>;
}
