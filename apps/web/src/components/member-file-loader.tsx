'use client';
// Cargador de archivos de miembros (F4): CSV/XLSX de ventas por SKU, resenas, Speedship y marketplaces.
// Reutiliza la reserva y la subida de /api/imports; la revision y el registro usan las rutas member-file del mismo manejador.
// Muestra solo conteos, motivos y agregados: ningun valor de celda sale del servidor.
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {Role} from '@vexa/platform/capabilities';
import {Button} from './ui/button';
import {useAutoRefresh} from './ui/use-auto-refresh';
import {Icon} from './ui/icons';
import {StatusChip} from './ui/status-chip';
import {TickBar} from './ui/progress-ring';
import {nf} from './ui/format';
import {ScrollTable} from './workspace/scroll-table';
import {useOnboarding} from './onboarding/contexto';
import {useT,useLocaleIntl} from './i18n/proveedor';
import {rolTieneCapacidad} from '../lib/onboarding/catalogo.mjs';
import {
 CURRENCIES,KIND_ORDER,MEMBER_FILE_MAPPING_VERSION,MemberFileError,checkFile,dayOf,errorKey,fieldKey,formatMinor,importsApi,previewBody,reasonKey,sha256Hex,
 type MemberFileDetail,type MemberFileKind,type MemberFilePreview,type RegisteredFile,
} from '../lib/imports/member-file-client';
import type {Clave} from '../lib/i18n';
import importStyles from './import-preview.module.css';
import styles from './member-file-loader.module.css';

type Connection={id:string;source:string;account_id:string};
type Listing={connections:Connection[];reservations:{id:string;state:string}[]};
type Attempt={fingerprint:string;key:string;id?:string};
const HISTORY_LIMIT=5;

