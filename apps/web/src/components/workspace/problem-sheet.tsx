'use client';
import {useEffect,useMemo,useState,type ReactNode} from 'react';
import type {ConversationRef} from '../../../../../packages/workspace-service/detail.mjs';
import type {ProblemFacts} from '../../../../../packages/workspace-service/problem-facts.mjs';
import type {MonthlyIncidencesView} from '../../../../../packages/workspace-service/incidences.mjs';
import {diaCorte} from '../../../../../packages/workspace-service/datos-hasta.mjs';
import {etiquetaMotivo} from '../../../../../packages/workspace-service/critico.mjs';
import {Citation} from '../ui/citation';
import {ChartState} from '../ui/chart-state';
import {ColumnChart,type ColumnDatum} from '../ui/column-chart';
import {EmptyState} from '../ui/empty-state';
import {Button,LinkButton,Refresh,Arrow} from '../ui/button';
import {KindBadge} from '../ui/kind-badge';
import {StatusChip} from '../ui/status-chip';
import {Icon} from '../ui/icons';
import {WaitStatus} from '../ui/wait-status';
import {useJson} from '../ui/use-json';
import {nf} from '../ui/format';
import {ESPERA} from '../../lib/legibilidad/espera.mjs';
import {agruparCitas,AVISO_TERCEROS,textoCitas} from '../../lib/legibilidad/explorador.mjs';
import {etiquetaSeveridad} from '../../lib/legibilidad/problemas-catalogo.mjs';
import {encabezadoFicha,resumenAdjuntos,serieConversaciones,cambioMensual,etiquetaRecomendacion,estadoIntervencion,IMPACTO_NO_DISPONIBLE} from '../../lib/legibilidad/ficha.mjs';
import s from './problem-sheet.module.css';
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
 const [citas,setCitas]=useState<Cita[]|null>(null),[fallo,setFallo]=useState(false),[reload,setReload]=useState(0);
 const sinAlcance=!new URLSearchParams(shared).get('snapshot_id');
 useEffect(()=>{
  if(sinAlcance)return;
  const abort=new AbortController(),params=new URLSearchParams(shared),q=new URLSearchParams();
  for(const key of ['date_start','date_end','timezone','date_basis','currency','basis','exponent','snapshot_id','scope_hash'])if(params.get(key)!==null)q.set(key,params.get(key)!);
  for(const key of ['sku','source'])for(const v of params.getAll(key))q.append(key,v);
  void Promise.resolve().then(()=>{setCitas(null);setFallo(false);});
  void (async()=>{try{
   const response=await fetch('/api/explorer/tools',{method:'POST',cache:'no-store',signal:abort.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'get_evidence',args:{query:q.toString(),problemId:id}})});
   if(!response.ok)throw Error(String(response.status));
   const result=(await response.json()).data?.result as {problemId:string;citations:Cita[]}|undefined;
   if(abort.signal.aborted)return;
   if(!result||result.problemId!==id||!Array.isArray(result.citations))throw Error('shape');
   setCitas(result.citations);
  }catch{if(!abort.signal.aborted)setFallo(true);}})();
  return()=>abort.abort();
 },[id,shared,sinAlcance,reload]);
 const delCorte=useMemo<Cita[]|null>(()=>captured&&captured.length?captured.flatMap(c=>('citations' in c&&Array.isArray(c.citations)?c.citations:[]).map((q:{message_revision_id:string;quote:string;quote_hash:string;role:string})=>({conversationId:c.id,messageRevisionId:q.message_revision_id,quote:q.quote,quoteHash:q.quote_hash,role:q.role,source:c.source}))):null,[captured]);
 const usable=citas??(fallo?delCorte:null);
 return {citas:usable,esperando:!sinAlcance&&citas===null&&!fallo,fallo:fallo&&usable===null,sinAlcance,reintentar:()=>setReload(n=>n+1)};
}

function Kpi({label,kind,children,foot}:{label:string;kind?:Parameters<typeof KindBadge>[0]['kind'];children:ReactNode;foot?:ReactNode}){
 return <div className={s.kpi}><span>{label}{kind&&<KindBadge kind={kind}/>}</span>{children}{foot&&<small>{foot}</small>}</div>;
}
const NA=<strong className={s.na}>No disponible ahora</strong>;

