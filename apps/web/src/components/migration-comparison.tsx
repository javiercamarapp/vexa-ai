'use client';
import {useAutoRefresh} from './ui/use-auto-refresh';
import {ScrollTable} from './workspace/scroll-table';
import {PageHeader} from './ui/page-header';
import {KpiLinea} from './panel-comun/kpi-linea';
import './panel-comun/panel-comun.css';
import {Button} from './ui/button';
import {StatCard} from './ui/stat-card';
import {StatusChip} from './ui/status-chip';
import {BarList} from './ui/bar-list';
import {EmptyState} from './ui/empty-state';
import {IdChip} from './ui/id-chip';
import {Icon} from './ui/icons';
import {SkeletonStats} from './ui/skeletons';
import {nf} from './ui/format';
import css from './ops-panels.module.css';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {ComparisonResult,ComparisonSnapshot} from '../../../../packages/connectors/comparability.mjs';
const reasonLabels:Record<string,string>={currency_unit_changed:'Cambió la unidad monetaria; los importes no son comparables.',scope_changed:'Cambiaron filtros, ventana, moneda o base temporal.',pipeline_changed:'Cambió la versión del procesamiento.',mapping_changed:'Cambió el mapeo de las fuentes.',taxonomy_changed:'Cambió la taxonomía: documenta el cambio y genera cortes con el mismo método.',channel_coverage_changed:'Cambió la cobertura de canales; menos casos no significa una mejora.',incomplete_evidence:'Hay datos sin versión, fecha o canal verificable.',empty_dataset:'Uno de los cortes no contiene conversaciones.'};

