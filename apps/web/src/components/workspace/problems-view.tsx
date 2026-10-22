'use client';
import {useMemo,useState} from 'react';
import type {Bundle,Metric,RecordView} from '../../lib/workspace/contracts';
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
import {nf} from '../ui/format';
import {EmptyState} from '../ui/empty-state';
type M=Metric&{coverage?:{known_n:number;eligible_n:number};missing_reasons?:string[]};
const STATUS:Record<string,{label:string;tone:'ok'|'warn'|'info'}>={ready:{label:'Cobertura completa',tone:'ok'},partial:{label:'Cobertura parcial',tone:'warn'},stale:{label:'Corte anterior',tone:'warn'}};
const exact=(m:M)=>m.amount_minor!==null&&/^-?\d+$/.test(m.amount_minor);
const money=(m:M)=>formatMinorUnits(m.amount_minor,m.currency,m.exponent);
function primary(item:RecordView):M|undefined{return (item.metrics.find(x=>x.kind==='exposure')??item.metrics[0]) as M|undefined;}
function Coverage({m}:{m:M}){const c=m.coverage;if(!c||c.eligible_n<=0)return null;return <span className="pcard-cov"><ProgressRing size={30} stroke={4} value={c.known_n/c.eligible_n} title={`Cobertura: ${nf.format(c.known_n)} de ${nf.format(c.eligible_n)}`}/><span>{nf.format(c.known_n)} de {nf.format(c.eligible_n)} registros</span></span>;}
function Figure({m,big=false}:{m:M;big?:boolean}){
 return <div className="pfig" data-big={big||undefined}><div className="pfig-label"><span>{m.label}</span><KindBadge metric={m}/></div>
  <strong className="pfig-value">{exact(m)?money(m):'No disponible'}</strong>
  {!exact(m)&&m.missing_reasons?.includes('EXPOSURE_NOT_LINKED')&&<small>Sin vínculos problema–pedido: la exposición no se calcula.</small>}
  {!exact(m)&&m.known_subtotal!==null&&<small>Subtotal conocido: {formatMinorUnits(m.known_subtotal,m.currency,m.exponent)}; no es el total.</small>}</div>;
}
function QuickView({item,query,onClose}:{item:RecordView|null;query:string;onClose:()=>void}){
 return <Drawer open={!!item} onClose={onClose} width={560} title={item?.title??''} subtitle={item&&<StatusChip tone={STATUS[item.status]?.tone??'info'}>{STATUS[item.status]?.label??item.status}</StatusChip>} footer={item&&<LinkButton href={'/problems/'+item.id+'?'+query} variant="primary" size="sm" icon={<Arrow/>}>Abrir problema</LinkButton>}>
  {item&&<div className="stack">
   <p className="card-lead">{item.summary}</p>
   <div className="stat-grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))'}}>{item.metrics.map((m,i)=><div key={i} className="card"><Figure m={m as M}/><Coverage m={m as M}/><small className="pfig-src"><SourceRef value={m.source_ref}/></small></div>)}</div>
   <dl className="record-details">{item.details.map((d,i)=><div key={i}><dt>{d.label}</dt><dd>{d.value}</dd></div>)}<div><dt>Versión</dt><dd>{item.version}</dd></div></dl>
   {item.evidence.length>0?<section><h3>Evidencia autorizada ({item.evidence.length})</h3>{item.evidence.map(e=><Citation key={e.id} quote={e.quote} role={e.role} messageRevisionId={e.id}/>)}</section>:<p className="state">Sin citas verificables con tu acceso en este corte.</p>}
  </div>}
 </Drawer>;
}
export function ProblemsView({bundle,query}:{bundle:Bundle;query:string}){
 const [mode,setMode]=useState<'cards'|'table'>('cards'),[quick,setQuick]=useState<RecordView|null>(null),[incluirRuido,setIncluirRuido]=useState(false);
 // Solo presentación y ranking: las notificaciones automáticas siguen publicadas; el interruptor las devuelve.
 const sep=useMemo(()=>separarRuido(bundle.items,i=>[i.title,i.summary,...i.details.map(d=>d.value)],incluirRuido),[bundle.items,incluirRuido]);
 const items=sep.visibles;
 const insights=useMemo(()=>insightsProblemas({items,moneda:bundle.meta.scope?.currency??null}),[items,bundle.meta.scope?.currency]);
 const known=items.map(i=>primary(i)).filter((m):m is M=>!!m&&exact(m)).map(m=>{const n=BigInt(m.amount_minor!);return n<0n?-n:n;});
 const max=known.reduce((a,n)=>n>a?n:a,0n);
 const bars:BarListItem[]=items.map(item=>{const m=primary(item);const ok=!!m&&exact(m);const n=ok?BigInt(m!.amount_minor!):0n;
  return {key:item.id,label:item.title,value:ok&&max>0n?(ratioBps(n<0n?-n:n,max)??0)/100:ok?0:null,display:m?(ok?money(m):'Sin importe'):'Sin importe',kind:m?epistemicKind(m):'unclassified',href:'/problems/'+item.id+'?'+query,note:m&&!ok&&m.known_subtotal!==null?'Subtotal conocido: '+formatMinorUnits(m.known_subtotal,m.currency,m.exponent)+'; no es el total.':undefined};});
 const by=(s:string)=>items.filter(i=>i.status===s).length;
 return <div className="stack">
  <NoiseToggle incluir={incluirRuido} onChange={setIncluirRuido} ocultos={sep.ocultosN} unidad="problemas agrupados de esta página"/>
  <section className="card" aria-label="Lo más importante"><div className="card-title"><div><h2>Lo más importante</h2><p>Hasta tres lecturas con su fuente y su cobertura</p></div></div><InsightList insights={insights}/></section>
  <div className="split" data-even>
   <section className="card" aria-label="Comparación de exposición por problema">
    <div className="card-title"><div><h2>Ingresos expuestos por problema agrupado</h2><p>Longitud proporcional · {bundle.meta.scope?.currency??''} · no se suma entre problemas</p></div></div>
    <BarList items={bars}/>
   </section>
   <div className="stack">
    <section className="card" aria-label="Problemas por estado">
     <div className="card-title"><div><h2>Estado de la cobertura</h2><p>Problemas del corte</p></div></div>
     <DonutChart title="Problemas por estado de cobertura" centerValue={items.length} centerLabel="problemas" segments={[{key:'ready',label:'Cobertura completa',value:by('ready'),display:String(by('ready')),tone:1},{key:'partial',label:'Cobertura parcial',value:by('partial'),display:String(by('partial')),tone:5},{key:'stale',label:'Corte anterior',value:by('stale'),display:String(by('stale')),tone:'neutral'}]}/>
    </section>
   </div>
  </div>
  <div className="toolbar"><SegmentedControl label="Vista de problemas" value={mode} onChange={setMode} options={[{value:'cards',label:'Tarjetas'},{value:'table',label:'Tabla'}]}/><span className="chip" aria-live="polite">{items.length} {items.length===1?'problema agrupado':'problemas agrupados'}</span></div>
  {!items.length?<EmptyState compact art="search" title="Aún sin datos" body={sep.ocultosN?`Los ${nf.format(sep.ocultosN)} problemas agrupados de esta página son notificaciones automáticas, ocultas por defecto. Actívalas con el interruptor para verlas.`:'No hay problemas agrupados en esta página.'}/>:mode==='cards'?<div className="cards-grid reveal">{items.map(item=>{const m=primary(item),rest=item.metrics.filter(x=>x!==m) as M[];const st=STATUS[item.status]??{label:item.status,tone:'info' as const};
   return <article key={item.id} className="card problem-card pcard" data-lift>
    <header className="pcard-head"><StatusChip tone={st.tone}>{st.label}</StatusChip><span className="chip" title="Versión del problema">v{item.version}</span></header>
    <h3 className="pcard-title"><Link href={'/problems/'+item.id+'?'+query} className="card-link">{item.title}</Link></h3>
    <p className="pcard-summary">{item.summary}</p>
    {m&&<><Figure m={m} big/><Coverage m={m}/></>}
    {rest.length>0&&<ul className="pcard-rest">{rest.map((r,i)=><li key={i}><span>{r.label}</span><strong>{exact(r)?money(r):'No disponible'}</strong><KindBadge metric={r}/></li>)}</ul>}
    <footer className="pcard-foot"><span className="pcard-ev"><Icon name="message" size={14}/>{item.evidence.length} {item.evidence.length===1?'cita verificable':'citas verificables'}</span><button type="button" className="btn btn-ghost btn-sm" onClick={()=>setQuick(item)} aria-label={'Vista rápida: '+item.title}>Vista rápida</button></footer>
   </article>;})}</div>
  :<section className="card" aria-label="Tabla de problemas"><div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla de problemas, desplazamiento horizontal"><table className="dtable"><thead><tr><th scope="col">Problema</th><th scope="col">Estado</th><th scope="col" className="num">Ingresos expuestos</th><th scope="col" className="num">Reembolsos</th><th scope="col">Cobertura</th><th scope="col" className="num">Citas</th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead><tbody>{items.map(item=>{const m=primary(item),r=item.metrics.find(x=>x.kind==='refunds') as M|undefined,st=STATUS[item.status]??{label:item.status,tone:'info' as const},c=m?.coverage;
   return <tr key={item.id}><th scope="row"><Link href={'/problems/'+item.id+'?'+query} className="row-link-inline">{item.title}</Link></th><td><StatusChip tone={st.tone}>{st.label}</StatusChip></td><td className="num">{m&&exact(m)?money(m):'No disponible'}{m&&<div><KindBadge metric={m}/></div>}</td><td className="num">{r&&exact(r)?money(r):'—'}</td><td>{c&&c.eligible_n>0?<span className="inline-bar" title={`${nf.format(c.known_n)} de ${nf.format(c.eligible_n)} registros`}><i style={{width:Math.round(c.known_n*100/c.eligible_n)+'%'}}/><span className="sr-only">{nf.format(c.known_n)} de {nf.format(c.eligible_n)} registros</span></span>:'—'}</td><td className="num">{item.evidence.length}</td><td><button type="button" className="btn btn-ghost btn-sm" onClick={()=>setQuick(item)} aria-label={'Vista rápida: '+item.title}>Vista rápida</button></td></tr>;})}</tbody></table></div></section>}
  <QuickView item={quick} query={query} onClose={()=>setQuick(null)}/>
 </div>;
}
