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
import {InsightList} from '../ui/insight-list';
import {insightsProblemas} from '../../lib/legibilidad/insights.mjs';
import {separarRuido} from '../../lib/legibilidad/ruido.mjs';
import {filasDesdeCatalogo,filasDesdeItems,numerarGrupos,agruparCategorias,resumenFilas,ordenarFilas,filtrarFilas,hayImporte,fraseGrupo,marcarGeneral,etiquetaSeveridad,type FilaProblema,type ColumnaOrden} from '../../lib/legibilidad/problemas-catalogo.mjs';
import {DEFINICION,etiquetaMotivo,desgloseCriticos} from '../../../../../packages/workspace-service/critico.mjs';
import {nf} from '../ui/format';
import {EmptyState} from '../ui/empty-state';
import {Chip} from '../ui/chip';
import {Notice} from '../ui/notice';
import {guardarVista,leerVista} from '../../lib/workspace/cache.mjs';
import s from './problems-view.module.css';
type M=Metric&{coverage?:{known_n:number;eligible_n:number};missing_reasons?:string[]};
const STATUS:Record<string,{label:string;tone:'ok'|'warn'|'info'}>={ready:{label:'Cobertura completa',tone:'ok'},partial:{label:'Cobertura parcial',tone:'warn'},stale:{label:'Corte anterior',tone:'warn'}};
const exact=(m:M)=>m.amount_minor!==null&&/^-?\d+$/.test(m.amount_minor);
const money=(m:M)=>formatMinorUnits(m.amount_minor,m.currency,m.exponent);
const PAGINA=50,CATEGORIAS_VISIBLES=8,CRITICAS_VISIBLES=6;
function Coverage({m}:{m:M}){const c=m.coverage;if(!c||c.eligible_n<=0)return null;return <span className="pcard-cov"><ProgressRing size={30} stroke={4} value={c.known_n/c.eligible_n} title={`Cobertura: ${nf.format(c.known_n)} de ${nf.format(c.eligible_n)}`}/><span>{nf.format(c.known_n)} de {nf.format(c.eligible_n)} registros</span></span>;}
function Figure({m,big=false}:{m:M;big?:boolean}){
 return <div className="pfig" data-big={big||undefined}><div className="pfig-label"><span>{m.label}</span><KindBadge metric={m}/></div>
  <strong className="pfig-value">{exact(m)?money(m):'No disponible'}</strong>
  {!exact(m)&&m.missing_reasons?.includes('EXPOSURE_NOT_LINKED')&&<small>Sin vínculos problema–pedido: la exposición no se calcula.</small>}
  {!exact(m)&&m.known_subtotal!==null&&<small>Subtotal conocido: {formatMinorUnits(m.known_subtotal,m.currency,m.exponent)}; no es el total.</small>}</div>;
}
const NA=<span className={s.na}>No disponible</span>;
const sevTone=(v:string|null)=>v==='high'||v==='critical'?'bad' as const:v==='medium'?'warn' as const:'neutral' as const;
const textoSenales=(f:FilaProblema)=>f.senalesCriticas===null||f.conversaciones===null?null:`${nf.format(f.senalesCriticas)} ${f.senalesCriticas===1?'señal crítica':'señales críticas'} en ${nf.format(f.conversaciones)} conv.`;
const motivoDe=(f:FilaProblema)=>etiquetaMotivo(f.motivoCritico)??undefined;
const Citas=({f}:{f:FilaProblema})=>f.citas===null?NA:<span title="Citas registradas; se verifican al abrir el problema">{nf.format(f.citas)}</span>;
const Recomendacion=({f}:{f:FilaProblema})=>f.recomendaciones===null?NA:f.recomendaciones>0?<span>Sí ({f.recomendaciones})</span>:<span>No</span>;
const hrefDe=(f:FilaProblema,query:string)=>'/problems/'+f.id+'?'+query;
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