export function MemberFileLoader(){
 const t=useT(),loc=useLocaleIntl();
 const rol=useOnboarding()?.datos.rol,puedeSubir=rol===undefined||rolTieneCapacidad(rol as Role,'import');
 const [connections,setConnections]=useState<Connection[]>([]),[connection,setConnection]=useState('');
 const [kind,setKind]=useState<MemberFileKind>('sales_by_sku'),[currency,setCurrency]=useState(''),[dateFormat,setDateFormat]=useState('iso'),[sheet,setSheet]=useState('');
 const [file,setFile]=useState<File|null>(null),[fileProblem,setFileProblem]=useState<string|null>(null);
 const [preview,setPreview]=useState<MemberFilePreview|null>(null),[previewKey,setPreviewKey]=useState(''),[importId,setImportId]=useState(''),[fileSha,setFileSha]=useState('');
 const [busy,setBusy]=useState<''|'review'|'register'>(''),[error,setError]=useState<{code:string;status:number}|null>(null);
 const [registered,setRegistered]=useState<RegisteredFile|null>(null),[replayed,setReplayed]=useState(false);
 const [history,setHistory]=useState<RegisteredFile[]>([]),[historyState,setHistoryState]=useState<'loading'|'ready'|'error'>('loading');
 const attempt=useRef<Attempt|null>(null);
 const optionsKey=JSON.stringify([kind,sheet,dateFormat,currency]);
 const stale=preview!==null&&previewKey!==optionsKey;

 // Lectura de conexiones y archivos ya registrados; se repite en segundo plano cuando entra informacion nueva (useAutoRefresh) sin tocar el formulario.
 const load=async(signal?:AbortSignal)=>{
  const data=await importsApi<Listing>('?offset=0&connection_offset=0',undefined,undefined,signal);
  if(signal?.aborted)return;
  setConnections(data.connections);
  setConnection(previous=>previous||(data.connections.length===1?data.connections[0].id:''));
  const found:RegisteredFile[]=[];
  for(const r of data.reservations.filter(x=>x.state==='uploaded').slice(0,HISTORY_LIMIT)){
   const d=await importsApi<MemberFileDetail>('/'+r.id,undefined,undefined,signal);
   if(d.member_file)found.push(d.member_file);
  }
  if(!signal?.aborted){setHistory(found);setHistoryState('ready');}
 };
 useEffect(()=>{
  const controller=new AbortController();
  async function initialize(){try{await load(controller.signal);}catch{if(!controller.signal.aborted)setHistoryState('error');}}
  void initialize();
  return()=>controller.abort();
 },[]);
 const busyRef=useRef(false);useLayoutEffect(()=>{busyRef.current=busy!=='';});
 useAutoRefresh(()=>load(),{ocupado:()=>busyRef.current});

 const fail=(e:unknown)=>{
  if(e instanceof MemberFileError){
   if(e.code==='reservation_expired'||e.code==='confirmation_conflict')attempt.current=null;
   setError({code:e.code,status:e.status});
  }else setError({code:'unknown',status:0});
 };
 const describe=(e:{code:string;status:number}):string=>{
  if(e.code==='network')return t('cargador.err.network');
  const key=errorKey(e.code,e.status);
  return key?t(key):t('cargador.err.generico')+' '+t('cargador.err.codigo',{code:e.code});
 };
 function reset(){setPreview(null);setPreviewKey('');setImportId('');setFileSha('');setError(null);setRegistered(null);setReplayed(false);setSheet('');}
 function chooseFile(next:File|null){
  setFile(next);reset();setFileProblem(null);
  if(next){const check=checkFile(next.name,next.size);if(!check.ok)setFileProblem(check.reason);}
 }
 async function runPreview(id:string){
  const body=previewBody({kind,sheet:sheet||null,date_format:dateFormat,currency:currency||null});
  const p=await importsApi<MemberFilePreview>('/'+id+'/member-file/preview',body);
  setPreview(p);setPreviewKey(optionsKey);
 }
 async function review(){
  if(!file||!connection)return;
  const check=checkFile(file.name,file.size);
  if(!check.ok){setFileProblem(check.reason);return;}
  setBusy('review');setError(null);
  try{
   const bytes=await file.arrayBuffer(),sha=await sha256Hex(bytes);
   setFileSha(sha);
   const fingerprint=JSON.stringify([connection,sha,check.type]);
   if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,key:crypto.randomUUID()};
   let needUpload=true;
   if(attempt.current.id){
    const existing=await importsApi<MemberFileDetail>('/'+attempt.current.id);
    if(existing.preview_state==='registered'&&existing.member_file){setRegistered(existing.member_file);setReplayed(true);setPreview(null);return;}
    if(new Date(existing.import.expires_at)<=new Date())attempt.current={fingerprint,key:crypto.randomUUID()};
    else needUpload=existing.preview_state==='awaiting_upload';
   }
   const current=attempt.current;
   if(needUpload){
    const d=await importsApi<{import_id:string;upload_url?:string;job_id?:string}>('',{connection_id:connection,mapping_version:MEMBER_FILE_MAPPING_VERSION,content_type:check.type,size:file.size,sha256:sha},current.key);
    if(d.job_id||!d.upload_url)throw new MemberFileError('member_file_immutable',409);
    current.id=d.import_id;
    const put=await fetch(d.upload_url,{method:'PUT',headers:{'Content-Type':check.type},body:bytes}).catch(()=>{throw new MemberFileError('upload_failed',0);});
    if(!put.ok)throw new MemberFileError('upload_failed',put.status);
   }
   if(!current.id)throw new MemberFileError('unknown',0);
   setImportId(current.id);
   await runPreview(current.id);
  }catch(e){fail(e);}finally{setBusy('');}
 }
 async function register(){
  if(!importId||!preview||!preview.can_register||stale)return;
  setBusy('register');setError(null);
  try{
   const body={...previewBody({kind,sheet:sheet||null,date_format:dateFormat,currency:currency||null}),sha256:fileSha};
   const d=await importsApi<{member_file:RegisteredFile;replayed:boolean}>('/'+importId+'/member-file/register',body);
   setRegistered(d.member_file);setReplayed(d.replayed);setPreview(null);
   setHistory(previous=>[d.member_file,...previous.filter(x=>x.file_sha256!==d.member_file.file_sha256)].slice(0,HISTORY_LIMIT));
   setFile(null);attempt.current=null;
  }catch(e){fail(e);}finally{setBusy('');}
 }

 const kindLabel=(k:string)=>t(`cargador.tipo.${k}` as Clave);
 const when=(iso:string)=>new Intl.DateTimeFormat(loc,{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(iso));
 const needsConnection=puedeSubir&&connections.length===0&&historyState!=='loading';
 const blockedNote=preview?.blocker==='sheet_required'?t('cargador.res.bloqueaHoja'):preview?.blocker==='currency_required'?t('cargador.res.bloqueaMoneda'):preview?.blocker==='no_valid_rows'?t('cargador.res.bloqueaFilas'):null;

 return <section className="task-page stack" aria-labelledby="member-files-heading" data-testid="member-file-loader">
  <div className="pc-card-head"><div><h2 id="member-files-heading">{t('cargador.titulo')}</h2><p>{t('cargador.desc')}</p></div></div>
  {!puedeSubir&&<p className="ac-nota" role="note">{t('cargador.soloLectura')}</p>}
  {needsConnection&&<p className="ac-nota" role="note">{t('cargador.sinConexion')}</p>}
  <p role="status" aria-live="polite" className={busy?'notice-bar':'sr-only'} data-tone="info">{busy==='review'?t('cargador.subiendo'):busy==='register'?t('cargador.registrando'):''}</p>
  {error&&<p role="alert" className="state state-error"><b>{t('cargador.err.titulo')}.</b> {describe(error)}</p>}

  {puedeSubir&&connections.length>0&&<div className={styles.form}>
   <fieldset className={styles.kinds} disabled={busy!==''}>
    <legend><b>{t('cargador.tipo')}</b></legend>
    {KIND_ORDER.map(k=><label key={k} className={styles.kind} data-on={kind===k?'1':undefined}>
     <input type="radio" name="member-file-kind" value={k} checked={kind===k} onChange={()=>setKind(k)}/>
     <b>{kindLabel(k)}</b><small>{t(`cargador.req.${k}` as Clave)}</small>
    </label>)}
   </fieldset>
   <div className={styles.row2}>
    <label className="field">{t('cargador.moneda')}
     <select value={currency} onChange={e=>setCurrency(e.target.value)} disabled={busy!==''} aria-describedby="member-file-currency-help">
      <option value="">{t('cargador.sinMoneda')}</option>{CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
     </select>
     <small id="member-file-currency-help" className="form-note">{t('cargador.monedaAyuda')}</small>
    </label>
    <label className="field">{t('cargador.formatoFecha')}
     <select value={dateFormat} onChange={e=>setDateFormat(e.target.value)} disabled={busy!==''} aria-describedby="member-file-date-help">
      <option value="iso">{t('cargador.fecha.iso')}</option><option value="dmy">{t('cargador.fecha.dmy')}</option><option value="mdy">{t('cargador.fecha.mdy')}</option>
     </select>
     <small id="member-file-date-help" className="form-note">{t('cargador.fechaAyuda')}</small>
    </label>
   </div>
   {connections.length>1&&<label className="field">{t('cargador.conexion')}
    <select value={connection} onChange={e=>setConnection(e.target.value)} disabled={busy!==''}>
     <option value="">—</option>{connections.map(c=><option key={c.id} value={c.id}>{c.source} · {c.account_id}</option>)}
    </select>
   </label>}
   {preview&&preview.sheets.length>1&&<label className="field">{t('cargador.hoja')}
    <select value={sheet||preview.sheet||''} onChange={e=>setSheet(e.target.value)} disabled={busy!==''}>
     <option value="">{t('cargador.elegirHoja')}</option>{preview.sheets.map(s=><option key={s} value={s}>{s}</option>)}
    </select>
   </label>}
   <label className={importStyles.drop} data-has={file?'1':undefined}>
    <Icon name="upload" size={20}/>
    <span>{file?file.name:t('cargador.arrastra')}</span>
    <small>{file?`${nf.format(file.size)} B`:t('cargador.archivo')}</small>
    <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy!==''} onChange={e=>chooseFile(e.target.files?.[0]??null)}/>
   </label>
   {fileProblem&&<p role="alert" className="state state-error">{t(`cargador.rechazo.${fileProblem}` as Clave)}</p>}
   <div className="btn-group">
    <Button variant="primary" disabled={busy!==''||!file||!connection||fileProblem!==null||(preview!==null&&!stale)} onClick={()=>void review()}>{t(preview?'cargador.revisarDeNuevo':'cargador.revisar')}</Button>
   </div>
  </div>}

  {preview&&<div className={styles.result} aria-live="polite">
   <h3>{t('cargador.res.titulo')}</h3>
   {blockedNote&&<p className="state state-error" role="alert">{blockedNote}</p>}
   {preview.headers.missing_required.length>0&&<p className="state state-error" role="alert">{t('cargador.res.faltan',{campos:preview.headers.missing_required.map(f=>f.split('|').map(x=>{const k=fieldKey(x);return k?t(k):x;}).join(' / ')).join(', ')})}</p>}
   {preview.headers.ambiguous.length>0&&<p className="state state-error" role="alert">{t('cargador.res.ambiguas',{campos:preview.headers.ambiguous.map(x=>{const k=fieldKey(x);return k?t(k):x;}).join(', ')})}</p>}
   {preview.rows.read>0&&<>
    <TickBar title={t('cargador.res.tick',{acc:nf.format(preview.rows.accepted),total:nf.format(preview.rows.read)})} value={preview.rows.read>0?preview.rows.accepted/preview.rows.read:0}/>
    <ul className={importStyles.chipRow}>
     <li><StatusChip tone="info">{t('cargador.res.leidas',{n:nf.format(preview.rows.read)})}</StatusChip></li>
     <li><StatusChip tone="ok">{t('cargador.res.aceptadas',{n:nf.format(preview.rows.accepted)})}</StatusChip></li>
     <li><StatusChip tone="muted">{t('cargador.res.rechazadas',{n:nf.format(preview.rows.rejected)})}</StatusChip></li>
     <li><StatusChip tone="warn">{t('cargador.res.duplicadas',{n:nf.format(preview.rows.duplicates)})}</StatusChip></li>
    </ul>
   </>}
   {Object.keys(preview.headers.recognized).length>0&&<details open={preview.headers.missing_required.length>0}>
    <summary>{t('cargador.res.columnas')}</summary>
    <p className={importStyles.note}>{t('cargador.res.columnasD')}</p>
    <ul className={styles.cols}>{Object.entries(preview.headers.recognized).map(([f,h])=><li key={f}><span>{(()=>{const k=fieldKey(f);return k?t(k):f;})()}</span><code>{h}</code></li>)}</ul>
    {preview.headers.ignored_count>0&&<p className={importStyles.note}>{t('cargador.res.ignoradas',{n:nf.format(preview.headers.ignored_count)})}</p>}
   </details>}
   {preview.reasons.length>0&&<div>
    <h4>{t('cargador.res.motivos')}</h4>
    <ScrollTable label={t('cargador.res.motivos')}><table className="dtable">
     <caption className="sr-only">{t('cargador.res.motivos')}</caption>
     <thead><tr><th>{t('cargador.res.motivo')}</th><th>{t('cargador.res.campo')}</th><th>{t('cargador.res.cuantas')}</th><th>{t('cargador.res.primera')}</th></tr></thead>
     <tbody>{preview.reasons.map(r=>{const rk=reasonKey(r.code),fk=fieldKey(r.field);return <tr key={r.code+':'+(r.field??'')}>
      <td>{rk?t(rk):t('cargador.motivo.otro',{code:r.code})}</td><td>{fk?t(fk):r.field??'—'}</td><td>{nf.format(r.count)}</td><td>{nf.format(r.first_line)}</td></tr>;})}</tbody>
    </table></ScrollTable>
    {preview.errors_truncated&&<p className={importStyles.note}>{t('cargador.res.truncado')}</p>}
   </div>}
   {preview.aggregates&&preview.rows.accepted>0&&<div>
    <h4>{t('cargador.res.resumen')}</h4>
    <ul className={styles.facts}>
     {preview.aggregates.date_min&&preview.aggregates.date_max&&<li>{t('cargador.res.rangoFechas',{desde:dayOf(preview.aggregates.date_min),hasta:dayOf(preview.aggregates.date_max)})}</li>}
     {preview.aggregates.date_max&&<li><b>{t('cargador.res.corte',{fecha:dayOf(preview.aggregates.date_max)})}</b></li>}
     {preview.aggregates.distinct_skus!==null&&<li>{t('cargador.res.skus',{n:nf.format(preview.aggregates.distinct_skus)})}</li>}
     {preview.aggregates.distinct_orders!==null&&<li>{t('cargador.res.pedidos',{n:nf.format(preview.aggregates.distinct_orders)})}</li>}
     {preview.aggregates.quantity_total!==null&&<li>{t('cargador.res.unidades',{n:nf.format(preview.aggregates.quantity_total)})}</li>}
    </ul>
    {preview.aggregates.amounts.length>0&&<>
     <h4>{t('cargador.res.importes')}</h4>
     <ul className={styles.amounts}>{preview.aggregates.amounts.map(a=><li key={a.currency}><b>{formatMinor(a.amount_minor,a.exponent,a.currency,loc)}</b> · {t('cargador.res.importeFilas',{n:nf.format(a.rows)})}</li>)}</ul>
     {preview.aggregates.amount_kind&&<p className={importStyles.note}>{t(`cargador.res.importeNota.${preview.aggregates.amount_kind}` as Clave)}</p>}
     {preview.aggregates.amount_missing>0&&<p className={importStyles.note}>{t('cargador.res.sinImporte',{n:nf.format(preview.aggregates.amount_missing)})}</p>}
    </>}
    {preview.aggregates.rating_histogram&&<>
     <h4>{t('cargador.res.calificaciones')}</h4>
     <ul className={styles.hist}>{Object.entries(preview.aggregates.rating_histogram).map(([stars,n])=><li key={stars}><StatusChip tone="neutral">{t('cargador.res.estrellas',{n:stars})}: {nf.format(n)}</StatusChip></li>)}</ul>
    </>}
   </div>}
   {preview.can_register&&<>
    <p className={importStyles.note}>{t('cargador.res.avisoRegistro')}</p>
    <div className="btn-group"><Button variant="primary" disabled={busy!==''||stale} onClick={()=>void register()}>{t('cargador.registrar')}</Button></div>
   </>}
  </div>}

  {registered&&<div className={styles.registered} role="status">
   <h3>{t('cargador.reg.titulo')}</h3>
   {replayed&&<p className={importStyles.note}>{t('cargador.reg.replay')}</p>}
   <p>{t('cargador.reg.tipo',{tipo:kindLabel(registered.kind)})}</p>
   <p>{t('cargador.reg.filas',{acc:nf.format(registered.rows.accepted),rech:nf.format(registered.rows.rejected),dup:nf.format(registered.rows.duplicates),total:nf.format(registered.rows.read)})}</p>
   {registered.cut&&<p><b>{t('cargador.reg.corte',{fecha:dayOf(registered.cut)})}</b></p>}
   <p className={styles.mono}>{t('cargador.reg.huella',{hash:registered.file_sha256})}</p>
   <p>{t('cargador.reg.cuando',{fecha:when(registered.registered_at)})}</p>
   <p><StatusChip tone="warn">{t('cargador.reg.aplicado')}</StatusChip></p>
   <div className="btn-group"><Button onClick={()=>{reset();setFile(null);}}>{t('cargador.reg.otro')}</Button></div>
  </div>}

  <div>
   <h3>{t('cargador.hist.titulo')}</h3>
   {historyState==='loading'&&<p className={importStyles.note}>{t('cargador.hist.cargando')}</p>}
   {historyState==='ready'&&history.length===0&&<p className={importStyles.note}>{t('cargador.hist.vacio')}</p>}
   {history.length>0&&<ul className={styles.history}>{history.map(h=><li key={h.file_sha256}>{t('cargador.hist.fila',{tipo:kindLabel(h.kind),fecha:dayOf(h.cut),acc:nf.format(h.rows.accepted)})}</li>)}</ul>}
  </div>
 </section>;
}
