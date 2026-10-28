'use client';
import {RovaqCargando} from './rovaq-cargando';
import {useAutoRefresh} from './ui/use-auto-refresh';
import {refreshConnectionOptions} from '../lib/imports/connection-options';
import {ScrollTable} from './workspace/scroll-table';
import {Button,LinkButton,Arrow,Download} from './ui/button';
import {Drawer} from './ui/overlay';
import {EmptyState} from './ui/empty-state';
import {useOnboarding} from './onboarding/contexto';
import {rolTieneCapacidad} from '../lib/onboarding/catalogo.mjs';
import type {Role} from '@vexa/platform/capabilities';
import {StatusChip} from './ui/status-chip';
import {FunnelChart} from './ui/funnel-chart';
import {TickBar} from './ui/progress-ring';
import {Stepper} from './ui/stepper';
import {Tip} from './ui/tip';
import {Icon} from './ui/icons';
import {nf} from './ui/format';
import {useJson} from './ui/use-json';
import {agregadoImportaciones,desgloseImportaciones} from '../lib/connections/estado.mjs';
import {DatosCabecera} from './datos/datos-cabecera';
import {KpiLinea} from './panel-comun/kpi-linea';
import './panel-comun/panel-comun.css';
import type {CoverageView} from '../../../../packages/workspace-service/provenance.mjs';
import styles from './import-preview.module.css';
import {useLayoutEffect,useEffect,useState,useRef} from 'react';
import {useT,useLocaleIntl} from './i18n/proveedor';
import type {Clave,Traductor} from '../lib/i18n';
import type {Mapping,Preview} from '../../../../packages/ingestion/mapping.mjs';
type TeamJob={id:string;state:string;created_at:string;accepted:string;rejected:string;duplicates:string;account_id:string};
const jobLabels:Record<string,Clave>={queued:'conx.i.job.queued',running:'conx.i.job.running',succeeded:'conx.i.job.succeeded',partial:'conx.i.job.partial',failed:'conx.i.job.failed',cancelled:'conx.i.job.cancelled'};
// Traductor activo para los mensajes de api() (función de módulo); lo fija el componente al renderizar. Sin él, español.
const tApiRef:{current:Traductor|null}={current:null};
type Reservation={id:string;state:string;mapping_version:string};
type Detail={import:Reservation&{file_hash:string;expires_at:string;content_type?:string;job_id?:string};mapping:Mapping|null;headers?:string[];sheets?:string[];preview?:Preview;preview_state:string;upload_token?:string};
const messageFields=['id','text','date','order','sku','amount','currency','customer','role','conversation'] as const;
const customerFields=['id','raw','raw_hash','source_file','source_index','source_file_hash','source_observed_at','provider_account'] as const;
const associationFields=['id','raw','raw_hash','container_raw','container_hash','source_file','source_index','source_file_hash','source_observed_at','provider_account','source_version','pair_index','global_ordinal','bridge','bridge_hash'] as const;
const jobTone=(state:string)=>state==='succeeded'?'ok':state==='partial'?'warn':state==='failed'?'bad':state==='running'||state==='queued'?'info':'muted';
const big=(rows:TeamJob[],key:'accepted'|'rejected'|'duplicates')=>rows.reduce((a,j)=>a+BigInt(/^\d+$/.test(j[key])?j[key]:'0'),0n);
const initial:Mapping={columns:{id:'',text:''},timezone:'',dateFormat:'iso',currency:null};
async function api(route:string,body?:unknown,key?:string,signal?:AbortSignal){const r=await fetch('/api/imports'+route,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:body===undefined?undefined:JSON.stringify(body),signal}).catch(()=>{throw new Error(tApiRef.current?tApiRef.current('conx.i.errRespuesta'):'No se pudo recibir la respuesta. Revisa el estado antes de repetir la operación.');});const j=await r.json();if(!r.ok)throw new Error(`${j.error?.message||(tApiRef.current?tApiRef.current('conx.i.errSolicitud'):'No se pudo completar la solicitud de importación.')} ${tApiRef.current?tApiRef.current('conx.i.codigo',{status:r.status,code:j.error?.code?' · '+j.error.code:''}):`(código ${r.status}${j.error?.code?' · '+j.error.code:''})`}`);return j.data;}
const cargaFecha=(iso:string,loc:string)=>new Intl.DateTimeFormat(loc,{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(iso));
export function ImportPreview(){
 const t=useT(),loc=useLocaleIntl();useLayoutEffect(()=>{tApiRef.current=t;});
 const [connections,setConnections]=useState<{id:string;source:string;account_id:string}[]>([]),[reservations,setReservations]=useState<Reservation[]>([]),[connection,setConnection]=useState(''),[file,setFile]=useState<File|null>(null),[detail,setDetail]=useState<Detail|null>(null),[mapping,setMapping]=useState<Mapping>(initial),[preview,setPreview]=useState<Preview|null>(null),[headers,setHeaders]=useState<string[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[approved,setApproved]=useState(false),[openConn,setOpenConn]=useState(false),[openSample,setOpenSample]=useState(false);
 const [sheets,setSheets]=useState<string[]>([]),[nextOffset,setNextOffset]=useState<number|null>(null),[nextConnectionOffset,setNextConnectionOffset]=useState<number|null>(null);
 const [canConfigure,setCanConfigure]=useState(false),[connectionName,setConnectionName]=useState('');
 // Subir archivos exige la capacidad «import» (propietario y analista): operador y lector ven las importaciones, pero no el bloque de carga. El servidor sigue siendo quien decide.
 const rolSesion=useOnboarding()?.datos.rol,puedeImportar=rolSesion===undefined||rolTieneCapacidad(rolSesion as Role,'import');
 const [teamJobs,setTeamJobs]=useState<TeamJob[]>([]),[nextTeamOffset,setNextTeamOffset]=useState<number|null>(null);
 const retry=useRef<{fingerprint:string;key:string;id?:string}|null>(null);
 const {data:coverage}=useJson<CoverageView>('/api/coverage',j=>{const d=(j as {data?:CoverageView})?.data;return Array.isArray(d?.sources)?d as CoverageView:null;});
 const total=agregadoImportaciones(coverage?.sources);
 async function run(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn();}catch(e){const message=e instanceof Error?e.message:t('conx.i.errImport');setError(message);setTeamJobs([]);setNextTeamOffset(null);if(/^40[13]:/.test(message))setCanConfigure(false);if(/mapping_version_conflict|confirmation_conflict|upload_capability_invalid|reservation_expired/.test(message))setApproved(false);}finally{setBusy(false);}}
 async function list(offset=0,connectionOffset=0,append=false,teamOffset=0){
  const data=await api(`?offset=${offset}&connection_offset=${connectionOffset}&team_offset=${teamOffset}`);
  const refreshed=append?data.connections:await refreshConnectionOptions(data,connection,next=>api(`?offset=${offset}&connection_offset=${next}&team_offset=${teamOffset}`));
  setTeamJobs(previous=>append?Array.from(new Map([...previous,...(data.team_jobs??[])].map(j=>[j.id,j])).values()):(data.team_jobs??[]));
  if(!append||teamOffset>0)setNextTeamOffset(data.next_team_offset??null);
  setCanConfigure(data.canConfigure===true);
  setConnections(previous=>append?Array.from(new Map([...previous,...refreshed].map(c=>[c.id,c])).values()):refreshed);
  if(!append&&!refreshed.some((item:{id:string})=>item.id===connection))setConnection('');
  setReservations(previous=>append?Array.from(new Map([...previous,...data.reservations].map(r=>[r.id,r])).values()):data.reservations);
  if(!append||offset>0)setNextOffset(data.next_offset);
  if(!append||connectionOffset>0)setNextConnectionOffset(data.next_connection_offset);
 }

 // Datos nuevos: relectura en segundo plano de la primera página de cargas y reservas; se funde con lo ya pintado (no pierde páginas abiertas ni toca el formulario).
 const busyRef=useRef(true);useLayoutEffect(()=>{busyRef.current=busy;});
 useAutoRefresh(async()=>{
  if(busyRef.current)return;
  const data=await api('?offset=0&connection_offset=0&team_offset=0');if(busyRef.current)return;
  const fundir=<T extends {id:string}>(nuevos:T[],previos:T[])=>{const ids=new Set(nuevos.map(x=>x.id));return [...nuevos,...previos.filter(x=>!ids.has(x.id))];};
  setCanConfigure(data.canConfigure===true);setTeamJobs(previous=>fundir<TeamJob>(data.team_jobs??[],previous));setReservations(previous=>fundir<Reservation>(data.reservations??[],previous));
 },{ocupado:()=>busyRef.current});
 useEffect(()=>{
  const controller=new AbortController();
  async function initialize(){
   try{
    const data=await api('?offset=0&connection_offset=0',undefined,undefined,controller.signal);
    if(controller.signal.aborted)return;
    setCanConfigure(data.canConfigure===true);setConnections(data.connections);setReservations(data.reservations);setTeamJobs(data.team_jobs??[]);setNextTeamOffset(data.next_team_offset??null);
    setNextOffset(data.next_offset);setNextConnectionOffset(data.next_connection_offset);
   }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:t('conx.i.errImport'));}
   finally{if(!controller.signal.aborted)setBusy(false);}
  }
  void initialize();
  return()=>controller.abort();
 },[]); // eslint-disable-line react-hooks/exhaustive-deps
 async function createConnection(){const data=await api('/connections',{account_id:connectionName});await list();setConnections(previous=>previous.some(c=>c.id===data.connection.id)?previous:[...previous,data.connection]);setConnection(data.connection.id);setConnectionName('');setOpenConn(false);setNotice(data.created?t('conx.i.noticeCsvNueva'):t('conx.i.noticeCsvExiste'));}
 async function load(id:string,sheet?:string){const d:Detail=await api('/'+id+(sheet?'?sheet='+encodeURIComponent(sheet):''));setDetail(d);setMapping(sheet?{...initial,sheet}:d.mapping??{...initial,sheet:d.sheets?.length===1?d.sheets[0]:null});setPreview(d.preview??null);setHeaders(d.preview?.headers??d.headers??[]);setSheets(d.preview?.sheets??d.sheets??[]);setApproved(Boolean(!sheet&&d.mapping&&d.upload_token&&new Date(d.import.expires_at)>new Date()));setNotice(d.preview_state==='awaiting_upload'?t('conx.i.noticePendiente'):d.preview_state==='sheet_required'?t('conx.i.noticeHoja'):d.import.state==='queued'?t('conx.i.noticeCola'):t('conx.i.noticeConfigura'));}
 function change(next:Mapping){setMapping(next);setApproved(false);setPreview(null);}
 function changeProfile(value:string){
  if(value==='hubspot-ticket-contact-association-v1'){
   if(detail?.import.content_type!=='text/csv')return;
   change({...mapping,columns:{id:'',...Object.fromEntries(associationFields.map(k=>[k,headers.includes(k)?k:'']))},profile:'hubspot-ticket-contact-association-v1',timezone:'UTC',dateFormat:'iso',currency:null,sheet:null});
  }else if(value==='hubspot-contact-csv-v1'){
   if(detail?.import.content_type!=='text/csv')return;
   change({...mapping,columns:{id:mapping.columns.id??'',...Object.fromEntries(customerFields.filter(k=>k!=='id').map(k=>[k,null]))},profile:'hubspot-contact-csv-v1',timezone:'UTC',dateFormat:'iso',currency:null,sheet:null});
  }else if(value==='history-message-v1'){
   if(detail?.import.content_type!=='text/csv')return;
   change({...mapping,columns:['hubspot-contact-csv-v1','hubspot-ticket-contact-association-v1'].includes(mapping.profile??'')?{id:mapping.columns.id,text:''}:mapping.columns,profile:'history-message-v1',dateFormat:'iso'});
  }else if(value===''){
   const next={...mapping,columns:['hubspot-contact-csv-v1','hubspot-ticket-contact-association-v1'].includes(mapping.profile??'')?{id:mapping.columns.id,text:''}:mapping.columns};delete next.profile;change(next);
  }
 }
 function checkProfile(){
  if(!mapping.profile)return;
  if(detail?.import.content_type!=='text/csv')throw Error(t('conx.i.errCsvHist'));
  if(mapping.profile==='hubspot-ticket-contact-association-v1'){
   if(mapping.timezone!=='UTC'||mapping.dateFormat!=='iso'||associationFields.some(k=>!mapping.columns[k]))throw Error(t('conx.i.errVinculos'));
   return;
  }
  if(mapping.profile==='hubspot-contact-csv-v1'){
   if(mapping.dateFormat!=='iso'||customerFields.some(k=>!mapping.columns[k]))throw Error(t('conx.i.errClientes'));
   return;
  }
  if(mapping.dateFormat!=='iso'||(['id','text','date','role','conversation'] as const).some(k=>!mapping.columns[k]))throw Error(t('conx.i.errHistorico'));
 }
 async function upload(){if(!file||!connection)throw Error(t('conx.i.errSelConn'));if(file.size<1||file.size>20*1024*1024)throw Error(t('conx.i.errTam'));const bytes=await file.arrayBuffer(),sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');const type=file.name.toLowerCase().endsWith('.xlsx')?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/csv';const fingerprint=JSON.stringify([connection,sha,type]);if(retry.current?.fingerprint!==fingerprint)retry.current={fingerprint,key:crypto.randomUUID()};const attempt=retry.current!;
 try{if(attempt.id){const existing:Detail=await api('/'+attempt.id);if(existing.import.state==='reserved'&&new Date(existing.import.expires_at)<=new Date())throw Error('reservation_expired');if(existing.preview_state!=='awaiting_upload'){await load(attempt.id);await list();return;}}
 const d=await api('',{connection_id:connection,mapping_version:'interactive-unmapped-v1',content_type:type,size:file.size,sha256:sha},attempt.key);attempt.id=d.import_id;setNotice(t('conx.i.noticeSubiendo'));const r=await fetch(d.upload_url,{method:'PUT',headers:{'Content-Type':type},body:bytes}).catch(()=>{throw new Error(t('conx.i.errSubida'));});if(!r.ok)throw Error(t('conx.i.errObjeto'));await load(d.import_id);await list();}catch(e){if(e instanceof Error&&e.message.includes('reservation_expired'))retry.current=null;throw e;}}
 async function validate(){if(!detail)return;checkProfile();const p:Preview=await api('/'+detail.import.id+'/preview',{mapping});setPreview(p);setHeaders(p.headers);setNotice(t('conx.i.noticeValidacion'));}
 async function save(){if(!detail)return;checkProfile();const p=await api('/'+detail.import.id+'/mapping',{mapping,expected_version:detail.import.mapping_version});setPreview(p);setDetail({...detail,mapping,upload_token:p.upload_token,import:{...detail.import,mapping_version:p.mapping_version}});setApproved(true);setNotice(t('conx.i.noticeGuardada'));}
 async function confirm(){if(!detail||!approved)return;const d=await api('/'+detail.import.id+'/confirm',{upload_token:detail.upload_token,sha256:detail.import.file_hash,mapping_version:detail.import.mapping_version});setApproved(false);setNotice(d.state==='queued'?t('conx.i.noticeEnCola'):d.state);await load(detail.import.id);await list();}
 const hasWork=teamJobs.length>0||reservations.length>0,setupSteps=[{done:connections.length>0,label:t('conx.i.paso1')},{done:hasWork,label:t('conx.i.paso2')},{done:teamJobs.length>0,label:t('conx.i.paso3')}];
 const flow=[{key:'file',label:t('conx.i.flowArchivo'),state:detail?'done':'current'},{key:'map',label:t('conx.i.flowColumnas'),state:!detail?'todo':preview||approved?'done':'current'},{key:'val',label:t('conx.i.flowValidacion'),state:!detail?'todo':approved?'done':preview?'current':'todo'},{key:'queue',label:t('conx.i.flowCola'),state:detail&&(detail.import.state==='queued'||detail.import.job_id)?'done':approved?'current':'todo'}] as const;
 const jobAccepted=big(teamJobs,'accepted'),jobRejected=big(teamJobs,'rejected'),jobDup=big(teamJobs,'duplicates');
 const cov=preview?.coverage,valid=preview?preview.input_rows-preview.coverage.rejected:0;
 if(busy&&!error&&!canConfigure&&connections.length===0&&reservations.length===0&&teamJobs.length===0)return <RovaqCargando mensaje=""/>;
 return <section className="task-page import-page stack" aria-labelledby="imports-heading"><DatosCabecera actual="importaciones" title={t('conx.i.titulo')} description={t('conx.i.desc')} actions={<>{canConfigure&&<Button variant="primary" disabled={busy} onClick={()=>setOpenConn(true)}>{t('conx.i.nuevaCsv')}</Button>}</>}/>
 {error&&<p role="alert" className="state state-error">{error} {t('conx.i.errorTail')}</p>}<p role="status" aria-live="polite" className={busy||notice?'notice-bar':'sr-only'} data-tone="info">{busy?t('conx.i.procesando'):notice}</p>
 {!busy&&!error&&!hasWork&&!puedeImportar&&<EmptyState art="doc" title={t('rol.imp.vacioTituloSinCarga')} body={t('rol.imp.vacioSinCarga')}/>}
 {!busy&&!error&&!hasWork&&puedeImportar&&<EmptyState art="doc" title={t('conx.i.vacioTitulo')} body={canConfigure?t('conx.i.vacioBody'):t('rol.imp.vacioAnalista')} steps={setupSteps} action={canConfigure&&!connections.length?<Button variant="primary" onClick={()=>setOpenConn(true)}>{t('conx.i.crearCsv')}</Button>:undefined}/>}
 <Drawer open={openConn&&canConfigure} onClose={()=>setOpenConn(false)} title={t('conx.i.nuevaCsv')} subtitle={t('conx.i.drawerSub')} footer={<Button type="submit" form="import-source" variant="primary" disabled={busy||!connectionName.trim()}>{t('conx.i.crearCsv')}</Button>}>
  <form id="import-source" className="import-source" onSubmit={event=>{event.preventDefault();void run(createConnection);}}><fieldset disabled={busy} className="form-grid"><legend className="sr-only">{t('conx.i.nuevaCsv')}</legend><label className="field field-wide">{t('conx.i.nombreOrigen')}<input name="csv-account" value={connectionName} onChange={event=>setConnectionName(event.target.value)} required maxLength={200}/></label><p className="form-note field-wide">{t('conx.i.notaNombre')}</p></fieldset></form>
 </Drawer>
 {canConfigure&&(total||teamJobs.length>0)&&<KpiLinea label={t('conx.i.kpiLabel')} items={total?[
  {label:t('conx.i.k.cargasEsp'),value:nf.format(total.cargas),c:5,partes:total.porFuente.map(x=>({label:x.nombre,value:x.cargas})),nota:t('conx.i.k.nota1',{desglose:desgloseImportaciones(total.porFuente,'cargas')})},
  {label:t('conx.i.k.filasInc'),value:nf.format(total.incorporadas),c:3,partes:total.porFuente.map(x=>({label:x.nombre,value:x.incorporadas})),nota:t('conx.i.k.nota2',{desglose:desgloseImportaciones(total.porFuente)})},
  {label:t('conx.i.k.rechReglas'),value:nf.format(total.rechazadas),c:2,partes:[{label:t('conx.i.k.rechazadas'),value:Number(total.rechazadas)},{label:t('conx.i.k.incorporadas'),value:Number(total.incorporadas)}],nota:total.sinDesglose>0?t('conx.i.k.nota3a',{n:nf.format(total.sinDesglose)}):total.soloMetadatos>0?t('conx.i.k.nota3b',{n:nf.format(total.soloMetadatos)}):t('conx.i.k.nota3c')},
  {label:t('conx.i.k.pendientes'),value:nf.format(total.pendientes),c:4,partes:[{label:t('conx.i.k.pendientes'),value:Number(total.pendientes)},{label:t('conx.i.k.procesadas'),value:Number(total.incorporadas)}],nota:total.pendientes>0?t('conx.i.k.porProcesar'):t('conx.i.k.nadaProcesar')}]
  :[
  {label:t('conx.i.k.cargasList'),value:nf.format(teamJobs.length),c:1,partes:[{label:t('conx.i.k.aceptadas'),value:Number(jobAccepted)},{label:t('conx.i.k.rechazadas'),value:Number(jobRejected)},{label:t('conx.i.k.duplicadas'),value:Number(jobDup)}],nota:nextTeamOffset!==null?t('conx.i.k.notaRecientes'):t('conx.i.k.notaTabla')},
  {label:t('conx.i.k.filasAcep'),value:nf.format(jobAccepted),c:7,partes:[{label:t('conx.i.k.aceptadas'),value:Number(jobAccepted)},{label:t('conx.i.k.duplicadas'),value:Number(jobDup)}],nota:t('conx.i.k.soloListadas')},
  {label:t('conx.i.k.duplicadas'),value:nf.format(jobDup),c:2,partes:[{label:t('conx.i.k.duplicadas'),value:Number(jobDup)},{label:t('conx.i.k.aceptadas'),value:Number(jobAccepted)}],nota:t('conx.i.k.soloListadas')},
  {label:t('conx.i.k.rechazadas'),value:nf.format(jobRejected),c:2,partes:[{label:t('conx.i.k.rechazadas'),value:Number(jobRejected)},{label:t('conx.i.k.aceptadas'),value:Number(jobAccepted)}],nota:t('conx.i.k.soloListadas')}]}/>}
 {canConfigure&&<section className="pc-card" data-flush aria-labelledby="team-imports-heading"><div className="pc-card-head"><div><h2 id="team-imports-heading">{t('conx.i.t.titulo')}</h2><p>{teamJobs.length>0?t('conx.i.t.mostrando',{n:nf.format(teamJobs.length),de:total&&total.cargas>teamJobs.length?t('conx.i.t.de',{n:nf.format(total.cargas)}):nextTeamOffset!==null?t('conx.i.t.hayMas'):''}):''}{t('conx.i.t.incluye')}</p></div></div>{teamJobs.length?<div className="ui-table-wrap" tabIndex={0} role="region" aria-label={t('conx.i.t.region')}><table className="ui-table"><caption className="sr-only">{t('conx.i.t.caption')}</caption><thead><tr><th>{t('conx.i.t.origen')}</th><th>{t('conx.i.t.estado')}</th><th data-align="num">{t('conx.i.k.aceptadas')}</th><th data-align="num">{t('conx.i.k.rechazadas')}</th><th data-align="num">{t('conx.i.k.duplicadas')}</th><th>{t('conx.i.t.detalle')}</th></tr></thead><tbody>{teamJobs.map(j=><tr key={j.id}><th scope="row">{j.account_id}<small className={styles.when}>{cargaFecha(j.created_at,loc)} · {t('conx.i.t.ref')} {j.id.slice(0,6)}</small></th><td><StatusChip tone={jobTone(j.state)}>{jobLabels[j.state]?t(jobLabels[j.state]):j.state}</StatusChip></td><td data-align="num">{j.accepted}</td><td data-align="num"><Tip label={t('conx.i.t.tipRech')}><span className={styles.rejected}>{j.rejected}</span></Tip></td><td data-align="num">{j.duplicates}</td><td><LinkButton href={'/jobs/'+j.id} size="sm" variant="ghost" icon={<Arrow/>}>{t('conx.i.t.verProgreso')}</LinkButton></td></tr>)}</tbody></table></div>:<p role="status">{busy?<span className="sr-only">{t('conx.i.t.consultando')}</span>:error?t('conx.i.t.noVerificar'):t('conx.i.t.ninguno')}</p>}{nextTeamOffset!==null&&<div className="btn-group"><Button disabled={busy} onClick={()=>void run(()=>list(0,0,true,nextTeamOffset))}>{t('conx.i.t.masCargas')}</Button></div>}</section>}
 {!puedeImportar&&<p className="ac-nota" role="note">{t('rol.imp.soloLectura')}</p>}
 <div className="pc-grid" data-cols="6-6">{puedeImportar&&<div className="pc-card"><fieldset className={'import-upload '+styles.upload} disabled={busy}><legend className="pc-card-head" style={{padding:0}}><b style={{font:"600 14px/1.3 var(--font-ui)"}}>{t('conx.i.n.titulo')}</b></legend><label>{t('conx.i.n.conexion')}<select value={connection} onChange={e=>setConnection(e.target.value)}><option value="">{t('conx.i.n.selConexion')}</option>{connections.map(c=><option key={c.id} value={c.id}>{c.source} · {c.account_id}</option>)}</select></label>{!connections.length&&<p>{t('conx.i.n.sinConexiones')}</p>}<label className={styles.drop} data-has={file?'1':undefined}><Icon name="upload" size={20}/><span>{t('conx.i.n.archivo')}</span><small>{file?file.name:t('conx.i.n.formatos')}</small><input type="file" accept=".csv,.xlsx" onChange={e=>setFile(e.target.files?.[0]??null)}/></label><Button variant="primary" disabled={!connection||!file} icon={<Icon name="upload" size={14}/>} onClick={()=>void run(upload)}>{t('conx.i.n.reservar')}</Button></fieldset>{reservations.length>0?<ul className={'task-record-list '+styles.reservations} aria-label={t('conx.i.n.reservas')}>{reservations.map(r=><li key={r.id}><button disabled={busy} onClick={()=>void run(()=>load(r.id))}>{r.id} · {r.state}</button></li>)}</ul>:<p className="ac-nota">{t('conx.i.n.sinReservas')}</p>}</div>}<section className="pc-card" aria-label={t('conx.i.m.region')}><div className="pc-card-head"><div><h2>{t('conx.i.m.region')}</h2><p>{t('conx.i.m.sub')}</p></div></div><ul className="pc-lista ui-reset pc-fill" role="list"><li style={{listStyle:'none'}}><i className="pc-punto" style={{['--c' as string]:'var(--chart-8)'}}/><span className="pc-grow"><span className="pc-t">{t('conx.i.m.estandar')}</span><span className="pc-s">{t('conx.i.m.estandarD')}</span></span></li><li style={{listStyle:'none'}}><i className="pc-punto" style={{['--c' as string]:'var(--chart-8)'}}/><span className="pc-grow"><span className="pc-t">{t('conx.i.m.hist')}</span><span className="pc-s">{t('conx.i.m.histD')}</span></span></li><li style={{listStyle:'none'}}><i className="pc-punto" style={{['--c' as string]:'var(--chart-8)'}}/><span className="pc-grow"><span className="pc-t">{t('conx.i.m.clientes')}</span><span className="pc-s">{t('conx.i.m.clientesD')}</span></span></li><li style={{listStyle:'none'}}><i className="pc-punto" style={{['--c' as string]:'var(--chart-8)'}}/><span className="pc-grow"><span className="pc-t">{t('conx.i.m.vinculos')}</span><span className="pc-s">{t('conx.i.m.vinculosD')}</span></span></li></ul></section></div>
 {nextConnectionOffset!==null&&<div className="btn-group"><Button disabled={busy} onClick={()=>void run(()=>list(0,nextConnectionOffset,true))}>{t('conx.i.masConexiones')}</Button></div>}
 {nextOffset!==null&&<div className="btn-group"><Button disabled={busy} onClick={()=>void run(()=>list(nextOffset,0,true))}>{t('conx.i.masReservas')}</Button></div>}
 
 {detail&&<section className={'card '+styles.mapping}><Stepper label={t('conx.i.pasos')} steps={[...flow]}/>{detail.import.job_id&&<LinkButton href={'/jobs/'+detail.import.job_id} size="sm" icon={<Arrow/>}>{t('conx.i.verProgresoReal')}</LinkButton>}<div className="card-title"><div><h2>{t('conx.i.cfg.titulo')}</h2><p>{mapping.profile==='hubspot-ticket-contact-association-v1'?t('conx.i.cfg.assoc'):mapping.profile==='hubspot-contact-csv-v1'?t('conx.i.cfg.cust'):t('conx.i.cfg.msg')}</p></div><span className="chip">{t('conx.i.cfg.estado',{estado:detail.import.state,version:detail.import.mapping_version})}</span></div><fieldset className="task-fields import-mapping form-grid" disabled={busy||detail.import.state!=='reserved'}><legend className="sr-only">{t('conx.i.cfg.legend')}</legend>
 <label className="field">{t('conx.i.cfg.modo')}<select aria-describedby="import-profile-help" disabled={detail.import.content_type!=='text/csv'} value={mapping.profile??''} onChange={e=>changeProfile(e.target.value)}><option value="">{t('conx.i.cfg.modoStd')}</option><option value="history-message-v1" disabled={detail.import.content_type!=='text/csv'}>{t('conx.i.m.hist')}</option><option value="hubspot-contact-csv-v1" disabled={detail.import.content_type!=='text/csv'}>{t('conx.i.m.clientes')}</option><option value="hubspot-ticket-contact-association-v1" disabled={detail.import.content_type!=='text/csv'}>{t('conx.i.m.vinculos')}</option></select></label>
 <p id="import-profile-help" className="form-note field-wide">{detail.import.content_type==='text/csv'?t('conx.i.cfg.ayudaCsv'):t('conx.i.cfg.ayudaNoCsv')}</p>
 {mapping.profile==='history-message-v1'&&<details className="field-wide"><summary>{t('conx.i.cfg.reqHist')}</summary><p>{t('conx.i.cfg.reqHistD')}</p></details>}
 {mapping.profile==='hubspot-contact-csv-v1'&&<details className="field-wide"><summary>{t('conx.i.cfg.reqCli')}</summary><p>{t('conx.i.cfg.reqCliD')}</p></details>}
 {mapping.profile==='hubspot-ticket-contact-association-v1'&&<p className="form-note field-wide">{t('conx.i.cfg.notaVinc')}</p>}
 {(mapping.profile==='hubspot-ticket-contact-association-v1'?associationFields:mapping.profile==='hubspot-contact-csv-v1'?customerFields:messageFields).map(k=><label key={k} className="field">{t('conx.i.cfg.columna',{k})}{headers.length?<select value={mapping.columns[k]??''} onChange={e=>change({...mapping,columns:{...mapping.columns,[k]:e.target.value||null}} as Mapping)}><option value="">{['hubspot-contact-csv-v1','hubspot-ticket-contact-association-v1'].includes(mapping.profile??'')||k==='id'||k==='text'||(mapping.profile==='history-message-v1'&&['date','role','conversation'].includes(k))?t('conx.i.cfg.selObl'):t('conx.i.cfg.sinCol')}</option>{headers.map(h=><option key={h} value={h}>{h}</option>)}</select>:<input value={mapping.columns[k]??''} onChange={e=>change({...mapping,columns:{...mapping.columns,[k]:e.target.value}})}/>}</label>)}
 <label className="field">{t('conx.i.cfg.zona')}<input placeholder="America/Merida" disabled={mapping.profile==='hubspot-ticket-contact-association-v1'} value={mapping.timezone} onChange={e=>change({...mapping,timezone:e.target.value})}/></label><label className="field">{t('conx.i.cfg.formatoFecha')}<select disabled={Boolean(mapping.profile)} value={mapping.dateFormat} onChange={e=>change({...mapping,dateFormat:e.target.value as Mapping['dateFormat']})}><option value="iso">ISO</option><option value="ymd">AAAA-MM-DD</option><option value="dmy">DD/MM/AAAA</option><option value="mdy">MM/DD/AAAA</option></select></label>{!['hubspot-contact-csv-v1','hubspot-ticket-contact-association-v1'].includes(mapping.profile??'')&&<label className="field">{t('conx.i.cfg.moneda')}<select value={mapping.currency??''} onChange={e=>change({...mapping,currency:e.target.value||null})}><option value="">{t('conx.i.cfg.sinImportes')}</option>{['USD','MXN','EUR','GBP','CAD','AUD','JPY','KWD'].map(c=><option key={c}>{c}</option>)}</select></label>}<label className="field">{t('conx.i.cfg.hoja')}<select disabled={!sheets.length} value={mapping.sheet??''} onChange={e=>{setApproved(false);setPreview(null);void run(()=>load(detail.import.id,e.target.value));}}><option value="">{t('conx.i.cfg.selHoja')}</option>{sheets.map(sheet=><option key={sheet} value={sheet}>{sheet}</option>)}</select></label>
 <div className={'btn-group field-wide '+styles.actions}><Button onClick={()=>void run(validate)}>{t('conx.i.cfg.validar')}</Button><Button disabled={!preview} onClick={()=>void run(save)}>{t('conx.i.cfg.guardar')}</Button><Button variant="primary" disabled={!approved} onClick={()=>void run(confirm)}>{t('conx.i.cfg.confirmar')}</Button></div></fieldset>
 {preview&&cov&&<div className={styles.result}><h2>{t('conx.i.v.titulo',{n:preview.input_rows})}</h2>
  <div className={styles.resultGrid}><div><FunnelChart title={t('conx.i.v.embudo')} stages={[{key:'read',label:t('conx.i.v.leidas'),value:preview.input_rows,display:nf.format(preview.input_rows)},{key:'valid',label:t('conx.i.v.validas'),value:valid,display:nf.format(valid)},{key:'acc',label:t('conx.i.v.aceptadas'),value:cov.accepted,display:nf.format(cov.accepted)}]}/></div>
  <div className={styles.chips}><TickBar title={t('conx.i.v.tick',{acc:nf.format(cov.accepted),total:nf.format(preview.input_rows)})} value={preview.input_rows>0?cov.accepted/preview.input_rows:0}/><ul className={styles.chipRow}><li><StatusChip tone="ok">{t('conx.i.v.chipAcep',{n:nf.format(cov.accepted)})}</StatusChip></li><li><Tip label={t('conx.i.t.tipRech')}><StatusChip tone="muted">{t('conx.i.v.chipRech',{n:nf.format(cov.rejected)})}</StatusChip></Tip></li><li><StatusChip tone="info">{t('conx.i.v.chipDup',{n:nf.format(cov.duplicates)})}</StatusChip></li><li><StatusChip tone="warn">{t('conx.i.v.chipPend',{n:nf.format(cov.pending)})}</StatusChip></li></ul></div></div>
  <p className={styles.note}>{t('conx.i.v.nota',{limit:preview.sample.limit})}</p>
  <div className="btn-group"><Button icon={<Icon name="eye" size={14}/>} onClick={()=>setOpenSample(true)}>{t('conx.i.v.verMuestra')}</Button>{detail.mapping&&<LinkButton href={'/api/imports/'+detail.import.id+'/errors.csv'} download="" icon={<Download/>}>{t('conx.i.v.descargar')}</LinkButton>}</div>
  <Drawer open={openSample} onClose={()=>setOpenSample(false)} width={720} title={t('conx.i.v.muestra')} subtitle={t('conx.i.v.muestraSub',{limit:preview.sample.limit})}>
   <ScrollTable label={t('conx.i.v.tablaDesp')}><table className="dtable"><caption className="sr-only">{t('conx.i.v.muestra')}</caption><thead><tr><th>{t('conx.i.v.fila')}</th><th>ID</th>{mapping.profile==='hubspot-ticket-contact-association-v1'?<><th>{t('conx.i.v.ticket')}</th><th>{t('conx.i.v.contacto')}</th><th>{t('conx.i.v.prueba')}</th></>:mapping.profile==='hubspot-contact-csv-v1'?<><th>{t('conx.i.v.nombre')}</th><th>{t('conx.i.v.ultMod')}</th></>:<><th>{t('conx.i.v.texto')}</th><th>{t('conx.i.v.fechaUtc')}</th><th>Importe minor units</th></>}</tr></thead><tbody>{preview.sample.rows.map(r=><tr key={r.line}><td>{r.line}</td><td>{r.id}</td>{r.entity_type==='association'?<><td>{r.ticket_id}</td><td>{r.contact_id}</td><td>{{valid:t('conx.i.v.bridge.valid'),missing:t('conx.i.v.bridge.missing'),malformed:t('conx.i.v.bridge.malformed')}[r.bridge_status]}</td></>:r.entity_type==='customer'?<><td>{r.display_name??t('conx.i.v.desconocido')}</td><td>{r.occurred_at??t('conx.i.v.desconocida')}</td></>:<><td>{r.text}</td><td>{r.occurred_at??t('conx.i.v.desconocida')}</td><td>{r.money?`${r.money.amount_minor} ${r.money.currency}`:t('conx.i.v.desconocido')}</td></>}</tr>)}</tbody></table></ScrollTable>
   {preview.errors.length>0&&<><h3>{t('conx.i.v.erroresFila')}</h3><ul className="row-list">{preview.errors.slice(0,100).map((e,i)=><li key={i}>{t('conx.i.v.filaErr',{line:e.line,field:String(e.field ?? ''),code:String(e.code ?? '')})}</li>)}</ul></>}
  </Drawer></div>}
 </section>}
 </section>;
}
