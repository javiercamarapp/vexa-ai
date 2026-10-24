'use client';
import {useAutoRefresh} from '../ui/use-auto-refresh';
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import type {ConversationRef} from '../../../../../packages/workspace-service/detail.mjs';
import type {ProblemFacts} from '../../../../../packages/workspace-service/problem-facts.mjs';
import type {MonthlyIncidencesView} from '../../../../../packages/workspace-service/incidences.mjs';
import {diaCorte} from '../../../../../packages/workspace-service/datos-hasta.mjs';
import {etiquetaMotivo} from '../../../../../packages/workspace-service/critico.mjs';
import {Citation} from '../ui/citation';
import {ChartState} from '../ui/chart-state';
import {ColumnChart,type ColumnDatum} from '../ui/column-chart';
import {Button,LinkButton,Refresh,Arrow} from '../ui/button';
import {KindBadge} from '../ui/kind-badge';
import {TituloAuto} from '../ui/titulo-auto';
import {StatusChip} from '../ui/status-chip';
import {KpiStrip} from '../ui/kpi-strip';
import {Chip} from '../ui/chip';
import {Icon} from '../ui/icons';
import {WaitStatus} from '../ui/wait-status';
import {useJson} from '../ui/use-json';
import {nf} from '../ui/format';
import {ESPERA} from '../../lib/legibilidad/espera.mjs';
import {agruparCitas,AVISO_TERCEROS,textoCitas} from '../../lib/legibilidad/explorador.mjs';
import {etiquetaSeveridad} from '../../lib/legibilidad/problemas-catalogo.mjs';
import {encabezadoFicha,resumenAdjuntos,serieConversaciones,cambioMensual,etiquetaRecomendacion,estadoIntervencion,IMPACTO_NO_DISPONIBLE} from '../../lib/legibilidad/ficha.mjs';
import s from './problem-sheet.module.css';
import {fetchCupo} from '../../lib/workspace/cupo.mjs';
const sevTone=(v:string|null)=>v==='high'||v==='critical'?'bad' as const:v==='medium'?'warn' as const:'neutral' as const;
const mesCorto=(m:string)=>new Intl.DateTimeFormat('es-MX',{month:'short',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z')).replace('.','');
const mesLargo=(m:string)=>new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z'));
export const acceptFacts=(j:unknown)=>{const d=(j as {data?:ProblemFacts})?.data;return d&&typeof d.problemId==='string'&&'recommendations' in d?d:null;};
const acceptTrend=(j:unknown)=>{const d=(j as {data?:MonthlyIncidencesView})?.data;return d&&Array.isArray(d.series)&&typeof d.status==='string'?d:null;};
const VISIBLES=8,TOPE=50;
type Cita={conversationId?:string;messageRevisionId:string;quote:string;quoteHash:string;role:string;source?:string;category?:string;severity?:string};
const peso=(c:Cita)=>c.severity==='critical'?3:c.severity==='high'?2:c.severity==='medium'?1:0;

/** Citas verificadas al abrir: la evidencia viva con la versión vigente del problema (misma herramienta que el Explorador). Si no llega, se usan las del corte (si las hay). */
function useEvidencia(id:string,shared:string,captured:ConversationRef[]|null){
 const [citas,setCitas]=useState<Cita[]|null>(null),[fallo,setFallo]=useState(false),[reload,setReload]=useState(0),[cobertura,setCobertura]=useState<{runsVerified:number;runsTotal:number}|null>(null);
 // El servidor exige AMBOS (snapshot_id y scope_hash) para la herramienta de evidencia: con solo el primero respondía 400 (published_scope_required) en cada apertura de la ficha (QA-2, N6).
 const silencioso=useRef(false);
 const alcance=new URLSearchParams(shared),sinAlcance=!alcance.get('snapshot_id')||!alcance.get('scope_hash');
 useEffect(()=>{
  if(sinAlcance)return;
  const abort=new AbortController(),params=new URLSearchParams(shared),q=new URLSearchParams();
  for(const key of ['date_start','date_end','timezone','date_basis','currency','basis','exponent','snapshot_id','scope_hash'])if(params.get(key)!==null)q.set(key,params.get(key)!);
  for(const key of ['sku','source'])for(const v of params.getAll(key))q.append(key,v);
  // Relectura por datos nuevos: conserva las citas pintadas hasta que lleguen las nuevas (sin esqueleto).
  const silent=silencioso.current;silencioso.current=false;
  if(!silent)void Promise.resolve().then(()=>{setCitas(null);setCobertura(null);setFallo(false);});
  void (async()=>{try{
   const pedir=()=>fetchCupo('/api/explorer/tools',{method:'POST',cache:'no-store',signal:abort.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'get_evidence',args:{query:q.toString(),problemId:id}})});
   let response=await pedir();
   // Un reintento silencioso ante 5xx (conexión cortada por el pooler) antes de mostrar «No se pudo verificar».
   if(response.status>=500){await new Promise(r=>setTimeout(r,1200));if(abort.signal.aborted)return;response=await pedir();}
   if(!response.ok)throw Error(String(response.status));
   const result=(await response.json()).data?.result as {problemId:string;citations:Cita[];verification?:{runsVerified:number;runsTotal:number}|null}|undefined;
   if(abort.signal.aborted)return;
   if(!result||result.problemId!==id||!Array.isArray(result.citations))throw Error('shape');
   setCobertura(result.verification&&result.verification.runsTotal>result.verification.runsVerified?result.verification:null);setCitas(result.citations);
  }catch{if(!abort.signal.aborted&&!silent)setFallo(true);}})();
  return()=>abort.abort();
 },[id,shared,sinAlcance,reload]);
 useAutoRefresh(()=>{if(!sinAlcance){silencioso.current=true;setReload(n=>n+1);}},{activo:!sinAlcance});
 const delCorte=useMemo<Cita[]|null>(()=>captured&&captured.length?captured.flatMap(c=>('citations' in c&&Array.isArray(c.citations)?c.citations:[]).map((q:{message_revision_id:string;quote:string;quote_hash:string;role:string})=>({conversationId:c.id,messageRevisionId:q.message_revision_id,quote:q.quote,quoteHash:q.quote_hash,role:q.role,source:c.source}))):null,[captured]);
 const usable=citas??(fallo?delCorte:null);
 return {citas:usable,cobertura,esperando:!sinAlcance&&citas===null&&!fallo,fallo:fallo&&usable===null,sinAlcance,reintentar:()=>setReload(n=>n+1)};
}

