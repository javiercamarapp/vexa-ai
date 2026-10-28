'use client';
import {useT,useIdioma} from '../i18n/proveedor';
import {fecha as fechaI} from '../../lib/i18n/formato';
import {ConMarca} from '../ui/brand-mark';
import {RovaqCargando} from '../rovaq-cargando';
import type {Clave} from '../../lib/i18n';
import type {CargaVista} from '../../../../../packages/workspace-service/carga-sla.mjs';
import {PageHeader} from '../ui/page-header';
import {Button,Refresh} from '../ui/button';
import {EmptyState} from '../ui/empty-state';
import {Icon} from '../ui/icons';
import {NoDisponible,Vacio} from '../refunds/fuga-partes';
import {Notice} from '../ui/notice';
import {KindBadge} from '../ui/kind-badge';
import {Sparkline} from '../ui/sparkline';
import {useVista} from '../map/use-vista';
import {horaTxt,horas,num,pasoCarga,pct} from './carga-modelo.mjs';
import '../map/mapa.css';
import './carga.css';

const forma=(d:unknown)=>typeof d==='object'&&d!==null&&'carga' in d&&'sla' in d;
function Esqueleto({}:{segundos:number}){
 const t=useT();
 return <RovaqCargando compacto mensaje={t('carga.cargando')}/>;
}
type Carga=CargaVista['carga'];

const DL=['carga.dl0','carga.dl1','carga.dl2','carga.dl3','carga.dl4','carga.dl5','carga.dl6'] as const satisfies readonly Clave[];
const DC=['carga.dc0','carga.dc1','carga.dc2','carga.dc3','carga.dc4','carga.dc5','carga.dc6'] as const satisfies readonly Clave[];
const DIAS_ES=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const PET={['--cat' as string]:'var(--chart-5)'};
/** Percentil 95 de las celdas con datos: el tope de la escala (una celda aislada no aplasta al resto). */
const p95=(m:number[][])=>{const v=m.flat().filter(x=>x>0).sort((a,b)=>a-b);return v.length?v[Math.min(v.length-1,Math.floor(v.length*0.95))]:0;};
function Kpi({label,value,note,children}:{label:string;value:React.ReactNode;note?:React.ReactNode;children?:React.ReactNode}){
 return <div className="ui-kpi" data-c="5" style={PET}><span className="ui-kpi-label">{label}</span><div className="ui-kpi-row"><strong className="ui-kpi-value">{value}</strong>{children}</div>{note&&<small className="ui-kpi-note">{note}</small>}</div>;
}
/** Barra de bala: marcador en el umbral, tramo de fondo suave y valor en petróleo. */
function Bala({valor,umbral,max,label}:{valor:number;umbral?:number;max:number;label:string}){
 const p=Math.min(100,Math.max(0,valor*100/Math.max(1,max))),u=umbral===undefined?null:Math.min(100,umbral*100/Math.max(1,max));
 return <span className="cg-bala" role="img" aria-label={label}><span className="cg-bala-v" style={{inlineSize:p+'%'}}/>{u!==null&&<span className="cg-bala-u" style={{insetInlineStart:u+'%'}}/>}</span>;
}
function Calor({c}:{c:Carga}){
 const t=useT();
 const largo=(d:number)=>t(DL[d]??'carga.dl0');
 const m=c.matriz??[],tope=p95(m)||c.max||0,celda=c.celdaPico;
 const porHora=c.porHora??[],maxH=Math.max(1,...porHora.map(h=>h.total)),porDia=c.porDia??[],maxD=Math.max(1,...porDia.map(d=>d.promedioPorDia));
 return <div className="cg-calor" tabIndex={0} role="region" aria-label={t('carga.calorAria')}>
  <table className="cg-tabla" aria-label={t('carga.tablaAria')}>
   <caption className="sr-only">{t('carga.caption')}</caption>
   <thead><tr><th scope="col"><span className="sr-only">{t('carga.dia')}</span></th>{Array.from({length:24},(_,h)=><th key={h} scope="col" className="cg-h">{h}</th>)}<th scope="col" className="cg-h cg-tot">{t('carga.porDia')}</th></tr></thead>
   <tbody>{m.map((fila,d)=><tr key={d}><th scope="row">{t(DC[d]??'carga.dc0')}</th>{fila.map((v,h)=><td key={h} data-paso={pasoCarga(v,tope)} data-pico={celda&&celda.hora===h&&celda.dia===c.porDia?.[d]?.dia||undefined} title={t('carga.celdaTip',{dia:largo(d),hora:horaTxt(h),v})}>{v>=10?Math.round(v):v>0?Math.round(v*10)/10:''}</td>)}
    <td className="cg-marg"><span className="cg-marg-b" style={{inlineSize:((porDia[d]?.promedioPorDia??0)*100/maxD)+'%'}} title={t('carga.diaTip',{dia:largo(d),v:porDia[d]?.promedioPorDia??0})}/><b>{porDia[d]?Math.round(porDia[d].promedioPorDia):''}</b></td></tr>)}</tbody>
   <tfoot><tr><th scope="row"><span className="sr-only">{t('carga.totalHora')}</span></th>{Array.from({length:24},(_,h)=><td key={h} className="cg-marg-c"><span style={{blockSize:((porHora.find(x=>x.hora===h)?.total??0)*100/maxH)+'%'}} title={t('carga.horaTotalTip',{hora:horaTxt(h),n:num(porHora.find(x=>x.hora===h)?.total??0)})}/></td>)}<td/></tr></tfoot>
  </table>
  <ol className="cg-leyenda" aria-label={t('carga.leyendaAria')}>{[1,2,3,4,5].map(p=><li key={p}><i data-paso={p} aria-hidden="true"/>{p===1?t('carga.menos'):p===5?t('carga.mas'):''}</li>)}<li>{t('carga.leyendaTxt',{tope})}</li></ol>
 </div>;
}
type Parte={status:string;note?:string};
function Cuerpo({p,onRetry,vacio,children}:{p:Parte;onRetry:()=>void;vacio:string;children:React.ReactNode}){
 const t=useT();
 if(p.status==='unavailable')return <NoDisponible onRetry={onRetry}/>;
 if(p.status==='not_computed')return <Vacio>{t('carga.noCalculado')}</Vacio>;
 if(p.status!=='ok')return <Vacio>{p.note??vacio}</Vacio>;
 return <>{children}</>;
}
function Tarjeta({id,titulo,desc,kind='observed',children,clase}:{id:string;titulo:string;desc?:React.ReactNode;kind?:'observed'|'estimated'|'inferred';children:React.ReactNode;clase?:string}){
 return <section className={'ui-card cg-card '+(clase??'')} aria-labelledby={id}><header className="ui-card-head"><div className="ui-card-copy"><h2 id={id} className="ui-card-title">{titulo}</h2>{desc&&<p className="ui-card-desc">{desc}</p>}</div><KindBadge kind={kind}/></header>{children}</section>;
}

