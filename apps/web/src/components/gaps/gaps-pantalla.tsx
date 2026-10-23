'use client';
import {useState} from 'react';
import {PageHeader} from '../ui/page-header';
import {Button,Download,LinkButton,Refresh} from '../ui/button';
import {EmptyState} from '../ui/empty-state';
import {KindBadge} from '../ui/kind-badge';
import {Icon} from '../ui/icons';
import {NoDisponible,Seccion,Vacio} from '../refunds/fuga-partes';
import {bajar} from '../refunds/fuga-pantalla';
import {SeccionGano,SeccionPierdo,SeccionPorQue} from './gaps-secciones';
import {SeccionFamilias} from './gaps-familias';
import {SeccionRecomendaciones,type Supuesto} from './gaps-recs';
import {csvIngresos,csvIntensidad,csvRecomendaciones,proveniencia,resumenHtml} from './gaps-archivos.mjs';
import {lineaCobertura,num,periodoIngresos,usd} from './gaps-modelo.mjs';
import {useGaps} from './use-gaps';
import '../refunds/fuga.css';
import './gaps.css';

const ANCLAS:[string,string][]=[['gp-gano','Dónde gano'],['gp-pierdo','Dónde pierdo'],['gp-porque','Por qué y dónde ganar más'],['gp-familias','Ventas vs quejas'],['gp-recs','Recomendaciones']];

function Esqueleto({segundos}:{segundos:number}){
 return <section className="card" aria-busy="true"><div className="fg-skel" role="status"><span className="sr-only">Cargando brechas de ingreso…</span>
  <div className="fg-skel-big" aria-hidden="true"/>{[0,1,2,3,4].map(i=><div key={i} className="fg-skel-l" style={{width:`${92-i*9}%`}} aria-hidden="true"/>)}
  <p className="fg-sm">{segundos<2?'Calculando…':segundos<8?`Calculando… ${segundos} s`:`Calculando… ${segundos} s. Está tardando más de lo normal; sigue intentando.`}</p></div></section>;
}

