'use client';
import {useState} from 'react';
import {useSearchParams} from 'next/navigation';
import type {SkuFila} from '../../../../../packages/workspace-service/fuga-reembolsos.mjs';
import {PageHeader} from '../ui/page-header';
import {Button,Download,Refresh} from '../ui/button';
import {EmptyState} from '../ui/empty-state';
import {KindBadge} from '../ui/kind-badge';
import {Icon} from '../ui/icons';
import {NoDisponible,Seccion,TablaSkus,SeccionTracker,SeccionRepetido,SeccionCambios,Vacio} from './fuga-partes';
import {SeccionIntensidad} from './fuga-intensidad';
import {Estimador} from './fuga-estimador';
import {Skeleton} from './fuga-esqueleto';
import {endpointFuga,useFuga} from './use-fuga';
import {colaVencidos,listaWalmart,paqueteEvidencia,proveniencia,type Archivo} from './fuga-archivos.mjs';
import {fraseConcentracion,lineaCobertura,lineaVentanas,num,periodoDelTitular,usd} from './fuga-modelo.mjs';
import './fuga.css';

/** Descarga local (Blob): no hay ninguna petición de red. */
export function bajar(a:Archivo){
 const url=URL.createObjectURL(new Blob([a.contenido],{type:a.mime})),el=document.createElement('a');
 el.href=url;el.download=a.nombre;el.rel='noopener';document.body.appendChild(el);el.click();el.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
}

