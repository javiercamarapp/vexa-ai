'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {Bundle,Metric} from '../../lib/workspace/contracts';
import {formatMinorUnits} from '../../../../../packages/metrics/money.mjs';
import {ratioBps} from './cfo-model.mjs';
import {epistemicKind} from '../../lib/epistemic.mjs';
import Link from './navigation-lifecycle';
import {SegmentedControl} from '../ui/segmented';
import {StatusChip} from '../ui/status-chip';
import {KindBadge} from '../ui/kind-badge';
import {BarList,type BarListItem} from '../ui/bar-list';
import {DonutChart} from '../ui/donut-chart';
import {ProgressRing} from '../ui/progress-ring';
import {Drawer} from '../ui/overlay';
import {Citation} from '../ui/citation';
import {SourceRef} from '../ui/source-ref';
import {LinkButton,Arrow} from '../ui/button';
import {Icon} from '../ui/icons';
import {InsightList} from '../ui/insight-list';
import {NoiseToggle} from '../ui/noise-toggle';
import {insightsProblemas} from '../../lib/legibilidad/insights.mjs';
import {separarRuido} from '../../lib/legibilidad/ruido.mjs';
import {filasDesdeCatalogo,filasDesdeItems,numerarGrupos,agruparCategorias,resumenFilas,ordenarFilas,filtrarFilas,hayImporte,fraseGrupo,marcarGeneral,etiquetaSeveridad,type FilaProblema,type ColumnaOrden} from '../../lib/legibilidad/problemas-catalogo.mjs';
import {DEFINICION,etiquetaMotivo,desgloseCriticos} from '../../../../../packages/workspace-service/critico.mjs';
import {nf} from '../ui/format';
import {EmptyState} from '../ui/empty-state';
import s from './problems-view.module.css';
type M=Metric&{coverage?:{known_n:number;eligible_n:number};missing_reasons?:string[]};
const STATUS:Record<string,{label:string;tone:'ok'|'warn'|'info'}>={ready:{label:'Cobertura completa',tone:'ok'},partial:{label:'Cobertura parcial',tone:'warn'},stale:{label:'Corte anterior',tone:'warn'}};
const exact=(m:M)=>m.amount_minor!==null&&/^-?\d+$/.test(m.amount_minor);
const money=(m:M)=>formatMinorUnits(m.amount_minor,m.currency,m.exponent);
const PAGINA=50,CATEGORIAS_VISIBLES=10,CRITICAS_VISIBLES=8;
function Coverage({m}:{m:M}){const c=m.coverage;if(!c||c.eligible_n<=0)return null;return <span className="pcard-cov"><ProgressRing size={30} stroke={4} value={c.known_n/c.eligible_n} title={`Cobertura: ${nf.format(c.known_n)} de ${nf.format(c.eligible_n)}`}/><span>{nf.format(c.known_n)} de {nf.format(c.eligible_n)} registros</span></span>;}
function Figure({m,big=false}:{m:M;big?:boolean}){
 return <div className="pfig" data-big={big||undefined}><div className="pfig-label"><span>{m.label}</span><KindBadge metric={m}/></div>
  <strong className="pfig-value">{exact(m)?money(m):'No disponible'}</strong>
  {!exact(m)&&m.missing_reasons?.includes('EXPOSURE_NOT_LINKED')&&<small>Sin vínculos problema–pedido: la exposición no se calcula.</small>}
  {!exact(m)&&m.known_subtotal!==null&&<small>Subtotal conocido: {formatMinorUnits(m.known_subtotal,m.currency,m.exponent)}; no es el total.</small>}</div>;
}
const NA=<span className={s.na}>No disponible</span>;
const sevTone=(v:string|null)=>v==='high'||v==='critical'?'bad' as const:v==='medium'?'warn' as const:'neutral' as const;
const Severidad=({f}:{f:FilaProblema})=>f.severidad===null?NA:<StatusChip tone={sevTone(f.severidad)}>{etiquetaSeveridad(f.severidad)}</StatusChip>;
const textoSenales=(f:FilaProblema)=>f.senalesCriticas===null||f.conversaciones===null?null:`${nf.format(f.senalesCriticas)} ${f.senalesCriticas===1?'señal crítica':'señales críticas'} en ${nf.format(f.conversaciones)} conv.`;
const motivoDe=(f:FilaProblema)=>etiquetaMotivo(f.motivoCritico)??undefined;
const Critico=({f}:{f:FilaProblema})=>f.critico===null?NA:f.critico?<span title={motivoDe(f)}><StatusChip tone="bad">Revisión crítica</StatusChip>{textoSenales(f)&&<small className={s.critWhy}>{textoSenales(f)}</small>}</span>:<span>No</span>;
const Citas=({f}:{f:FilaProblema})=>f.citas===null?NA:<span title="Citas registradas; se verifican al abrir el problema">{nf.format(f.citas)}</span>;
const Recomendacion=({f}:{f:FilaProblema})=>f.recomendaciones===null?NA:f.recomendaciones>0?<span>Sí ({f.recomendaciones})</span>:<span>No</span>;
const Conversaciones=({f}:{f:FilaProblema})=>f.conversaciones===null?NA:<strong>{nf.format(f.conversaciones)}</strong>;
const hrefDe=(f:FilaProblema,query:string)=>'/problems/'+f.id+'?'+query;
const ORDENES:{v:string;label:string}[]=[
 {v:'conversaciones:desc',label:'Conversaciones: de más a menos'},{v:'conversaciones:asc',label:'Conversaciones: de menos a más'},{v:'categoria:asc',label:'Categoría: A–Z'},
 {v:'severidad:desc',label:'Severidad: alta primero'},{v:'critico:desc',label:'Revisión crítica primero'},{v:'citas:desc',label:'Citas: de más a menos'},{v:'recomendaciones:desc',label:'Con recomendación primero'}];
