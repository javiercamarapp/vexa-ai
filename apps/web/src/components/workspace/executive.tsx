'use client';
import {useEffect,useState,type ReactNode} from 'react';
import type {Bundle} from '../../lib/workspace/contracts';
import type {CoverageView} from '../../../../../packages/workspace-service/provenance.mjs';
import type {MonthlyIncidencesView} from '../../../../../packages/workspace-service/incidences.mjs';
import {etiquetaMotivo} from '../../../../../packages/workspace-service/critico.mjs';
import {formatMinorUnits} from '../../../../../packages/metrics/money.mjs';
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
import {hace} from '../../lib/workspace/swr.mjs';
import {claveCache,guardarCache,leerCache} from '../../lib/workspace/cache.mjs';
import {filasDesdeCatalogo,numerarGrupos as numerar,ordenarFilas,fraseGrupo,etiquetaSeveridad,type FilaProblema} from '../../lib/legibilidad/problemas-catalogo.mjs';
import {separarRuido} from '../../lib/legibilidad/ruido.mjs';
import {serieConversaciones} from '../../lib/legibilidad/ficha.mjs';
import {topProblemas} from '../../lib/legibilidad/resumen-ejecutivo.mjs';
import s from './executive.module.css';

export const acceptCoverage=(j:unknown)=>{const d=(j as {data?:CoverageView})?.data;return d&&Array.isArray(d.sources)?d:null;};
const acceptTrend=(j:unknown)=>{const d=(j as {data?:MonthlyIncidencesView})?.data;return d&&Array.isArray(d.series)&&typeof d.status==='string'?d:null;};
type Fuentes=NonNullable<ReturnType<typeof import('../../lib/legibilidad/resumen-ejecutivo.mjs').estadoFuentes>>;

/** UNA franja de estado: cobertura de fuentes, «datos hasta» por fuente, dinero por problema y avisos plegables (antes 3 banners antes de la primera cifra). */
export function StatusStrip({fuentes,cargando,avisos,onCobertura,dineroDisponible}:{fuentes:Fuentes|null;cargando:boolean;avisos:{key:string;node:ReactNode}[];onCobertura:()=>void;dineroDisponible:boolean}){
 return <section className={s.strip} aria-label="Estado de los datos">
  <div className={s.stripRow}>
   <span className={s.stripItem}>Fuentes con datos: {fuentes&&fuentes.cargadas!==null?<strong>{fuentes.cargadas} de {fuentes.total}</strong>:cargando?<CifraCargando/>:<strong>No disponible ahora</strong>}{fuentes&&fuentes.sinCargar.length>0&&<span>(sin cargar: {fuentes.sinCargar.join(', ')})</span>}</span>
   <span className={s.stripItem}>Datos hasta:{(fuentes?.cortes??[]).map(c=><span key={c.etiqueta}>{c.etiqueta} <strong>{c.dia??'sin fecha de corte'}</strong></span>)}{!fuentes&&(cargando?<CifraCargando ancho="12ch"/>:<strong>No disponible ahora</strong>)}</span>
   {!dineroDisponible&&<span className={s.stripItem}>Dinero por problema: <strong>No disponible</strong></span>}
   <Button size="sm" variant="ghost" onClick={onCobertura}>Ver cobertura</Button>
  </div>
  {avisos.length>0&&<details className={s.avisos}><summary>{avisos.length===1?'1 aviso':`${avisos.length} avisos`}</summary><div>{avisos.map(a=><div key={a.key}>{a.node}</div>)}</div></details>}
 </section>;
}

type Kpi={label:string;kind:Parameters<typeof KindBadge>[0]['kind'];value:ReactNode;delta?:Delta|null;foot?:ReactNode;spark?:number[];icon:string;href?:string};
export function ExecKpis({items}:{items:Kpi[]}){
 return <section className={s.kpis} aria-label="Indicadores principales">{items.map(k=><StatCard key={k.label} label={k.label} kind={k.kind} icon={k.icon} value={k.value} delta={k.delta??undefined} spark={k.spark} sparkLabel={k.label+': meses completos'} foot={k.foot} href={k.href}/>)}</section>;
}