/** Pantalla «Brechas de ingreso»: UN titular de dinero (ingreso bruto observado) y luego dónde gano, dónde pierdo, por qué y dónde podría ganar más. Sin margen: todo es ingreso bruto. */
export function GapsPantalla({organization}:{organization?:string}){
 const g=useGaps(),v=g.data;
 const [aviso,setAviso]=useState(''),[supuesto,setSupuesto]=useState<Supuesto|null>(null);
 const per=v?periodoIngresos(v):null;
 const irA=(id:string)=>{const el=document.getElementById('rec-'+id)??document.getElementById('gp-recs');el?.scrollIntoView({behavior:'smooth',block:'start'});(el as HTMLElement|null)?.focus?.({preventScroll:true});};
 const bajarArchivo=(a:{nombre:string;mime:string;contenido:string;total:number})=>{bajar(a);setAviso(`Archivo descargado en tu equipo: ${a.nombre}. No se envió nada.`);};
 const ok=v?.ingresos.status==='ok'?v.ingresos:null;
 return <div className="task-page stack fg-page">
  <PageHeader eyebrow="Dinero" title="Brechas de ingreso" description={<>Dónde estás ganando más, dónde estás perdiendo y por qué, y dónde podrías ganar más. Todo es ingreso bruto: no hay costo ni margen por producto.{organization?` ${organization}.`:''}</>}
   actions={<><LinkButton href="/refunds" variant="secondary">Ver fuga de reembolsos</LinkButton><Button icon={<Refresh/>} onClick={()=>g.reload()} loading={g.busy&&!!v}>Actualizar</Button></>}/>
  {!v&&g.busy&&<Esqueleto segundos={g.segundos}/>}
  {!v&&!g.busy&&g.error&&<EmptyState art="shield" tone="warn" title={g.error.code==='acceso'?'Tu rol no tiene acceso a este panel':'No disponible ahora'} body={g.error.texto} action={g.error.code==='acceso'?undefined:<Button icon={<Refresh/>} onClick={()=>g.reload()}>Reintentar</Button>}/>}
  {v&&<>
   <section className="card fg-hero" aria-labelledby="gp-hero-t">
    <div className="fg-hero-top"><p id="gp-hero-t" className="eyebrow">Ingreso bruto observado</p><KindBadge kind="observed"/></div>
    {v.ingresos.status==='unavailable'?<NoDisponible onRetry={()=>g.reload()}/>
     :!ok?<Vacio>Todavía no hay pedidos cargados en el libro. Carga el export de Amazon o Walmart para ver este número.</Vacio>
     :<>
      <p className="fg-big" aria-label={`${usd(ok.activoMinor)} de ingreso bruto observado, en dólares, sin cancelados`}>{usd(ok.activoMinor)}<small>USD de ingreso bruto, sin cancelados</small></p>
      {per&&<p className="fg-periodo"><b>{per.etiqueta}</b></p>}
      <p className="fg-aviso" role="note">{per?.linea}</p>
      <p className="fg-meta">{lineaCobertura(v)}</p>
     </>}
   </section>

   <nav aria-label="Secciones de esta pantalla"><ul className="gp-nav">{ANCLAS.map(([id,t])=><li key={id}><a href={'#'+id}>{t}</a></li>)}</ul></nav>

   <Seccion id="gp-gano" titulo="Dónde gano" kind="observed" intro="Ingreso bruto por mes, canal y SKU, con su crecimiento mes contra mes entre meses completos.">
    <SeccionGano v={v} onReintentar={()=>g.reload()}/>
   </Seccion>
   <Seccion id="gp-pierdo" titulo="Dónde pierdo" kind="observed" intro="Reembolsos, cancelaciones y reembolsos negados o vencidos, y cuánto pesan sobre el ingreso del mismo SKU, canal y mes.">
    <SeccionPierdo v={v} onReintentar={()=>g.reload()}/>
   </Seccion>
   <Seccion id="gp-porque" titulo="Por qué y dónde podría ganar más" kind="inferred" intro="Concentración, candidatos a revisar y a empujar (reglas sobre datos observados) y los motivos que registra el Tracker.">
    <SeccionPorQue v={v} onReintentar={()=>g.reload()} irA={irA}/>
   </Seccion>
   <Seccion id="gp-familias" titulo="Ventas vs quejas por familia de producto" kind="observed" intro="¿La herramienta que más se vende es la que más contactos de soporte genera? Cruce de ingreso con conversaciones por familia de producto.">
    <SeccionFamilias v={v} onReintentar={()=>g.reload()}/>
   </Seccion>
   <Seccion id="gp-recs" titulo="Recomendaciones con evidencia" kind="inferred" intro="Reglas, sin IA: solo aparece una recomendación si los datos la respaldan. Cada una dice qué hacer, por qué, con qué evidencia y cuánto ingreso está en juego.">
    <SeccionRecomendaciones v={v} onReintentar={()=>g.reload()} supuesto={supuesto} onSupuestos={setSupuesto}/>
   </Seccion>
   <Seccion id="gp-descargas" titulo="Llévalo a tu reunión" intro="Archivos que se generan aquí mismo, en tu navegador. Sin PII, sin nombres de clientes y sin enviar nada.">
    <div className="gp-descargas">
     <Button icon={<Download/>} disabled={!ok} onClick={()=>bajarArchivo(resumenHtml(v))}>Resumen (HTML)</Button>
     <Button icon={<Download/>} disabled={v.ranking.status!=='ok'} onClick={()=>bajarArchivo(csvIngresos(v))}>Ingreso por SKU (CSV)</Button>
     <Button icon={<Download/>} disabled={v.intensidad.status!=='ok'} onClick={()=>bajarArchivo(csvIntensidad(v))}>Intensidad de reembolso (CSV)</Button>
     <Button icon={<Download/>} disabled={v.recomendaciones.items.length===0} onClick={()=>bajarArchivo(csvRecomendaciones(v))}>Recomendaciones (CSV)</Button>
    </div>
    <p className="fg-aviso fg-ok" role="status" aria-live="polite">{aviso}</p>
   </Seccion>

   <details className="card fg-como">
    <summary><Icon name="info" size={16}/> Cómo se calculó</summary>
    <ul>
     {proveniencia(v).map((t,i)=><li key={i}>{t}</li>)}
     <li>Mes completo: empieza el día 1 a 3 (si es el primero del canal), termina a menos de 3 días de su fin (si es el último) y sus líneas no caen a menos de la mitad del mes previo. Solo los meses completos entran a comparaciones mes contra mes; el cruce con reembolsos usa meses completos desde que existe el libro de reembolsos del canal.</li>
     <li>Reglas de recomendación (umbrales de trabajo, no hallazgos): intensidad {v.umbrales.multiplicadorMediana} veces la mediana del canal con al menos {usd(String(v.umbrales.minIngresoCruceUsd*100))} de ingreso, {num(v.umbrales.minLineasCruce)} líneas y {num(v.umbrales.minReembolsosCruce)} reembolsos para «revisar»; crecimiento de {v.umbrales.minCrecimientoPct} % o más con devolución no mayor a la mediana para «empujar»; venta cruzada con {num(v.umbrales.minParConversaciones)} conversaciones y el análisis al menos al {v.umbrales.minAvanceCrossPct} %. «Mercado» significa canal: todavía no hay geografía.</li>
     <li>Familias de producto: la IA anota la familia mencionada en cada conversación (prefijo del código de modelo o categoría de herramienta). Solo las familias con prefijo de SKU se cruzan con ventas; las categorías no se mezclan. «Quejas» son conversaciones de soporte que mencionan la familia.</li>
     <li>Lo que no se puede calcular hoy: margen o utilidad (no hay costo por producto), tasa de reembolso por cohorte de pedido, unidades (el libro trae líneas, no cantidad), causa raíz, geografía.</li>
     <li>Lectura: tablas precalculadas que se refrescan solas; ingresos al {v.frescura.ordenes?.refreshedAt?.slice(0,10)??'(sin fecha)'}, reembolsos al {v.frescura.reembolsos?.refreshedAt?.slice(0,10)??'(sin fecha)'}; consulta del {v.generatedAt.slice(0,10)}.</li>
    </ul>
   </details>
  </>}
 </div>;
}