const COLUMNA_DIR:Record<ColumnaOrden,'asc'|'desc'>={categoria:'asc',conversaciones:'desc',severidad:'desc',critico:'desc',citas:'desc',recomendaciones:'desc',importe:'desc'};

function QuickView({fila,query,onClose}:{fila:FilaProblema|null;query:string;onClose:()=>void}){
 const reg=fila?.registro,st=reg?(STATUS[reg.status]??{label:reg.status,tone:'info' as const}):null;
 return <Drawer open={!!fila} onClose={onClose} width={560} title={fila?.categoria??''} subtitle={fila&&<span>{fraseGrupo(fila)}{st&&<> · <StatusChip tone={st.tone}>{st.label}</StatusChip></>}</span>} footer={fila&&<LinkButton href={hrefDe(fila,query)} variant="primary" size="sm" icon={<Arrow/>}>Abrir problema</LinkButton>}>
  {fila&&<div className={s.quick}>
   <div className={s.tiles}>
    <div className={s.tile}><strong>{fila.conversaciones===null?'No disponible':nf.format(fila.conversaciones)}</strong><span>Conversaciones <KindBadge kind="observed"/></span></div>
    <div className={s.tile}><strong>{fila.severidad===null?'No disponible':etiquetaSeveridad(fila.severidad)}</strong><span>Severidad registrada</span></div>
    <div className={s.tile}><strong>{fila.critico===null?'No disponible':fila.critico?'Sí':'No'}</strong><span>Revisión crítica{textoSenales(fila)?' · '+textoSenales(fila):''}</span></div>
    <div className={s.tile}><strong>{fila.recomendaciones===null?'No disponible':fila.recomendaciones>0?'Sí ('+fila.recomendaciones+')':'No'}</strong><span>Recomendación guardada</span></div>
   </div>
   {reg&&<p className="card-lead">{reg.summary}</p>}
   {reg&&reg.metrics.length>0&&<div className="stat-grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))'}}>{reg.metrics.map((m,i)=><div key={i} className="card"><Figure m={m as M}/><Coverage m={m as M}/><small className="pfig-src"><SourceRef value={m.source_ref}/></small></div>)}</div>}
   {reg&&reg.evidence.length>0?<section><h3>Evidencia autorizada ({reg.evidence.length})</h3>{reg.evidence.map(e=><Citation key={e.id} quote={e.quote} role={e.role} messageRevisionId={e.id}/>)}</section>
    :<p className="state">{fila.citas!==null?`${nf.format(fila.citas)} ${fila.citas===1?'cita registrada':'citas registradas'}; la evidencia se verifica al abrir el problema.`:'La evidencia se verifica al abrir el problema.'}</p>}
  </div>}
 </Drawer>;
}

function Categorias({cats,sel,onSelect}:{cats:ReturnType<typeof agruparCategorias>;sel:string|null;onSelect:(clave:string|null)=>void}){
 const [todas,setTodas]=useState(false);
 const max=Math.max(1,...cats.map(c=>c.conversaciones??0)),lista=todas?cats:cats.slice(0,CATEGORIAS_VISIBLES);
 return <section className="card" aria-label="Conversaciones por categoría">
  <div className={s.cardHead}><div><h2>Conversaciones por categoría</h2><p>Cada barra es una categoría de la clasificación. Elige una para ver sus grupos de problemas abajo.</p></div><KindBadge kind="observed"/></div>
  <ul className={s.cats}>{lista.map(c=><li key={c.clave}><button type="button" className={s.catBtn} aria-pressed={sel===c.clave} onClick={()=>onSelect(sel===c.clave?null:c.clave)}>
   <span className={s.catTop}><span className={s.catName}>{c.nombre}</span><span className={s.catNum}>{c.conversaciones===null?'No disponible':nf.format(c.conversaciones)+' conv.'}</span></span>
   <span className={s.catTrack} aria-hidden="true"><span className={s.catFill} style={{width:c.conversaciones===null?'0%':Math.max(1,c.conversaciones*100/max)+'%'}}/></span>
   <span className={s.catSub}><span>{nf.format(c.grupos)} {c.grupos===1?'grupo':'grupos'}</span>{c.criticos!==null&&c.criticos>0&&<span>{nf.format(c.criticos)} {c.criticos===1?'grupo':'grupos'} con revisión crítica</span>}</span>
  </button></li>)}</ul>
  {cats.length>CATEGORIAS_VISIBLES&&<div className={s.more}><button type="button" className="btn btn-ghost btn-sm" onClick={()=>setTodas(v=>!v)} aria-expanded={todas}>{todas?'Ver solo las '+CATEGORIAS_VISIBLES+' principales':'Ver las '+nf.format(cats.length)+' categorías'}</button></div>}
 </section>;
}

function Criticas({filas,query,disponible,total}:{filas:FilaProblema[];query:string;disponible:boolean;total:{groups:number;signals:number}|null}){
 const [todas,setTodas]=useState(false);
 const crit=useMemo(()=>ordenarFilas(filas.filter(f=>f.critico===true),{col:'conversaciones',dir:'desc'}),[filas]);
 const cats=useMemo(()=>agruparCategorias(crit),[crit]);
 const lista=todas?crit:crit.slice(0,CRITICAS_VISIBLES);
 const desg=desgloseCriticos({total:total?.groups??null,visibles:crit.length,senales:total?.signals??null});
 return <section className="card" id="senales-criticas" aria-label="Grupos con revisión crítica">
  <div className={s.cardHead}><div><h2>Grupos con revisión crítica{disponible?' ('+nf.format(desg.grupos)+')':''}</h2><p>{DEFINICION.grupo} Se revisan sin importar el dinero.</p><p className="state">{DEFINICION.senal}</p>{disponible&&<p className="state"><strong>{desg.texto}</strong></p>}</div></div>
  {!disponible?<p className="state" role="status">No disponible ahora: las señales críticas no se calcularon en esta carga. No significa que no existan; reintenta con «Actualizar».</p>
   :!crit.length?<p className="state">Ningún grupo visible cumple el criterio crítico en este corte.</p>
   :<div className={s.crit}>
    <ul className={s.critCats} aria-label="Categorías con señales críticas">{cats.map(c=><li key={c.clave}><span className="chip">{c.nombre}: {nf.format(c.grupos)}</span></li>)}</ul>
    <ul className={s.critList}>{lista.map(f=><li key={f.id} className={s.critItem}><Link href={hrefDe(f,query)} className="row-link-inline">{f.categoria} · {fraseGrupo(f)}</Link><span className={s.critNum}>{f.conversaciones===null?'No disponible':nf.format(f.conversaciones)+' conv.'}</span>{textoSenales(f)&&<span className={s.critMeta}>{textoSenales(f)}{motivoDe(f)?' · '+motivoDe(f):''}</span>}</li>)}</ul>
    {crit.length>CRITICAS_VISIBLES&&<div><button type="button" className="btn btn-ghost btn-sm" onClick={()=>setTodas(v=>!v)} aria-expanded={todas}>{todas?'Ver solo las '+CRITICAS_VISIBLES+' con más conversaciones':'Ver los '+nf.format(crit.length)+' grupos'}</button></div>}
    {desg.ocultos>0&&<p className="state">Se listan los {nf.format(crit.length)} a la vista; los otros {nf.format(desg.ocultos)} están en notificaciones automáticas ocultas y ya cuentan en el total de {nf.format(desg.grupos)}.</p>}
   </div>}
 </section>;
}

export function ProblemsView({bundle,query}:{bundle:Bundle;query:string}){
 const [modo,setModo]=useState<'tabla'|'tarjetas'>('tabla'),[quick,setQuick]=useState<FilaProblema|null>(null),[incluirRuido,setIncluirRuido]=useState(false);
 const [texto,setTexto]=useState(''),[clave,setClave]=useState<string|null>(null),[soloCriticos,setSoloCriticos]=useState<'todos'|'criticos'>('todos'),[orden,setOrden]=useState<string|null>(null),[mostrar,setMostrar]=useState(PAGINA);
 const tablaRef=useRef<HTMLDivElement>(null);
 const catalogo=bundle.meta.catalog;
 // Con resumen del catálogo (corte sin vínculos) las filas son TODOS los problemas vigentes; sin él, los registros de la página (con su importe si lo traen).
 const todas=useMemo(()=>numerarGrupos(catalogo?filasDesdeCatalogo(catalogo):filasDesdeItems(bundle.items)),[catalogo,bundle.items]);
 // Solo presentación y ranking: las notificaciones automáticas siguen publicadas; el interruptor las devuelve.
 const sep=useMemo(()=>separarRuido(todas,f=>[f.titulo,f.categoria],incluirRuido),[todas,incluirRuido]);
 const visibles=useMemo(()=>marcarGeneral(sep.visibles),[sep.visibles]);
 const conImporte=hayImporte(visibles);
 const cats=useMemo(()=>agruparCategorias(visibles),[visibles]);
 const resumen=useMemo(()=>resumenFilas(visibles),[visibles]);
 const ordenVigente=orden??(conImporte?'importe:desc':'conversaciones:desc');
 const [col,dir]=ordenVigente.split(':') as [ColumnaOrden,'asc'|'desc'];
 const filtradas=useMemo(()=>ordenarFilas(filtrarFilas(visibles,{texto,clave,soloCriticos:soloCriticos==='criticos'}),{col,dir}),[visibles,texto,clave,soloCriticos,col,dir]);
 const pagina=filtradas.slice(0,mostrar);
 const categoriaSel=clave?cats.find(c=>c.clave===clave)??null:null;
 // Misma fuente de «citas registradas» para el detalle: se rotula allí junto a las verificadas al abrir.
 useEffect(()=>{try{const m:Record<string,number>={};for(const f of todas)if(f.citas!==null)m[f.id]=f.citas;sessionStorage.setItem('vexa:citas-registradas',JSON.stringify(m));}catch{/* sin almacenamiento */}},[todas]);
 const critDisponible=catalogo?catalogo.parts.signals==='ok':visibles.some(f=>f.critico!==null);
 const opciones=conImporte?[{v:'importe:desc',label:'Importe: de mayor a menor'},...ORDENES]:ORDENES;
 const cambiar=(fn:()=>void)=>{fn();setMostrar(PAGINA);};
 const elegirCategoria=(c:string|null)=>{cambiar(()=>setClave(c));if(c)requestAnimationFrame(()=>tablaRef.current?.scrollIntoView?.({block:'start',behavior:'smooth'}));};
 const ordenarPor=(c:ColumnaOrden)=>setOrden(col===c?`${c}:${dir==='asc'?'desc':'asc'}`:`${c}:${COLUMNA_DIR[c]}`);
 // Gráfica clásica por importe: solo cuando hay importes exactos (se vuelve a mostrar sola en cuanto existan vínculos).
 const items=useMemo(()=>{const ids=new Set(visibles.map(f=>f.id));return bundle.items.filter(i=>ids.has(i.id));},[bundle.items,visibles]);
 const insights=useMemo(()=>conImporte?insightsProblemas({items,moneda:bundle.meta.scope?.currency??null}):[],[conImporte,items,bundle.meta.scope?.currency]);
 const bars:BarListItem[]=useMemo(()=>{if(!conImporte)return [];
  const prim=(i:typeof items[number])=>(i.metrics.find(x=>x.kind==='exposure')??i.metrics[0]) as M|undefined;
  const max=items.map(prim).filter((m):m is M=>!!m&&exact(m)).map(m=>{const n=BigInt(m.amount_minor!);return n<0n?-n:n;}).reduce((a,n)=>n>a?n:a,0n);
  return items.map(item=>{const m=prim(item),ok=!!m&&exact(m),n=ok?BigInt(m!.amount_minor!):0n;
   return {key:item.id,label:item.title,value:ok&&max>0n?(ratioBps(n<0n?-n:n,max)??0)/100:ok?0:null,display:m?(ok?money(m):'Sin importe'):'Sin importe',kind:m?epistemicKind(m):'unclassified',href:'/problems/'+item.id+'?'+query,note:m&&!ok&&m.known_subtotal!==null?'Subtotal conocido: '+formatMinorUnits(m.known_subtotal,m.currency,m.exponent)+'; no es el total.':undefined} as BarListItem;});},[conImporte,items,query]);
 const by=(st:string)=>items.filter(i=>i.status===st).length;
 const th=(c:ColumnaOrden,label:string,num=false,title?:string)=>{const activa=col===c;return <th scope="col" className={num?s.num+' num':undefined} aria-sort={activa?(dir==='asc'?'ascending':'descending'):'none'} title={title}><button type="button" className={'btn btn-ghost btn-sm '+s.sortBtn} onClick={()=>ordenarPor(c)}>{label}<span aria-hidden="true">{activa?(dir==='asc'?'▲':'▼'):''}</span></button></th>;};
 return <div className="stack">
  <NoiseToggle incluir={incluirRuido} onChange={v=>cambiar(()=>setIncluirRuido(v))} ocultos={sep.ocultosN} unidad="grupos de problemas"/>
  {!conImporte&&<aside className="notice-bar" data-tone="info" role="note"><Icon name="info" size={14}/><div className={s.explain}>
   <p><strong>Importe por problema: aún no disponible.</strong> Aparece cuando se conecten los pedidos con los clientes; mientras tanto se ordena por conversaciones.</p>
   <details><summary>Qué falta</summary><p>Faltan los vínculos entre cada problema y los pedidos del libro económico: sin ellos no se puede saber cuánto dinero toca cada problema, y por eso no se muestra ninguna cifra (desconocido no es cero).{bundle.meta.can_manage?<> <Link href="/economics" className="row-link-inline">Revisar fuentes y vínculos</Link></>:null}</p></details>
  </div></aside>}
  <div className={s.kpis} role="group" aria-label="Resumen de problemas">
   <div className={s.kpi}><strong>{nf.format(resumen.grupos)}</strong><span>Grupos de problemas</span><small>Conversaciones parecidas agrupadas por la IA; una categoría puede tener varios.</small></div>
   <div className={s.kpi}><strong>{nf.format(resumen.categorias)}</strong><span>Categorías</span><small>Entre los grupos visibles, sin notificaciones automáticas ocultas. Cada grupo cuenta conversaciones únicas, no incidencias: por eso no coincide con el Resumen.</small></div>
   <div className={s.kpi}>{resumen.criticos===null||!critDisponible?<strong className={s.kpiNA}>No disponible ahora</strong>:<strong>{nf.format(catalogo?.critical?catalogo.critical.groups:resumen.criticos)}</strong>}<span>Grupos con revisión crítica</span><small>{catalogo?.critical&&critDisponible&&<>{desgloseCriticos({total:catalogo.critical.groups,visibles:resumen.criticos??0,senales:catalogo.critical.signals}).texto} · </>}<a className="row-link-inline" href="#senales-criticas">Ver cuáles son</a></small></div>
   <div className={s.kpi}><strong>{sep.ocultosN>0&&!incluirRuido?nf.format(sep.ocultosN):'0'}</strong><span>Notificaciones automáticas ocultas</span><small>Alertas de minoristas y del sistema</small></div>
  </div>
  {conImporte&&<div className="split" data-even>
   <section className="card" aria-label="Comparación de exposición por problema">
    <div className="card-title"><div><h2>Ingresos expuestos por problema agrupado</h2><p>Longitud proporcional · {bundle.meta.scope?.currency??''} · no se suma entre problemas</p></div></div>
    <BarList items={bars}/>
   </section>
   <div className="stack">
    <section className="card" aria-label="Lo más importante"><div className="card-title"><div><h2>Lo más importante</h2><p>Hasta tres lecturas con su fuente y su cobertura</p></div></div><InsightList insights={insights}/></section>
    <section className="card" aria-label="Problemas por estado">
     <div className="card-title"><div><h2>Estado de la cobertura</h2><p>Problemas del corte</p></div></div>
     <DonutChart title="Problemas por estado de cobertura" centerValue={items.length} centerLabel="problemas" segments={[{key:'ready',label:'Cobertura completa',value:by('ready'),display:String(by('ready')),tone:1},{key:'partial',label:'Cobertura parcial',value:by('partial'),display:String(by('partial')),tone:5},{key:'stale',label:'Corte anterior',value:by('stale'),display:String(by('stale')),tone:'neutral'}]}/>
    </section>
   </div>
  </div>}
  {visibles.length>0&&<Categorias cats={cats} sel={clave} onSelect={elegirCategoria}/>}
  {(catalogo||visibles.some(f=>f.critico!==null)||!!bundle.meta.critical_notice)&&<Criticas filas={visibles} query={query} disponible={critDisponible} total={catalogo?.critical??null}/>}
  <div ref={tablaRef} className="stack" id="lista-problemas">
   <div className={s.tools} role="search">
    <label className="grow">Buscar por categoría o grupo<input type="search" value={texto} onChange={e=>cambiar(()=>setTexto(e.target.value))} placeholder="Ej.: batería, envío, refacciones"/></label>
    <label>Ordenar por<select value={ordenVigente} onChange={e=>setOrden(e.target.value)}>{opciones.map(o=><option key={o.v} value={o.v}>{o.label}</option>)}</select></label>
    {critDisponible&&<SegmentedControl label="Qué grupos mostrar" value={soloCriticos} onChange={v=>cambiar(()=>setSoloCriticos(v))} options={[{value:'todos',label:'Todos'},{value:'criticos',label:'Solo críticos'}]}/>}
    <SegmentedControl label="Vista de problemas" value={modo} onChange={setModo} options={[{value:'tabla',label:'Tabla'},{value:'tarjetas',label:'Tarjetas'}]}/>
   </div>
   {categoriaSel&&<div className={s.filterChip} role="status"><strong>{categoriaSel.nombre}</strong><span>{nf.format(categoriaSel.grupos)} {categoriaSel.grupos===1?'grupo':'grupos'}{categoriaSel.conversaciones!==null&&<> · {nf.format(categoriaSel.conversaciones)} conversaciones</>}</span><button type="button" className="btn btn-ghost btn-sm" onClick={()=>elegirCategoria(null)}>Quitar filtro</button></div>}
   <div className="toolbar"><span className="chip" aria-live="polite">{nf.format(filtradas.length)} {filtradas.length===1?'grupo':'grupos'}{filtradas.length<visibles.length?' de '+nf.format(visibles.length):''}</span></div>
   {!visibles.length?<EmptyState compact art="search" title="Aún sin datos" body={sep.ocultosN?`Los ${nf.format(sep.ocultosN)} grupos de problemas de esta página son notificaciones automáticas, ocultas por defecto. Actívalas con el interruptor para verlas.`:'No hay problemas agrupados en esta página.'}/>
   :!filtradas.length?<EmptyState compact art="search" title="Ningún grupo coincide" body="Cambia la búsqueda o quita el filtro de categoría para ver más grupos."/>
   :modo==='tarjetas'?<div className={s.cardsGrid}>{pagina.map(f=>{const st=f.registro?(STATUS[f.registro.status]??{label:f.registro.status,tone:'info' as const}):null;
    return <article key={f.id} className={s.gcard}>
     <div className={s.gcardHead}><span className="chip">{fraseGrupo(f)}</span>{f.critico&&<StatusChip tone="bad">Revisión crítica</StatusChip>}{st&&<StatusChip tone={st.tone}>{st.label}</StatusChip>}</div>
     <h3><Link href={hrefDe(f,query)} className="card-link">{f.categoria}</Link></h3>
     <div><div className={s.big}>{f.conversaciones===null?'No disponible':nf.format(f.conversaciones)}</div><div className={s.bigLabel}>conversaciones <KindBadge kind="observed"/></div></div>
     {f.importe&&<Figure m={f.importe as M} big/>}
     <ul className={s.facts}><li>Severidad: <Severidad f={f}/></li><li>Citas: <Citas f={f}/></li><li>Recomendación: <Recomendacion f={f}/></li></ul>
     <div className={s.foot}><button type="button" className="btn btn-ghost btn-sm" onClick={()=>setQuick(f)} aria-label={'Vista rápida: '+f.categoria+', '+fraseGrupo(f)}>Vista rápida</button></div>
    </article>;})}</div>
   :<div className={s.tableWrap}><table className={s.table} aria-label="Tabla de problemas"><colgroup>{(conImporte?[14,24,10,8,10,7,10,17]:[19,28,12,10,12,8,11]).map((w,i)=><col key={i} style={{width:w+'%'}}/>)}</colgroup>
    <thead><tr>{th('categoria','Categoría')}<th scope="col">Grupo</th>{th('conversaciones','Conversaciones',true,'Conversaciones únicas del grupo (Observado)')}{th('severidad','Severidad')}{th('critico','Crítico',false,DEFINICION.grupo)}{th('citas','Citas',true,'Citas registradas; se verifican al abrir el problema')}{th('recomendaciones','Recomendación')}{conImporte&&th('importe','Ingresos expuestos',true)}</tr></thead>
    <tbody>{pagina.map(f=><tr key={f.id}>
     <th scope="row" className={s.cat} data-label="Categoría">{f.categoria}</th>
     <td data-label="Grupo" className={s.full}><div className={s.group}><Link href={hrefDe(f,query)} className="row-link-inline">{fraseGrupo(f)}</Link><button type="button" className="btn btn-ghost btn-sm" onClick={()=>setQuick(f)} aria-label={'Vista rápida: '+f.categoria+', '+fraseGrupo(f)}>Vista rápida</button></div></td>
     <td data-label="Conversaciones" className={s.num+' num'}><Conversaciones f={f}/></td>
     <td data-label="Severidad"><Severidad f={f}/></td>
     <td data-label="Crítico"><Critico f={f}/></td>
     <td data-label="Citas" className={s.num+' num'}><Citas f={f}/></td>
     <td data-label="Recomendación"><Recomendacion f={f}/></td>
     {conImporte&&<td data-label="Ingresos expuestos" className={s.num+' num'}>{f.importe?<>{money(f.importe as M)}<div><KindBadge metric={f.importe}/></div></>:NA}</td>}
    </tr>)}</tbody></table></div>}
   {filtradas.length>pagina.length&&<div className="btn-group"><button type="button" className="btn" onClick={()=>setMostrar(n=>n+PAGINA)}>Mostrar {nf.format(Math.min(PAGINA,filtradas.length-pagina.length))} más (quedan {nf.format(filtradas.length-pagina.length)})</button></div>}
  </div>
  <QuickView fila={quick} query={query} onClose={()=>setQuick(null)}/>
 </div>;
}
