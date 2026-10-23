'use client';
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
import {DIAS_CORTO,fechaCorta,horaTxt,horas,mesTxt,num,pasoCarga,pct} from './carga-modelo.mjs';
import '../map/mapa.css';
import './carga.css';

const forma=(d:unknown)=>typeof d==='object'&&d!==null&&'carga' in d&&'sla' in d;
function Esqueleto({segundos}:{segundos:number}){
 return <div className="cg-skel" role="status" aria-busy="true"><span className="sr-only">Cargando carga y SLA…</span><div className="cg-skel-b" aria-hidden="true"/><div className="cg-skel-b" aria-hidden="true"/>
  <p className="fg-sm">{segundos<2?'Calculando…':segundos<8?`Calculando… ${segundos} s`:`Calculando… ${segundos} s. Está tardando más de lo normal; sigue intentando.`}</p></div>;
}
type Carga=CargaVista['carga'];

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
 const m=c.matriz??[],tope=p95(m)||c.max||0,celda=c.celdaPico;
 const porHora=c.porHora??[],maxH=Math.max(1,...porHora.map(h=>h.total)),porDia=c.porDia??[],maxD=Math.max(1,...porDia.map(d=>d.promedioPorDia));
 return <div className="cg-calor" tabIndex={0} role="region" aria-label="Mapa de carga por día de la semana y hora">
  <table className="cg-tabla" aria-label="Conversaciones entrantes por hora del día y día de la semana (promedio por día)">
   <caption className="sr-only">Promedio de conversaciones entrantes por cada día de la semana, hora por hora, en hora de la Ciudad de México. Escala con tope en el percentil 95.</caption>
   <thead><tr><th scope="col"><span className="sr-only">Día</span></th>{Array.from({length:24},(_,h)=><th key={h} scope="col" className="cg-h">{h}</th>)}<th scope="col" className="cg-h cg-tot">Por día</th></tr></thead>
   <tbody>{m.map((fila,d)=><tr key={d}><th scope="row">{DIAS_CORTO[d]}</th>{fila.map((v,h)=><td key={h} data-paso={pasoCarga(v,tope)} data-pico={celda&&celda.hora===h&&celda.dia===c.porDia?.[d]?.dia||undefined} title={`${c.porDia?.[d]?.dia} ${horaTxt(h)}: ${v} por día`}>{v>=10?Math.round(v):v>0?Math.round(v*10)/10:''}</td>)}
    <td className="cg-marg"><span className="cg-marg-b" style={{inlineSize:((porDia[d]?.promedioPorDia??0)*100/maxD)+'%'}} title={`${porDia[d]?.dia}: ${porDia[d]?.promedioPorDia} por día`}/><b>{porDia[d]?Math.round(porDia[d].promedioPorDia):''}</b></td></tr>)}</tbody>
   <tfoot><tr><th scope="row"><span className="sr-only">Total por hora</span></th>{Array.from({length:24},(_,h)=><td key={h} className="cg-marg-c"><span style={{blockSize:((porHora.find(x=>x.hora===h)?.total??0)*100/maxH)+'%'}} title={`${horaTxt(h)}: ${num(porHora.find(x=>x.hora===h)?.total??0)} en total`}/></td>)}<td/></tr></tfoot>
  </table>
  <ol className="cg-leyenda" aria-label="Leyenda de la escala">{[1,2,3,4,5].map(p=><li key={p}><i data-paso={p} aria-hidden="true"/>{p===1?'Menos':p===5?'Más':''}</li>)}<li>Conversaciones nuevas por día en promedio · tope de escala en el percentil 95 ({tope})</li></ol>
 </div>;
}
type Parte={status:string;note?:string};
function Cuerpo({p,onRetry,vacio,children}:{p:Parte;onRetry:()=>void;vacio:string;children:React.ReactNode}){
 if(p.status==='unavailable')return <NoDisponible onRetry={onRetry}/>;
 if(p.status==='not_computed')return <Vacio>El resumen todavía no se ha calculado para esta organización.</Vacio>;
 if(p.status!=='ok')return <Vacio>{p.note??vacio}</Vacio>;
 return <>{children}</>;
}
function Tarjeta({id,titulo,desc,kind='observed',children,clase}:{id:string;titulo:string;desc?:React.ReactNode;kind?:'observed'|'estimated'|'inferred';children:React.ReactNode;clase?:string}){
 return <section className={'ui-card cg-card '+(clase??'')} aria-labelledby={id}><header className="ui-card-head"><div className="ui-card-copy"><h2 id={id} className="ui-card-title">{titulo}</h2>{desc&&<p className="ui-card-desc">{desc}</p>}</div><KindBadge kind={kind}/></header>{children}</section>;
}

