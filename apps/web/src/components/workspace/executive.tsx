'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {useStoredString} from '../ui/browser-state';
import type {Bundle} from '../../lib/workspace/contracts';
import type {CoverageView} from '../../../../../packages/workspace-service/provenance.mjs';
import type {MonthlyIncidencesView} from '../../../../../packages/workspace-service/incidences.mjs';
import {useT} from '../i18n/proveedor';
import {fraseGrupoT,motivoT,sevT} from './problemas-i18n';
import {formatMinorUnits} from '../../lib/formato/dinero-pantalla.mjs';
import Link from './navigation-lifecycle';
import {StatCard,type Delta} from '../ui/stat-card';
import {Sparkline} from '../ui/sparkline';
import {KindBadge} from '../ui/kind-badge';
import {TituloAuto} from '../ui/titulo-auto';
import {StatusChip} from '../ui/status-chip';
import {Button,LinkButton,Arrow} from '../ui/button';
import {EsperaEsqueleto,CifraCargando} from '../ui/wait-status';
import {EmptyState} from '../ui/empty-state';
import {useJson} from '../ui/use-json';
import {nf} from '../ui/format';
import {claveCache,guardarCache,leerCache} from '../../lib/workspace/cache.mjs';
import {filasDesdeCatalogo,numerarGrupos as numerar,ordenarFilas,type FilaProblema} from '../../lib/legibilidad/problemas-catalogo.mjs';
import {separarRuido} from '../../lib/legibilidad/ruido.mjs';
import {serieConversaciones} from '../../lib/legibilidad/ficha.mjs';
import {topProblemas} from '../../lib/legibilidad/resumen-ejecutivo.mjs';
import s from './executive.module.css';

export const acceptCoverage=(j:unknown)=>{const d=(j as {data?:CoverageView})?.data;return d&&Array.isArray(d.sources)?d:null;};
const acceptTrend=(j:unknown)=>{const d=(j as {data?:MonthlyIncidencesView})?.data;return d&&Array.isArray(d.series)&&typeof d.status==='string'?d:null;};
type Fuentes=NonNullable<ReturnType<typeof import('../../lib/legibilidad/resumen-ejecutivo.mjs').estadoFuentes>>;

/** UNA franja de estado: cobertura de fuentes, «datos hasta» por fuente, dinero por problema y avisos plegables (antes 3 banners antes de la primera cifra). */
export function StatusStrip({linea=null,fuentes,cargando,avisos,onCobertura,dineroDisponible}:{linea?:string|null;fuentes:Fuentes|null;cargando:boolean;avisos:{key:string;node:ReactNode}[];onCobertura:()=>void;dineroDisponible:boolean}){
 const t=useT();
 // Avisos ocultables: cada uno se puede quitar 7 días (solo en este navegador); si aparece un aviso con otra clave, se muestra. La causa se resuelve con sus acciones (Importar datos, Revisar fuentes…).
 const CLAVE_OCULTOS='vexa:avisos-ocultos';
 const [guardados,guardarOcultos]=useStoredString(CLAVE_OCULTOS,'{}');
 const [ahora]=useState(()=>Date.now());
 let ocultos:Record<string,number>={};
 try{const j=JSON.parse(guardados) as Record<string,number>;ocultos=Object.fromEntries(Object.entries(j).filter(([,v])=>typeof v==='number'&&v>ahora));}catch{/* invalid preference: show all */}
 const visibles=avisos.filter(a=>!ocultos[a.key]);
 return <section className={s.strip+' mv-franja'} data-estado-datos aria-label={t('exe.estadoDatos')}>
  <div className={s.stripRow}>
   <span className={s.stripItem+' mv-franja-fuentes'}><span className="mv-etq">{t('exe.fuentesConDatos')}</span> {fuentes&&fuentes.cargadas!==null?<strong>{t('exe.xDeY',{a:fuentes.cargadas,b:fuentes.total??0})}</strong>:cargando?<CifraCargando/>:<strong>{t('prob.noDispAhoraC')}</strong>}{fuentes&&fuentes.sinCargar.length>0&&<span className="mv-franja-sin">({t('exe.sinCargar')} {fuentes.sinCargar.join(', ')})</span>}</span>
   <span className={s.stripItem+' mv-franja-hasta'}>{t('exe.datosHasta')}{(fuentes?.cortes??[]).map(c=><span key={c.etiqueta}>{c.etiqueta} <strong>{c.dia??t('res.sinFechaCorte')}</strong></span>)}{!fuentes&&(cargando?<CifraCargando ancho="12ch"/>:<strong>{t('prob.noDispAhoraC')}</strong>)}</span>
   {!dineroDisponible&&<span className={s.stripItem}>{t('exe.dineroPorProblema')} <strong>{t('prob.noDisp')}</strong></span>}
   <Button size="sm" variant="ghost" onClick={onCobertura}>{t('exe.verCobertura')}</Button>
  </div>
  {linea&&<p className={s.lineaAvisos+' mv-franja-linea'} role="status" data-testid="linea-avisos">{linea}</p>}
  {visibles.length>0&&<details className={s.avisos+' mv-avisos'}><summary>{visibles.length===1?t('exe.unAviso'):t('exe.nAvisos',{n:visibles.length})}</summary><div>{visibles.map(a=><div key={a.key}>{a.node}<div className={s.avisoPie}><Button size="sm" variant="ghost" onClick={()=>{const vence=Date.now()+7*864e5;guardarOcultos(JSON.stringify({...ocultos,[a.key]:vence}));}} title={t('exe.ocultarTitulo')}>{t('exe.ocultar7')}</Button></div></div>)}</div></details>}
 </section>;
}