function RowSpark({id}:{id:string}){
 const t=useJson<MonthlyIncidencesView>('/api/trends/incidences?problem='+encodeURIComponent(id),acceptTrend);
 const serie=serieConversaciones(t.data);
 const completos=(serie??[]).filter(p=>!p.partial&&p.value!==null).map(p=>p.value as number).slice(-6);
 if(t.busy&&!t.data)return <span className="sr-only">Cargando tendencia</span>;
 if(completos.length<2)return <small title="Sin dos meses completos con datos fechados para dibujar la tendencia">—</small>;
 return <Sparkline data={completos} w={72} h={24} label="Tendencia mensual de conversaciones (meses completos)"/>;
}

/** Top 5 por conversaciones (cifra observada), con mini-tendencia de meses completos y enlace a la ficha. */
export function TopProblems({items,query,cargando,error,onRetry}:{items:Bundle['items']|null;query:string;cargando:boolean;error:string;onRetry:()=>void}){
 const [ruido,setRuido]=useState(false);
 const lista=items?separarRuido(items,i=>[i.title,i.summary],ruido):null;
 const top=lista?topProblemas(lista.visibles,5) as FilaProblema[]:[];
 return <section className="card" aria-label="Problemas con más conversaciones">
  <div className={s.cardHead}><div><h2>Problemas con más conversaciones</h2><p>Los 5 grupos con más conversaciones distintas. La categoría la asigna la IA.</p></div><KindBadge kind="observed"/></div>
  {cargando&&!items&&<EsperaEsqueleto que="los problemas" filas={5}/>}
  {error&&!items&&<p className="state state-error" role="alert">{error} <Button size="sm" onClick={onRetry}>Reintentar</Button></p>}
  {items&&top.length===0&&<EmptyState compact art="search" title="Sin conversaciones por problema" body="Cuando los grupos tengan conversaciones registradas aparecerán aquí." action={<LinkButton href={'/problems?'+query} size="sm" icon={<Arrow/>}>Ver problemas</LinkButton>}/>}
  {top.length>0&&<ol className={s.list}>{top.map((f,i)=><li key={f.id} className={s.row}>
   <span className={s.rank}>{i+1}</span>
   <div className={s.name}><Link href={'/problems/'+f.id+'?'+query}>{f.categoria}</Link><small>{fraseGrupo(f)}</small><TituloAuto problemId={f.id} label={f.titulo} conversaciones={f.conversaciones}/></div>
   <div className={s.num}><strong>{nf.format(f.conversaciones as number)}</strong><small>conversaciones</small><RowSpark id={f.id}/></div>
  </li>)}</ol>}
  {lista&&lista.ocultosN>0&&<p className={s.note}>{ruido?'Se incluyen':'Se ocultan'} {nf.format(lista.ocultosN)} grupos de notificaciones automáticas. <button type="button" className="row-link-inline" onClick={()=>setRuido(v=>!v)}>{ruido?'Ocultarlas':'Incluirlas'}</button></p>}
  <p className={s.note}><LinkButton href={'/problems?'+query} variant="ghost" size="sm" icon={<Arrow/>}>Ver todos los problemas</LinkButton></p>
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
 const clave=claveCache('problems',query);
 const desde=(c:ReturnType<typeof leerCache>)=>c?{d:desdeCatalogo(c.datos as Bundle),edad:c.edadMs}:null;
 const [lectura,setLectura]=useState<{d:Criticos|null;edad:number|null}|null>(()=>{const c=desde(leerCache(clave));return c?{d:c.d,edad:c.edad}:null;});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const c=desde(leerCache(clave));void Promise.resolve().then(()=>setLectura(c?{d:c.d,edad:c.edad}:null));},[clave]);
 const cargar=async()=>{
  setBusy(true);setError('');
  try{const q=new URLSearchParams(query);q.set('resource','problems');const r=await fetch('/api/workspace?'+q.toString(),{cache:'no-store'});if(!r.ok)throw Error(String(r.status));
   const b=(await r.json()).data as Bundle;if(!b||!Array.isArray(b.items))throw Error('shape');guardarCache(clave,b);const d=desdeCatalogo(b);if(!d)setError('Las señales críticas no se calcularon en esta carga; reintenta en unos segundos.');setLectura(d?{d,edad:null}:null);
  }catch{setError('No se pudo consultar la revisión crítica ahora.');}finally{setBusy(false);}
 };
 // `edadMs`: antigüedad de la última lectura guardada (null = recién calculada); nunca se presenta una lectura vieja como actual.
 return {datos:lectura?.d??null,edadMs:lectura?.edad??null,busy,error,cargar};
}
export function Attention({crit,query,conteo}:{crit:ReturnType<typeof useCriticos>;query:string;conteo:{groups:number;signals:number|null}|null}){
 const d=crit.datos,total=d?.groups??conteo?.groups??null;
 return <section className="card" aria-label="Qué requiere atención" id="atencion">
  <div className={s.cardHead}><div><h2>Qué requiere atención</h2><p>Grupos con al menos una señal crítica (severidad alta, crítica o categoría sensible). Se revisan sin importar el dinero.</p></div><KindBadge kind="inferred" hint="La severidad la asigna la IA al extraer cada conversación: es Inferido."/></div>
  {total!==null&&<p className={s.note}><strong>{nf.format(total)}</strong> {total===1?'grupo con revisión crítica':'grupos con revisión crítica'}{(d?.signals??conteo?.signals)!=null&&<> · {nf.format((d?.signals??conteo?.signals) as number)} señales críticas (evidencias)</>}</p>}
  {d&&crit.edadMs!==null&&<p className="state state-cache" role="status" data-testid="criticos-edad">Última lectura guardada ({hace(crit.edadMs)}); no se recalcula sola porque es una consulta pesada. <button type="button" className="row-link-inline" onClick={()=>void crit.cargar()} disabled={crit.busy}>{crit.busy?'Calculando…':'Calcular de nuevo'}</button></p>}
  {d&&d.filas.length>0&&<ol className={s.list}>{d.filas.slice(0,CRIT_VISIBLES).map((f,i)=><li key={f.id} className={s.row}>
   <span className={s.rank}>{i+1}</span>
   <div className={s.name}><Link href={'/problems/'+f.id+'?'+query}>{f.categoria}</Link><small>{fraseGrupo(f)}{f.motivoCritico?' · '+etiquetaMotivo(f.motivoCritico):''}</small><TituloAuto problemId={f.id} label={f.titulo} conversaciones={f.conversaciones} temas={f.temas??null}/></div>
   <div className={s.num}><strong>{f.conversaciones===null?'—':nf.format(f.conversaciones)}</strong><small>conversaciones</small>{f.severidad&&<StatusChip tone={f.severidad==='high'||f.severidad==='critical'?'bad':f.severidad==='medium'?'warn':'neutral'}>{etiquetaSeveridad(f.severidad)}</StatusChip>}</div>
  </li>)}</ol>}
  {!d&&<>
   <p className={s.note}>{total===null?'Todavía no se calcularon los grupos críticos. Es una consulta pesada y no se lanza sola; no significa que no existan.':'Abre la lista para ver cuáles son.'}</p>
   {crit.busy?<EsperaEsqueleto que="los grupos críticos" filas={3}/>:<div className="btn-group"><Button size="sm" variant="primary" onClick={()=>void crit.cargar()}>Calcular ahora</Button><LinkButton href={'/problems?'+query+'#senales-criticas'} size="sm" icon={<Arrow/>}>Ir a Problemas</LinkButton></div>}
   {crit.error&&<p className="state state-error" role="alert">{crit.error}</p>}
  </>}
  {d&&d.filas.length>CRIT_VISIBLES&&<p className={s.note}><LinkButton href={'/problems?'+query+'#senales-criticas'} variant="ghost" size="sm" icon={<Arrow/>}>Ver los {nf.format(d.filas.length)} grupos</LinkButton></p>}
 </section>;
}
export function HowCalculated({children}:{children:ReactNode}){
 return <details className={'card '+s.fold}><summary>Cómo se calculó</summary><div>{children}</div></details>;
}
export const dinero=(m:{amountMinor:string|null;currency:string;exponent:number}|null)=>m&&m.amountMinor!==null?formatMinorUnits(m.amountMinor,m.currency,m.exponent):null;