/** Pantalla «Carga y SLA» (/workload): lo que SÍ es medible con HubSpot; cada bloque con su cobertura y su «No disponible ahora». Mediana y p90, nunca promedio. */
export function CargaPantalla({organization}:{organization?:string}){ void organization;
 const t=useT(),idioma=useIdioma();
 const fechaCorta=(iso?:string|null)=>iso?fechaI(idioma,String(iso).slice(0,10),{day:'numeric',month:'short',year:'numeric'}):'—';
 const mesTxt=(m:string)=>fechaI(idioma,String(m)+'-01',{month:'short',year:'numeric'});
 const f=useVista<CargaVista>('/api/workload',forma);
 const v=f.data,reintentar=()=>f.reload();
 const c=v?.carga,s=v?.sla,ci=v?.cierre;
 const cok=!!c&&c.status==='ok'&&!!c.matriz,pico=c?.horasPico?.[0],menor=c?.diasMenorCarga??[];
 const perfil=(c?.porHora??[]).slice().sort((a,b)=>a.hora-b.hora).map(h=>h.total);
 const sok=!!s&&s.status==='ok'&&s.medibles!=null,base=Math.max(1,s?.medibles??1);
 const edad=s?.edadAbiertos,maxEdad=Math.max(1,edad?.d1_7??0,edad?.d7_30??0,edad?.d30??0);
 const cierreOk=!!ci&&ci.status==='ok';
 if(!v&&f.busy)return <RovaqCargando mensaje=""/>;
 return <div className="task-page stack cg-page">
  <PageHeader eyebrow={t('mapa.eyebrow')} title={t('carga.titulo')} description={<>{t('carga.desc')}</>}/>
  {!v&&f.busy&&<section className="ui-card"><Esqueleto segundos={f.segundos}/></section>}
  {!v&&!f.busy&&f.error&&<EmptyState art="shield" tone="warn" title={f.error.code==='acceso'?t('vista.sinAcceso'):t('vista.noDisponible')} body={f.error.texto} action={f.error.code==='acceso'?undefined:<Button icon={<Refresh/>} onClick={reintentar}>{t('vista.reintentar')}</Button>}/>}
  {v&&c&&s&&ci&&<>
   <Notice tone="info" title={<ConMarca marca="hubspot">{t('carga.fuente')}</ConMarca>}>{t('carga.fuenteCuerpo')}</Notice>
   <div className="ui-kpis" role="group" aria-label={t('carga.kpisAria')}>
    <Kpi label={t('carga.horaPico')} value={cok&&pico?horaTxt(pico.hora):'—'} note={cok&&pico?t('carga.pctSemana',{pct:pct(pico.pct)}):t('carga.sinDatos')}>{perfil.length>1&&<Sparkline data={perfil} color={5} label={t('carga.perfilHora')}/>}</Kpi>
    <Kpi label={t('carga.menorCarga')} value={cok&&menor.length?menor.map(d=>{const i=DIAS_ES.indexOf(d.dia);return i>=0?t(DC[i]):d.dia.slice(0,3);}).join(idioma==='en'?' and ':' y '):'—'} note={cok&&menor.length?menor.map(d=>t('carga.porDiaN',{n:d.promedioPorDia})).join(' · '):t('carga.sinDatos')}>{cok&&c.porDia&&<Sparkline data={c.porDia.map(d=>d.promedioPorDia)} color={5} label={t('carga.convPorDia')}/>}</Kpi>
    <Kpi label={t('carga.abiertos24')} value={sok?num(s.abiertosSinRespuesta24h):'—'} note={sok?t('carga.edadNota',{a:num(edad?.d1_7),b:num(edad?.d7_30),c:num(edad?.d30)}):t('carga.sinHilos')}>{sok&&edad&&<Sparkline data={[edad.d1_7,edad.d7_30,edad.d30]} color={5} label={t('carga.abiertosRango')}/>}</Kpi>
    <Kpi label={t('carga.cierreMed')} value={cierreOk?horas(ci.closeP50Hours):'—'} note={cierreOk?t('carga.cierreNota',{p90:horas(ci.closeP90Hours),pct:pct(ci.reopenedPercent)}):t('carga.sinCierre')}>{cierreOk&&ci.closeP50Hours!=null&&ci.closeP90Hours!=null&&<Bala valor={ci.closeP50Hours} max={ci.closeP90Hours} label={t('carga.medVsP90',{med:horas(ci.closeP50Hours),p90:horas(ci.closeP90Hours)})}/>}</Kpi>
   </div>
   <div className="cg-row84">
    <Tarjeta id="cg-carga" titulo={t('carga.mapaTitulo')} desc={t('carga.mapaDesc')}>
     <Cuerpo p={c} onRetry={reintentar} vacio={t('carga.mapaVacio')}><Calor c={c}/>
      <p className="cg-nota">{(c.meses??[]).map(mesTxt).join(', ')} · {t('carga.convEntrantes',{n:num(c.total)})}{c.excluidos?.length?` ${t('carga.excluidos')} ${c.excluidos.map(e=>`${mesTxt(e.mes)} (${e.motivo==='mes_parcial'?t('carga.mesParcial'):e.motivo==='posible_hueco'?t('carga.posibleHueco'):t('carga.muyPocos')})`).join(', ')}.`:''} {v.canal.status!=='ok'?t('carga.canalNo'):v.canal.derivable?t('carga.canalOk'):t('carga.canalSolo',{a:num(v.canal.conCanal),b:num(v.canal.total)})}</p>
     </Cuerpo>
    </Tarjeta>
    <Tarjeta id="cg-sla" titulo={t('carga.slaTitulo')} desc={t('carga.slaDesc')}>
     <Cuerpo p={s} onRetry={reintentar} vacio={t('carga.hilosVacio')}>
      {sok&&<>
       <p className="cg-big"><b>{pct(s.pctDentroDeConRespuesta)}</b><span>{t('carga.dentroDe',{a:num(s.dentro),b:num(s.conRespuestaRegistrada)})}</span></p>
       <div className="cg-bar" role="img" aria-label={t('carga.barAria',{a:num(s.dentro),b:num(s.fuera),c:num(s.sinRespuestaRegistrada)})}>{[['dentro',s.dentro],['fuera',s.fuera],['sin',s.sinRespuestaRegistrada]].map(([k,n])=><i key={k as string} data-t={k as string} style={{inlineSize:`${(Number(n??0)*100)/base}%`}}/>)}<span className="cg-bar-u" style={{insetInlineStart:`${((s.dentro??0)*100)/base}%`}} aria-hidden="true"/></div>
       <ul className="cg-bar-l">{[['dentro',t('carga.lDentro'),s.dentro],['fuera',t('carga.lFuera'),s.fuera],['sin',t('carga.lSin'),s.sinRespuestaRegistrada]].map(([k,l,n])=><li key={k as string}><i data-t={k as string} aria-hidden="true"/><span>{l as string}</span><b>{num(n as number)}</b><small>{pct(Math.round((Number(n??0)*1000)/base)/10)}</small></li>)}</ul>
       <p className="cg-aviso" role="note"><Icon name="alert" size={14}/><span><b>{t('carga.coberturaBaja')}</b> {t('carga.coberturaTxt',{a:num(s.conRespuestaRegistrada),b:num(s.medibles),pct:pct(s.pctConRespuesta)})}</span></p>
      </>}
     </Cuerpo>
    </Tarjeta>
   </div>
   <div className="cg-row444">
    <Tarjeta id="cg-cierre" titulo={t('carga.cierreTitulo')} desc={t('carga.cierreDesc')}>
     <Cuerpo p={ci} onRetry={reintentar} vacio={t('carga.cierreVacio')}>
      {cierreOk&&<ul className="cg-stats"><li><span>{t('carga.hilosCerrados')}</span><b>{num(ci.closed)}</b><small>{t('carga.deN',{n:num(ci.threads)})}</small></li><li><span>{t('carga.medCierre')}</span><b>{horas(ci.closeP50Hours)}</b><small>p90 {horas(ci.closeP90Hours)}</small></li><li><span>{t('carga.cerrados1h')}</span><b>{num(ci.closedUnder1h)}</b><small>{pct(ci.closed?Math.round(((ci.closedUnder1h??0)*1000)/ci.closed)/10:null)}</small></li><li><span>{t('carga.tardaron7')}</span><b>{num(ci.closedOver7d)}</b><small>{pct(ci.closed?Math.round(((ci.closedOver7d??0)*1000)/ci.closed)/10:null)}</small></li><li><span>{t('carga.reabiertos')}</span><b>{pct(ci.reopenedPercent)}</b><small>{t('carga.hilosN',{n:num(ci.reopenedThreads)})}</small></li></ul>}
     </Cuerpo>
    </Tarjeta>
    <Tarjeta id="cg-edad" titulo={t('carga.edadTitulo')} desc={t('carga.edadDesc')}>
     <Cuerpo p={s} onRetry={reintentar} vacio={t('carga.hilosVacio')}>
      {sok&&edad&&<ul className="cg-stats">{[[t('carga.e17'),edad.d1_7],[t('carga.e730'),edad.d7_30],[t('carga.e30'),edad.d30]].map(([l,n])=><li key={l as string}><span>{l as string}</span><b>{num(n as number)}</b><Bala valor={n as number} max={maxEdad} label={t('carga.edadHilos',{rango:l as string,n:num(n as number)})}/></li>)}<li><span>{t('carga.cerradosSin')}</span><b>{num(s.cerradosSinRespuestaRegistrada)}</b><small>{t('carga.hilos')}</small></li></ul>}
     </Cuerpo>
    </Tarjeta>
    <Tarjeta id="cg-base" titulo={t('carga.baseTitulo')} desc={t('carga.baseDesc')} kind="observed">
     <Cuerpo p={s} onRetry={reintentar} vacio={t('carga.hilosVacio')}>
      {sok&&<ul className="cg-stats"><li><span>{t('carga.medPrimera')}</span><b>{horas(s.primeraRespuestaP50h)}</b><small>{(s.primeraRespuestaP50h??99)<0.1?t('carga.posibleAuto'):'p50'}</small></li><li><span>{t('carga.p90')}</span><b>{horas(s.primeraRespuestaP90h)}</b><small>{t('carga.p90Nota')}</small></li><li><span>{t('carga.medibles')}</span><b>{num(s.medibles)}</b><small>{t('carga.deN',{n:num(s.hilos)})}</small></li><li><span>{t('carga.periodo')}</span><b>{fechaCorta(s.rango?.desde)}</b><small>{t('carga.aFecha',{fecha:fechaCorta(s.rango?.hasta)})}</small></li></ul>}
     </Cuerpo>
    </Tarjeta>
   </div>
   <details className="ui-card cg-como">
    <summary><Icon name="info" size={14}/> {t('carga.como')}</summary>
    <ul>
     <li>{t('carga.como1')}</li>
     <li>{t('carga.como2',{fecha:fechaCorta(s.corte?.slice(0,10))})}</li>
     <li>{t('carga.como3')}</li>
     <li>{t('carga.como4',{fecha:v.generatedAt.slice(0,10)})} {v.nota}</li>
    </ul>
   </details>
  </>}
 </div>;
}