type Kpi={label:string;kind:Parameters<typeof KindBadge>[0]['kind'];value:ReactNode;delta?:Delta|null;foot?:ReactNode;spark?:number[];icon:string;href?:string};
export function ExecKpis({items}:{items:Kpi[]}){
 const t=useT();
 return <section className={s.kpis} aria-label={t('exe.indicadores')}>{items.map(k=><StatCard key={k.label} label={k.label} kind={k.kind} icon={k.icon} value={k.value} delta={k.delta??undefined} spark={k.spark} sparkLabel={k.label+': '+t('exe.mesesCompletos')} foot={k.foot} href={k.href}/>)}</section>;
}

function RowSpark({id}:{id:string}){
 const tt=useT();
 const t=useJson<MonthlyIncidencesView>('/api/trends/incidences?problem='+encodeURIComponent(id),acceptTrend);
 const serie=serieConversaciones(t.data);
 const completos=(serie??[]).filter(p=>!p.partial&&p.value!==null).map(p=>p.value as number).slice(-6);
 if(t.busy&&!t.data)return <span className="sr-only">{tt('exe.cargandoTendencia')}</span>;
 if(completos.length<2)return <small title={tt('exe.sinDosMeses')}>—</small>;
 return <Sparkline data={completos} w={72} h={24} color={7} label={tt('exe.tendenciaMensual')}/>;
}

