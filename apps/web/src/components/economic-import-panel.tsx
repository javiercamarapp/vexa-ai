'use client';
import {useEffect,useRef,useState} from 'react';
import {parseImport,summarizeImport,MAX_BYTES,EconomicImportError,type EconomicImport} from '../lib/economic-import/contract';
import {runEconomicImport,type ImportProgress} from '../lib/economic-import/runner';
import {formatMinorUnits} from '../../../../packages/metrics/money.mjs';
import type {EconomicScope} from '../../../../packages/metrics/repository.mjs';
import './economic-import.css';
import {useT} from './i18n/proveedor';
import type {Clave} from '../lib/i18n';
const statuses:Record<string,Clave>={recorded:'tr.imp.sRegistrado',settled:'tr.imp.sLiquidado',pending:'tr.imp.sPendiente',cancelled:'tr.imp.sCancelado',unknown:'tr.imp.sDesconocido'};
export function EconomicImportPanel({tenantId,onImported}:{tenantId:string;onImported:(scope:EconomicScope)=>void}){
 const t=useT();
 const [document,setDocument]=useState<EconomicImport|null>(null),[name,setName]=useState(''),[fingerprint,setFingerprint]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false),[running,setRunning]=useState(false),[approved,setApproved]=useState(false),[phrase,setPhrase]=useState(''),[progress,setProgress]=useState<ImportProgress|null>(null),[page,setPage]=useState(0);
 const active=useRef<AbortController|null>(null),generation=useRef(0),fileInput=useRef<HTMLInputElement>(null),locked=useRef(false);
 useEffect(()=>()=>{generation.current++;active.current?.abort();},[tenantId]);
 const money=(amount:string|null)=>formatMinorUnits(amount,'USD',2);
 async function select(file:File|undefined){
  if(locked.current)return;const epoch=++generation.current;setDocument(null);setName('');setFingerprint('');setError('');setApproved(false);setPhrase('');setProgress(null);setPage(0);if(!file)return;setLoading(true);
  try{if(file.size>MAX_BYTES)throw Error(t('tr.imp.supera',{mib:MAX_BYTES/1048576}));const content=await file.text();const next=parseImport(content,tenantId);const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(content));if(epoch!==generation.current)return;setFingerprint(Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join(''));setName(file.name);setDocument(next);}catch(e){if(epoch===generation.current)setError(e instanceof EconomicImportError?t(e.clave,e.vars):e instanceof Error?e.message:t('tr.imp.noLeer'));}finally{if(epoch===generation.current)setLoading(false);}
 }
 async function start(){
  if(locked.current||!document||!approved||phrase!==`IMPORTAR ${document.entries.length}`)return;
  locked.current=true;const epoch=generation.current,controller=new AbortController();active.current=controller;setRunning(true);setApproved(false);setPhrase('');setError('');
  try{const result=await runEconomicImport(document,tenantId,{signal:controller.signal,onProgress:value=>{if(generation.current===epoch)setProgress(value);}});if(generation.current!==epoch)return;
   if(result.phase==='unauthorized'){setDocument(null);setFingerprint('');setName('');if(fileInput.current)fileInput.current.value='';}
   if(result.phase==='complete')onImported(document.scope);
  }finally{locked.current=false;if(generation.current===epoch)setRunning(false);active.current=null;}
 }
 const summary=document?summarizeImport(document):null;
 const canStart=!!document&&approved&&phrase===`IMPORTAR ${document.entries.length}`&&!running&&!loading;
 return <section className="task-card economic-import" aria-labelledby="economic-import-title" aria-busy={loading||running}>
  <header className="task-card-header"><div><p className="eyebrow">{t('tr.imp.eyebrow')}</p><h2 id="economic-import-title">{t('tr.imp.titulo')}</h2></div><span className="status">{t('tr.imp.hasta',{n:2000})}</span></header>
  <p>{t('tr.imp.intro')}</p>
  <label>{t('tr.imp.archivoJson')}<input ref={fileInput} type="file" accept=".json,application/json" disabled={running||loading} onChange={event=>void select(event.target.files?.[0])}/></label>
  {loading&&<p role="status">{t('tr.imp.validando')}</p>}{error&&<p role="alert">{error}</p>}
  {document&&summary&&<>
   <div className="task-columns economic-import-summary"><div><h3>{t('tr.imp.archivoAlcance')}</h3><dl><dt>{t('tr.imp.archivo')}</dt><dd>{name}</dd><dt>{t('tr.imp.orgDestino')}</dt><dd><code>{tenantId}</code></dd><dt>{t('tr.imp.periodoUtc')}</dt><dd>{document.scope.start} → {document.scope.end}</dd><dt>{t('tr.imp.unidadBase')}</dt><dd>{t('tr.imp.unidadBaseTxt',{dec:2})}</dd><dt>{t('tr.imp.sha')}</dt><dd><code>{fingerprint}</code></dd></dl></div>
    <div><h3>{t('tr.imp.registrosArchivo')}</h3><dl><dt>{t('tr.imp.ordenes')}</dt><dd>{t('tr.imp.subtotalConocido',{n:summary.orders,v:money(summary.orderKnownMinor)})}</dd><dt>{t('tr.imp.reembolsos')}</dt><dd>{t('tr.imp.subtotalConocido',{n:summary.refunds,v:money(summary.refundKnownMinor)})}</dd><dt>{t('tr.imp.importesDesc')}</dt><dd>{summary.unknownAmounts}</dd></dl><ul>{Object.entries(summary.refundStatuses).map(([status,count])=><li key={status}>{statuses[status]?t(statuses[status]):status}: {count}</li>)}</ul><p>{t('tr.imp.estosSubtotales')}</p></div></div>
   <details><summary>{t('tr.imp.revisarMoneda',{n:document.sources.length})}</summary><div className="task-columns"><article><h3>{t('tr.imp.catalogo')}</h3><p>{document.currencyConfiguration.source} · {document.currencyConfiguration.reference} · {document.currencyConfiguration.date}</p><p>{document.currencyConfiguration.report}</p></article>{document.sources.map(source=><article key={source.sourceId}><h3>{source.name}</h3><p>{source.evidenceType==='order_export'?t('tr.imp.expOrdenes'):t('tr.imp.regPagos')}{t('tr.imp.fuenteIncompleta')}</p><p>{t('tr.imp.ventanaCorte',{a:source.windowStart,b:source.windowEnd,w:source.watermark})}</p><p>{source.report}</p><code>{source.sourceId}</code></article>)}</div></details>
   <p className="state-panel">{t('tr.imp.fuentesIncompletas',{n:summary.incompleteSources})}</p>
   <details><summary>{t('tr.imp.revisarRegistros',{n:document.entries.length})}</summary><div className="table-scroll" tabIndex={0} aria-label={t('tr.imp.tablaAria')}><table><thead><tr><th>{t('tr.imp.thIdentidad')}</th><th>{t('tr.imp.thComponente')}</th><th>{t('tr.imp.thFecha')}</th><th>{t('tr.imp.thImporte')}</th><th>{t('tr.imp.thEstado')}</th><th>{t('tr.imp.thProcedencia')}</th></tr></thead><tbody>{document.entries.slice(page*25,(page+1)*25).map(entry=><tr key={entry.sourceId+entry.kind+entry.externalId}><td>{entry.externalId}</td><td>{entry.kind==='order'?t('tr.imp.orden'):t('tr.imp.reembolso')}</td><td>{entry.effectiveAt}</td><td>{money(entry.amountMinor)}</td><td>{statuses[entry.status]?t(statuses[entry.status]):entry.status}</td><td>{document.sources.find(s=>s.sourceId===entry.sourceId)?.name}<details><summary>{t('tr.imp.evidRelacion')}</summary><p>{entry.report}</p><p>{t('tr.imp.ordenRel',{v:entry.orderId??t('tr.imp.sinRelacion')})}</p></details></td></tr>)}</tbody></table></div><div className="economic-import-actions"><button type="button" disabled={page===0} onClick={()=>setPage(p=>p-1)}>{t('tr.imp.anteriores')}</button><span>{t('tr.imp.paginaDe',{a:page+1,b:Math.ceil(document.entries.length/25)})}</span><button type="button" disabled={(page+1)*25>=document.entries.length} onClick={()=>setPage(p=>p+1)}>{t('tr.imp.siguientes')}</button></div></details>
   {!running&&progress?.phase!=='complete'&&<fieldset className="task-fields"><legend>{t('tr.imp.confirmar')}</legend><label className="economic-import-attestation"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/>{t('tr.imp.revise',{o:summary.orders,r:summary.refunds})}</label><label>{t('tr.imp.escribe',{n:document.entries.length})}<input autoComplete="off" value={phrase} onChange={e=>setPhrase(e.target.value)}/></label><button type="button" disabled={!canStart} onClick={()=>void start()}>{progress?t('tr.imp.reanudar'):t('tr.imp.guardar')}</button></fieldset>}
  </>}
  {progress&&<div className="economic-import-progress" role={progress.phase==='error'||progress.phase==='unauthorized'?'alert':'status'} aria-live="polite"><p>{progress.clave?t(progress.clave,progress.vars):progress.message}</p>{progress.phase!=='unauthorized'&&<><progress max={progress.totalEntries||1} value={progress.acknowledgedEntries}/><p>{t('tr.imp.verificados',{a:progress.verifiedEntries,b:progress.totalEntries,c:progress.acknowledgedEntries})}</p><p>{t('tr.imp.parcial')}</p></>}</div>}
  {running&&<button type="button" onClick={()=>active.current?.abort()}>{t('tr.imp.pausar')}</button>}
  {progress?.phase==='complete'&&<a href="#economic-ledger">{t('tr.imp.verRegistro')}</a>}
 </section>;
}
