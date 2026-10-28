'use client';
import {useAutoRefresh} from '../ui/use-auto-refresh';
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import type {ConversationRef} from '../../../../../packages/workspace-service/detail.mjs';
import type {ProblemFacts} from '../../../../../packages/workspace-service/problem-facts.mjs';
import type {MonthlyIncidencesView} from '../../../../../packages/workspace-service/incidences.mjs';
import {useT,useIdioma,useLocaleIntl} from '../i18n/proveedor';
import {fecha} from '../../lib/i18n/formato';
import type {Clave} from '../../lib/i18n';
import {chipSevT,motivoT,senalesT} from './problemas-i18n';
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
import {agruparCitas} from '../../lib/legibilidad/explorador.mjs';
import {encabezadoFicha,serieConversaciones,cambioMensual} from '../../lib/legibilidad/ficha.mjs';
import s from './problem-sheet.module.css';
import {fetchCupo} from '../../lib/workspace/cupo.mjs';
const mesCorto=(loc:string,m:string)=>new Intl.DateTimeFormat(loc,{month:'short',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z')).replace('.','');
const mesLargo=(loc:string,m:string)=>new Intl.DateTimeFormat(loc,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z'));
const CLASES_ADJ=['imagen','video','audio','documento','otro'] as const;
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

const NA=()=>{const t=useT();return <strong className={s.na}>{t('prob.noDispAhoraC')}</strong>;};

export function ProblemSheet({id,shared,captured,dinero,facts,onTitle,causa=null}:{causa?:ReactNode;id:string;shared:string;captured:ConversationRef[]|null;dinero:ReactNode|null;facts:ReturnType<typeof useJson<ProblemFacts>>;onTitle?:(t:string|null)=>void}){
 const t=useT(),idioma=useIdioma(),loc=useLocaleIntl(),mCorto=(m:string)=>mesCorto(loc,m),mLargo=(m:string)=>mesLargo(loc,m),pct=(v:number)=>v.toLocaleString(loc,{minimumFractionDigits:1,maximumFractionDigits:1});
 const diaT=(v:unknown)=>{const m=typeof v==='string'?/^(\d{4})-(\d{2})-(\d{2})/.exec(v):null;return m&&Number(m[2])>=1&&Number(m[2])<=12?fecha(idioma,v as string):null;};
 const trend=useJson<MonthlyIncidencesView>('/api/trends/incidences?problem='+encodeURIComponent(id),acceptTrend);
 const ev=useEvidencia(id,shared,captured);
 const [todas,setTodas]=useState(false),[intentos,setIntentos]=useState(0);
 const f=facts.data,head=encabezadoFicha(f,(m:string)=>motivoT(t,m)),grupoTxt=f?.grupo?(f.grupo.de>1?t('prob.grupoNDeM',{n:f.grupo.n,de:f.grupo.de}):t('prob.grupoUnico')):null;
 useEffect(()=>{onTitle?.(head?.categoria??null);},[head?.categoria,onTitle]);
 const serie=serieConversaciones(trend.data),cambio=cambioMensual(serie);
 const tendenciaCaida=!serie&&!trend.busy&&(!!trend.error||trend.data?.status==='timeout');
 // Reintento automático en segundo plano (3 veces, cada 20 s) cuando la tendencia agota su tiempo.
 const recargarTendencia=trend.reload;
 useEffect(()=>{if(!tendenciaCaida||intentos>=3)return;const t=setTimeout(()=>{setIntentos(n=>n+1);void recargarTendencia();},20000);return()=>clearTimeout(t);},[tendenciaCaida,intentos,recargarTendencia]);
 const datos:ColumnDatum[]=(serie?serie.map(p=>({key:p.month,label:mCorto(p.month),long:mLargo(p.month)+(p.partial?' '+t('prob.mesIncompletoP'):''),value:p.value,partial:p.partial,display:p.value===null?t('prob.noDisp'):nf.format(p.value)+' '+t(p.value===1?'prob.conv1':'prob.convN'),detail:p.partial?t('prob.mesIncompletoNoComp'):undefined})):[]);
 const parciales=trend.data?.completeness?.partialMonths??[];
 const att=f?.attachments as unknown as {state?:string;total:number;conversaciones:number;porClase?:Record<string,number>;cobertura?:{total:number;enlazados:number}}|undefined;
 const adj=(!att||att.state!=='ok')?{valor:null,detalle:t('prob.noDispAhoraC'),nota:null}:{valor:att.total,detalle:att.total>0?CLASES_ADJ.filter(k=>(att.porClase?.[k]??0)>0).map(k=>t(('prob.adj.'+k+((att.porClase?.[k]??0)===1?'1':'N')) as Clave,{n:nf.format(att.porClase![k])})).join(' · ')+' '+t(att.conversaciones===1?'prob.adjEn1':'prob.adjEnN',{n:nf.format(att.conversaciones)}):t('prob.adjNinguno'),nota:att.cobertura&&att.cobertura.total>0?t('prob.adjNota',{a:nf.format(att.cobertura.enlazados),b:nf.format(att.cobertura.total)}):null};
 const distintas=agruparCitas((ev.citas??[]).slice().sort((a,b)=>peso(b)-peso(a)));
 const lista=distintas.slice(0,todas?TOPE:VISIBLES);
 const rec=f?.recommendations.items[0]??null;
 const verificadas=ev.citas?distintas.length:null;
 return <div className={s.sheet}>
  <section className="ui-card" aria-label={t('prob.identificacion')}>
   <div className={s.head}>
    <div className={s.chips}>
     {grupoTxt&&<Chip categoria={7}>{grupoTxt}</Chip>}
     {f?.severity&&(()=>{const c=chipSevT(t,f.severity,head?.critico);return c&&<StatusChip tone={c.tono} title={c.ayuda??undefined}>{c.texto}</StatusChip>;})()}
     {head?.critico===true&&<StatusChip tone="bad" title={head.motivo??undefined}>{t('prob.revCritica')}</StatusChip>}
     {head?.critico===false&&<Chip>{t('prob.sinRevCritica')}</Chip>}
     {f&&<KindBadge kind="inferred" hint={t('prob.hintInferido')}/>}
    </div>
    {f&&<TituloAuto problemId={id} label={f.label??''} conversaciones={f.conversations} temas={f.themes??null}/>}
    {facts.busy&&!f&&<div role="status" aria-busy="true"><span className="sr-only">{t('prob.cargandoFicha')}</span><div className="skel-rows"><span/></div></div>}
    {facts.error&&!f&&<p className="state state-error" role="alert">{facts.error} <Button size="sm" icon={<Refresh/>} onClick={facts.reload}>{t('prob.reintentar')}</Button></p>}
    {f&&f.parts.catalog==='unavailable'&&<p className="state" role="note">{t('prob.parteNoDisp')}</p>}
   </div>
  </section>

  <KpiStrip label={t('prob.cifras')} items={[
   {label:t('prob.conversaciones'),c:7,spark:serie?serie.map(p=>p.value??0):undefined,value:!f&&facts.busy?'…':f?.conversations!=null?nf.format(f.conversations):<NA/>,note:cambio&&cambio.pct!==null?<>{cambio.pct>0?'+':cambio.pct<0?'−':''}{pct(Math.abs(cambio.pct))} % {t('prob.vsMesPrevio')}</>:t('prob.distintasGrupo')},
   {label:t('prob.citasRegistradas'),c:7,value:!f&&facts.busy?'…':f?.citations!=null?nf.format(f.citations):<NA/>,note:ev.esperando?undefined:verificadas!==null?t(verificadas===1?'prob.citasVerif1':'prob.citasVerifN',{n:nf.format(verificadas)}):ev.sinAlcance?t('prob.seVerificanPub'):t('prob.verifNoDisp')},
   {label:t('prob.adjuntos'),c:7,value:!f&&facts.busy?'…':adj.valor!==null?nf.format(adj.valor):<NA/>,note:adj.detalle},
   {label:t('prob.senalesCriticas'),c:6,value:!f&&facts.busy?'…':f?.critical?nf.format(f.critical.signals):<NA/>,note:f?.critical?(f.critical.critical?t('prob.sevAltaSensible'):t('prob.ningunaEvCritica')):undefined}
  ]}/>
  {adj.nota&&<p className={s.sub} role="note">{adj.nota}</p>}

  <div className={s.row84} data-falla={tendenciaCaida||undefined}>
  <section className={"ui-card "+s.violeta} aria-label={t('prob.tendenciaMensual')}>
   <header className="ui-card-head"><div className="ui-card-copy"><h2 className="ui-card-title">{t('prob.convPorMes')}</h2><p className="ui-card-desc">{t('prob.ultimos12')}</p></div><KindBadge kind="observed"/></header>
   {tendenciaCaida?<div className={s.nd} role="status"><Icon name="clock" size={16}/><div><strong>{t('prob.noDispAhoraC')}</strong><span>{t('prob.tendenciaTardo')}{intentos<3?' '+t('prob.seReintenta'):''}</span></div><Button size="sm" icon={<Refresh/>} loading={trend.busy} onClick={()=>{setIntentos(0);void trend.reload();}}>{t('prob.reintentar')}</Button></div>:<div className="stack">
    <ChartState busy={trend.busy} hasData={!!serie} error={trend.error} status={trend.status} que={t('prob.laTendencia')} retryLabel={t('prob.reintentarTendencia')} onRetry={trend.reload} height={150}
     empty={<div className={s.nd} role="status"><Icon name="info" size={16}/><div><strong>{t('prob.aunSinDatos')}</strong><span>{t('prob.sinConvFecha')}</span></div></div>}>
     {serie&&<><ColumnChart title={t('prob.convPorMesProblema')} kind="observed" height={150} data={datos} unit={t('prob.convUnidad')}/>
      {cambio&&<p className={s.nota}>{cambio.pct===null?t('prob.sinBaseComp',{mes:mLargo(cambio.a.month),n:nf.format(cambio.a.value!),prev:mLargo(cambio.de.month)}):<>{t('prob.deAMes',{de:mLargo(cambio.de.month),a:mLargo(cambio.a.month)})} <strong>{cambio.pct>0?'+':cambio.pct<0?'−':''}{pct(Math.abs(cambio.pct))} %</strong> ({nf.format(cambio.de.value!)} → {nf.format(cambio.a.value!)}), {t('prob.entreCompletos')}</>}</p>}
      {parciales.length>0&&<p className={s.nota} role="note">* {t(parciales.length===1?'prob.parcial1':'prob.parcialN',{meses:parciales.map(mLargo).join(' '+t('prob.y')+' '),hasta:diaT(trend.data?.completeness?.dataThrough)??t('prob.fechaDesconocida')})}</p>}
      {trend.data!.undated!==null&&trend.data!.undated>0&&<p className={s.nota} role="note">{t('prob.sinFechaGrafica',{n:nf.format(trend.data!.undated)})}</p>}</>}
    </ChartState>
   </div>}
  </section>
  <div className={s.col}>
   {causa}
   {head&&<section className="ui-card" aria-label={t('prob.porQueImporta')}>
    <header className="ui-card-head"><div className="ui-card-copy"><h2 className="ui-card-title">{t('prob.porQueImporta')}</h2><p className="ui-card-desc">{t('prob.revYSenales')}</p></div>{head.critico===true?<StatusChip tone="bad">{t('prob.revCritica')}</StatusChip>:head.critico===false?<Chip>{t('prob.sinRevCritica')}</Chip>:null}</header>
    <p className={s.sub} style={{maxWidth:'none'}}>{head.critico===true&&head.motivo?<><strong>{t('prob.motivoDe')}</strong> {head.motivo}</>:t('prob.ningunaCumple')}{head.senales!==null&&<> · {nf.format(head.senales)} {senalesT(t,head.senales)}.</>}</p>
    {distintas.length>0&&<ul className={s.previa} aria-label={t('prob.citasDestacadas')}>{distintas.slice(0,2).map((c,i)=><li key={c.messageRevisionId+':'+i}><q>{c.quote.length>140?c.quote.slice(0,137)+'…':c.quote}</q></li>)}</ul>}
   </section>}
   <section className="ui-card" aria-label={t('prob.queHacer')}>
   <header className="ui-card-head"><div className="ui-card-copy"><h2 className="ui-card-title">{t('prob.siguientePaso')}</h2><p className="ui-card-desc">{t('prob.recEIntervencion')}</p></div></header>
   {f&&f.recommendations.state==='unavailable'&&<p className="state" role="status">{t('prob.noDispAhoraP')} <Button size="sm" icon={<Refresh/>} onClick={facts.reload}>{t('prob.reintentar')}</Button></p>}
   {f&&f.recommendations.state==='ok'&&!rec&&<p className="state">{t('prob.sinRec')} <LinkButton href={'/recommendations?'+shared+'&problem_id='+encodeURIComponent(id)} size="sm" icon={<Arrow/>}>{t('prob.irARec')}</LinkButton></p>}
   {f&&f.recommendations.state==='ok'&&f.recommendations.items.length>0&&<ul className={s.recs}>{f.recommendations.items.map(r=><li key={r.id} className={s.rec}>
    <div style={{minWidth:0}}><strong>{(['proposed','dismissed','accepted','implemented'].includes(r.status)?t(('prob.rec.'+r.status) as Clave):String(r.status??''))} · {t('prob.version',{v:r.version})}</strong><div className={s.chips}><Chip>{t('prob.intervencion',{e:(r.intervention?(['draft','approved','active','measuring','closed','cancelled'].includes(r.intervention)?t(('prob.int.'+r.intervention) as Clave):String(r.intervention)):t('prob.sinIntervencion'))})}</Chip></div></div>
    <LinkButton href={'/recommendations?'+shared+'&problem_id='+encodeURIComponent(id)} size="sm" icon={<Arrow/>} aria-label={t('prob.verRecDeEste')}>{t('prob.ver')}</LinkButton>
   </li>)}</ul>}
   </section>
  </div>
  </div>

  <section className="ui-card" aria-label={t('prob.evidenciaCitada')}>
   <header className="ui-card-head"><div className="ui-card-copy"><h2 className="ui-card-title">{t('prob.loQueDicen')}</h2><p className="ui-card-desc">{t('prob.citasTextuales')}</p></div><KindBadge kind="observed"/></header>
   {ev.esperando&&<WaitStatus titulo={t('prob.espEvTitulo')} detalle={t('prob.espEvDetalle')}/>}
   {ev.sinAlcance&&!ev.citas&&<p className="state" role="status">{t('prob.abreDesdePub')} <LinkButton href="/problems" size="sm" icon={<Arrow/>}>{t('prob.irAProblemas')}</LinkButton></p>}
   {ev.fallo&&<p className="state state-error" role="alert">{t('prob.noSePudoVerif')} <Button size="sm" icon={<Refresh/>} onClick={ev.reintentar}>{t('prob.reintentar')}</Button></p>}
   {ev.citas&&distintas.length===0&&<p className="state">{t('prob.sinCitas')}</p>}
   {distintas.length>0&&<>
    <p className={s.privacy} role="note"><Icon name="info" size={14}/><span>{t('prob.avisoTerceros')}</span></p>
    <div className={s.evi}>{lista.map((c,i)=><Citation key={c.messageRevisionId+':'+c.quoteHash+':'+i} quote={c.quote} role={c.role} category={c.category} source={c.source} messageRevisionId={c.messageRevisionId} times={c.veces}/>)}</div>
    {distintas.length>VISIBLES&&<div style={{marginTop:'var(--sp-3)'}}><Button size="sm" aria-expanded={todas} onClick={()=>setTodas(v=>!v)}>{todas?t('prob.verPrimeras',{n:VISIBLES}):t('prob.verDeCitas',{a:nf.format(Math.min(TOPE,distintas.length)),b:nf.format(distintas.length)})}</Button></div>}
    {ev.cobertura&&<p className="state" role="note">{t('prob.citasVerifDe',{a:nf.format(ev.cobertura.runsVerified),b:nf.format(ev.cobertura.runsTotal)})}</p>}
    {ev.citas&&ev.citas.length>distintas.length&&<p className="state" role="note">{t('prob.registrosIdenticas',{n:nf.format(ev.citas.length)})}</p>}
   </>}
  </section>

  {dinero??<p className={s.impact} role="note">{t('prob.impactoNoDisp')}</p>}
 </div>;
}
