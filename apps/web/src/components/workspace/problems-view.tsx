'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {Bundle,Metric} from '../../lib/workspace/contracts';
import {formatMinorUnits} from '../../lib/formato/dinero-pantalla.mjs';
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
import {filasDesdeCatalogo,filasDesdeItems,numerarGrupos,agruparCategorias,resumenFilas,ordenarFilas,filtrarFilas,hayImporte,marcarGeneral,type FilaProblema,type ColumnaOrden} from '../../lib/legibilidad/problemas-catalogo.mjs';
import {desgloseCriticos} from '../../../../../packages/workspace-service/critico.mjs';
import {nf} from '../ui/format';
import {useT} from '../i18n/proveedor';
import {chipSevT,sevT,fraseGrupoT,motivoT,senalesT} from './problemas-i18n';
import type {Traductor} from '../../lib/i18n';
import {EmptyState} from '../ui/empty-state';
import {Chip} from '../ui/chip';
import {Notice} from '../ui/notice';
import {guardarVista,leerVista} from '../../lib/workspace/cache.mjs';
import s from './problems-view.module.css';
type M=Metric&{coverage?:{known_n:number;eligible_n:number};missing_reasons?:string[]};
const STATUS:Record<string,{label:'prob.st.ready'|'prob.st.partial'|'prob.st.stale';tone:'ok'|'warn'|'info'}>={ready:{label:'prob.st.ready',tone:'ok'},partial:{label:'prob.st.partial',tone:'warn'},stale:{label:'prob.st.stale',tone:'warn'}};
const exact=(m:M)=>m.amount_minor!==null&&/^-?\d+$/.test(m.amount_minor);
const money=(m:M)=>formatMinorUnits(m.amount_minor,m.currency,m.exponent);
const PAGINA=50,CATEGORIAS_VISIBLES=8,CRITICAS_VISIBLES=6;
function Coverage({m}:{m:M}){const t=useT();const c=m.coverage;if(!c||c.eligible_n<=0)return null;return <span className="pcard-cov"><ProgressRing size={30} stroke={4} value={c.known_n/c.eligible_n} title={t('prob.cobTitulo',{a:nf.format(c.known_n),b:nf.format(c.eligible_n)})}/><span>{t('prob.cobRegistros',{a:nf.format(c.known_n),b:nf.format(c.eligible_n)})}</span></span>;}
function Figure({m,big=false}:{m:M;big?:boolean}){
 const t=useT();
 return <div className="pfig" data-big={big||undefined}><div className="pfig-label"><span>{m.label}</span><KindBadge metric={m}/></div>
  <strong className="pfig-value">{exact(m)?money(m):t('prob.noDisp')}</strong>
  {!exact(m)&&m.missing_reasons?.includes('EXPOSURE_NOT_LINKED')&&<small>{t('prob.sinVinculos')}</small>}
  {!exact(m)&&m.known_subtotal!==null&&<small>{t('prob.subtotal',{v:formatMinorUnits(m.known_subtotal,m.currency,m.exponent)})}</small>}</div>;
}
const NA=()=>{const t=useT();return <span className={s.na}>{t('prob.noDisp')}</span>;};
const sevTone=(v:string|null)=>v==='high'||v==='critical'?'bad' as const:v==='medium'?'warn' as const:'neutral' as const;
const textoSenales=(t:Traductor,f:FilaProblema)=>f.senalesCriticas===null||f.conversaciones===null?null:t('prob.senalesEn',{n:nf.format(f.senalesCriticas),senales:senalesT(t,f.senalesCriticas),conv:nf.format(f.conversaciones)});
const motivoDe=(t:Traductor,f:FilaProblema)=>motivoT(t,f.motivoCritico)??undefined;
const Citas=({f}:{f:FilaProblema})=>{const t=useT();return f.citas===null?<NA/>:<span title={t('prob.citasTitulo')}>{nf.format(f.citas)}</span>;};
const Recomendacion=({f}:{f:FilaProblema})=>{const t=useT();return f.recomendaciones===null?<NA/>:f.recomendaciones>0?<span>{t('prob.si')} ({f.recomendaciones})</span>:<span>{t('prob.no')}</span>;};
const hrefDe=(f:FilaProblema,query:string)=>'/problems/'+f.id+'?'+query;
const COLUMNA_DIR:Record<ColumnaOrden,'asc'|'desc'>={categoria:'asc',conversaciones:'desc',severidad:'desc',critico:'desc',citas:'desc',recomendaciones:'desc',importe:'desc'};