export function ProblemSheet({id,shared,captured,dinero,facts,onTitle}:{id:string;shared:string;captured:ConversationRef[]|null;dinero:ReactNode|null;facts:ReturnType<typeof useJson<ProblemFacts>>;onTitle?:(t:string|null)=>void}){
 const trend=useJson<MonthlyIncidencesView>('/api/trends/incidences?problem='+encodeURIComponent(id),acceptTrend);
 const ev=useEvidencia(id,shared,captured);
 const [todas,setTodas]=useState(false);
 const f=facts.data,head=encabezadoFicha(f,etiquetaMotivo);
 useEffect(()=>{onTitle?.(head?.categoria??null);},[head?.categoria,onTitle]);
 const serie=serieConversaciones(trend.data),cambio=cambioMensual(serie);
 const datos:ColumnDatum[]=(serie?serie.map(p=>({key:p.month,label:mesCorto(p.month),long:mesLargo(p.month)+(p.partial?' (mes incompleto)':''),value:p.value,partial:p.partial,display:p.value===null?'No disponible':nf.format(p.value)+(p.value===1?' conversación':' conversaciones'),detail:p.partial?'Mes incompleto: no se compara':undefined})):[]);
 const parciales=trend.data?.completeness?.partialMonths??[];
 const adj=resumenAdjuntos(f?.attachments);
 const distintas=agruparCitas((ev.citas??[]).slice().sort((a,b)=>peso(b)-peso(a)));
 const lista=distintas.slice(0,todas?TOPE:VISIBLES);
 const rec=f?.recommendations.items[0]??null;
 const verificadas=ev.citas?distintas.length:null;
 return <div className={s.sheet}>
  <section className="card" aria-label="Identificación del problema">
   <div className={s.head}>
    <div className={s.chips}>
     {head?.grupo&&<span className="chip">{head.grupo}</span>}
     {f?.severity&&<StatusChip tone={sevTone(f.severity)}>Severidad {etiquetaSeveridad(f.severity)?.toLowerCase()}</StatusChip>}
     {head?.critico===true&&<StatusChip tone="bad" title={head.motivo??undefined}>Revisión crítica</StatusChip>}
     {head?.critico===false&&<span className="chip">Sin revisión crítica</span>}
     {f&&<KindBadge kind="inferred" hint="La categoría y la severidad las asigna la IA al extraer cada conversación: son Inferido, no un hecho observado."/>}
    </div>
    {head?.critico===true&&head.motivo&&<p className={s.sub}><strong>Motivo de la revisión crítica:</strong> {head.motivo}{head.senales!==null&&<> · {nf.format(head.senales)} {head.senales===1?'señal crítica':'señales críticas'} (evidencias).</>}</p>}
    {facts.busy&&!f&&<div role="status" aria-busy="true"><span className="sr-only">Cargando la ficha…</span><div className="skel-rows"><span/></div></div>}
    {facts.error&&!f&&<p className="state state-error" role="alert">{facts.error} <Button size="sm" icon={<Refresh/>} onClick={facts.reload}>Reintentar</Button></p>}
    {f&&f.parts.catalog==='unavailable'&&<p className="state" role="note">Parte de la ficha no está disponible ahora; lo que no se pudo calcular se marca «No disponible ahora», no cero.</p>}
   </div>
  </section>

  <section className={s.kpis} aria-label="Cifras del problema">
   <Kpi label="Conversaciones" kind="observed" foot="Conversaciones distintas del grupo">{!f&&facts.busy?<strong>…</strong>:f?.conversations!=null?<strong>{nf.format(f.conversations)}</strong>:NA}</Kpi>
   <Kpi label="Citas registradas" kind="observed" foot={ev.esperando?'Verificando al abrir…':verificadas!==null?`${textoCitas(verificadas)} verificadas al abrir`:ev.sinAlcance?'Se verifican al abrir desde una publicación':'Verificación no disponible ahora'}>{!f&&facts.busy?<strong>…</strong>:f?.citations!=null?<strong>{nf.format(f.citations)}</strong>:NA}</Kpi>
   <Kpi label="Adjuntos asociados" kind="observed" foot={adj.detalle}>{!f&&facts.busy?<strong>…</strong>:adj.valor!==null?<strong>{nf.format(adj.valor)}</strong>:NA}</Kpi>
   <Kpi label="Señales críticas" kind="inferred" foot={f?.critical?(f.critical.critical?'Evidencias de severidad alta, crítica o de categoría sensible':'Ninguna evidencia crítica en este grupo'):undefined}>{!f&&facts.busy?<strong>…</strong>:f?.critical?<strong>{nf.format(f.critical.signals)}</strong>:NA}</Kpi>
  </section>
  {adj.nota&&<p className={s.sub} role="note">{adj.nota}</p>}

  <section className="card" aria-label="Tendencia mensual de conversaciones">
   <div className={s.cardHead}><div><h3>Conversaciones por mes</h3><p>Últimos 12 meses, por fecha de inicio o primer mensaje de la conversación.</p></div><KindBadge kind="observed"/></div>
   <div className="stack">
    <ChartState busy={trend.busy} hasData={!!serie} error={trend.error} status={trend.status} que="la tendencia" retryLabel="Reintentar tendencia" onRetry={trend.reload} height={150}
     empty={trend.data?.status==='timeout'?<EmptyState compact art="chart" tone="warn" title="No disponible ahora" body="La consulta superó el tiempo permitido. Reintenta en unos segundos." action={<Button size="sm" icon={<Refresh/>} loading={trend.busy} onClick={trend.reload}>Reintentar tendencia</Button>}/>:<EmptyState compact art="chart" title="Aún sin datos" body="Este grupo no tiene conversaciones con fecha en los últimos 12 meses."/>}>
     {serie&&<><ColumnChart title="Conversaciones por mes de este problema" kind="observed" height={150} data={datos} unit="conversaciones"/>
      {cambio&&<p className={s.delta}>{cambio.pct===null?`${mesLargo(cambio.a.month)}: ${nf.format(cambio.a.value!)} conversaciones; ${mesLargo(cambio.de.month)} no ofrece base de comparación.`:<>De {mesLargo(cambio.de.month)} a {mesLargo(cambio.a.month)}: <strong>{cambio.pct>0?'+':cambio.pct<0?'−':''}{Math.abs(cambio.pct).toLocaleString('es-MX',{minimumFractionDigits:1,maximumFractionDigits:1})} %</strong> ({nf.format(cambio.de.value!)} → {nf.format(cambio.a.value!)}), entre meses completos.</>}</p>}
      {parciales.length>0&&<p className="state" role="note">* {parciales.map(mesLargo).join(' y ')} {parciales.length===1?'es un mes incompleto':'son meses incompletos'} (datos hasta {diaCorte(trend.data?.completeness?.dataThrough)??'fecha desconocida'}) y no se compara.</p>}
      {trend.data!.undated!==null&&trend.data!.undated>0&&<p className="state" role="note">{nf.format(trend.data!.undated)} registros sin fecha no entran en la gráfica.</p>}</>}
    </ChartState>
   </div>
  </section>

  <section className="card" aria-label="Evidencia citada">
   <div className={s.cardHead}><div><h3>Lo que dicen los clientes</h3><p>Citas textuales verificadas al abrir contra su conversación vigente. «Ver origen» muestra la cadena hasta el archivo cargado.</p></div><KindBadge kind="observed"/></div>
   {ev.esperando&&<WaitStatus {...ESPERA.evidencia}/>}
   {ev.sinAlcance&&!ev.citas&&<EmptyState compact art="doc" title="Abre este problema desde una publicación" body="Las citas se verifican con el periodo y los filtros de la publicación." action={<LinkButton href="/problems" size="sm" icon={<Arrow/>}>Ir a Problemas</LinkButton>}/>}
   {ev.fallo&&<p className="state state-error" role="alert">No se pudo verificar la evidencia ahora. <Button size="sm" icon={<Refresh/>} onClick={ev.reintentar}>Reintentar</Button></p>}
   {ev.citas&&distintas.length===0&&<p className="state">No hay citas disponibles con el acceso vigente.</p>}
   {distintas.length>0&&<>
    <p className={s.privacy} role="note"><Icon name="info" size={14}/><span>{AVISO_TERCEROS}</span></p>
    <div className={s.evi}>{lista.map((c,i)=><Citation key={c.messageRevisionId+':'+c.quoteHash+':'+i} quote={c.quote} role={c.role} category={c.category} source={c.source} messageRevisionId={c.messageRevisionId} times={c.veces}/>)}</div>
    {distintas.length>VISIBLES&&<div style={{marginTop:'var(--sp-3)'}}><Button size="sm" aria-expanded={todas} onClick={()=>setTodas(v=>!v)}>{todas?`Ver solo las ${VISIBLES} primeras`:`Ver ${nf.format(Math.min(TOPE,distintas.length))} de ${nf.format(distintas.length)} citas distintas`}</Button></div>}
    {ev.citas&&ev.citas.length>distintas.length&&<p className="state" role="note">{nf.format(ev.citas.length)} registros; las citas idénticas se muestran una vez con «×N».</p>}
   </>}
  </section>

  <section className="card" aria-label="Qué hacer">
   <div className={s.cardHead}><div><h3>Recomendación e intervención</h3><p>Qué propone el sistema para este problema y en qué estado está su seguimiento.</p></div></div>
   {f&&f.recommendations.state==='unavailable'&&<p className="state" role="status">No disponible ahora. <Button size="sm" icon={<Refresh/>} onClick={facts.reload}>Reintentar</Button></p>}
   {f&&f.recommendations.state==='ok'&&!rec&&<EmptyState compact art="inbox" title="Aún sin recomendación" body="Cuando se genere una recomendación para este problema aparecerá aquí." action={<LinkButton href={'/recommendations?'+shared+'&problem_id='+encodeURIComponent(id)} size="sm" icon={<Arrow/>}>Ir a Recomendaciones</LinkButton>}/>}
   {f&&f.recommendations.state==='ok'&&f.recommendations.items.length>0&&<ul className={s.recs}>{f.recommendations.items.map(r=><li key={r.id} className={s.rec}>
    <div style={{minWidth:0}}><strong>{etiquetaRecomendacion(r.status)} · versión {r.version}</strong></div>
    <LinkButton href={'/recommendations?'+shared+'&problem_id='+encodeURIComponent(id)} size="sm" icon={<Arrow/>} aria-label="Ver la recomendación de este problema">Ver recomendación</LinkButton>
    <div className={s.chips}><span className="chip">Intervención: {estadoIntervencion(r)}</span></div>
   </li>)}</ul>}
  </section>

  {dinero??<p className={s.impact} role="note">{IMPACTO_NO_DISPONIBLE}</p>}
 </div>;
}