function moneyText(value:string|null|undefined,exponent:number|undefined){if(value==null)return 'desconocido';if(exponent===undefined)return value+' (unidad sin verificar)';const negative=value.startsWith('-'),digits=(negative?value.slice(1):value).padStart(exponent+1,'0');return (negative?'-':'')+(exponent?digits.slice(0,-exponent)+'.'+digits.slice(-exponent):digits);}
export function MigrationComparison(){
 const requestGeneration=useRef(0);
 const [denied,setDenied]=useState(false);
 const [snapshots,setSnapshots]=useState<ComparisonSnapshot[]>([]),[before,setBefore]=useState(''),[after,setAfter]=useState(''),[result,setResult]=useState<ComparisonResult|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[nextCursor,setNextCursor]=useState<string|null>(null);
 const [start,setStart]=useState(''),[end,setEnd]=useState(''),[timezone,setTimezone]=useState('UTC'),[currency,setCurrency]=useState('USD'),[sources,setSources]=useState(''),[channels,setChannels]=useState('');
 const api=useCallback(async(url:string,body?:unknown,signal?:AbortSignal)=>{
  const generation=++requestGeneration.current;
  const response=await fetch('/api/migrations'+url,{method:body===undefined?'GET':'POST',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal});
  if(signal?.aborted||generation!==requestGeneration.current)throw new DOMException('Respuesta obsoleta','AbortError');
  if([401,403].includes(response.status)){requestGeneration.current++;setDenied(true);setSnapshots([]);setBefore('');setAfter('');setResult(null);setNextCursor(null);setLoaded(false);setStart('');setEnd('');setTimezone('UTC');setCurrency('USD');setSources('');setChannels('');throw Error('Ya no tienes autorización para consultar o modificar estos cortes.');}
  if(!response.ok)throw Error(response.status===409?'No se pudo congelar o comparar este alcance. Comprueba versiones, identidades y límites del conjunto de datos.':'No se pudo consultar el servicio de comparación. Reintenta.');
  const data=await response.json();if(signal?.aborted||generation!==requestGeneration.current)throw new DOMException('Respuesta obsoleta','AbortError');return data;
 },[]);
 const refresh=useCallback(async(signal?:AbortSignal)=>{const body=await api('',undefined,signal);setSnapshots(body.snapshots);setNextCursor(body.nextCursor);setLoaded(true);setDenied(false);},[api]);
 useEffect(()=>{const controller=new AbortController();void Promise.resolve().then(()=>refresh(controller.signal)).catch(e=>{if(!controller.signal.aborted&&e.name!=='AbortError')setError(e.message);});return()=>controller.abort();},[refresh]);
 // Datos nuevos: relectura en segundo plano de los cortes; no corre durante una acción.
 const busyRef=useRef(false);busyRef.current=busy;
 useAutoRefresh(()=>refresh(),{ocupado:()=>busyRef.current});
 async function action(work:()=>Promise<void>){setError('');setBusy(true);try{await work();}catch(e){if(!(e instanceof Error&&e.name==='AbortError'))setError(e instanceof Error?e.message:'Error de comparación.');}finally{setBusy(false);}}
 const label=(s:ComparisonSnapshot)=>`${s.id.slice(0,8)} · ${s.watermark} · ${s.summary.conversations} conversaciones`; const countLabels:Record<string,string>={conversations:'Conversaciones resueltas',sourceConversations:'Conversaciones fuente',messages:'Mensajes fuente',orders:'Órdenes vinculadas'};
 const countIcons:Record<string,string>={conversations:'message',sourceConversations:'database',messages:'mail',orders:'receipt'};
 return <section className="stack">
  <PageHeader eyebrow="Interno" title="Comparación de migración" description="Cortes inmutables antes y después; las diferencias no demuestran ahorro ni efecto causal."/>
  {error&&<p role="alert" className="notice-bar"><Icon name="alert" size={14}/>{error}</p>}
  {!loaded&&!error&&<><p role="status" className="sr-only">Cargando cortes…</p><SkeletonStats count={2}/></>}
  {loaded&&<KpiLinea label="Indicadores de cortes" items={[
   {label:'Cortes guardados',value:nf.format(snapshots.length)+(nextCursor?'+':''),c:5,partes:snapshots.map(x=>({label:x.id.slice(0,6),value:Number(x.summary.conversations)})),nota:snapshots.length?'Conversaciones por corte':'Sin cortes'},
   {label:'Conversaciones del último corte',value:snapshots[0]?nf.format(snapshots[0].summary.conversations):'—',vacio:!snapshots[0],c:3,partes:snapshots[0]?[{label:'Último',value:Number(snapshots[0].summary.conversations)}]:undefined,nota:snapshots[0]?'Corte '+snapshots[0].id.slice(0,6)+'…'+snapshots[0].id.slice(-3):'Sin cortes'}]}/>}
  {loaded&&!snapshots.length&&<EmptyState art="doc" title="Aún no hay cortes publicados" body="Congela el conjunto de datos para crear el primero." compact/>}
  <div className="split" data-even>
   <fieldset className="card" disabled={busy||denied} style={{margin:0}}><legend className="sr-only">Seleccionar cortes guardados</legend>
    <div className="card-title"><div><h2>Comparar dos cortes</h2><p>Selecciona el baseline y el corte posterior</p></div>{nextCursor&&<Button size="sm" variant="ghost" onClick={()=>void action(async()=>{const data=await api('?'+new URLSearchParams({cursor:nextCursor}));setSnapshots(previous=>[...previous,...data.snapshots.filter((s:ComparisonSnapshot)=>!previous.some(p=>p.id===s.id))]);setNextCursor(data.nextCursor);})}>Cargar cortes anteriores</Button>}</div>
    <div className={css.form}>
     <label htmlFor="comparison-before">Antes</label><select id="comparison-before" value={before} onChange={e=>{setBefore(e.target.value);setResult(null);}}><option value="">Selecciona baseline</option>{snapshots.map(s=><option key={s.id} value={s.id}>{label(s)}</option>)}</select>
     <label htmlFor="comparison-after">Después</label><select id="comparison-after" value={after} onChange={e=>{setAfter(e.target.value);setResult(null);}}><option value="">Selecciona corte posterior</option>{snapshots.map(s=><option key={s.id} value={s.id}>{label(s)}</option>)}</select>
     <div><Button variant="primary" size="sm" disabled={!before||!after||before===after} onClick={()=>void action(async()=>setResult(await api('/compare?'+new URLSearchParams({before,after}))))}>Comparar cortes</Button></div>
    </div>
   </fieldset>
   <section className="card" aria-label="Cortes por tamaño">
    <div className="card-title"><div><h2>Cortes guardados</h2><p>Conversaciones por corte, más recientes primero</p></div></div>
    <BarList c={5} empty="Sin cortes todavía." items={snapshots.slice(0,6).map(s=>({key:s.id,label:s.watermark,value:s.summary.conversations,display:nf.format(s.summary.conversations),kind:'observed' as const}))}/>
   </section>
  </div>
  <form className="card" onSubmit={e=>{e.preventDefault();void action(async()=>{const data=await api('',{dateStart:new Date(start+'T00:00:00Z').toISOString(),dateEnd:new Date(end+'T00:00:00Z').toISOString(),timezone,currency,dateBasis:'conversation',sources:sources.split(',').map(x=>x.trim()).filter(Boolean),channels:channels.split(',').map(x=>x.trim()).filter(Boolean)});setAfter(data.snapshot.id);setResult(null);await refresh();});}}><fieldset disabled={busy||denied} className={css.form} style={{margin:0,padding:0,border:0}}><legend className="sr-only">Congelar un corte nuevo — propietario o analista</legend>
   <div className="card-title"><div><h2>Congelar un corte nuevo</h2><p>Propietario o analista · ventana UTC por inicio de conversación</p></div><Button type="submit" size="sm" variant="primary">Congelar corte</Button></div>
   <div className={css.cols}><label>Inicio UTC<input required type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Fin UTC exclusivo<input required type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label></div>
   <details><summary>Opciones del alcance</summary><div className={css.cols}>
    <label>Zona horaria del contrato<input required value={timezone} onChange={e=>setTimezone(e.target.value)}/></label><label>Moneda<input required maxLength={3} value={currency} onChange={e=>setCurrency(e.target.value.toUpperCase())}/></label>
    <label>Fuentes, separadas por coma<input value={sources} onChange={e=>setSources(e.target.value)} placeholder="Todas si se deja vacío"/></label><label>Canales, separados por coma<input value={channels} onChange={e=>setChannels(e.target.value)} placeholder="Todos si se deja vacío"/></label></div></details>
  </fieldset></form>
  {result&&<section aria-label="Resultado de comparación" className="stack">
   <div className="card"><div className="card-title"><div><h2>{result.state==='comparable'?'Comparable':'No comparable'}</h2><p>{result.notice}</p></div><StatusChip tone={result.state==='comparable'?'ok':'warn'}>{result.state==='comparable'?'Apto para comparar':'Revisar motivos'}</StatusChip></div>
    <div className={css.flow}><span className={css.flowNode}><span>Antes</span><IdChip value={result.before.id} head={8} tail={4}/></span><Icon name="arrow-right" size={16}/><span className={css.flowNode}><span>Después</span><IdChip value={result.after.id} head={8} tail={4}/></span></div>
    {result.reasons.length>0&&<ul className="row-list" style={{marginTop:'var(--sp-3)'}}>{result.reasons.map(reason=><li key={reason} className="notice-bar"><Icon name="info" size={14}/><p>{reasonLabels[reason]??reason}</p></li>)}</ul>}
   </div>
   <div className="stat-grid">{Object.entries(result.counts).map(([key,v])=><StatCard key={key} label={countLabels[key]??key} icon={countIcons[key]??'database'} kind="observed" value={nf.format(Number(v.after))} foot={<>Antes {nf.format(Number(v.before))} · diferencia {String(v.delta)}</>}/>)}</div>
   <div className="split" data-even>
    <section className="card" aria-label="Cobertura observada por canal"><div className="card-title"><div><h2>Cobertura por canal</h2><p>Conteos observados; no acreditan el total del proveedor</p></div></div>
     <ScrollTable label="Cobertura por canal, tabla desplazable"><table className="dtable"><thead><tr><th>Canal</th><th className="num">Antes</th><th className="num">Después</th></tr></thead><tbody>{result.channels.map(c=><tr key={c.channel}><th scope="row">{c.channel}</th><td className="num">{c.before}</td><td className="num">{c.after}</td></tr>)}</tbody></table></ScrollTable></section>
    <section className="card" aria-label="Importes de órdenes vinculadas"><div className="card-title"><div><h2>Importes de órdenes</h2><p>No son pérdidas, ahorro ni ingresos recuperados</p></div></div>
     {Object.keys(result.money).length===0?<p className="state">Sin importes en estos cortes.</p>:<ScrollTable label="Importes por moneda, tabla desplazable"><table className="dtable"><thead><tr><th>Moneda</th><th className="num">Antes</th><th className="num">Después</th><th className="num">Delta comparable</th></tr></thead><tbody>{Object.entries(result.money).map(([code,m])=>{const bx=result.before.method.currencyExponents[code],ax=result.after.method.currencyExponents[code];return <tr key={code}><th scope="row">{code}</th><td className="num">{moneyText(m.before?.amountMinor,bx)}<br/><small>conocido {moneyText(m.before?.knownSubtotalMinor,bx)}</small></td><td className="num">{moneyText(m.after?.amountMinor,ax)}<br/><small>conocido {moneyText(m.after?.knownSubtotalMinor,ax)}</small></td><td className="num">{m.deltaMinor===null?'no disponible':moneyText(m.deltaMinor,ax)}</td></tr>;})}</tbody></table></ScrollTable>}
     <p className={css.muted}>Importes desconocidos permanecen desconocidos.</p></section>
   </div>
   <details><summary>Método y procedencia congelados</summary><pre className={css.pre}>{JSON.stringify({before:{scope:result.before.scope,method:result.before.method,watermark:result.before.watermark,inputHash:result.before.inputHash,warnings:result.before.summary.warnings},after:{scope:result.after.scope,method:result.after.method,watermark:result.after.watermark,inputHash:result.after.inputHash,warnings:result.after.summary.warnings}},null,2)}</pre></details>
  </section>}
 </section>;
}