/** Pantalla «Carga y SLA» (/workload): lo que SÍ es medible con HubSpot; cada bloque con su cobertura y su «No disponible ahora». Mediana y p90, nunca promedio. */
export function CargaPantalla({organization}:{organization?:string}){ void organization;
 const f=useVista<CargaVista>('/api/workload',forma);
 const v=f.data,reintentar=()=>f.reload();
 const c=v?.carga,s=v?.sla,ci=v?.cierre;
 const cok=!!c&&c.status==='ok'&&!!c.matriz,pico=c?.horasPico?.[0],menor=c?.diasMenorCarga??[];
 const perfil=(c?.porHora??[]).slice().sort((a,b)=>a.hora-b.hora).map(h=>h.total);
 const sok=!!s&&s.status==='ok'&&s.medibles!=null,base=Math.max(1,s?.medibles??1);
 const edad=s?.edadAbiertos,maxEdad=Math.max(1,edad?.d1_7??0,edad?.d7_30??0,edad?.d30??0);
 const cierreOk=!!ci&&ci.status==='ok';
 return <div className="task-page stack cg-page">
  <PageHeader eyebrow="Operación" title="Carga y SLA" description={<>Cuándo entran las conversaciones, a qué hora hace falta gente y cuánto riesgo hay con las 24 h de Amazon. Fuente: HubSpot.</>}
   actions={<Button icon={<Refresh/>} onClick={reintentar} loading={f.busy&&!!v}>Actualizar</Button>}/>
  {!v&&f.busy&&<section className="ui-card"><Esqueleto segundos={f.segundos}/></section>}
  {!v&&!f.busy&&f.error&&<EmptyState art="shield" tone="warn" title={f.error.code==='acceso'?'Tu rol no tiene acceso a este panel':'No disponible ahora'} body={f.error.texto} action={f.error.code==='acceso'?undefined:<Button icon={<Refresh/>} onClick={reintentar}>Reintentar</Button>}/>}
  {v&&c&&s&&ci&&<>
   <Notice tone="info" title="HubSpot es la fuente.">Zendesk no se usa mientras su configuración esté en transición. Sin extrapolar al histórico.</Notice>
   <div className="ui-kpis" role="group" aria-label="Indicadores de carga y SLA">
    <Kpi label="Hora pico" value={cok&&pico?horaTxt(pico.hora):'—'} note={cok&&pico?`${pct(pico.pct)} de lo que entra en la semana`:'Sin datos'}>{perfil.length>1&&<Sparkline data={perfil} color={5} label="Perfil de conversaciones por hora del día"/>}</Kpi>
    <Kpi label="Menor carga" value={cok&&menor.length?menor.map(d=>d.dia.slice(0,3)).join(' y '):'—'} note={cok&&menor.length?menor.map(d=>`${d.promedioPorDia} por día`).join(' · '):'Sin datos'}>{cok&&c.porDia&&<Sparkline data={c.porDia.map(d=>d.promedioPorDia)} color={5} label="Conversaciones por día de la semana"/>}</Kpi>
    <Kpi label="Abiertos sin respuesta >24 h" value={sok?num(s.abiertosSinRespuesta24h):'—'} note={sok?`1–7 d: ${num(edad?.d1_7)} · 7–30 d: ${num(edad?.d7_30)} · >30 d: ${num(edad?.d30)}`:'Sin hilos medibles'}>{sok&&edad&&<Sparkline data={[edad.d1_7,edad.d7_30,edad.d30]} color={5} label="Abiertos por rango de edad"/>}</Kpi>
    <Kpi label="Cierre de hilos (mediana)" value={cierreOk?horas(ci.closeP50Hours):'—'} note={cierreOk?`p90 ${horas(ci.closeP90Hours)} · ${pct(ci.reopenedPercent)} reabiertos`:'Sin cierre calculado'}>{cierreOk&&ci.closeP50Hours!=null&&ci.closeP90Hours!=null&&<Bala valor={ci.closeP50Hours} max={ci.closeP90Hours} label={`Mediana ${horas(ci.closeP50Hours)} frente al percentil 90 ${horas(ci.closeP90Hours)}`}/>}</Kpi>
   </div>
   <div className="cg-row84">
    <Tarjeta id="cg-carga" titulo="Mapa de carga" desc={`Conversaciones nuevas por hora y día, hora de la Ciudad de México, solo meses completos`}>
     <Cuerpo p={c} onRetry={reintentar} vacio="No hay meses completos y comparables con datos para calcular la carga."><Calor c={c}/>
      <p className="cg-nota">{(c.meses??[]).map(mesTxt).join(', ')} · {num(c.total)} conversaciones entrantes (primer mensaje del cliente).{c.excluidos?.length?` Excluidos: ${c.excluidos.map(e=>`${mesTxt(e.mes)} (${e.motivo==='mes_parcial'?'mes parcial':e.motivo==='posible_hueco'?'posible hueco de exportación':'muy pocos datos'})`).join(', ')}.`:''} {v.canal.status!=='ok'?'Canal: no disponible ahora.':v.canal.derivable?'Canal disponible.':`Solo total: ${num(v.canal.conCanal)} de ${num(v.canal.total)} conversaciones traen canal.`}</p>
     </Cuerpo>
    </Tarjeta>
    <Tarjeta id="cg-sla" titulo="Riesgo de SLA de 24 horas" desc="Primera respuesta de agente en hilos medibles de HubSpot">
     <Cuerpo p={s} onRetry={reintentar} vacio="Sin hilos de HubSpot medibles todavía.">
      {sok&&<>
       <p className="cg-big"><b>{pct(s.pctDentroDeConRespuesta)}</b><span>de los hilos con respuesta registrada la tuvieron en 24 h o menos ({num(s.dentro)} de {num(s.conRespuestaRegistrada)})</span></p>
       <div className="cg-bar" role="img" aria-label={`Respuesta en 24 h o menos: ${num(s.dentro)}; después de 24 h: ${num(s.fuera)}; sin respuesta de agente registrada: ${num(s.sinRespuestaRegistrada)}`}>{[['dentro',s.dentro],['fuera',s.fuera],['sin',s.sinRespuestaRegistrada]].map(([t,n])=><i key={t as string} data-t={t as string} style={{inlineSize:`${(Number(n??0)*100)/base}%`}}/>)}<span className="cg-bar-u" style={{insetInlineStart:`${((s.dentro??0)*100)/base}%`}} aria-hidden="true"/></div>
       <ul className="cg-bar-l">{[['dentro','≤ 24 h',s.dentro],['fuera','Tardía (> 24 h)',s.fuera],['sin','Sin respuesta registrada',s.sinRespuestaRegistrada]].map(([t,l,n])=><li key={t as string}><i data-t={t as string} aria-hidden="true"/><span>{l as string}</span><b>{num(n as number)}</b><small>{pct(Math.round((Number(n??0)*1000)/base)/10)}</small></li>)}</ul>
       <p className="cg-aviso" role="note"><Icon name="alert" size={14}/><span><b>Cobertura baja.</b> Solo {num(s.conRespuestaRegistrada)} de {num(s.medibles)} hilos ({pct(s.pctConRespuesta)}) tienen respuesta de agente en la base: «sin respuesta registrada» no es cumplido ni incumplido. Riesgo de reclamo A-to-z a 48 h, no multa.</span></p>
      </>}
     </Cuerpo>
    </Tarjeta>
   </div>
   <div className="cg-row444">
    <Tarjeta id="cg-cierre" titulo="Cierre y reaperturas" desc="Hilos de HubSpot, precalculado">
     <Cuerpo p={ci} onRetry={reintentar} vacio="Sin hilos con cierre calculado.">
      {cierreOk&&<ul className="cg-stats"><li><span>Hilos cerrados</span><b>{num(ci.closed)}</b><small>de {num(ci.threads)}</small></li><li><span>Mediana de cierre</span><b>{horas(ci.closeP50Hours)}</b><small>p90 {horas(ci.closeP90Hours)}</small></li><li><span>Cerrados en menos de 1 h</span><b>{num(ci.closedUnder1h)}</b><small>{pct(ci.closed?Math.round(((ci.closedUnder1h??0)*1000)/ci.closed)/10:null)}</small></li><li><span>Tardaron más de 7 días</span><b>{num(ci.closedOver7d)}</b><small>{pct(ci.closed?Math.round(((ci.closedOver7d??0)*1000)/ci.closed)/10:null)}</small></li><li><span>Reabiertos</span><b>{pct(ci.reopenedPercent)}</b><small>{num(ci.reopenedThreads)} hilos</small></li></ul>}
     </Cuerpo>
    </Tarjeta>
    <Tarjeta id="cg-edad" titulo="Abiertos por edad" desc="Sin respuesta de agente > 24 h; solo conteo">
     <Cuerpo p={s} onRetry={reintentar} vacio="Sin hilos de HubSpot medibles todavía.">
      {sok&&edad&&<ul className="cg-stats">{[['1 a 7 días',edad.d1_7],['7 a 30 días',edad.d7_30],['Más de 30 días',edad.d30]].map(([l,n])=><li key={l as string}><span>{l as string}</span><b>{num(n as number)}</b><Bala valor={n as number} max={maxEdad} label={`${l}: ${num(n as number)} hilos`}/></li>)}<li><span>Cerrados sin respuesta registrada</span><b>{num(s.cerradosSinRespuestaRegistrada)}</b><small>hilos</small></li></ul>}
     </Cuerpo>
    </Tarjeta>
    <Tarjeta id="cg-base" titulo="Primera respuesta y base" desc="Con cobertura baja; no sirve para planear turnos" kind="observed">
     <Cuerpo p={s} onRetry={reintentar} vacio="Sin hilos de HubSpot medibles todavía.">
      {sok&&<ul className="cg-stats"><li><span>Mediana de primera respuesta</span><b>{horas(s.primeraRespuestaP50h)}</b><small>{(s.primeraRespuestaP50h??99)<0.1?'posible respuesta automática':'p50'}</small></li><li><span>Percentil 90</span><b>{horas(s.primeraRespuestaP90h)}</b><small>9 de cada 10 llegaron antes</small></li><li><span>Hilos medibles</span><b>{num(s.medibles)}</b><small>de {num(s.hilos)}</small></li><li><span>Periodo de creación</span><b>{fechaCorta(s.rango?.desde)}</b><small>a {fechaCorta(s.rango?.hasta)}</small></li></ul>}
     </Cuerpo>
    </Tarjeta>
   </div>
   <details className="ui-card cg-como">
    <summary><Icon name="info" size={14}/> Cómo se calculó</summary>
    <ul>
     <li>Carga: cada conversación cuenta una vez, en el día y la hora de su primer mensaje del cliente, en hora de la Ciudad de México. Cada celda es el promedio por día en los meses usados (hasta 6 completos); la escala tiene tope en el percentil 95. Se excluyen el último mes con datos y los meses con posible hueco de exportación.</li>
     <li>SLA: solo hilos de HubSpot API con mensaje del cliente. Un hilo sin respuesta de agente en la base no se da por cumplido ni por incumplido. «Abiertos sin respuesta &gt; 24 h» usa el estado del último corte de HubSpot ({fechaCorta(s.corte?.slice(0,10))}).</li>
     <li>El histórico del CSV no se usa para SLA: en dos de cada tres conversaciones no hay mensaje de agente en la base.</li>
     <li>Cierre y reaperturas: resumen precalculado (reapertura = hilo que pasa a abierto justo después de cerrarse). Mediana y percentil 90, nunca promedio. Consulta del {v.generatedAt.slice(0,10)}. {v.nota}</li>
    </ul>
   </details>
  </>}
 </div>;
}