const VIOLETA='var(--chart-7)';
/** KPI compacto: etiqueta, cifra 26 px, nota y una mini-visual propia (nunca una cifra sola). */
function Kpi({label,value,note,children}:{label:string;value:React.ReactNode;note?:React.ReactNode;children?:React.ReactNode}){
 return <div className="ui-kpi" data-c="7" style={{['--cat' as string]:VIOLETA}}><span className="ui-kpi-label">{label}</span><strong className="ui-kpi-value">{value}</strong>{note&&<small className="ui-kpi-note">{note}</small>}{children&&<div className={s.mini}>{children}</div>}</div>;
}
/** Barra de proporción 0..1 en un matiz (violeta) con el resto en pista suave. `alerta` pinta el tramo en carmesí (requiere acción). */
function Prop({parte,total,alerta=false,label}:{parte:number;total:number;alerta?:boolean;label:string}){
 const p=total>0?Math.max(0,Math.min(1,parte/total)):0;
 return <span className={s.prop} role="img" aria-label={label}><span className={s.propFill} data-alerta={alerta||undefined} style={{width:Math.max(p>0?3:0,p*100)+'%'}}/></span>;
}
/** Columnas finas (máx. 8) de un matiz: forma de la distribución, no una serie en el tiempo. */
function Columnas({valores,label}:{valores:number[];label:string}){
 const max=Math.max(1,...valores);
 return <span className={s.cols} role="img" aria-label={label}>{valores.map((v,i)=><span key={i} style={{height:Math.max(8,v*100/max)+'%'}} title={nf.format(v)}/>)}</span>;
}

function Categorias({cats,sel,onSelect}:{cats:ReturnType<typeof agruparCategorias>;sel:string|null;onSelect:(clave:string|null)=>void}){
 const [todas,setTodas]=useState(false);
 const max=Math.max(1,...cats.map(c=>c.conversaciones??0)),lista=todas?cats:cats.slice(0,CATEGORIAS_VISIBLES);
 return <section className={'ui-card '+s.fill} aria-label="Conversaciones por categoría">
  <header className="ui-card-head"><div className="ui-card-copy"><h2 className="ui-card-title">Conversaciones por categoría</h2><p className="ui-card-desc">Elige una barra para filtrar la tabla</p></div><KindBadge kind="observed"/></header>
  <ul className={s.cats}>{lista.map(c=><li key={c.clave}><button type="button" className={s.catBtn} aria-pressed={sel===c.clave} onClick={()=>onSelect(sel===c.clave?null:c.clave)}>
   <span className={s.catName}>{c.nombre}</span>
   <span className={s.catTrack} aria-hidden="true"><span className={s.catFill} style={{width:c.conversaciones===null?'0%':Math.max(1,c.conversaciones*100/max)+'%'}}/></span>
   <span className={s.catNum}>{c.conversaciones===null?'—':nf.format(c.conversaciones)}</span>
   <span className={s.catGrp}>{nf.format(c.grupos)} {c.grupos===1?'grupo':'grupos'}</span>
  </button></li>)}</ul>
  {cats.length>CATEGORIAS_VISIBLES&&<div className={s.more}><button type="button" className="btn btn-ghost btn-sm" onClick={()=>setTodas(v=>!v)} aria-expanded={todas}>{todas?'Ver solo las '+CATEGORIAS_VISIBLES+' principales':'Ver las '+nf.format(cats.length)+' categorías'}</button></div>}
 </section>;
}