function QuickView({fila,query,onClose}:{fila:FilaProblema|null;query:string;onClose:()=>void}){
 const t=useT();
 const reg=fila?.registro,st=reg?(STATUS[reg.status]?{label:t(STATUS[reg.status].label),tone:STATUS[reg.status].tone}:{label:reg.status,tone:'info' as const}):null;
 return <Drawer open={!!fila} onClose={onClose} width={560} title={fila?.categoria??''} subtitle={fila&&<span>{fraseGrupoT(t,fila)}{st&&<> · <StatusChip tone={st.tone}>{st.label}</StatusChip></>}</span>} footer={fila&&<LinkButton href={hrefDe(fila,query)} variant="primary" size="sm" icon={<Arrow/>}>{t('prob.abrir')}</LinkButton>}>
  {fila&&<div className={s.quick}>
   <div className={s.tiles}>
    <div className={s.tile}><strong>{fila.conversaciones===null?t('prob.noDisp'):nf.format(fila.conversaciones)}</strong><span>{t('prob.conversaciones')} <KindBadge kind="observed"/></span></div>
    <div className={s.tile}><strong title={chipSevT(t,fila.severidad,fila.critico)?.ayuda??undefined}>{fila.severidad===null?t('prob.noDisp'):fila.critico===true&&chipSevT(t,fila.severidad,true)?.ayuda?t('prob.mixta'):sevT(t,fila.severidad)}</strong><span>{t('prob.sevRegistrada')}{fila.critico===true&&chipSevT(t,fila.severidad,true)?.ayuda?t('prob.hayCriticos'):''}</span></div>
    <div className={s.tile}><strong>{fila.critico===null?t('prob.noDisp'):fila.critico?t('prob.si'):t('prob.no')}</strong><span>{t('prob.revCritica')}{textoSenales(t,fila)?' · '+textoSenales(t,fila):''}</span></div>
    <div className={s.tile}><strong>{fila.recomendaciones===null?t('prob.noDisp'):fila.recomendaciones>0?t('prob.si')+' ('+fila.recomendaciones+')':t('prob.no')}</strong><span>{t('prob.recGuardada')}</span></div>
   </div>
   {reg&&<p className="card-lead">{reg.summary}</p>}
   {reg&&reg.metrics.length>0&&<div className="stat-grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))'}}>{reg.metrics.map((m,i)=><div key={i} className="card"><Figure m={m as M}/><Coverage m={m as M}/><small className="pfig-src"><SourceRef value={m.source_ref}/></small></div>)}</div>}
   {reg&&reg.evidence.length>0?<section><h3>{t('prob.evAutorizada',{n:reg.evidence.length})}</h3>{reg.evidence.map(e=><Citation key={e.id} quote={e.quote} role={e.role} messageRevisionId={e.id}/>)}</section>
    :<p className="state">{fila.citas!==null?t(fila.citas===1?'prob.citaReg1':'prob.citaRegN',{n:nf.format(fila.citas)}):t('prob.evSeVerifica')}</p>}
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
 const t=useT();
 const [todas,setTodas]=useState(false);
 const max=Math.max(1,...cats.map(c=>c.conversaciones??0)),lista=todas?cats:cats.slice(0,CATEGORIAS_VISIBLES);
 return <section className={'ui-card '+s.fill} aria-label={t('prob.convPorCat')}>
  <header className="ui-card-head"><div className="ui-card-copy"><h2 className="ui-card-title">{t('prob.convPorCat')}</h2><p className="ui-card-desc">{t('prob.eligeBarra')}</p></div><KindBadge kind="observed"/></header>
  <ul className={s.cats}>{lista.map(c=><li key={c.clave}><button type="button" className={s.catBtn} aria-pressed={sel===c.clave} onClick={()=>onSelect(sel===c.clave?null:c.clave)}>
   <span className={s.catName}>{c.nombre}</span>
   <span className={s.catTrack} aria-hidden="true"><span className={s.catFill} style={{width:c.conversaciones===null?'0%':Math.max(1,c.conversaciones*100/max)+'%'}}/></span>
   <span className={s.catNum}>{c.conversaciones===null?'—':nf.format(c.conversaciones)}</span>
   <span className={s.catGrp}>{nf.format(c.grupos)} {t(c.grupos===1?'prob.grupo1':'prob.grupoN')}</span>
  </button></li>)}</ul>
  {cats.length>CATEGORIAS_VISIBLES&&<div className={s.more}><button type="button" className="btn btn-ghost btn-sm" onClick={()=>setTodas(v=>!v)} aria-expanded={todas}>{todas?t('prob.verPrincipales',{n:CATEGORIAS_VISIBLES}):t('prob.verCategorias',{n:nf.format(cats.length)})}</button></div>}
 </section>;
}

function Criticas({filas,query,disponible,total}:{filas:FilaProblema[];query:string;disponible:boolean;total:{groups:number;signals:number}|null}){
 const t=useT();
 const [todas,setTodas]=useState(false);
 const crit=useMemo(()=>ordenarFilas(filas.filter(f=>f.critico===true),{col:'conversaciones',dir:'desc'}),[filas]);
 const lista=todas?crit:crit.slice(0,CRITICAS_VISIBLES);
 const desg=desgloseCriticos({total:total?.groups??null,visibles:crit.length,senales:total?.signals??null});
 return <section className={'ui-card '+s.fill} id="senales-criticas" aria-label={t('prob.gruposCriticos')}>
  <header className="ui-card-head"><div className="ui-card-copy"><h2 className="ui-card-title">{t('prob.revCritica')}{disponible?' ('+nf.format(desg.grupos)+')':''}</h2><p className="ui-card-desc" title={t('prob.defGrupo')+' '+t('prob.defSenal')}>{t('prob.sinImportarDinero')}</p></div></header>
  {!disponible?<p className="state" role="status">{t('prob.critNoCalc')}</p>
   :!crit.length?<p className="state">{t('prob.ningunCritico')}</p>
   :<><ul className={s.critList}>{lista.map(f=><li key={f.id} className={s.critItem}><Link href={hrefDe(f,query)} className="row-link-inline">{f.categoria} · {fraseGrupoT(t,f)}</Link><span className={s.critNum}>{f.conversaciones===null?'—':nf.format(f.conversaciones)}</span>{textoSenales(t,f)&&<span className={s.critMeta}>{textoSenales(t,f)}</span>}</li>)}</ul>
    {(crit.length>CRITICAS_VISIBLES||desg.ocultos>0)&&<div className={s.more}>{crit.length>CRITICAS_VISIBLES&&<button type="button" className="btn btn-ghost btn-sm" onClick={()=>setTodas(v=>!v)} aria-expanded={todas}>{todas?t('prob.verMenos'):t('prob.verLos',{n:nf.format(crit.length)})}</button>}{desg.ocultos>0&&<small className={s.muted}> {t('prob.masOcultas',{n:nf.format(desg.ocultos)})}</small>}</div>}</>}
 </section>;
}

export function ProblemsView({bundle,query}:{bundle:Bundle;query:string}){
 const t=useT();
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
 const insights=useMemo(()=>conImporte?insightsProblemas({items,moneda:bundle.meta.scope?.currency??null,t}):[],[conImporte,items,bundle.meta.scope?.currency,t]);
 const bars:BarListItem[]=useMemo(()=>{if(!conImporte)return [];
  const prim=(i:typeof items[number])=>(i.metrics.find(x=>x.kind==='exposure')??i.metrics[0]) as M|undefined;
  const max=items.map(prim).filter((m):m is M=>!!m&&exact(m)).map(m=>{const n=BigInt(m.amount_minor!);return n<0n?-n:n;}).reduce((a,n)=>n>a?n:a,0n);
  return items.map(item=>{const m=prim(item),ok=!!m&&exact(m),n=ok?BigInt(m!.amount_minor!):0n;
   return {key:item.id,label:item.title,value:ok&&max>0n?(ratioBps(n<0n?-n:n,max)??0)/100:ok?0:null,display:m?(ok?money(m):t('prob.sinImporte')):t('prob.sinImporte'),kind:m?epistemicKind(m):'unclassified',href:'/problems/'+item.id+'?'+query,note:m&&!ok&&m.known_subtotal!==null?t('prob.subtotal',{v:formatMinorUnits(m.known_subtotal,m.currency,m.exponent)}):undefined} as BarListItem;});},[conImporte,items,query,t]);
 const by=(st:string)=>items.filter(i=>i.status===st).length;
 // Cifras de las tarjetas (solo lo observado: un desconocido no suma cero).
 const convTotal=useMemo(()=>visibles.reduce((a,f)=>a+(f.conversaciones??0),0),[visibles]);
 const convDesconocidas=visibles.some(f=>f.conversaciones===null),hayConv=visibles.some(f=>f.conversaciones!==null);
 const top4=cats.slice(0,4).reduce((a,c)=>a+(c.conversaciones??0),0);
 const nCrit=catalogo?.critical?catalogo.critical.groups:resumen.criticos;
 const maxConv=Math.max(1,...pagina.map(f=>f.conversaciones??0));
 const th=(c:ColumnaOrden,label:string,num=false,title?:string)=>{const activa=col===c;return <th scope="col" className={num?s.num+' num':undefined} aria-sort={activa?(dir==='asc'?'ascending':'descending'):'none'} title={title}><button type="button" className={s.sortBtn+' ui-reset'} onClick={()=>ordenarPor(c)}>{label}<span aria-hidden="true">{activa?(dir==='asc'?'▲':'▼'):''}</span></button></th>;};
 const ocultosTxt=sep.ocultosN>0&&!incluirRuido?t('prob.nOcultas',{n:nf.format(sep.ocultosN)}):null;
 return <div className="stack" data-tour="problemas">
  {!conImporte&&<Notice tone="info" title={t('prob.importeNoDisp')}>{t('prob.ordenConv')}{bundle.meta.can_manage?<> <Link href="/economics" className="row-link-inline">{t('prob.revisarFuentes')}</Link></>:null}</Notice>}
  <div className="ui-kpis" role="group" aria-label={t('prob.resumen')}>
   <Kpi label={t('prob.kConv')} value={hayConv?nf.format(convTotal)+(convDesconocidas?'+':''):'—'} note={hayConv?(cats.length?t('prob.kTop4',{p:Math.round(top4*100/Math.max(1,convTotal))}):undefined):t('prob.kSinConteo')}>{hayConv&&<Prop parte={top4} total={convTotal} label={t('prob.kPeso4')}/>}</Kpi>
   <Kpi label={t('prob.kGrupos')} value={nf.format(resumen.grupos)} note={ocultosTxt?t('prob.kGruposNota',{n:nf.format(sep.ocultosN),total:nf.format(resumen.grupos+sep.ocultosN)}):t('prob.kGruposIA')}>{nCrit!==null&&critDisponible&&<Prop parte={nCrit} total={resumen.grupos} alerta label={t('prob.kCritSobreTotal')}/>}</Kpi>
   <Kpi label={t('prob.kCategorias')} value={nf.format(resumen.categorias)} note={ocultosTxt?t('prob.kNotifAuto',{x:ocultosTxt}):t('prob.kSinOcultas')}><Columnas valores={cats.slice(0,12).map(c=>c.grupos)} label={t('prob.kGrupos12')}/></Kpi>
   <Kpi label={t('prob.revCritica')} value={nCrit===null||!critDisponible?<span className={s.kpiNA}>{t('prob.noDisp')}</span>:nf.format(nCrit)} note={catalogo?.critical&&critDisponible?t('prob.nSenalesCrit',{n:nf.format(catalogo.critical.signals)}):t('prob.seCalculaAlAbrir')}>{critDisponible&&<Columnas valores={cats.slice(0,12).map(c=>c.criticos??0)} label={t('prob.kCritPorCat')}/>}</Kpi>
  </div>
  {conImporte&&<div className={s.row84}>
   <div className="stack">
   <section className="ui-card" aria-label={t('prob.compExposicion')}><header className="ui-card-head"><div className="ui-card-copy"><h2 className="ui-card-title">{t('prob.ingresosExpuestos')}</h2><p className="ui-card-desc">{bundle.meta.scope?.currency??''} · {t('prob.noSeSuma')}</p></div></header><BarList items={bars} c={1}/></section>
<section className="ui-card" aria-label={t('prob.porEstado')}><header className="ui-card-head"><div className="ui-card-copy"><h2 className="ui-card-title">{t('prob.estadoCobertura')}</h2></div></header>
     <DonutChart title={t('prob.porEstadoCob')} centerValue={items.length} centerLabel={t('prob.problemas')} segments={[{key:'ready',label:t('prob.st.ready'),value:by('ready'),display:String(by('ready')),tone:1},{key:'partial',label:t('prob.st.partial'),value:by('partial'),display:String(by('partial')),tone:5},{key:'stale',label:t('prob.st.stale'),value:by('stale'),display:String(by('stale')),tone:'neutral'}]}/>
    </section>
   </div>
    <section className="ui-card" aria-label={t('prob.loMasImportante')}><header className="ui-card-head"><div className="ui-card-copy"><h2 className="ui-card-title">{t('prob.loMasImportante')}</h2></div></header><InsightList insights={insights}/></section>
  </div>}
  {visibles.length>0&&<div className={s.row84}>
   <Categorias cats={cats} sel={clave} onSelect={elegirCategoria}/>
   {(catalogo||visibles.some(f=>f.critico!==null)||!!bundle.meta.critical_notice)?<Criticas filas={visibles} query={query} disponible={critDisponible} total={catalogo?.critical??null}/>:<section className={'ui-card '+s.fill}><header className="ui-card-head"><div className="ui-card-copy"><h2 className="ui-card-title">{t('prob.revCritica')}</h2></div></header><p className="state">{t('prob.noDispAhora')}</p></section>}
  </div>}
  <section ref={tablaRef as React.RefObject<HTMLElement>} className={'ui-card '+s.tableCard} id="lista-problemas" aria-label={t('prob.gruposProblemas')}>
   <header className={s.tableHead}>
    <div className="ui-card-copy"><h2 className="ui-card-title">{t('prob.gruposProblemas')}</h2><p className="ui-card-desc">{nf.format(filtradas.length)} {t(filtradas.length===1?'prob.grupo1':'prob.grupoN')}{filtradas.length<visibles.length?' '+t('prob.de')+' '+nf.format(visibles.length):''}{categoriaSel?' · '+categoriaSel.nombre:''}</p></div>
    <div className={s.tools} role="group" aria-label={t('prob.buscarFiltrar')}>
     <input type="search" className={s.search} aria-label={t('prob.buscarPorCat')} value={texto} onChange={e=>cambiar(()=>setTexto(e.target.value))} placeholder={t('prob.buscarCat')}/>
     {critDisponible&&<SegmentedControl size="sm" label={t('prob.queGrupos')} value={soloCriticos} onChange={v=>cambiar(()=>setSoloCriticos(v))} options={[{value:'todos',label:t('prob.todos')},{value:'criticos',label:t('prob.soloCriticos')}]}/>}
     <label className={s.sw} title={t('prob.alertasMin')}><input type="checkbox" checked={incluirRuido} onChange={e=>cambiar(()=>setIncluirRuido(e.target.checked))}/><span>{t('prob.notifAuto')}{ocultosTxt?' ('+nf.format(sep.ocultosN)+')':''}</span></label>
     {categoriaSel&&<Chip categoria={7} onRemove={()=>elegirCategoria(null)} removeLabel={t('prob.quitarFiltro')}>{categoriaSel.nombre}</Chip>}
    </div>
   </header>
   {!visibles.length?<EmptyState compact art="search" title={t('prob.aunSinDatos')} body={sep.ocultosN?t('prob.todosRuido',{n:nf.format(sep.ocultosN)}):t('prob.sinAgrupados')}/>
   :!filtradas.length?<EmptyState compact art="search" title={t('prob.ningunoCoincide')} body={t('prob.cambiaBusqueda')}/>
   :<div className={s.tableWrap} tabIndex={0} role="region" aria-label={t('prob.tabla')}><table className={s.table}>
    <thead><tr>{th('categoria',t('prob.problema'))}{th('conversaciones',t('prob.conversaciones'),true,t('prob.convUnicas'))}{th('severidad',t('prob.severidad'))}{th('critico',t('prob.critico'),false,t('prob.defGrupo'))}{th('citas',t('prob.citas'),true,t('prob.citasTitulo'))}{th('recomendaciones',t('prob.recomendacion'))}{conImporte&&th('importe',t('prob.ingresosExp'),true)}<th scope="col"><span className="sr-only">{t('prob.acciones')}</span></th></tr></thead>
    <tbody>{pagina.map(f=><tr key={f.id}>
     <th scope="row" className={s.cat} data-label={t('prob.problema')}><Link href={hrefDe(f,query)} className="row-link-inline"><b>{f.categoria}</b> · {fraseGrupoT(t,f)}</Link></th>
     <td data-label={t('prob.conversaciones')} className={s.num+' num'}>{f.conversaciones===null?<NA/>:<span className={s.convCell}><span className={s.convBar} aria-hidden="true"><span style={{width:Math.max(2,f.conversaciones*100/maxConv)+'%'}}/></span><strong>{nf.format(f.conversaciones)}</strong></span>}</td>
     <td data-label={t('prob.severidad')}>{f.severidad===null?<NA/>:<span title={chipSevT(t,f.severidad,f.critico)?.ayuda??undefined}><Chip tone={chipSevT(t,f.severidad,f.critico)?.tono??sevTone(f.severidad)}>{f.critico===true&&chipSevT(t,f.severidad,true)?.ayuda?t('prob.mixta'):sevT(t,f.severidad)}</Chip></span>}</td>
     <td data-label={t('prob.critico')}>{f.critico===null?<NA/>:f.critico?<span title={motivoDe(t,f)}><Chip tone="bad">{t('prob.critico')}</Chip></span>:<span className={s.muted}>—</span>}</td>
     <td data-label={t('prob.citas')} className={s.num+' num'}><Citas f={f}/></td>
     <td data-label={t('prob.recomendacion')}><Recomendacion f={f}/></td>
     {conImporte&&<td data-label={t('prob.ingresosExp')} className={s.num+' num'}>{f.importe?<>{money(f.importe as M)} <KindBadge metric={f.importe}/></>:<NA/>}</td>}
     <td data-label="" className={s.act}><button type="button" className="btn btn-ghost btn-sm" onClick={()=>setQuick(f)} aria-label={t('prob.vistaRapidaDe',{cat:f.categoria,grupo:fraseGrupoT(t,f)})}>{t('prob.vistaRapida')}</button></td>
    </tr>)}</tbody></table></div>}
   {filtradas.length>pagina.length&&<div className={s.pager}><span className={s.muted}>{t('prob.mostrando',{a:nf.format(pagina.length),b:nf.format(filtradas.length)})}</span><button type="button" className="btn btn-sm" onClick={()=>setMostrar(n=>n+PAGINA)}>{t('prob.mostrarMas',{n:nf.format(Math.min(PAGINA,filtradas.length-pagina.length))})}</button></div>}
  </section>
  <QuickView fila={quick} query={query} onClose={()=>setQuick(null)}/>
 </div>;
}
