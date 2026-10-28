"use client";
import {RovaqCargando} from './rovaq-cargando';
import {useAutoRefresh} from './ui/use-auto-refresh';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {pedirSwr,leerSwr,claveSwr,invalidarSwr} from '../lib/workspace/swr.mjs';
import {LineaCache} from './ui/linea-cache';
import {useVistaPersistente} from './workspace/vista-persistente';
const useAntesDePintar=typeof window==='undefined'?useEffect:useLayoutEffect;
const validaConexiones=(j:unknown)=>Array.isArray((j as {connections?:unknown})?.connections)?j:null;
import {Button} from './ui/button';
import {SegmentedControl} from './ui/segmented';
import {StatusChip} from './ui/status-chip';
import {ProgressRing} from './ui/progress-ring';
import {EmptyState} from './ui/empty-state';
import {Icon} from './ui/icons';
import {BrandBadge,ConMarca,marcaDe} from './ui/brand-mark';
import {SkeletonRows} from './ui/skeletons';
import styles from './connections.module.css';
import {useJson} from './ui/use-json';
import {estadoConexion,nombreFuente,type EstadoConexion} from '../lib/connections/estado.mjs';
import {useT,useLocaleIntl} from './i18n/proveedor';
import type {Traductor} from '../lib/i18n';
import type {CoverageView} from '../../../../packages/workspace-service/provenance.mjs';
import type {ConnectionHealth} from '../../../../packages/connectors/health.mjs';
const sourceName=nombreFuente;
const CONFIG_STATUS:Record<string,'conx.h.cfg.active'|'conx.h.cfg.paused'|'conx.h.cfg.disabled'|'conx.h.cfg.reconnect_required'>={active:'conx.h.cfg.active',paused:'conx.h.cfg.paused',disabled:'conx.h.cfg.disabled',reconnect_required:'conx.h.cfg.reconnect_required'};
const lag=(seconds:number)=>seconds<3600?Math.max(1,Math.floor(seconds/60))+' min':seconds<86400?Math.floor(seconds/3600)+' h':Math.floor(seconds/86400)+' d';
const date=(value:string|null,empty:string,loc:string)=>value?new Date(value).toLocaleString(loc):empty;
async function read(t:Traductor,signal?:AbortSignal):Promise<ConnectionHealth[]>{
 const response=await pedirSwr('/api/connections',{signal,valida:validaConexiones});
 if(response.status<200||response.status>=300)throw Object.assign(new Error(response.status===401||response.status===403?t('conx.h.errAcceso'):t('conx.h.errEstado')),{estado:response.status});
 const data=response.json as {connections?:ConnectionHealth[]};if(!Array.isArray(data?.connections))throw new Error(t('conx.h.errRespuesta'));return data.connections;
}
export function ConnectionHealthPanel(){
 const t=useT(),loc=useLocaleIntl();
 const recheckPending=useRef(false),rowsRef=useRef<ConnectionHealth[]>([]);
 const {data:coverage,busy:coverageBusy}=useJson<CoverageView>('/api/coverage',j=>{const d=(j as {data?:CoverageView})?.data;return Array.isArray(d?.sources)?d as CoverageView:null;});
 const sources=coverage?.sources??null,est=(r:ConnectionHealth):EstadoConexion=>estadoConexion(r,sources,t);
 const [rows,setRows]=useState<ConnectionHealth[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[confirmed,setConfirmed]=useState<Record<string,string|null>>({}),[tab,setTab]=useVistaPersistente<'all'|'ok'|'pending'>('conexiones:pestana','all'),[picked,setPicked]=useVistaPersistente<string|null>('conexiones:elegida',null),[edad,setEdad]=useState<number|null>(null),[viejo,setViejo]=useState(false);
 useAntesDePintar(()=>{const g=leerSwr(claveSwr('/api/connections')),v=(g?.datos as {connections?:ConnectionHealth[]}|undefined)?.connections;if(g&&Array.isArray(v)){setRows(v);setEdad(g.edadMs);if(g.fresca)setBusy(false);}},[]);
 useEffect(()=>{const controller=new AbortController();async function load(){try{const g=leerSwr(claveSwr('/api/connections'));if(g?.fresca){setBusy(false);return;}const data=await read(t,controller.signal);if(!controller.signal.aborted){setRows(data);setEdad(null);setViejo(false);}}catch(e){if(!controller.signal.aborted){const st=(e as {estado?:number}).estado;if(rowsRef.current.length>0&&(st===undefined||st>=500))setViejo(true);else setError(e instanceof Error?e.message:t('conx.h.errEstado'));}}finally{if(!controller.signal.aborted)setBusy(false);}}void load();return()=>controller.abort();},[]); // eslint-disable-line react-hooks/exhaustive-deps
useEffect(()=>{rowsRef.current=rows;},[rows]);
 // Datos nuevos: relectura en segundo plano; conserva las filas pintadas (si falla, se rotula la línea de caché) y no corre durante un reintento.
 async function refresh(){if(recheckPending.current)return;invalidarSwr({prefijo:'/api/connections'});try{const data=await read(t);if(recheckPending.current)return;setRows(data);setEdad(null);setViejo(false);setError('');}catch(e){const st=(e as {estado?:number}).estado;if(rowsRef.current.length>0&&(st===undefined||st>=500))setViejo(true);}}
 useAutoRefresh(refresh,{ocupado:()=>recheckPending.current});
 async function recheck(row:ConnectionHealth){if(recheckPending.current)return;recheckPending.current=true;setBusy(true);setError('');try{const response=await fetch('/api/connections/'+row.id+'/recheck',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmedCredentialRotation:Boolean(row.reconnect?.attemptId&&confirmed[row.id]===row.reconnect.attemptId),expectedAttemptId:row.reconnect?.attemptId})});if(!response.ok)throw new Error(response.status===403?t('conx.h.errSoloProp'):t('conx.h.errIntento'));invalidarSwr({prefijo:'/api/connections'});setRows(await read(t));setEdad(null);setConfirmed(previous=>({...previous,[row.id]:null}));}catch(e){setError(e instanceof Error?e.message:t('conx.h.errIntentoCorto'));}finally{recheckPending.current=false;setBusy(false);}}
 const shownRows=rows.filter(r=>tab==='all'||(tab==='ok')===est(r).ok),row=shownRows.find(r=>r.id===picked)??shownRows[0]??null;
 const okCount=rows.filter(r=>est(r).ok).length,e=row?est(row):null;
 if(busy&&rows.length===0&&!error)return <RovaqCargando mensaje=""/>;
 return <section className="task-card connection-health" data-tour="fuentes" aria-labelledby="connections-title"><div className="card-title"><div><h2 id="connections-title">{t('conx.h.estadoTitulo')}</h2><p>{t('conx.h.estadoSub')}</p></div></div>
 {((busy&&rows.length===0)||(coverageBusy&&!coverage))&&<div role="status"><span className="sr-only">{t('conx.h.consultando')}</span><SkeletonRows rows={3}/></div>}{error&&<p role="alert" className="state state-error">{error}</p>}
 {!busy&&!error&&rows.length===0&&<EmptyState art="plug" compact title={t('conx.h.sinConexiones')} body={t('conx.h.sinConexionesBody')}/>}
 {rows.length>0&&<LineaCache edadMs={edad} actualizando={busy} viejo={viejo}/>}
 {!error&&rows.length>0&&!(coverageBusy&&!coverage)&&<>
  <SegmentedControl label={t('conx.h.filtrar')} size="sm" value={tab} onChange={setTab} options={[{value:'all',label:t('conx.h.todas'),count:rows.length},{value:'ok',label:t('conx.h.conectadas'),count:okCount},{value:'pending',label:t('conx.h.pendientes'),count:rows.length-okCount}]}/>
  <div className={styles.master}>
   <div className={styles.side}><ul className={styles.list} aria-label={t('conx.h.integraciones')}>{shownRows.map(r=><li key={r.id}><button type="button" className={styles.item} aria-pressed={row?.id===r.id} onClick={()=>setPicked(r.id)}>{marcaDe(r.source)?<BrandBadge marca={r.source}/>:<Icon name="plug" size={16}/>}<span className={styles.name}><strong>{sourceName(r.source)}</strong><small>{r.accountId}</small></span><StatusChip tone={est(r).tone}>{est(r).chip}</StatusChip></button></li>)}{shownRows.length===0&&<li className={styles.none}>{t('conx.h.sinPestana')}</li>}</ul><p className={styles.note}>{t('conx.h.soloLectura')}</p></div>
   {row&&e&&<article className={styles.detail} key={row.id} aria-label={sourceName(row.source)+' '+row.accountId}><header className={styles.dhead}><h2><ConMarca marca={row.source} tamaño={20}>{sourceName(row.source)}: {row.accountId}</ConMarca></h2><StatusChip tone={e.tone}>{e.estado}</StatusChip></header>
   <p className={styles.sub}>{t('conx.h.config',{estado:CONFIG_STATUS[row.connectionStatus]?t(CONFIG_STATUS[row.connectionStatus]):row.connectionStatus})}</p>
   {e.anillo&&<div className={styles.ringRow}><ProgressRing size={56} stroke={6} value={e.anillo.valor} label={e.anillo.pct+'%'} title={e.lineas[0]}/><span>{e.lineas[0]}</span></div>}
   {e.lineas.slice(e.anillo?1:0).length>0&&<ul className={styles.facts}>{e.lineas.slice(e.anillo?1:0).map(l=><li key={l}>{l}</li>)}</ul>}
   <dl className={styles.dl}>
 <dt>{t('conx.h.ultIntento')}</dt><dd>{date(row.lastAttempt,t('conx.h.sinIntentos'),loc)}</dd><dt>{e.ultimo.rotulo}</dt><dd>{date(e.ultimo.valor,e.ultimo.vacio,loc)}</dd>
 {row.lagSeconds!==null&&row.lastSuccess&&<><dt>{t('conx.h.tiempoDesde')}</dt><dd>{lag(row.lagSeconds)}</dd></>}
 <dt>{t('conx.h.permisos')}</dt><dd>{row.permissions==='revoked'?t('conx.h.perm.revoked'):row.permissions==='available'?t('conx.h.perm.available'):t('conx.h.perm.unknown')}</dd></dl>
 {row.watermark&&<details className={styles.tech}><summary>{t('conx.h.detalleTec')}</summary><p>{t('conx.h.huella')}<code>{row.watermark.value}</code></p></details>}
 {row.lagSeconds!==null&&row.lastSuccess&&<p className={styles.sub}>{t('conx.h.antiguedad')}</p>}
 {row.reconnect&&<aside className={styles.reconnect}><h3>{t('conx.h.pasosReconexion')}</h3><ol>{row.reconnect.steps.map(step=><li key={step}>{step}</li>)}</ol>{row.reconnect.canRequest&&<><label className="check-chip"><input type="checkbox" checked={Boolean(row.reconnect?.attemptId&&confirmed[row.id]===row.reconnect.attemptId)} onChange={event=>setConfirmed(previous=>({...previous,[row.id]:event.target.checked?row.reconnect?.attemptId??null:null}))}/><span>{t('conx.h.confirmoRot')}</span></label><Button variant="primary" size="sm" disabled={busy||!Boolean(row.reconnect?.attemptId&&confirmed[row.id]===row.reconnect.attemptId)} onClick={()=>void recheck(row)}>{t('conx.h.permitirIntento')}</Button></>}</aside>}
   </article>}
  </div></>}</section>;
}
