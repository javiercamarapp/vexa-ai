'use client';
import type {CargaVista} from '../../../../../packages/workspace-service/carga-sla.mjs';
import {PageHeader} from '../ui/page-header';
import {Button,Refresh} from '../ui/button';
import {EmptyState} from '../ui/empty-state';
import {Icon} from '../ui/icons';
import {NoDisponible,Seccion,Vacio} from '../refunds/fuga-partes';
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
function Tarjetas({c}:{c:Carga}){
 const pico=c.horasPico??[],val=c.horasValle??[],dias=c.diasMenorCarga??[];
 return <div className="cg-tarjetas">
  <article><p className="eyebrow">Hora pico</p><p className="cg-k">{pico[0]?horaTxt(pico[0].hora):'—'}</p>
   <p className="fg-sm">{pico.length?`Seguidas de ${pico.slice(1).map(h=>horaTxt(h.hora)).join(' y ')}. La hora pico concentra ${pct(pico[0].pct)} de lo que entra en la semana (${pico[0].promedioPorDia} conversaciones por día en promedio).`:'Sin datos.'}</p></article>
  <article><p className="eyebrow">Días de menor carga</p><p className="cg-k">{dias.map(d=>d.dia).join(' y ')||'—'}</p>
   <p className="fg-sm">{dias.length?dias.map(d=>`${d.dia}: ${d.promedioPorDia} conversaciones por día`).join(' · ')+'. Buen momento para descansos o formación.':'Sin datos.'}</p></article>
  <article><p className="eyebrow">Horas más tranquilas</p><p className="cg-k">{val.map(h=>horaTxt(h.hora)).join(' · ')||'—'}</p>
   <p className="fg-sm">{val.length?`Entre las tres suman ${pct(Math.round(val.reduce((a,h)=>a+h.pct,0)*10)/10)} de las conversaciones.`:'Sin datos.'}</p></article>
 </div>;
}
function Calor({c}:{c:Carga}){
 const m=c.matriz??[],max=c.max??0,celda=c.celdaPico;
 return <div className="fg-tabla-wrap cg-calor" tabIndex={0} role="region" aria-label="Mapa de carga por día de la semana y hora">
  <table className="cg-tabla" aria-label="Conversaciones entrantes por hora del día y día de la semana (promedio por día)">
   <caption className="sr-only">Promedio de conversaciones entrantes por cada día de la semana, hora por hora, en hora de la Ciudad de México.</caption>
   <thead><tr><th scope="col"><span className="sr-only">Día</span></th>{Array.from({length:24},(_,h)=><th key={h} scope="col" className="cg-h">{h}</th>)}</tr></thead>
   <tbody>{m.map((fila,d)=><tr key={d}><th scope="row">{DIAS_CORTO[d]}</th>{fila.map((v,h)=><td key={h} data-paso={pasoCarga(v,max)} data-pico={celda&&celda.hora===h&&celda.dia===c.porDia?.[d]?.dia||undefined} title={`${c.porDia?.[d]?.dia} ${horaTxt(h)}: ${v} por día`}>{v>=10?Math.round(v):v}</td>)}</tr>)}</tbody>
  </table>
 </div>;
}
function BloqueCarga({v,onRetry}:{v:CargaVista;onRetry:()=>void}){
 const c=v.carga;
 if(c.status==='unavailable')return <NoDisponible onRetry={onRetry}/>;
 if(c.status!=='ok'||!c.matriz)return <Vacio>{c.note??'No hay meses completos y comparables con datos para calcular la carga.'}</Vacio>;
 return <>
  <Tarjetas c={c}/>
  <ol className="cg-leyenda" aria-label="Leyenda de la escala">{[1,2,3,4,5].map(p=><li key={p}><i data-paso={p} aria-hidden="true"/>{p===1?'Menos':p===5?'Más':''}</li>)}<li className="fg-sm">Cada celda: conversaciones nuevas por día en promedio.</li></ol>
  <Calor c={c}/>
  <p className="fg-sm">Meses usados: {(c.meses??[]).map(mesTxt).join(', ')}. {num(c.total)} conversaciones entrantes (primer mensaje del cliente). Hora de la Ciudad de México ({v.zona}). {c.excluidos?.length?`Excluidos por incompletos: ${c.excluidos.map(e=>`${mesTxt(e.mes)} (${e.motivo==='mes_parcial'?'mes parcial':e.motivo==='posible_hueco'?'posible hueco de exportación':'muy pocos datos'})`).join(', ')}.`:''}</p>
  <p className="fg-sm cg-canal">{v.canal.status!=='ok'?'Canal: no disponible ahora.':v.canal.derivable?'Canal disponible.':`Solo total, sin separar por canal: ${num(v.canal.conCanal)} de ${num(v.canal.total)} conversaciones traen canal. Para separar Amazon, Walmart y Shopify hace falta conectar sus cuentas o que HubSpot traiga el canal de venta.`}</p>
 </>;
}
function BloqueSla({v,onRetry}:{v:CargaVista;onRetry:()=>void}){
 const s=v.sla;
 if(s.status==='unavailable')return <NoDisponible onRetry={onRetry}/>;
 if(s.status!=='ok'||s.medibles==null)return <Vacio>Sin hilos de HubSpot medibles todavía.</Vacio>;
 const base=s.medibles||1,partes=[{t:'dentro',n:s.dentro??0,l:'Respuesta registrada en 24 h o menos'},{t:'fuera',n:s.fuera??0,l:'Respuesta registrada después de 24 h'},{t:'sin',n:s.sinRespuestaRegistrada??0,l:'Sin respuesta de agente registrada'}];
 const rapida=(s.primeraRespuestaP50h??99)<0.1;
 return <>
  <div className="cg-sla">
   <p className="mp-big"><span>{pct(s.pctDentroDeConRespuesta)}</span><small>de los hilos con respuesta de agente registrada la tuvieron en 24 h o menos ({num(s.dentro)} de {num(s.conRespuestaRegistrada)})</small></p>
   <p className="cg-aviso" role="note"><Icon name="alert" size={16}/><span><b>Cobertura baja.</b> Solo {num(s.conRespuestaRegistrada)} de {num(s.medibles)} hilos medibles ({pct(s.pctConRespuesta)}) tienen una respuesta de agente en la base. El resto puede ser que no se respondió o que la respuesta no se capturó; por eso el porcentaje de arriba es una cota optimista, no el cumplimiento real de SLA. Si se cuentan todos los hilos medibles, {num(s.dentro)} de {num(s.medibles)} ({pct(s.pctDentroDeMedibles)}) cumplieron.</span></p>
  </div>
  <div className="cg-bar" role="img" aria-label={partes.map(p=>`${p.l}: ${num(p.n)}`).join('; ')}>{partes.map(p=><i key={p.t} data-t={p.t} style={{inlineSize:`${(p.n*100)/base}%`}}/>)}</div>
  <ul className="cg-bar-l">{partes.map(p=><li key={p.t}><i data-t={p.t} aria-hidden="true"/><span>{p.l}</span><b>{num(p.n)}</b><small>{pct(Math.round((p.n*1000)/base)/10)}</small></li>)}</ul>
  <div className="cg-grid">
   <article><p className="eyebrow">Mediana de primera respuesta</p><p className="cg-k">{horas(s.primeraRespuestaP50h)}</p>{rapida&&<p className="fg-sm">Una mediana de segundos sugiere respuestas automáticas contadas como agente: no la uses para planear turnos.</p>}</article>
   <article><p className="eyebrow">Percentil 90</p><p className="cg-k">{horas(s.primeraRespuestaP90h)}</p><p className="fg-sm">9 de cada 10 respuestas registradas llegaron en ese tiempo o antes.</p></article>
   <article><p className="eyebrow">Abiertos sin respuesta &gt; 24 h</p><p className="cg-k">{num(s.abiertosSinRespuesta24h)}</p>
    <p className="fg-sm">Solo conteo, sin nombres. Entre 1 y 7 días: {num(s.edadAbiertos?.d1_7)} · 7 a 30 días: {num(s.edadAbiertos?.d7_30)} · más de 30 días: {num(s.edadAbiertos?.d30)}.</p></article>
  </div>
  <p className="fg-sm">Base: {num(s.medibles)} hilos de HubSpot con mensaje del cliente, de {num(s.hilos)} hilos en total ({num(s.sinMensajeCliente)} sin mensaje del cliente). Hilos creados del {fechaCorta(s.rango?.desde)} al {fechaCorta(s.rango?.hasta)}; estado según el último corte de HubSpot ({fechaCorta(s.corte?.slice(0,10))}). {num(s.cerradosSinRespuestaRegistrada)} hilos cerrados no tienen respuesta de agente registrada.</p>
  <p className="fg-sm cg-canal">No se puede separar por canal (Amazon, Walmart…): HubSpot API no trae el canal de venta. Las cifras son del total. {v.nota}</p>
 </>;
}
function BloqueCierre({v,onRetry}:{v:CargaVista;onRetry:()=>void}){
 const c=v.cierre;
 if(c.status==='unavailable')return <NoDisponible onRetry={onRetry}/>;
 if(c.status==='not_computed')return <Vacio>El resumen de cierre todavía no se ha calculado para esta organización.</Vacio>;
 if(c.status!=='ok')return <Vacio>Sin hilos con cierre calculado.</Vacio>;
 return <div className="cg-grid">
  <article><p className="eyebrow">Hilos cerrados</p><p className="cg-k">{num(c.closed)}</p><p className="fg-sm">de {num(c.threads)} hilos de HubSpot.</p></article>
  <article><p className="eyebrow">Reabiertos</p><p className="cg-k">{pct(c.reopenedPercent)}</p><p className="fg-sm">{num(c.reopenedThreads)} hilos volvieron a abrirse después de cerrarse.</p></article>
  <article><p className="eyebrow">Tiempo de cierre</p><p className="cg-k">{horas(c.closeP50Hours)}</p><p className="fg-sm">Mediana; el percentil 90 es {horas(c.closeP90Hours)}. {num(c.closedUnder1h)} cerraron en menos de 1 h y {num(c.closedOver7d)} tardaron más de 7 días. Precalculado{c.refreshedAt?` el ${fechaCorta(c.refreshedAt.slice(0,10))}`:''}.</p></article>
 </div>;
}