/** Tabla de los 8 grupos con más conversaciones: barra en color de métrica (Problemas = violeta) dentro de la celda, tendencia de meses completos y severidad. */
export function TopProblems({items,query,cargando,error,onRetry,criticos}:{items:Bundle['items']|null;query:string;cargando:boolean;error:string;onRetry:()=>void;criticos?:{groups:number;signals:number|null}|null}){
 const t=useT();
 const [ruido,setRuido]=useState(false);
 const lista=items?separarRuido(items,i=>[i.title,i.summary],ruido):null;
 const top=lista?topProblemas(lista.visibles,8) as FilaProblema[]:[];
 const max=Math.max(1,...top.map(f=>f.conversaciones??0));
 return <section className="card ov-tabla" aria-label={t('exe.probMasConv')}>
  <div className={s.cardHead}><div><h2>{t('exe.probMasConv')}</h2><p>{t('exe.gruposMasConv')}</p></div>
   <div className={s.headAcc}>{criticos&&<LinkButton href={'/problems?'+query+'#senales-criticas'} size="sm" variant="ghost" icon={<Arrow/>}>{nf.format(criticos.groups)} {t(criticos.groups===1?'exe.grupoCritico1':'exe.grupoCriticoN')}</LinkButton>}<KindBadge kind="observed"/></div></div>
  {cargando&&!items&&<EsperaEsqueleto que={t('res.losProblemas')} filas={5}/>}
  {error&&!items&&<p className="state state-error" role="alert">{error} <Button size="sm" onClick={onRetry}>{t('prob.reintentar')}</Button></p>}
  {items&&top.length===0&&<EmptyState compact art="search" title={t('exe.sinConvPorProb')} body={t('exe.cuandoGrupos')} action={<LinkButton href={'/problems?'+query} size="sm" icon={<Arrow/>}>{t('exe.verProblemas')}</LinkButton>}/>}
  {top.length>0&&<div className="ui-table-wrap" role="region" aria-label={t('exe.tablaProbMasConv')} tabIndex={0} style={{maxHeight:'none'}}><table className="ui-table ov-problemas"><caption className="sr-only">{t('exe.captionProb')}</caption>
   <thead><tr><th scope="col">{t('prob.problema')}</th><th scope="col" data-align="num">{t('prob.conversaciones')}</th><th scope="col">{t('exe.tendencia')}</th><th scope="col">{t('prob.severidad')}</th></tr></thead>
   <tbody>{top.map(f=><tr key={f.id}>
    <td><Link href={'/problems/'+f.id+'?'+query}>{f.categoria}</Link> <small>{fraseGrupoT(t,f)}</small></td>
    <td data-align="num"><span className="ov-celda-barra"><span className="ov-barra"><i style={{width:Math.max(2,(f.conversaciones??0)*100/max)+'%'}}/></span><strong>{f.conversaciones===null?'—':nf.format(f.conversaciones)}</strong></span></td>
    <td><RowSpark id={f.id}/></td>
    <td>{f.severidad?<StatusChip tone={f.severidad==='high'||f.severidad==='critical'?'bad':f.severidad==='medium'?'warn':'neutral'}>{sevT(t,f.severidad)}</StatusChip>:<small>—</small>}</td>
   </tr>)}</tbody></table></div>}
  <div className={s.foot}>{lista&&lista.ocultosN>0&&<span className={s.note}>{t(ruido?'exe.seIncluyen':'exe.seOcultan',{n:nf.format(lista.ocultosN)})} <button type="button" className="row-link-inline" onClick={()=>setRuido(v=>!v)}>{ruido?t('exe.ocultarlas'):t('exe.incluirlas')}</button></span>}<LinkButton href={'/problems?'+query} variant="ghost" size="sm" icon={<Arrow/>}>{t('res.verTodosProblemas')}</LinkButton></div>
 </section>;
}