/** Pantalla «Fuga de reembolsos»: insight -> dinero -> acción, con datos reales cargados; cada cifra con su clase, periodo y cobertura. */
export function FugaPantalla({organization,embebido=false}:{organization?:string;/** Dentro del copiloto de negocio: sin PageHeader del espacio de trabajo; el h1 es el titular de la pantalla. */embebido?:boolean}){
 const sp=useSearchParams(),f=useFuga(endpointFuga(sp?.toString()));
 const per=f.data?periodoDelTitular(f.data):null;
 const [abierto,setAbierto]=useState<string|null>(null),[skuPaquete,setSkuPaquete]=useState<string>(''),[aviso,setAviso]=useState('');
 const v=f.data;
 const sinLibro=v?.titular.status==='empty'&&v.skus.status!=='ok';
 const top:SkuFila[]=v&&v.skus.status==='ok'?v.skus.top:[];
 const paquete=(sku:string)=>{
  if(!v)return;const p=paqueteEvidencia(v,sku);
  if(!p){setAviso('No se pudo armar el paquete de este SKU.');return;}
  bajar(p.html);setTimeout(()=>bajar(p.csv),400);
  setAviso(`Paquete de ${sku} descargado en tu equipo: ${p.html.nombre} y ${p.csv.nombre}. No se envió nada.`);
 };
 const lista=()=>{if(!v)return;const l=listaWalmart(v);bajar(l);setAviso(`Lista descargada: ${num(l.total)} SKUs con reembolsos en Walmart (${l.nombre}). No se envió nada.`);};
 const cola=()=>{if(!v)return;const c=colaVencidos(v);bajar(c);setAviso(`Cola descargada: ${num(c.total)} solicitudes (${c.nombre}). No se envió nada.`);};
 const skuSel=skuPaquete||top[0]?.sku||'';
 const est=v?.tracker.status==='ok'?v.tracker.estados:null;
 return <div className="task-page stack fg-page">
  {embebido?<header className="fg-embebido-head"><p className="cn-eyebrow">Dinero · tu copiloto de reembolsos</p><h1 className="cn-titular">Fuga de reembolsos</h1><p className="cn-fuente">Dónde se concentra el dinero devuelto, cuánto está negado o atorado y qué llevarte a la reunión con el proveedor o con Walmart.{organization?` ${organization}.`:''}</p><div className="cn-acciones"><Button size="sm" icon={<Refresh/>} onClick={()=>f.reload()} loading={f.busy&&!!v}>Actualizar</Button></div></header>:<PageHeader eyebrow="Dinero" title="Fuga de reembolsos" description={<>Dónde se concentra el dinero devuelto, cuánto está negado o atorado y qué llevarte a la reunión con el proveedor o con Walmart.{organization?` ${organization}.`:''}</>}
   actions={<Button icon={<Refresh/>} onClick={()=>f.reload()} loading={f.busy&&!!v}>Actualizar</Button>}/>}
  {!v&&f.busy&&<section className="card"><Skeleton lineas={6} segundos={f.segundos}/></section>}
  {!v&&!f.busy&&f.error&&<EmptyState art="shield" tone="warn" title={f.error.code==='acceso'?'Tu rol no tiene acceso a este panel':'No disponible ahora'} body={f.error.texto} action={f.error.code==='acceso'?undefined:<Button icon={<Refresh/>} onClick={()=>f.reload()}>Reintentar</Button>}/>}
  {v&&<>
   <section className="card fg-hero" aria-labelledby="fg-hero-t">
    <div className="fg-hero-top"><p id="fg-hero-t" className="eyebrow">Dinero devuelto</p><KindBadge kind="observed"/></div>
    {v.titular.status==='unavailable'?<NoDisponible onRetry={()=>f.reload()}/>
     :v.titular.status!=='ok'?<Vacio>Sin libro de reembolsos cargado para este periodo. Carga el export de Amazon o Walmart para ver este número.</Vacio>
     :<>
      <p className="fg-big" aria-label={`${usd(v.titular.usdBrutoMinor)} devueltos, brutos, en dólares`}>{usd(v.titular.usdBrutoMinor)}<small>USD devueltos, brutos</small></p>
      {per&&<p className="fg-periodo"><b>{per.etiqueta}</b>{per.ventanas.length>0&&<> · Ventana por canal: {per.ventanas.join(' · ')}</>}</p>}
      {per?.nota&&<p className="fg-aviso" role="note">{per.nota}</p>}
      <p className="fg-range">Rango observado: de <b>{usd(v.titular.usdNetoMinor)}</b> sin reembolsos cancelados a <b>{usd(v.titular.usdBrutoMinor)}</b> con ellos.</p>
      {fraseConcentracion(v)&&<p className="fg-frase">{fraseConcentracion(v)}</p>}
      <p className="fg-meta">{lineaCobertura(v)}</p>
      <p className="fg-meta">{lineaVentanas(v)}</p>
      {per?.acumulado&&<p className="fg-meta">{per.acumulado.texto}</p>}
     </>}
   </section>

   {sinLibro?<Seccion id="fg-sin-libro" titulo="Dónde se fuga" intro="Aquí verás los SKUs y canales que concentran el dinero devuelto."><Vacio>Todavía no hay reembolsos del libro económico para este periodo.</Vacio></Seccion>:<>
   <Seccion id="fg-skus" titulo="Dónde se fuga: los 10 SKUs" kind="observed" intro="Dinero devuelto por SKU base y canal. Abre un SKU para ver su expediente: lo que se sabe y lo que no.">
    {v.skus.status==='unavailable'?<NoDisponible onRetry={()=>f.reload()}/>:top.length===0?<Vacio>No hay reembolsos con SKU en este periodo.</Vacio>
     :<TablaSkus v={v} abierto={abierto} onAbrir={setAbierto} onPaquete={paquete}/>}
   </Seccion>

   <Seccion id="fg-acciones" titulo="Llévalo a la acción" intro="Tres archivos que se generan aquí mismo, en tu navegador. Sin PII, sin nombres de clientes y sin enviar nada.">
    <div className="fg-acciones">
     <article><h3>Paquete de evidencia para proveedor</h3><p>HTML y CSV de un SKU: reembolsos por mes y canal, líneas vendidas, estados del Tracker y lo que no prueba.</p>
      <div className="fg-acc-f"><label className="sr-only" htmlFor="fg-sku-sel">SKU del paquete</label><select id="fg-sku-sel" value={skuSel} onChange={e=>setSkuPaquete(e.target.value)} disabled={!top.length}>{top.map(r=><option key={r.sku} value={r.sku}>{r.sku} · {usd(r.usdBrutoMinor)}</option>)}</select>
       <Button variant="primary" icon={<Download/>} disabled={!skuSel} onClick={()=>paquete(skuSel)}>Generar paquete</Button></div></article>
     <article><h3>SKUs a revisar con Walmart</h3><p>{v.skus.status==='ok'?`${num(v.skus.walmart.length)} SKUs con reembolsos en Walmart, ordenados por dinero devuelto. Es una señal, no una tasa.`:'No disponible ahora.'}</p>
      <div className="fg-acc-f"><Button icon={<Download/>} disabled={v.skus.status!=='ok'} onClick={lista}>Descargar CSV</Button></div></article>
     <article><h3>Cola de reembolsos vencidos o negados</h3><p>{est?`${num(est.vencido)} con más de 180 días · ${num(est.no_reembolsable)} no reembolsables · ${num(est.rechazado)} rechazadas (del Tracker, recalculado ahora).`:'Requiere el Tracker de Excel, que no está disponible ahora.'}</p>
      <div className="fg-acc-f"><Button icon={<Download/>} disabled={!est} onClick={cola}>Descargar CSV</Button></div></article>
    </div>
    <p className="fg-aviso fg-ok" role="status" aria-live="polite">{aviso}</p>
   </Seccion>

   <Seccion id="fg-intensidad" titulo="Intensidad por canal" kind="observed" intro="Reembolsos del mes entre líneas vendidas del mes. Intensidad, no tasa por cohorte.">
    <SeccionIntensidad v={v} onReintentar={()=>f.reload()}/>
   </Seccion></>}

   <Seccion id="fg-tracker" titulo="Dinero negado o atorado" kind="observed" intro="Del Tracker de Excel: cuántas solicitudes de reembolso se pagaron y cuántas quedaron vencidas o negadas.">
    <SeccionTracker v={v} onCola={cola} onReintentar={()=>f.reload()}/>
   </Seccion>

   <Seccion id="fg-repetido" titulo="Contacto repetido" kind="observed" intro="Clientes que vuelven a escribir en 90 días.">
    <SeccionRepetido v={v} onReintentar={()=>f.reload()}/>
   </Seccion>

   <Seccion id="fg-cambios" titulo="Qué cambió" kind="observed" intro="Solo meses completos y comparables.">
    <SeccionCambios v={v}/>
   </Seccion>

   <Seccion id="fg-estimador" titulo="¿Cuánto podrías recuperar?" kind="estimated" intro="Un estimador con candado: tú tecleas los supuestos, Rovaq hace la cuenta.">
    <Estimador v={v}/>
   </Seccion>

   <details className="card fg-como">
    <summary><Icon name="info" size={16}/> Cómo se calculó</summary>
    <ul>
     {proveniencia(v).map((t,i)=><li key={i}>{t}</li>)}
     <li>Dinero devuelto: reembolsos del libro, última revisión de cada uno, en USD. «Bruto» incluye reembolsos cancelados; «sin cancelados» los quita. Los reembolsos sin monto (Amazon) cuentan como reembolso pero no suman dinero. CAD y MXN nunca se suman.</li>
     <li>SKU base: mayúsculas y sin sufijos -WMxx, -001A-001 ni -NEW. Los SKU numéricos de Best Buy no cruzan: no hay equivalencias.</li>
     <li>Lo que no se puede calcular hoy: tasa de reembolso por SKU o cohorte, margen o pérdida neta, causa raíz, tickets por 1,000 unidades. Faltan cantidad por línea, un identificador común de pedido en Walmart y costo por SKU.</li>
     <li>Corte: {v.scope.dateStart||v.scope.dateEnd?`${v.scope.dateStart??'inicio'} a ${v.scope.dateEnd??'hoy'}`:'todo lo cargado'}; consulta del {v.generatedAt.slice(0,10)}.</li>
    </ul>
   </details>
  </>}
 </div>;
}