function Criticas({filas,query,disponible,total}:{filas:FilaProblema[];query:string;disponible:boolean;total:{groups:number;signals:number}|null}){
 const [todas,setTodas]=useState(false);
 const crit=useMemo(()=>ordenarFilas(filas.filter(f=>f.critico===true),{col:'conversaciones',dir:'desc'}),[filas]);
 const lista=todas?crit:crit.slice(0,CRITICAS_VISIBLES);
 const desg=desgloseCriticos({total:total?.groups??null,visibles:crit.length,senales:total?.signals??null});
 return <section className={'ui-card '+s.fill} id="senales-criticas" aria-label="Grupos con revisión crítica">
  <header className="ui-card-head"><div className="ui-card-copy"><h2 className="ui-card-title">Revisión crítica{disponible?' ('+nf.format(desg.grupos)+')':''}</h2><p className="ui-card-desc" title={DEFINICION.grupo+' '+DEFINICION.senal}>Se revisa sin importar el dinero</p></div></header>
  {!disponible?<p className="state" role="status">No disponible ahora: las señales críticas no se calcularon en esta carga. No significa que no existan; reintenta con «Actualizar».</p>
   :!crit.length?<p className="state">Ningún grupo visible cumple el criterio crítico en este corte.</p>
   :<><ul className={s.critList}>{lista.map(f=><li key={f.id} className={s.critItem}><Link href={hrefDe(f,query)} className="row-link-inline">{f.categoria} · {fraseGrupo(f)}</Link><span className={s.critNum}>{f.conversaciones===null?'—':nf.format(f.conversaciones)}</span>{textoSenales(f)&&<span className={s.critMeta}>{textoSenales(f)}</span>}</li>)}</ul>
    {(crit.length>CRITICAS_VISIBLES||desg.ocultos>0)&&<div className={s.more}>{crit.length>CRITICAS_VISIBLES&&<button type="button" className="btn btn-ghost btn-sm" onClick={()=>setTodas(v=>!v)} aria-expanded={todas}>{todas?'Ver menos':'Ver los '+nf.format(crit.length)}</button>}{desg.ocultos>0&&<small className={s.muted}> {nf.format(desg.ocultos)} más en notificaciones automáticas ocultas</small>}</div>}</>}
 </section>;
}

