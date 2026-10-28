'use client';
import {RovaqCargando} from './rovaq-cargando';
import {useAutoRefresh} from './ui/use-auto-refresh';
import {useLayoutEffect,useCallback,useEffect,useRef,useState} from 'react';
type Snapshot={ready:boolean;policy:{version:number;backupTtlSeconds:number}|null;connections:Array<{id:string;source:string;accountId:string}>;artifacts:Array<{id:string;class:string;path:string;status:string}>;counts:{pending:number;deleted:number}};
type Preview={target:{connectionId:string;entityType:string;externalId:string};scope:{messages:string[];conversations:string[];revisions:unknown[];vectors:string[];jobs:string[];problems:string[];rawObjects:string[];rawFiles:Array<{importId:string;path:string;rows:number}>;artifacts:unknown[];derived:unknown[];policy:{version:number}};requestId:string;token:string;expiresAt:number};
class RetentionRequestError extends Error {}
import {segundosADias,diasASegundos} from '../lib/recovery/retencion.mjs';
import {PageHeader} from './ui/page-header';
import {Button} from './ui/button';
import {ErrorState} from './ui/error-state';
import {Loading} from './ui/loading';
import {KpiLinea} from './panel-comun/kpi-linea';
import './panel-comun/panel-comun.css';
import {useT,useLocaleIntl} from './i18n/proveedor';
export function RetentionPanel(){const t=useT(),loc=useLocaleIntl();const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[sourceLoading,setSourceLoading]=useState(false),[ttl,setTtl]=useState('2592000'),[connection,setConnection]=useState(''),[kind,setKind]=useState('conversation'),[external,setExternal]=useState(''),[sources,setSources]=useState<Array<{id:string;externalId:string}>>([]),[cursor,setCursor]=useState<string|null>(null),[next,setNext]=useState<string|null>(null),[preview,setPreview]=useState<Preview|null>(null),[confirmed,setConfirmed]=useState(false);const pending=useRef(false),epoch=useRef(0);
 const clear=useCallback(()=>{setPreview(null);setConfirmed(false);},[]);
 const load=useCallback(async(signal?:AbortSignal)=>{
  const generation=++epoch.current;setLoading(true);setNotice('');
  try{const r=await fetch('/api/recovery',{cache:'no-store',signal});if(!r.ok)throw new RetentionRequestError(r.status===403?t('conx.r.errProp'):t('conx.r.errConsulta'));const data=await r.json();if(!signal?.aborted&&generation===epoch.current){setSnapshot(data);setTtl(segundosADias(data.policy?.backupTtlSeconds??2592000));setError('');return true;}return false;
  }catch(e){if(!signal?.aborted&&generation===epoch.current){setSnapshot(null);clear();setError(e instanceof RetentionRequestError?e.message:t('conx.r.errConsultaRetry'));}return false;
  }finally{if(!signal?.aborted&&generation===epoch.current)setLoading(false);}
 },[clear,t]);
 useEffect(()=>{const c=new AbortController();void Promise.resolve().then(()=>load(c.signal));return()=>c.abort();},[load]);
 // Datos nuevos: relectura en segundo plano del estado; no toca el formulario (p. ej. los días elegidos) ni corre durante una operación.
 const ocupadoRef=useRef(true);useLayoutEffect(()=>{ocupadoRef.current=busy||loading;});
 const recargarSilencioso=useCallback(async()=>{if(ocupadoRef.current)return;const generation=epoch.current;try{const r=await fetch('/api/recovery',{cache:'no-store'});if(!r.ok)return;const data=await r.json();if(generation===epoch.current&&!ocupadoRef.current)setSnapshot(data);}catch{/* se conserva lo pintado */}},[]);
 useAutoRefresh(recargarSilencioso,{ocupado:()=>ocupadoRef.current});
 useEffect(()=>{const controller=new AbortController();void Promise.resolve().then(async()=>{
  if(controller.signal.aborted)return;if(!connection){setSourceLoading(false);return;}setSourceLoading(true);
  try{const r=await fetch('/api/recovery?'+new URLSearchParams({connectionId:connection,entityType:kind,...(cursor?{cursor}:{})}),{signal:controller.signal,cache:'no-store'});if(!r.ok)throw new RetentionRequestError(t('conx.r.errFuentes'));const result=await r.json();if(!controller.signal.aborted){setSources(result.items);setNext(result.nextCursor);setError('');}}
  catch{if(!controller.signal.aborted){setSources([]);setNext(null);clear();setError(t('conx.r.errFuentesSel'));}}
  finally{if(!controller.signal.aborted)setSourceLoading(false);}
 });return()=>controller.abort();},[connection,kind,cursor,clear,t]);
 async function action(operation:string,input:Record<string,unknown>={}){if(pending.current)return;pending.current=true;setBusy(true);setError('');setNotice('');try{const r=await fetch('/api/recovery',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({operation,...input})});if(!r.ok)throw new RetentionRequestError(r.status===409?t('conx.r.err409'):r.status===403?t('conx.r.err403'):r.status===413?t('conx.r.err413'):t('conx.r.errOp'));if(operation==='export'){const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='retention-ledger.json';a.click();URL.revokeObjectURL(url);setNotice(t('conx.r.noticeExport'));}else{const {data}=await r.json();if(operation==='preview'){setPreview(data);setConfirmed(false);}else{clear();if(!await load())return;setNotice(operation==='erase'?t('conx.r.noticeErase'):operation==='purge'?data.complete?t('conx.r.noticePurgeOk'):t('conx.r.noticePurgePend'):t('conx.r.noticePolitica'));}}}catch(e){clear();await load();setError(e instanceof RetentionRequestError?e.message:t('conx.r.errConfirmar'));}finally{pending.current=false;setBusy(false);}}
 const unavailable=busy||loading||sourceLoading;
 function selection(){clear();setExternal('');setSources([]);setCursor(null);setNext(null);}
 if(loading&&!snapshot&&!error)return <RovaqCargando mensaje=""/>;
 return <section className="task-page retention-page stack" aria-label={t('conx.r.titulo')} aria-busy={unavailable}>
  <PageHeader eyebrow={t('conx.r.eyebrow')} title={t('conx.r.titulo')} description={t('conx.r.desc')} actions={<><Button disabled={unavailable||!snapshot?.ready} onClick={()=>void action('export')}>{t('conx.r.exportar')}</Button></>}/>
  {(loading||sourceLoading)&&<p role="status" className="sr-only">{sourceLoading?t('conx.r.cargandoFuentes'):snapshot?t('conx.r.actualizando'):t('conx.r.cargando')}</p>}
  {loading&&!snapshot&&<Loading compact message={t('conx.r.cargando')}/>}
  {error&&(!snapshot?<ErrorState title={t('conx.r.noCargar')} body={error} onRetry={()=>{clear();void load();}}/>:<p role="alert" className="ac-nota">{error}</p>)}{notice&&<p role="status" className="ac-nota">{notice}</p>}
  {snapshot&&<>
   {!snapshot.ready&&<p role="status" className="ac-nota">{t('conx.r.faltaClave')}</p>}
   <KpiLinea label={t('conx.r.kpiLabel')} items={[
    {label:t('conx.r.k.pend'),value:String(snapshot.counts.pending),c:4,chip:snapshot.counts.pending>0?{texto:t('conx.r.k.porPurgar'),tono:'warn'}:{texto:t('conx.r.k.alDia'),tono:'ok'},partes:[{label:t('conx.r.k.pendientes'),value:snapshot.counts.pending},{label:t('conx.r.k.eliminados'),value:snapshot.counts.deleted}],nota:t('conx.r.k.notaFis')},
    {label:t('conx.r.k.archElim'),value:String(snapshot.counts.deleted),c:5,partes:[{label:t('conx.r.k.eliminados'),value:snapshot.counts.deleted},{label:t('conx.r.k.pendientes'),value:snapshot.counts.pending}],nota:t('conx.r.k.notaLedger')},
    {label:t('conx.r.k.retCopias'),value:snapshot.policy?t('conx.r.k.dias',{n:ttl}):'—',vacio:!snapshot.policy,c:3,partes:snapshot.policy?[{label:t('conx.r.k.politica'),value:1}]:undefined,nota:(snapshot.policy?.version??0)>0?t('conx.r.polGuardada',{version:snapshot.policy?.version??0}):t('conx.r.polNinguna')},
    {label:t('conx.r.k.conexiones'),value:String(snapshot.connections.length),c:1,partes:snapshot.connections.map(c=>({label:c.source,value:1})),nota:t('conx.r.k.notaConn')}]}/>
   <div className="pc-grid" data-cols="6-6">
    <form className="pc-card" onSubmit={e=>{e.preventDefault();void action('policy',{expectedVersion:snapshot.policy?.version??0,backupTtlSeconds:diasASegundos(ttl)});}}><div className="pc-card-head"><div><h2>{t('conx.r.polTitulo')}</h2><p>{t('conx.r.polSub')}</p></div></div>
     <div className="pc-ajustes"><div className="pc-ajuste"><div><h3>{t('conx.r.retMax')}</h3><p id="retention-ttl-help">{t('conx.r.retMaxAyuda')}</p></div><div className="pc-ajuste-ctl"><input aria-label={t('conx.r.retMax')} aria-describedby="retention-ttl-help" required type="number" min="0.01" max="365" step="any" value={ttl} disabled={unavailable} onChange={e=>{setTtl(e.target.value);clear();}} style={{width:96}}/></div></div></div>
     <div><Button type="submit" variant="primary" disabled={unavailable}>{t('conx.r.guardarPol')}</Button></div>
     <ul className="pc-lista ui-reset pc-fill" role="list" aria-label={t('conx.r.queHace')}><li style={{listStyle:'none'}}><i className="pc-punto" data-tono="bad"/><span className="pc-grow"><span className="pc-t">{t('conx.r.seElimina')}</span><span className="pc-s">{t('conx.r.seEliminaD')}</span></span></li><li style={{listStyle:'none'}}><i className="pc-punto" data-tono="ok"/><span className="pc-grow"><span className="pc-t">{t('conx.r.seConserva')}</span><span className="pc-s">{t('conx.r.seConservaD')}</span></span></li><li style={{listStyle:'none'}}><i className="pc-punto" data-tono="off"/><span className="pc-grow"><span className="pc-t">{t('conx.r.noVerif')}</span><span className="pc-s">{t('conx.r.noVerifD')}</span></span></li></ul></form>
    <form className="pc-card" onSubmit={e=>{e.preventDefault();void action('preview',{connectionId:connection,entityType:kind,externalId:external});}}><div className="pc-card-head"><div><h2>{t('conx.r.selTitulo')}</h2><p>{t('conx.r.selSub')}</p></div></div>
     <div className="pc-ajustes">
      <div className="pc-ajuste"><div><h3>{t('conx.r.conexion')}</h3></div><div className="pc-ajuste-ctl"><select aria-label={t('conx.r.conexion')} required disabled={unavailable} value={connection} onChange={e=>{setConnection(e.target.value);selection();}}><option value="">{t('conx.r.selConexion')}</option>{snapshot.connections.map(c=><option key={c.id} value={c.id}>{c.source} · {c.accountId}</option>)}</select></div></div>
      <div className="pc-ajuste"><div><h3>{t('conx.r.tipo')}</h3></div><div className="pc-ajuste-ctl"><select aria-label={t('conx.r.tipo')} disabled={unavailable} value={kind} onChange={e=>{setKind(e.target.value);selection();}}><option value="conversation">{t('conx.r.conversacion')}</option><option value="message">{t('conx.r.mensaje')}</option><option value="customer">{t('conx.r.cliente')}</option></select></div></div>
      <div className="pc-ajuste"><div><h3>{t('conx.r.identidad')}</h3></div><div className="pc-ajuste-ctl"><select aria-label={t('conx.r.identidad')} required disabled={unavailable||!sources.length} value={external} onChange={e=>{setExternal(e.target.value);clear();}}><option value="">{t('conx.r.selEntidad')}</option>{sources.map(s=><option key={s.id} value={s.externalId}>{s.externalId}</option>)}</select></div></div></div>
     <div style={{display:'flex',flexWrap:'wrap',gap:8}}><Button variant="ghost" disabled={unavailable||!cursor} onClick={()=>{selection();}}>{t('conx.r.primera')}</Button><Button variant="ghost" disabled={unavailable||!next} onClick={()=>{setCursor(next);setExternal('');setSources([]);clear();}}>{t('conx.r.siguiente')}</Button><Button type="submit" variant="primary" disabled={unavailable||!external||!snapshot.policy||!snapshot.ready}>{t('conx.r.previsualizar')}</Button></div></form>
   </div>
   {preview&&<section className="pc-card" aria-label={t('conx.r.alcance')} style={{borderColor:'var(--rovaq-rojo,#e8241c)'}}><div className="pc-card-head"><div><h2>{t('conx.r.revisar')}</h2><p>{t('conx.r.target',{conexion:preview.target.connectionId,tipo:preview.target.entityType,id:preview.target.externalId})}</p></div></div>
    <p className="ac-nota" style={{fontSize:13,color:'var(--ink)'}}>{t('conx.r.resumen',{conv:preview.scope.conversations.length,msgs:preview.scope.messages.length,revs:preview.scope.revisions.length,vecs:preview.scope.vectors.length,der:preview.scope.derived.length,art:preview.scope.artifacts.length,jobs:preview.scope.jobs.length,probs:preview.scope.problems.length,raw:preview.scope.rawObjects.length})}</p>
    <h3 style={{margin:0,font:'600 13px/1.4 var(--font-ui)'}}>{t('conx.r.rawTitulo')}</h3>{preview.scope.rawFiles.length?<ul className="pc-lista ui-reset">{preview.scope.rawFiles.map(f=><li key={f.importId} style={{listStyle:'none'}}><span className="pc-grow"><span className="pc-t">{f.path}</span><span className="pc-s">{t('conx.r.rawFilas',{n:f.rows})}</span></span></li>)}</ul>:<p className="ac-nota">{t('conx.r.rawNinguno')}</p>}
    <p className="ac-nota">{t('conx.r.solicitud',{id:preview.requestId,version:preview.scope.policy.version,hora:new Date(preview.expiresAt).toLocaleTimeString(loc)})}</p>
    <label style={{display:'flex',gap:8,alignItems:'center',fontSize:13}}><input type="checkbox" disabled={unavailable} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>{t('conx.r.confirmoAlcance')}</label>
    <div><Button disabled={unavailable||!confirmed} onClick={()=>void action('erase',{token:preview.token,requestId:preview.requestId,confirmed:true})}>{t('conx.r.confirmarBorrado')}</Button></div></section>}
   <section className="pc-card" data-flush aria-label={t('conx.r.purga')}><header className="pc-card-head"><div><h2>{t('conx.r.archFis')}</h2><p>{t('conx.r.pendElim',{p:snapshot.counts.pending,d:snapshot.counts.deleted})}</p></div><Button size="sm" disabled={unavailable||!snapshot.counts.pending} onClick={()=>void action('purge')}>{t('conx.r.eliminarReint')}</Button></header>
    {snapshot.artifacts.length?<div className="ui-table-wrap" tabIndex={0} role="region" aria-label={t('conx.r.archFis')}><table className="ui-table"><caption className="sr-only">{t('conx.r.archFis')}</caption><thead><tr><th scope="col">{t('conx.r.clase')}</th><th scope="col">{t('conx.r.ruta')}</th><th scope="col">{t('conx.r.estado')}</th></tr></thead><tbody>{snapshot.artifacts.map(a=><tr key={a.id}><th scope="row" data-align="start">{a.class}</th><td>{a.path}</td><td><span className="pc-estado" data-tono={a.status==='deleted'?'ok':a.status==='pending'?'warn':'off'}>{a.status==='deleted'?t('conx.r.st.deleted'):a.status==='pending'?t('conx.r.st.pending'):t('conx.r.st.kept')}</span></td></tr>)}</tbody></table></div>:<p className="ac-vacio" style={{margin:'0 14px 14px'}}>{t('conx.r.sinArch')}</p>}</section>
  </>}
 </section>;
}
