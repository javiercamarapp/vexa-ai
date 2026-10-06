'use client';
import {useEffect,useRef,useState} from 'react';
import {parseImport,summarizeImport,MAX_BYTES,type EconomicImport} from '../lib/economic-import/contract';
import {runEconomicImport,type ImportProgress} from '../lib/economic-import/runner';
import {formatMinorUnits} from '../../../../packages/metrics/money.mjs';
import type {EconomicScope} from '../../../../packages/metrics/repository.mjs';
import './economic-import.css';
const statuses:Record<string,string>={recorded:'Registrado',settled:'Liquidado',pending:'Pendiente',cancelled:'Cancelado',unknown:'Desconocido'};
export function EconomicImportPanel({tenantId,onImported}:{tenantId:string;onImported:(scope:EconomicScope)=>void}){
 const [document,setDocument]=useState<EconomicImport|null>(null),[name,setName]=useState(''),[fingerprint,setFingerprint]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false),[running,setRunning]=useState(false),[approved,setApproved]=useState(false),[phrase,setPhrase]=useState(''),[progress,setProgress]=useState<ImportProgress|null>(null),[page,setPage]=useState(0);
 const active=useRef<AbortController|null>(null),generation=useRef(0),fileInput=useRef<HTMLInputElement>(null),locked=useRef(false);
 useEffect(()=>()=>{generation.current++;active.current?.abort();},[tenantId]);
 const money=(amount:string|null)=>formatMinorUnits(amount,'USD',2);
 async function select(file:File|undefined){
  if(locked.current)return;const epoch=++generation.current;setDocument(null);setName('');setFingerprint('');setError('');setApproved(false);setPhrase('');setProgress(null);setPage(0);if(!file)return;setLoading(true);
  try{if(file.size>MAX_BYTES)throw Error('El archivo supera 8 MiB.');const content=await file.text();const next=parseImport(content,tenantId);const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(content));if(epoch!==generation.current)return;setFingerprint(Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join(''));setName(file.name);setDocument(next);}catch(e){if(epoch===generation.current)setError(e instanceof Error?e.message:'No se pudo leer el archivo.');}finally{if(epoch===generation.current)setLoading(false);}
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
  <header className="task-card-header"><div><p className="eyebrow">Importación revisada</p><h2 id="economic-import-title">Cargar órdenes y reembolsos</h2></div><span className="status">JSON · Hasta 2000 registros</span></header>
  <p>El archivo se valida completo antes de guardar. Se usa tu sesión owner y se compara la organización en cada escritura. No se publica un snapshot.</p>
  <label>Archivo económico JSON<input ref={fileInput} type="file" accept=".json,application/json" disabled={running||loading} onChange={event=>void select(event.target.files?.[0])}/></label>
  {loading&&<p role="status">Validando estructura, unidades y procedencia del archivo…</p>}{error&&<p role="alert">{error}</p>}
  {document&&summary&&<>
   <div className="task-columns economic-import-summary"><div><h3>Archivo y alcance</h3><dl><dt>Archivo</dt><dd>{name}</dd><dt>Organización de destino</dt><dd><code>{tenantId}</code></dd><dt>Periodo UTC (fin exclusivo)</dt><dd>{document.scope.start} → {document.scope.end}</dd><dt>Unidad y base</dt><dd>USD · 2 decimales · Importe bruto de orden, incluidos impuestos y envío</dd><dt>SHA-256 del archivo</dt><dd><code>{fingerprint}</code></dd></dl></div>
    <div><h3>Registros del archivo</h3><dl><dt>Órdenes</dt><dd>{summary.orders} · Subtotal conocido {money(summary.orderKnownMinor)}</dd><dt>Reembolsos</dt><dd>{summary.refunds} · Subtotal conocido {money(summary.refundKnownMinor)}</dd><dt>Importes desconocidos</dt><dd>{summary.unknownAmounts}</dd></dl><ul>{Object.entries(summary.refundStatuses).map(([status,count])=><li key={status}>{statuses[status]??status}: {count}</li>)}</ul><p>Estos subtotales describen el archivo; incluyen los estados indicados. No son pérdidas, no se restan entre sí y no acreditan cobertura completa.</p></div></div>
   <details><summary>Revisar configuración monetaria y {document.sources.length} fuentes</summary><div className="task-columns"><article><h3>Catálogo monetario</h3><p>{document.currencyConfiguration.source} · {document.currencyConfiguration.reference} · {document.currencyConfiguration.date}</p><p>{document.currencyConfiguration.report}</p></article>{document.sources.map(source=><article key={source.sourceId}><h3>{source.name}</h3><p>{source.evidenceType==='order_export'?'Exportación de órdenes':'Registro de pagos'} · Fuente incompleta</p><p>Ventana: {source.windowStart} → {source.windowEnd}. Corte: {source.watermark}.</p><p>{source.report}</p><code>{source.sourceId}</code></article>)}</div></details>
   <p className="state-panel">Las {summary.incompleteSources} fuentes se importan como incompletas. Esta versión sólo admite fuentes incompletas; guardar todos los registros del archivo no demuestra que el origen esté completo.</p>
   <details><summary>Revisar los {document.entries.length} registros antes de guardar</summary><div className="table-scroll" tabIndex={0} aria-label="Registros del archivo, tabla desplazable"><table><thead><tr><th>Identidad externa</th><th>Componente</th><th>Fecha UTC</th><th>Importe</th><th>Estado</th><th>Procedencia</th></tr></thead><tbody>{document.entries.slice(page*25,(page+1)*25).map(entry=><tr key={entry.sourceId+entry.kind+entry.externalId}><td>{entry.externalId}</td><td>{entry.kind==='order'?'Orden':'Reembolso'}</td><td>{entry.effectiveAt}</td><td>{money(entry.amountMinor)}</td><td>{statuses[entry.status]}</td><td>{document.sources.find(s=>s.sourceId===entry.sourceId)?.name}<details><summary>Evidencia y relación</summary><p>{entry.report}</p><p>Orden relacionada: {entry.orderId??'Sin relación acreditada'}</p></details></td></tr>)}</tbody></table></div><div className="economic-import-actions"><button type="button" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Anteriores</button><span>Página {page+1} de {Math.ceil(document.entries.length/25)}</span><button type="button" disabled={(page+1)*25>=document.entries.length} onClick={()=>setPage(p=>p+1)}>Siguientes</button></div></details>
   {!running&&progress?.phase!=='complete'&&<fieldset className="task-fields"><legend>Confirmar este archivo</legend><label className="economic-import-attestation"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/>Revisé este archivo, su SHA-256, organización, periodo, fuentes e importes. Autorizo registrar su moneda, fuentes, {summary.orders} órdenes y {summary.refunds} reembolsos con esta evidencia operacional.</label><label>Escribe IMPORTAR {document.entries.length}<input autoComplete="off" value={phrase} onChange={e=>setPhrase(e.target.value)}/></label><button type="button" disabled={!canStart} onClick={()=>void start()}>{progress?'Comprobar ledger y reanudar':'Comprobar ledger y guardar'}</button></fieldset>}
  </>}
  {progress&&<div className="economic-import-progress" role={progress.phase==='error'||progress.phase==='unauthorized'?'alert':'status'} aria-live="polite"><p>{progress.message}</p>{progress.phase!=='unauthorized'&&<><progress max={progress.totalEntries||1} value={progress.acknowledgedEntries}/><p>Verificados por lectura del ledger: {progress.verifiedEntries}/{progress.totalEntries}. Confirmados previamente o por respuesta de guardado: {progress.acknowledgedEntries}/{progress.totalEntries}.</p><p>La carga puede quedar parcial. Conserva el mismo archivo; al reanudar se comparará el ledger antes de enviar lo pendiente.</p></>}</div>}
  {running&&<button type="button" onClick={()=>active.current?.abort()}>Pausar carga</button>}
  {progress?.phase==='complete'&&<a href="#economic-ledger">Ver registro con el periodo y la base importados</a>}
 </section>;
}