const NA=<strong className={s.na}>No disponible ahora</strong>;

export function ProblemSheet({id,shared,captured,dinero,facts,onTitle,causa=null}:{causa?:ReactNode;id:string;shared:string;captured:ConversationRef[]|null;dinero:ReactNode|null;facts:ReturnType<typeof useJson<ProblemFacts>>;onTitle?:(t:string|null)=>void}){
 const trend=useJson<MonthlyIncidencesView>('/api/trends/incidences?problem='+encodeURIComponent(id),acceptTrend);
 const ev=useEvidencia(id,shared,captured);
 const [todas,setTodas]=useState(false),[intentos,setIntentos]=useState(0);
 const f=facts.data,head=encabezadoFicha(f,etiquetaMotivo);
 useEffect(()=>{onTitle?.(head?.categoria??null);},[head?.categoria,onTitle]);
 const serie=serieConversaciones(trend.data),cambio=cambioMensual(serie);
 const tendenciaCaida=!serie&&!trend.busy&&(!!trend.error||trend.data?.status==='timeout');
 // Reintento automático en segundo plano (3 veces, cada 20 s) cuando la tendencia agota su tiempo.
 const recargarTendencia=trend.reload;
 useEffect(()=>{if(!tendenciaCaida||intentos>=3)return;const t=setTimeout(()=>{setIntentos(n=>n+1);void recargarTendencia();},20000);return()=>clearTimeout(t);},[tendenciaCaida,intentos,recargarTendencia]);
 const datos:ColumnDatum[]=(serie?serie.map(p=>({key:p.month,label:mesCorto(p.month),long:mesLargo(p.month)+(p.partial?' (mes incompleto)':''),value:p.value,partial:p.partial,display:p.value===null?'No disponible':nf.format(p.value)+(p.value===1?' conversación':' conversaciones'),detail:p.partial?'Mes incompleto: no se compara':undefined})):[]);
 const parciales=trend.data?.completeness?.partialMonths??[];
 const adj=resumenAdjuntos(f?.attachments);
 const distintas=agruparCitas((ev.citas??[]).slice().sort((a,b)=>peso(b)-peso(a)));
 const lista=distintas.slice(0,todas?TOPE:VISIBLES);
 const rec=f?.recommendations.items[0]??null;
 const verificadas=ev.citas?distintas.length:null;
 return <div className={s.sheet}>
  <section className="ui-card" aria-label="Identificación del problema">
   <div className={s.head}>
    <div className={s.chips}>
     {head?.grupo&&<Chip categoria={7}>{head.grupo}</Chip>}
     {f?.severity&&<StatusChip tone={sevTone(f.severity)}>Severidad {etiquetaSeveridad(f.severity)?.toLowerCase()}</StatusChip>}
     {head?.critico===true&&<StatusChip tone="bad" title={head.motivo??undefined}>Revisión crítica</StatusChip>}
     {head?.critico===false&&<Chip>Sin revisión crítica</Chip>}
     {f&&<KindBadge kind="inferred" hint="La categoría y la severidad las asigna la IA al extraer cada conversación: son Inferido, no un hecho observado."/>}
    </div>
    {f&&<TituloAuto problemId={id} label={f.label??''} conversaciones={f.conversations} temas={f.themes??null}/>}
    {facts.busy&&!f&&<div role="status" aria-busy="true"><span className="sr-only">Cargando la ficha…</span><div className="skel-rows"><span/></div></div>}
    {facts.error&&!f&&<p className="state state-error" role="alert">{facts.error} <Button size="sm" icon={<Refresh/>} onClick={facts.reload}>Reintentar</Button></p>}
    {f&&f.parts.catalog==='unavailable'&&<p className="state" role="note">Parte de la ficha no está disponible ahora; lo que no se pudo calcular se marca «No disponible ahora», no cero.</p>}
   </div>
  </section>

  <KpiStrip label="Cifras del problema" items={[
   {label:'Conversaciones',c:7,spark:serie?serie.map(p=>p.value??0):undefined,value:!f&&facts.busy?'…':f?.conversations!=null?nf.format(f.conversations):NA,note:cambio&&cambio.pct!==null?<>{cambio.pct>0?'+':cambio.pct<0?'−':''}{Math.abs(cambio.pct).toLocaleString('es-MX',{minimumFractionDigits:1,maximumFractionDigits:1})} % vs mes previo · Observado</>:'Distintas del grupo · Observado'},
   {label:'Citas registradas',c:7,value:!f&&facts.busy?'…':f?.citations!=null?nf.format(f.citations):NA,note:ev.esperando?undefined:verificadas!==null?`${textoCitas(verificadas)} verificadas al abrir`:ev.sinAlcance?'Se verifican al abrir desde una publicación':'Verificación no disponible ahora'},
   {label:'Adjuntos asociados',c:7,value:!f&&facts.busy?'…':adj.valor!==null?nf.format(adj.valor):NA,note:adj.detalle},
   {label:'Señales críticas',c:6,value:!f&&facts.busy?'…':f?.critical?nf.format(f.critical.signals):NA,note:f?.critical?(f.critical.critical?'Severidad alta, crítica o sensible · Inferido':'Ninguna evidencia crítica · Inferido'):undefined}
  ]}/>
  {adj.nota&&<p className={s.sub} role="note">{adj.nota}</p>}

  <div className={s.row84} data-falla={tendenciaCaida||undefined}>
  <section className={"ui-card "+s.violeta} aria-label="Tendencia mensual de conversaciones">
   <header className="ui-card-head"><div className="ui-card-copy"><h2 className="ui-card-title">Conversaciones por mes</h2><p className="ui-card-desc">Últimos 12 meses, por fecha de inicio de la conversación</p></div><KindBadge kind="observed"/></header>
   {tendenciaCaida?<div className={s.nd} role="status"><Icon name="clock" size={16}/><div><strong>No disponible ahora</strong><span>La consulta de la tendencia tardó demasiado; no es cero.{intentos<3?' Se reintenta sola en segundo plano.':''}</span></div><Button size="sm" icon={<Refresh/>} loading={trend.busy} onClick={()=>{setIntentos(0);void trend.reload();}}>Reintentar</Button></div>:<div className="stack">
    <ChartState busy={trend.busy} hasData={!!serie} error={trend.error} status={trend.status} que="la tendencia" retryLabel="Reintentar tendencia" onRetry={trend.reload} height={150}
     empty={<div className={s.nd} role="status"><Icon name="info" size={16}/><div><strong>Aún sin datos</strong><span>Este grupo no tiene conversaciones con fecha en los últimos 12 meses.</span></div></div>}>
     {serie&&<><ColumnChart title="Conversaciones por mes de este problema" kind="observed" height={150} data={datos} unit="conversaciones"/>
      {cambio&&<p className={s.nota}>{cambio.pct===null?`${mesLargo(cambio.a.month)}: ${nf.format(cambio.a.value!)} conversaciones; ${mesLargo(cambio.de.month)} no ofrece base de comparación.`:<>De {mesLargo(cambio.de.month)} a {mesLargo(cambio.a.month)}: <strong>{cambio.pct>0?'+':cambio.pct<0?'−':''}{Math.abs(cambio.pct).toLocaleString('es-MX',{minimumFractionDigits:1,maximumFractionDigits:1})} %</strong> ({nf.format(cambio.de.value!)} → {nf.format(cambio.a.value!)}), entre meses completos.</>}</p>}
      {parciales.length>0&&<p className={s.nota} role="note">* {parciales.map(mesLargo).join(' y ')} {parciales.length===1?'es un mes incompleto':'son meses incompletos'} (datos hasta {diaCorte(trend.data?.completeness?.dataThrough)??'fecha desconocida'}) y no se compara.</p>}
      {trend.data!.undated!==null&&trend.data!.undated>0&&<p className={s.nota} role="note">{nf.format(trend.data!.undated)} registros sin fecha no entran en la gráfica.</p>}</>}
    </ChartState>
   </div>}
  </section>
  <div className={s.col}>
   {causa}
   {head&&<section className="ui-card" aria-label="Por qué importa">
    <header className="ui-card-head"><div className="ui-card-copy"><h2 className="ui-card-title">Por qué importa</h2><p className="ui-card-desc">Revisión crítica y señales</p></div>{head.critico===true?<StatusChip tone="bad">Revisión crítica</StatusChip>:head.critico===false?<Chip>Sin revisión crítica</Chip>:null}</header>
    <p className={s.sub} style={{maxWidth:'none'}}>{head.critico===true&&head.motivo?<><strong>Motivo:</strong> {head.motivo}</>:'Ninguna conversación del grupo cumple el criterio de revisión crítica en este corte.'}{head.senales!==null&&<> · {nf.format(head.senales)} {head.senales===1?'señal crítica':'señales críticas'}.</>}</p>
    {distintas.length>0&&<ul className={s.previa} aria-label="Citas destacadas">{distintas.slice(0,2).map((c,i)=><li key={c.messageRevisionId+':'+i}><q>{c.quote.length>140?c.quote.slice(0,137)+'…':c.quote}</q></li>)}</ul>}
   </section>}
   <section className="ui-card" aria-label="Qué hacer">
   <header className="ui-card-head"><div className="ui-card-copy"><h2 className="ui-card-title">Siguiente paso</h2><p className="ui-card-desc">Recomendación e intervención</p></div></header>
   {f&&f.recommendations.state==='unavailable'&&<p className="state" role="status">No disponible ahora. <Button size="sm" icon={<Refresh/>} onClick={facts.reload}>Reintentar</Button></p>}
   {f&&f.recommendations.state==='ok'&&!rec&&<p className="state">Aún sin recomendación. <LinkButton href={'/recommendations?'+shared+'&problem_id='+encodeURIComponent(id)} size="sm" icon={<Arrow/>}>Ir a Recomendaciones</LinkButton></p>}
   {f&&f.recommendations.state==='ok'&&f.recommendations.items.length>0&&<ul className={s.recs}>{f.recommendations.items.map(r=><li key={r.id} className={s.rec}>
    <div style={{minWidth:0}}><strong>{etiquetaRecomendacion(r.status)} · versión {r.version}</strong><div className={s.chips}><Chip>Intervención: {estadoIntervencion(r)}</Chip></div></div>
    <LinkButton href={'/recommendations?'+shared+'&problem_id='+encodeURIComponent(id)} size="sm" icon={<Arrow/>} aria-label="Ver la recomendación de este problema">Ver</LinkButton>
   </li>)}</ul>}
   </section>
  </div>
  </div>

  <section className="ui-card" aria-label="Evidencia citada">
   <header className="ui-card-head"><div className="ui-card-copy"><h2 className="ui-card-title">Lo que dicen los clientes</h2><p className="ui-card-desc">Citas textuales verificadas al abrir contra su conversación vigente</p></div><KindBadge kind="observed"/></header>
   {ev.esperando&&<WaitStatus {...ESPERA.evidencia}/>}
   {ev.sinAlcance&&!ev.citas&&<p className="state" role="status">Abre este problema desde una publicación: las citas se verifican con su periodo y filtros. <LinkButton href="/problems" size="sm" icon={<Arrow/>}>Ir a Problemas</LinkButton></p>}
   {ev.fallo&&<p className="state state-error" role="alert">No se pudo verificar la evidencia ahora. <Button size="sm" icon={<Refresh/>} onClick={ev.reintentar}>Reintentar</Button></p>}
   {ev.citas&&distintas.length===0&&<p className="state">No hay citas disponibles con el acceso vigente.</p>}
   {distintas.length>0&&<>
    <p className={s.privacy} role="note"><Icon name="info" size={14}/><span>{AVISO_TERCEROS}</span></p>
    <div className={s.evi}>{lista.map((c,i)=><Citation key={c.messageRevisionId+':'+c.quoteHash+':'+i} quote={c.quote} role={c.role} category={c.category} source={c.source} messageRevisionId={c.messageRevisionId} times={c.veces}/>)}</div>
    {distintas.length>VISIBLES&&<div style={{marginTop:'var(--sp-3)'}}><Button size="sm" aria-expanded={todas} onClick={()=>setTodas(v=>!v)}>{todas?`Ver solo las ${VISIBLES} primeras`:`Ver ${nf.format(Math.min(TOPE,distintas.length))} de ${nf.format(distintas.length)} citas distintas`}</Button></div>}
    {ev.cobertura&&<p className="state" role="note">Citas verificadas de {nf.format(ev.cobertura.runsVerified)} de {nf.format(ev.cobertura.runsTotal)} extracciones del grupo: así la ficha abre rápido. Las demás siguen registradas, pero no se leen en esta vista.</p>}
    {ev.citas&&ev.citas.length>distintas.length&&<p className="state" role="note">{nf.format(ev.citas.length)} registros; las citas idénticas se muestran una vez con «×N».</p>}
   </>}
  </section>

  {dinero??<p className={s.impact} role="note">{IMPACTO_NO_DISPONIBLE}</p>}
 </div>;
}