export function ProblemsView({bundle,query}:{bundle:Bundle;query:string}){
 // Filtros y orden se restauran al volver «atrás» desde un detalle (R2-1-003): se guardan por alcance en sessionStorage.
 const claveFiltros='filtros:'+query,[previos]=useState(()=>(leerVista(claveFiltros) as {texto?:string;soloCriticos?:'todos'|'criticos';orden?:string|null}|null)??{});
 const [quick,setQuick]=useState<FilaProblema|null>(null),[incluirRuido,setIncluirRuido]=useState(false);
 const [texto,setTexto]=useState(previos.texto??''),[clave,setClave]=useState<string|null>(null),[soloCriticos,setSoloCriticos]=useState<'todos'|'criticos'>(previos.soloCriticos??'todos'),[orden,setOrden]=useState<string|null>(previos.orden??null),[mostrar,setMostrar]=useState(PAGINA);
 const tablaRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{guardarVista(claveFiltros,{texto,soloCriticos,orden});},[claveFiltros,texto,soloCriticos,orden]);
 const catalogo=bundle.meta.catalog;
 const todas=useMemo(()=>numerarGrupos(catalogo?filasDesdeCatalogo(catalogo):filasDesdeItems(bundle.items)),[catalogo,bundle.items]);
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
 useEffect(()=>{try{const m:Record<string,number>={};for(const f of todas)if(f.citas!==null)m[f.id]=f.citas;sessionStorage.setItem('vexa:citas-registradas',JSON.stringify(m));}catch{/* sin almacenamiento */}},[todas]);
 const critDisponible=catalogo?catalogo.parts.signals==='ok':visibles.some(f=>f.critico!==null);
 const cambiar=(fn:()=>void)=>{fn();setMostrar(PAGINA);};
 const elegirCategoria=(c:string|null)=>{cambiar(()=>setClave(c));if(c)requestAnimationFrame(()=>tablaRef.current?.scrollIntoView?.({block:'start',behavior:'smooth'}));};
 const ordenarPor=(c:ColumnaOrden)=>setOrden(col===c?`${c}:${dir==='asc'?'desc':'asc'}`:`${c}:${COLUMNA_DIR[c]}`);
 const items=useMemo(()=>{const ids=new Set(visibles.map(f=>f.id));return bundle.items.filter(i=>ids.has(i.id));},[bundle.items,visibles]);
 const insights=useMemo(()=>conImporte?insightsProblemas({items,moneda:bundle.meta.scope?.currency??null}):[],[conImporte,items,bundle.meta.scope?.currency]);
 const bars:BarListItem[]=useMemo(()=>{if(!conImporte)return [];
  const prim=(i:typeof items[number])=>(i.metrics.find(x=>x.kind==='exposure')??i.metrics[0]) as M|undefined;
  const max=items.map(prim).filter((m):m is M=>!!m&&exact(m)).map(m=>{const n=BigInt(m.amount_minor!);return n<0n?-n:n;}).reduce((a,n)=>n>a?n:a,0n);
  return items.map(item=>{const m=prim(item),ok=!!m&&exact(m),n=ok?BigInt(m!.amount_minor!):0n;
   return {key:item.id,label:item.title,value:ok&&max>0n?(ratioBps(n<0n?-n:n,max)??0)/100:ok?0:null,display:m?(ok?money(m):'Sin importe'):'Sin importe',kind:m?epistemicKind(m):'unclassified',href:'/problems/'+item.id+'?'+query,note:m&&!ok&&m.known_subtotal!==null?'Subtotal conocido: '+formatMinorUnits(m.known_subtotal,m.currency,m.exponent)+'; no es el total.':undefined} as BarListItem;});},[conImporte,items,query]);
 const by=(st:string)=>items.filter(i=>i.status===st).length;
 // Cifras de las tarjetas (solo lo observado: un desconocido no suma cero).
 const convTotal=useMemo(()=>visibles.reduce((a,f)=>a+(f.conversaciones??0),0),[visibles]);
 const convDesconocidas=visibles.some(f=>f.conversaciones===null),hayConv=visibles.some(f=>f.conversaciones!==null);
 const top4=cats.slice(0,4).reduce((a,c)=>a+(c.conversaciones??0),0);
 const nCrit=catalogo?.critical?catalogo.critical.groups:resumen.criticos;
 const maxConv=Math.max(1,...pagina.map(f=>f.conversaciones??0));
 const th=(c:ColumnaOrden,label:string,num=false,title?:string)=>{const activa=col===c;return <th scope="col" className={num?s.num+' num':undefined} aria-sort={activa?(dir==='asc'?'ascending':'descending'):'none'} title={title}><button type="button" className={s.sortBtn+' ui-reset'} onClick={()=>ordenarPor(c)}>{label}<span aria-hidden="true">{activa?(dir==='asc'?'▲':'▼'):''}</span></button></th>;};
 const ocultosTxt=sep.ocultosN>0&&!incluirRuido?nf.format(sep.ocultosN)+' ocultas':null;
 return <div className="stack">
  {!conImporte&&<Notice tone="info" title="Importe por problema: aún no disponible">Se ordena por conversaciones hasta que se conecten los pedidos con los clientes (desconocido no es cero).{bundle.meta.can_manage?<> <Link href="/economics" className="row-link-inline">Revisar fuentes y vínculos</Link></>:null}</Notice>}
  <div className="ui-kpis" role="group" aria-label="Resumen de problemas">
   <Kpi label="Conversaciones en grupos" value={hayConv?nf.format(convTotal)+(convDesconocidas?'+':''):'—'} note={hayConv?(cats.length?`Las 4 mayores categorías: ${Math.round(top4*100/Math.max(1,convTotal))} %`:undefined):'Sin conteo de conversaciones en este corte'}>{hayConv&&<Prop parte={top4} total={convTotal} label="Peso de las 4 categorías mayores"/>}</Kpi>
   <Kpi label="Grupos de problemas" value={nf.format(resumen.grupos)} note="Conversaciones parecidas agrupadas por la IA">{nCrit!==null&&critDisponible&&<Prop parte={nCrit} total={resumen.grupos} alerta label="Grupos con revisión crítica sobre el total"/>}</Kpi>
   <Kpi label="Categorías" value={nf.format(resumen.categorias)} note={ocultosTxt?`Notificaciones automáticas: ${ocultosTxt}`:'Sin notificaciones automáticas ocultas'}><Columnas valores={cats.slice(0,12).map(c=>c.grupos)} label="Grupos de las 12 categorías mayores"/></Kpi>
   <Kpi label="Revisión crítica" value={nCrit===null||!critDisponible?<span className={s.kpiNA}>No disponible</span>:nf.format(nCrit)} note={catalogo?.critical&&critDisponible?`${nf.format(catalogo.critical.signals)} señales críticas`:'Se calcula al abrir'}>{critDisponible&&<Columnas valores={cats.slice(0,12).map(c=>c.criticos??0)} label="Grupos críticos por categoría"/>}</Kpi>
  </div>
  {conImporte&&<div className={s.row84}>
   <section className="ui-card" aria-label="Comparación de exposición por problema"><header className="ui-card-head"><div className="ui-card-copy"><h2 className="ui-card-title">Ingresos expuestos por problema</h2><p className="ui-card-desc">{bundle.meta.scope?.currency??''} · no se suma entre problemas</p></div></header><BarList items={bars}/></section>
   <div className="stack">
    <section className="ui-card" aria-label="Lo más importante"><header className="ui-card-head"><div className="ui-card-copy"><h2 className="ui-card-title">Lo más importante</h2></div></header><InsightList insights={insights}/></section>
    <section className="ui-card" aria-label="Problemas por estado"><header className="ui-card-head"><div className="ui-card-copy"><h2 className="ui-card-title">Estado de la cobertura</h2></div></header>
     <DonutChart title="Problemas por estado de cobertura" centerValue={items.length} centerLabel="problemas" segments={[{key:'ready',label:'Cobertura completa',value:by('ready'),display:String(by('ready')),tone:1},{key:'partial',label:'Cobertura parcial',value:by('partial'),display:String(by('partial')),tone:5},{key:'stale',label:'Corte anterior',value:by('stale'),display:String(by('stale')),tone:'neutral'}]}/>
    </section>
   </div>
  </div>}
  {visibles.length>0&&<div className={s.row84}>
   <Categorias cats={cats} sel={clave} onSelect={elegirCategoria}/>
   {(catalogo||visibles.some(f=>f.critico!==null)||!!bundle.meta.critical_notice)?<Criticas filas={visibles} query={query} disponible={critDisponible} total={catalogo?.critical??null}/>:<section className={'ui-card '+s.fill}><header className="ui-card-head"><div className="ui-card-copy"><h2 className="ui-card-title">Revisión crítica</h2></div></header><p className="state">No disponible ahora.</p></section>}
  </div>}
  <section ref={tablaRef as React.RefObject<HTMLElement>} className={'ui-card '+s.tableCard} id="lista-problemas" aria-label="Grupos de problemas">
   <header className={s.tableHead}>
    <div className="ui-card-copy"><h2 className="ui-card-title">Grupos de problemas</h2><p className="ui-card-desc">{nf.format(filtradas.length)} {filtradas.length===1?'grupo':'grupos'}{filtradas.length<visibles.length?' de '+nf.format(visibles.length):''}{categoriaSel?' · '+categoriaSel.nombre:''}</p></div>
    <div className={s.tools} role="group" aria-label="Buscar y filtrar grupos">
     <input type="search" className={s.search} aria-label="Buscar por categoría o grupo" value={texto} onChange={e=>cambiar(()=>setTexto(e.target.value))} placeholder="Buscar categoría o grupo"/>
     {critDisponible&&<SegmentedControl size="sm" label="Qué grupos mostrar" value={soloCriticos} onChange={v=>cambiar(()=>setSoloCriticos(v))} options={[{value:'todos',label:'Todos'},{value:'criticos',label:'Solo críticos'}]}/>}
     <label className={s.sw} title="Alertas de minoristas y del sistema, ocultas por defecto"><input type="checkbox" checked={incluirRuido} onChange={e=>cambiar(()=>setIncluirRuido(e.target.checked))}/><span>Notificaciones automáticas{ocultosTxt?' ('+nf.format(sep.ocultosN)+')':''}</span></label>
     {categoriaSel&&<Chip categoria={7} onRemove={()=>elegirCategoria(null)} removeLabel="Quitar filtro de categoría">{categoriaSel.nombre}</Chip>}
    </div>
   </header>
   {!visibles.length?<EmptyState compact art="search" title="Aún sin datos" body={sep.ocultosN?`Los ${nf.format(sep.ocultosN)} grupos de problemas de esta página son notificaciones automáticas, ocultas por defecto. Actívalas para verlas.`:'No hay problemas agrupados en esta página.'}/>
   :!filtradas.length?<EmptyState compact art="search" title="Ningún grupo coincide" body="Cambia la búsqueda o quita el filtro de categoría para ver más grupos."/>
   :<div className={s.tableWrap} tabIndex={0} role="region" aria-label="Tabla de problemas"><table className={s.table}>
    <thead><tr>{th('categoria','Problema')}{th('conversaciones','Conversaciones',true,'Conversaciones únicas del grupo (Observado)')}{th('severidad','Severidad')}{th('critico','Crítico',false,DEFINICION.grupo)}{th('citas','Citas',true,'Citas registradas; se verifican al abrir el problema')}{th('recomendaciones','Recomendación')}{conImporte&&th('importe','Ingresos expuestos',true)}<th scope="col"><span className="sr-only">Acciones</span></th></tr></thead>
    <tbody>{pagina.map(f=><tr key={f.id}>
     <th scope="row" className={s.cat} data-label="Problema"><Link href={hrefDe(f,query)} className="row-link-inline"><b>{f.categoria}</b> · {fraseGrupo(f)}</Link></th>
     <td data-label="Conversaciones" className={s.num+' num'}>{f.conversaciones===null?NA:<span className={s.convCell}><span className={s.convBar} aria-hidden="true"><span style={{width:Math.max(2,f.conversaciones*100/maxConv)+'%'}}/></span><strong>{nf.format(f.conversaciones)}</strong></span>}</td>
     <td data-label="Severidad">{f.severidad===null?NA:<Chip tone={sevTone(f.severidad)}>{etiquetaSeveridad(f.severidad)}</Chip>}</td>
     <td data-label="Crítico">{f.critico===null?NA:f.critico?<span title={motivoDe(f)}><Chip tone="bad">Crítico</Chip></span>:<span className={s.muted}>—</span>}</td>
     <td data-label="Citas" className={s.num+' num'}><Citas f={f}/></td>
     <td data-label="Recomendación"><Recomendacion f={f}/></td>
     {conImporte&&<td data-label="Ingresos expuestos" className={s.num+' num'}>{f.importe?<>{money(f.importe as M)} <KindBadge metric={f.importe}/></>:NA}</td>}
     <td data-label="" className={s.act}><button type="button" className="btn btn-ghost btn-sm" onClick={()=>setQuick(f)} aria-label={'Vista rápida: '+f.categoria+', '+fraseGrupo(f)}>Vista rápida</button></td>
    </tr>)}</tbody></table></div>}
   {filtradas.length>pagina.length&&<div className={s.pager}><span className={s.muted}>Mostrando {nf.format(pagina.length)} de {nf.format(filtradas.length)}</span><button type="button" className="btn btn-sm" onClick={()=>setMostrar(n=>n+PAGINA)}>Mostrar {nf.format(Math.min(PAGINA,filtradas.length-pagina.length))} más</button></div>}
  </section>
  <QuickView fila={quick} query={query} onClose={()=>setQuick(null)}/>
 </div>;
}
