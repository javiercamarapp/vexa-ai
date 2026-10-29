'use client';
import {RovaqCargando} from './rovaq-cargando';
import {useAutoRefresh} from './ui/use-auto-refresh';
import {useLayoutEffect,useCallback,useEffect,useRef,useState} from 'react';
import type {AliasEvent,AliasIdentity} from '../../../../packages/connectors/aliases.mjs';
import {MigrationComparison} from './migration-comparison';
import {Button} from './ui/button';
import {KpiLinea} from './panel-comun/kpi-linea';
import './panel-comun/panel-comun.css';
import {StatusChip} from './ui/status-chip';
import {DonutChart} from './ui/donut-chart';
import {EmptyState} from './ui/empty-state';
import {IdChip} from './ui/id-chip';
import {Timeline} from './ui/timeline';
import {Icon} from './ui/icons';
import {useT} from './i18n/proveedor';
import type {Traductor} from '../lib/i18n';
import {nf} from './ui/format';
import css from './ops-panels.module.css';
type Conversation={id:string;source:string;accountId:string;externalId:string;revisionState:string|null};
type Listing={conversations:Conversation[];groups:Array<{canonical_id:string;conversation_ids:string[]}>|null;projectionState:'resolved'|'unresolved';canPropose:boolean;canApprove:boolean;nextCursor:string|null};
type Proposal={source:AliasIdentity;target:AliasIdentity;expectedVersion:number;legacyUnresolved:boolean};
async function api(t:Traductor,body?:unknown,query='',signal?:AbortSignal){
 const response=await fetch('/api/migrations/aliases'+query,{method:body===undefined?'GET':'POST',cache:'no-store',signal,headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 if(!response.ok)throw Object.assign(Error(response.status===409?t('tr.ma.e409'):response.status===403?t('tr.ma.e403'):response.status===400?t('tr.ma.e400'):t('tr.ma.eServicio')),{status:response.status});
 return response.json();
}
export function MigrationAliases({onChange}:{onChange:()=>void}){
 const t=useT();
 const historyRequest=useRef(0),accessGeneration=useRef(0);
 const [listing,setListing]=useState<Listing|null>(null),[source,setSource]=useState(''),[target,setTarget]=useState(''),[proposal,setProposal]=useState<Proposal|null>(null),[history,setHistory]=useState<AliasEvent[]>([]),[historyBusy,setHistoryBusy]=useState(false),[historyError,setHistoryError]=useState('');
 const [busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[evidence,setEvidence]=useState(''),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false);
 const authorizedApi=useCallback(async(body?:unknown,query='',signal?:AbortSignal)=>{
  const generation=accessGeneration.current;
  try{
   const value=await api(t,body,query,signal);
   if(signal?.aborted||generation!==accessGeneration.current)throw new DOMException(t('tr.mc.obsoleta'),'AbortError');
   return value;
  }catch(error){
   if(signal?.aborted||generation!==accessGeneration.current)throw new DOMException(t('tr.mc.obsoleta'),'AbortError');
   if([401,403].includes((error as {status?:number})?.status??0)){
    accessGeneration.current++;historyRequest.current++;setListing(null);setSource('');setTarget('');setHistory([]);setProposal(null);setEvidence('');setReason('');setConfirmed(false);setHistoryBusy(false);setHistoryError('');setNotice('');setBusy(false);setError(t('tr.ma.sinAuth'));
   }
   throw error;
  }
 },[t]);
 const refresh=useCallback(async(signal?:AbortSignal)=>{const value=await authorizedApi(undefined,'',signal);if(!signal?.aborted)setListing(value);},[authorizedApi]);
 useEffect(()=>{const controller=new AbortController(),generation=accessGeneration.current;void Promise.resolve().then(()=>refresh(controller.signal)).catch(e=>{if(!controller.signal.aborted&&e.name!=='AbortError')setError(e.message);}).finally(()=>{if(!controller.signal.aborted&&generation===accessGeneration.current)setBusy(false);});return()=>controller.abort();},[refresh]);
 useEffect(()=>{if(!source)return;const requestId=++historyRequest.current,controller=new AbortController();void Promise.resolve().then(()=>authorizedApi(undefined,'?'+new URLSearchParams({sourceConversationId:source}),controller.signal)).then(value=>{if(!controller.signal.aborted&&requestId===historyRequest.current)setHistory(value.history);}).catch(e=>{if(!controller.signal.aborted&&requestId===historyRequest.current&&e.name!=='AbortError')setHistoryError(e.message);}).finally(()=>{if(!controller.signal.aborted&&requestId===historyRequest.current)setHistoryBusy(false);});return()=>controller.abort();},[source,authorizedApi]);
 async function action(work:()=>Promise<void>){const generation=accessGeneration.current;setError('');setNotice('');setBusy(true);try{await work();}catch(e){if(!(e instanceof Error&&e.name==='AbortError'))setError(e instanceof Error?e.message:t('tr.ma.eDecision'));}finally{if(generation===accessGeneration.current)setBusy(false);}}
 function selectSource(value:string){setSource(value);setProposal(null);setHistory([]);setHistoryBusy(Boolean(value));setHistoryError('');setConfirmed(false);setNotice('');}
 async function reload(){const requestId=++historyRequest.current;await refresh();setProposal(null);setConfirmed(false);if(source){try{const value=await authorizedApi(undefined,'?'+new URLSearchParams({sourceConversationId:source}));if(requestId===historyRequest.current){setHistory(value.history);setHistoryError('');}}finally{if(requestId===historyRequest.current)setHistoryBusy(false);}}}
 // Datos nuevos: relectura en segundo plano del listado; conserva propuestas y formularios en curso.
 const busyRef=useRef(true);useLayoutEffect(()=>{busyRef.current=busy;});
 useAutoRefresh(()=>refresh(),{ocupado:()=>busyRef.current});
 async function decide(operation:'confirm'|'undo'){
  const version=operation==='confirm'?proposal?.expectedVersion:history.at(-1)?.version;
  if(version===undefined||!confirmed)return;
  await authorizedApi({operation,sourceConversationId:source,...(operation==='confirm'?{targetConversationId:proposal?.target.conversation_id}:{}),expectedVersion:version,evidenceRef:evidence,reason,approved:true});
  setProposal(null);setConfirmed(false);setHistory([]);setEvidence('');setReason('');setNotice(operation==='confirm'?t('tr.ma.nConfirmado'):t('tr.ma.nDeshecho'));onChange();await reload();
 }
 const label=(row:Conversation)=>`${row.source} · ${row.accountId} · ${row.externalId}${row.revisionState==='ambiguous'?t('tr.ma.ambigua'):''}`;
 const last=history.at(-1),validDecision=confirmed&&evidence.trim().length>0&&reason.trim().length>0; const ambiguous=listing?listing.conversations.filter(row=>row.revisionState==='ambiguous').length:0;
 const eventTitle=(event:AliasEvent)=>event.operation==='confirm'?t('tr.ma.evConfirmado'):event.operation==='undo'?t('tr.ma.evDeshecho'):t('tr.ma.evAntiguo');
 const node=(i:AliasIdentity)=><span className={css.flowNode}><strong>{i.source}</strong><span>{i.account_id}</span><IdChip value={i.external_id} head={10} tail={4}/></span>;
 if(busy&&!listing&&!error)return <RovaqCargando mensaje=""/>;
 return <section className="stack" aria-labelledby="migration-aliases-title">
  <div className="card-title"><div><h2 id="migration-aliases-title">{t('tr.ma.titulo')}</h2><p>{t('tr.ma.desc')}</p></div></div>
  {error&&<p role="alert" className="notice-bar"><Icon name="alert" size={14}/>{error}</p>}{notice&&<p role="status" className="notice-bar" data-tone="info"><Icon name="check" size={14}/>{notice}</p>}{busy&&<p role="status" className="sr-only">{t('tr.ma.procesando')}</p>}
  {listing&&<>
  <div className="split" data-even>
   <KpiLinea label={t('tr.ma.indicadores')} items={[
    {label:t('tr.ma.convCargadas'),value:nf.format(listing.conversations.length)+(listing.nextCursor?'+':''),c:5,partes:[{label:t('tr.ma.sinAmbiguedad'),value:listing.conversations.length-ambiguous},{label:t('tr.ma.ambiguas'),value:ambiguous}],nota:t('tr.ma.enEstaPagina')},
    {label:t('tr.ma.idResueltas'),value:listing.groups===null?t('tr.ma.sinResolver'):nf.format(listing.groups.length),vacio:listing.groups===null,c:3,partes:listing.groups===null?undefined:[{label:t('tr.ma.resueltas'),value:listing.groups.length}],nota:listing.groups===null?t('tr.ma.hayAmbPend'):t('tr.ma.enOrg')},
    {label:t('tr.ma.ambiguas'),value:nf.format(ambiguous),c:2,chip:ambiguous>0?{texto:t('tr.ma.revisar'),tono:'warn'}:{texto:t('tr.ma.ninguna'),tono:'ok'},partes:[{label:t('tr.ma.ambiguas'),value:ambiguous},{label:t('tr.ma.sinAmbiguedad'),value:listing.conversations.length-ambiguous}],nota:t('tr.ma.enCargadas')}]}/>
   <section className="card" aria-label={t('tr.ma.estadoAria')}><div className="card-title"><div><h2>{t('tr.ma.estadoId')}</h2><p>{t('tr.ma.convCargadas')}</p></div></div>
    <DonutChart title={t('tr.ma.donutTitulo')} centerValue={nf.format(listing.conversations.length)} centerLabel={t('tr.ma.enTotal')} segments={[{key:'clear',label:t('tr.ma.sinAmbiguedad'),value:listing.conversations.length-ambiguous,display:nf.format(listing.conversations.length-ambiguous),tone:1},{key:'amb',label:t('tr.ma.identidadAmbigua'),value:ambiguous,display:nf.format(ambiguous),tone:5}]}/>
   </section>
  </div>
  {listing.groups===null&&<p role="status" className="notice-bar"><Icon name="info" size={14}/>{t('tr.ma.noResolver')}</p>}
  {!listing.conversations.length?<EmptyState art="inbox" compact title={t('tr.ma.noConv')}/>:
  <section className="card" aria-label={t('tr.ma.prepararAria')}>
   <div className="card-title"><div><h2>{t('tr.ma.prepararUn')}</h2><p>{t('tr.ma.origenDestino')}</p></div>{listing.nextCursor&&<Button size="sm" variant="ghost" disabled={busy} onClick={()=>void action(async()=>{const value:Listing=await authorizedApi(undefined,'?'+new URLSearchParams({cursor:listing.nextCursor!}));setListing(previous=>previous?{...value,conversations:[...previous.conversations,...value.conversations.filter(row=>!previous.conversations.some(old=>old.id===row.id))]}:value);})}>{t('tr.ma.cargarMas')}</Button>}</div>
   <div className={css.pickRow+' '+css.form}>
    <label>{t('tr.ma.convOrigen')}<select value={source} disabled={busy} onChange={event=>selectSource(event.target.value)}><option value="">{t('tr.ma.selOriginal')}</option>{listing.conversations.map(row=><option key={row.id} value={row.id}>{label(row)}</option>)}</select></label>
    {listing.canPropose&&<><label>{t('tr.ma.convDestino')}<select value={target} disabled={busy} onChange={event=>{setTarget(event.target.value);setProposal(null);setConfirmed(false);}}><option value="">{t('tr.ma.selCanonica')}</option>{listing.conversations.filter(row=>row.id!==source).map(row=><option key={row.id} value={row.id}>{label(row)}</option>)}</select></label>
    <div><Button size="sm" variant="primary" disabled={busy||!source||!target||source===target} onClick={()=>void action(async()=>{const value=await authorizedApi({operation:'propose',sourceConversationId:source,targetConversationId:target});setProposal(value.proposal);setConfirmed(false);})}>{t('tr.ma.prepararProp')}</Button></div></>}
   </div>
  </section>}
  {proposal&&<section className="card" aria-label={t('tr.ma.propAria')}><div className="card-title"><div><h3>{t('tr.ma.propPend')}</h3><p>{t('tr.ma.versionEsp',{v:proposal.expectedVersion})}</p></div><StatusChip tone="warn">{t('tr.ma.pendiente')}</StatusChip></div>
   <div className={css.flow}>{node(proposal.source)}<Icon name="arrow-right" size={16}/>{node(proposal.target)}</div>
   {proposal.legacyUnresolved&&<p className="notice-bar" style={{marginTop:'var(--sp-3)'}}><Icon name="info" size={14}/>{t('tr.ma.aliasAntiguo')}</p>}</section>}
  {listing.canApprove&&source&&<fieldset className={'card '+css.form} style={{margin:0}} disabled={busy||historyBusy||Boolean(historyError)}><legend className="sr-only">{t('tr.ma.decisionProp')}</legend>
   <div className="card-title"><div><h3>{t('tr.ma.decisionProp')}</h3><p>{t('tr.ma.seRegistra')}</p></div></div>
   <div className={css.cols}><label>{t('tr.ma.refEvid')}<input required maxLength={2000} value={evidence} onChange={event=>setEvidence(event.target.value)}/></label>
   <label>{t('tr.ma.motivoDec')}<textarea required maxLength={1000} value={reason} onChange={event=>setReason(event.target.value)}/></label></div>
   <label className="check"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>{t('tr.ma.confirmoId')}</label>
   <div className={css.actions}><Button size="sm" variant="primary" disabled={!proposal||!validDecision} onClick={()=>void action(()=>decide('confirm'))}>{t('tr.ma.confirmarAlias')}</Button><Button size="sm" disabled={!last||last.operation!=='confirm'||!validDecision} onClick={()=>void action(()=>decide('undo'))}>{t('tr.ma.deshacerAlias')}</Button></div>
  </fieldset>}
  {!listing.canApprove&&<p className="notice-bar" data-tone="calm"><Icon name="lock" size={14}/>{t('tr.ma.soloProp')}</p>}
  </>}
  {source&&<section className="card" aria-label={t('tr.ma.histAria')}><div className="card-title"><div><h3>{t('tr.ma.histProc')}</h3></div></div>{historyBusy&&<RovaqCargando compacto mensaje={t('tr.ma.cargandoHist')}/>}{historyError&&<p role="alert" className="notice-bar">{historyError}</p>}{!historyBusy&&!historyError&&!history.length&&<p className="state">{t('tr.ma.sinDecisiones')}</p>}
   {history.length>0&&<Timeline events={history.map(event=>({key:event.id,icon:event.operation==='confirm'?'link':event.operation==='undo'?'refresh':'clock',title:<>{t('tr.ma.versionEvento',{v:event.version,titulo:eventTitle(event)})}</>,meta:new Date(event.created_at).toLocaleString(t('tr.eval.locale')),body:<><p>{t('tr.ma.motivo',{v:event.reason??t('tr.ma.noRegistrado')})}</p><p>{t('tr.ma.evidencia',{v:event.evidence_ref??t('tr.ma.noRegistrada')})}</p><p>{t('tr.ma.aprobador',{v:event.approved_by??t('tr.ma.noRegistrado')})}</p><details><summary>{t('tr.ma.procVersion',{v:event.version})}</summary><pre className={css.pre}>{JSON.stringify({source:event.source,accountId:event.account_id,externalId:event.external_id,sourceConversationId:event.source_conversation_id,canonicalId:event.canonical_id,previousVersion:event.previous_version,provenance:event.provenance},null,2)}</pre></details></>}))}/>}
  </section>}
  <p className={css.muted}>{t('tr.ma.despuesDecision')}</p>
 </section>;
}
export function MigrationWorkspace(){const [revision,setRevision]=useState(0);return <><MigrationComparison key={revision}/><MigrationAliases onChange={()=>setRevision(value=>value+1)}/></>;}