/** Pantalla «Carga y SLA» (/workload): lo que SÍ es medible con HubSpot; cada bloque con su cobertura y su «No disponible ahora». */
export function CargaPantalla({organization}:{organization?:string}){
 const f=useVista<CargaVista>('/api/workload',forma);
 const v=f.data;
 return <div className="task-page stack cg-page">
  <PageHeader eyebrow="Operación" title="Carga y SLA" description={<>Cuándo entran las conversaciones, a qué hora conviene tener gente y cuánto riesgo hay de incumplir las 24 horas de Amazon.{organization?` ${organization}.`:''}</>}
   actions={<Button icon={<Refresh/>} onClick={()=>f.reload()} loading={f.busy&&!!v}>Actualizar</Button>}/>
  {!v&&f.busy&&<section className="card"><Esqueleto segundos={f.segundos}/></section>}
  {!v&&!f.busy&&f.error&&<EmptyState art="shield" tone="warn" title={f.error.code==='acceso'?'Tu rol no tiene acceso a este panel':'No disponible ahora'} body={f.error.texto} action={f.error.code==='acceso'?undefined:<Button icon={<Refresh/>} onClick={()=>f.reload()}>Reintentar</Button>}/>}
  {v&&<>
   <p className="mp-prov" role="note"><Icon name="info" size={16}/><span><b>HubSpot es la fuente.</b> Zendesk no se usa mientras su configuración esté en transición.</span></p>
   <Seccion id="cg-carga" titulo="Mapa de carga" kind="observed" intro="Conversaciones nuevas por hora del día y día de la semana, en hora de la Ciudad de México, solo con meses completos.">
    <BloqueCarga v={v} onRetry={()=>f.reload()}/>
   </Seccion>
   <Seccion id="cg-sla" titulo="Riesgo de SLA de 24 horas" kind="observed" intro="Primera respuesta de agente dentro de 24 h, solo en los hilos medibles de HubSpot API. Amazon exige 24 h o multa.">
    <BloqueSla v={v} onRetry={()=>f.reload()}/>
   </Seccion>
   <Seccion id="cg-cierre" titulo="Cierre y reaperturas" kind="observed" intro="Cuánto tardan en cerrarse los hilos de HubSpot y cuántos se reabren. Precalculado.">
    <BloqueCierre v={v} onRetry={()=>f.reload()}/>
   </Seccion>
   <details className="card fg-como">
    <summary><Icon name="info" size={16}/> Cómo se calculó</summary>
    <ul>
     <li>Carga: cada conversación cuenta una vez, en el día y la hora de su primer mensaje del cliente, convertidos a la hora de la Ciudad de México. Cada celda es el promedio por día (total entre cuántos de ese día hubo en los meses usados). Se usan hasta 6 meses completos: se excluyen el último mes con datos y los meses que caen por debajo de la mitad del anterior (suelen ser huecos de exportación). Los sellos de hora vienen de las fuentes; si una fuente exporta en otra zona, la hora se desplaza.</li>
     <li>SLA: solo hilos de HubSpot API con mensaje del cliente. Primera respuesta = primer mensaje de agente posterior al primer mensaje del cliente. Un hilo sin respuesta de agente en la base no se puede dar por incumplido ni por cumplido: se muestra aparte. «Abiertos sin respuesta &gt; 24 h» usa el estado del último corte de HubSpot.</li>
     <li>El histórico del CSV no se usa para SLA: en dos de cada tres conversaciones no hay mensaje de agente en la base, así que la primera respuesta ahí no es confiable.</li>
     <li>Cierre y reaperturas: se leen del resumen precalculado insight_thread_resolution (reapertura = hilo que pasa a abierto justo después de cerrarse).</li>
     <li>Consulta del {v.generatedAt.slice(0,10)}.</li>
    </ul>
   </details>
  </>}
 </div>;
}