type Criticos={groups:number|null;signals:number|null;filas:FilaProblema[]};
const CRIT_VISIBLES=5;
function desdeCatalogo(b:Bundle):Criticos|null{
 const cat=(b.meta as {catalog?:{rows:unknown[];critical:{groups:number;signals:number}|null;parts:{signals:string}}}).catalog;
 if(!cat||cat.parts?.signals!=='ok')return null;
 const filas=ordenarFilas(numerar(filasDesdeCatalogo(cat as never)).filter(f=>f.critico===true),{col:'conversaciones',dir:'desc'});
 return {groups:cat.critical?.groups??filas.length,signals:cat.critical?.signals??null,filas};
}
/** Grupos con revisión crítica: se leen de la lista de Problemas ya cargada (caché de 5 min) o, a petición, de la misma consulta; el Resumen no la dispara solo (es la pesada). */
export function useCriticos(query:string){
 const t=useT();
 const clave=claveCache('problems',query);
 const desde=(c:ReturnType<typeof leerCache>)=>c?{d:desdeCatalogo(c.datos as Bundle),edad:c.edadMs}:null;
 const [lectura,setLectura]=useState<{d:Criticos|null;edad:number|null}|null>(()=>{const c=desde(leerCache(clave));return c?{d:c.d,edad:c.edad}:null;});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const c=desde(leerCache(clave));void Promise.resolve().then(()=>setLectura(c?{d:c.d,edad:c.edad}:null));},[clave]);
 const cargar=async()=>{
  setBusy(true);setError('');
  try{const q=new URLSearchParams(query);q.set('resource','problems');const r=await fetch('/api/workspace?'+q.toString(),{cache:'no-store'});if(!r.ok)throw Error(String(r.status));
   const b=(await r.json()).data as Bundle;if(!b||!Array.isArray(b.items))throw Error('shape');guardarCache(clave,b);const d=desdeCatalogo(b);if(!d)setError(t('exe.sinSenales'));setLectura(d?{d,edad:null}:null);
  }catch{setError(t('exe.noSePudoCrit'));}finally{setBusy(false);}
 };
 // `edadMs`: antigüedad de la última lectura guardada (null = recién calculada); nunca se presenta una lectura vieja como actual.
 return {datos:lectura?.d??null,edadMs:lectura?.edad??null,busy,error,cargar};
}
export function Attention({crit,query,conteo}:{crit:ReturnType<typeof useCriticos>;query:string;conteo:{groups:number;signals:number|null}|null}){
 const t=useT();
 const d=crit.datos,total=d?.groups??conteo?.groups??null;
 return <section className="card" aria-label={t('exe.queRequiere')} id="atencion">
  <div className={s.cardHead}><div><h2>{t('exe.queRequiere')}</h2><p>{t('exe.gruposUnaSenal')}</p></div><KindBadge kind="inferred" hint={t('exe.sevIA')}/></div>
  {total!==null&&<p className={s.note}><strong>{nf.format(total)}</strong> {t(total===1?'exe.grupoRevCrit1':'exe.grupoRevCritN')}{(d?.signals??conteo?.signals)!=null&&<> · {t('exe.senalesEvidencias',{n:nf.format((d?.signals??conteo?.signals) as number)})}</>}</p>}
  {d&&crit.edadMs!==null&&<p className="state state-cache" role="status" data-testid="criticos-edad">{t('exe.ultimaLectura',{hace:crit.edadMs<59500?t('exe.haceS',{n:Math.max(0,Math.round(crit.edadMs/1000))}):t('exe.haceMin',{n:Math.round(Math.round(crit.edadMs/1000)/60)})})} <button type="button" className="row-link-inline" onClick={()=>void crit.cargar()} disabled={crit.busy}>{crit.busy?t('exe.calculando'):t('exe.calcularDeNuevo')}</button></p>}
  {d&&d.filas.length>0&&<ol className={s.list}>{d.filas.slice(0,CRIT_VISIBLES).map((f,i)=><li key={f.id} className={s.row}>
   <span className={s.rank}>{i+1}</span>
   <div className={s.name}><Link href={'/problems/'+f.id+'?'+query}>{f.categoria}</Link><small>{fraseGrupoT(t,f)}{f.motivoCritico?' · '+motivoT(t,f.motivoCritico):''}</small><TituloAuto problemId={f.id} label={f.titulo} conversaciones={f.conversaciones} temas={f.temas??null}/></div>
   <div className={s.num}><strong>{f.conversaciones===null?'—':nf.format(f.conversaciones)}</strong><small>{t('prob.convN')}</small>{f.severidad&&<StatusChip tone={f.severidad==='high'||f.severidad==='critical'?'bad':f.severidad==='medium'?'warn':'neutral'}>{sevT(t,f.severidad)}</StatusChip>}</div>
  </li>)}</ol>}
  {!d&&<>
   <p className={s.note}>{total===null?t('exe.todaviaNoCalc'):t('exe.abreLista')}</p>
   {crit.busy?<EsperaEsqueleto que={t('exe.losGruposCriticos')} filas={3}/>:<div className="btn-group"><Button size="sm" variant="primary" onClick={()=>void crit.cargar()}>{t('exe.calcularAhora')}</Button><LinkButton href={'/problems?'+query+'#senales-criticas'} size="sm" icon={<Arrow/>}>{t('prob.irAProblemas')}</LinkButton></div>}
   {crit.error&&<p className="state state-error" role="alert">{crit.error}</p>}
  </>}
  {d&&d.filas.length>CRIT_VISIBLES&&<p className={s.note}><LinkButton href={'/problems?'+query+'#senales-criticas'} variant="ghost" size="sm" icon={<Arrow/>}>{t('exe.verLosGrupos',{n:nf.format(d.filas.length)})}</LinkButton></p>}
 </section>;
}
export function HowCalculated({children}:{children:ReactNode}){
 const t=useT();
 return <details className={'card '+s.fold}><summary>{t('exe.comoSeCalculo')}</summary><div>{children}</div></details>;
}
export const dinero=(m:{amountMinor:string|null;currency:string;exponent:number}|null)=>m&&m.amountMinor!==null?formatMinorUnits(m.amountMinor,m.currency,m.exponent):null;
