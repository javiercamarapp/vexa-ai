'use client';
import {useMemo,useState} from 'react';
import type {MapaVista,EstadoMapa,Celdas} from '../../../../../packages/workspace-service/mapa-problemas.mjs';
import {PageHeader} from '../ui/page-header';
import {Button,LinkButton,Refresh,Arrow} from '../ui/button';
import {EmptyState} from '../ui/empty-state';
import {Icon} from '../ui/icons';
import {NoDisponible,Seccion,Vacio} from '../refunds/fuga-partes';
import {useVista} from './use-vista';
import {MapaCuadricula,type Mosaico} from './mapa-cuadricula';
import {MENSAJE_COMPLETO,filasTabla,limitesRampa,num,pctTxt,textoCobertura,textoOcultos} from './mapa-modelo.mjs';
import './mapa.css';

const forma=(d:unknown)=>typeof d==='object'&&d!==null&&'status' in d&&'provisional' in d;
function Esqueleto({segundos}:{segundos:number}){
 return <div className="mp-skel" role="status" aria-busy="true"><span className="sr-only">Cargando el mapa de problemas…</span>
  <div className="mp-skel-mapa" aria-hidden="true"/>
  <p className="fg-sm">{segundos<2?'Calculando…':segundos<8?`Calculando… ${segundos} s`:`Calculando… ${segundos} s. Está tardando más de lo normal; sigue intentando.`}</p></div>;
}
function Lista({titulo,celdas}:{titulo:string;celdas:Celdas}){
  if(celdas.ocultoTodo)return <section className="mp-lista"><h3>{titulo}</h3><p className="fg-sm">Sin desglose: cada categoría tiene menos de 5 casos.</p></section>;
  const tope=Math.max(1,...celdas.items.map(i=>i.n),celdas.otros);
  return <section className="mp-lista" aria-label={titulo}><h3>{titulo}</h3>
   <ul>{celdas.items.map(i=><li key={i.etiqueta}><span>{i.etiqueta}</span><b>{num(i.n)}</b><i style={{inlineSize:`${Math.max(4,(i.n*100)/tope)}%`}} aria-hidden="true"/></li>)}
    {celdas.otros>0&&<li><span>Otros (menos de 5 cada uno)</span><b>{num(celdas.otros)}</b><i style={{inlineSize:`${Math.max(4,(celdas.otros*100)/tope)}%`}} aria-hidden="true"/></li>}</ul></section>;
}
function Panel({e,total}:{e:EstadoMapa|null;total:number}){
 if(!e)return <aside className="mp-panel" aria-live="polite"><p className="fg-sm">Elige un estado del mapa para ver sus casos, motivos y retailers.</p></aside>;
 return <aside className="mp-panel" aria-live="polite" aria-label={`Detalle de ${e.nombre}`}>
  <p className="eyebrow">{e.pais==='US'?'Estados Unidos':'México'}</p>
  <p className="mp-panel-t">{e.nombre}</p>
  <p className="mp-panel-n"><b>{num(e.n)}</b> {e.n===1?'caso':'casos'} <span>· {pctTxt(total>0?Math.round((e.n*1000)/total)/10:null)} de los casos con estado</span></p>
  <Lista titulo="Tipo de caso" celdas={e.tipos}/><Lista titulo="Motivo" celdas={e.motivos}/><Lista titulo="Retailer" celdas={e.retailers}/>
  <p className="fg-sm">Casos = filas del Tracker. Las categorías con menos de 5 casos se agrupan para proteger la privacidad.</p>
 </aside>;
}

/** Pantalla «Mapa de problemas» (/map): casos por estado, provisional desde el Tracker. Honesta: cobertura a la vista, sin direcciones ni ciudades. */
export function MapaPantalla({organization}:{organization?:string}){
 const f=useVista<MapaVista>('/api/map',forma);
 const [pais,setPais]=useState<'US'|'MX'>('US'),[sel,setSel]=useState<string|null>(null);
 const v=f.data;
 const estados=useMemo(()=>v?.estados??[],[v]);
 const delPais=useMemo(()=>estados.filter(e=>e.pais===pais),[estados,pais]);
 const datos=useMemo(()=>new Map<string,Mosaico>(delPais.map(e=>[e.clave,{clave:e.clave,nombre:e.nombre,n:e.n}])),[delPais]);
 const max=Math.max(0,...delPais.map(e=>e.n));
 const totalPais=delPais.reduce((a,e)=>a+e.n,0);
 const actual=delPais.find(e=>e.clave===sel)??delPais[0]??null;
 const elegir=(c:string)=>setSel(c);
 const cambiar=(p:'US'|'MX')=>{setPais(p);setSel(null);};
 const lim=limitesRampa(max);
 const tabla=filasTabla(delPais,totalPais);
 return <div className="task-page stack mp-page">
  <PageHeader eyebrow="Operación" title="Mapa de problemas" description={<>En qué estados se concentran los casos de posventa, con qué motivo y en qué retailer.{organization?` ${organization}.`:''}</>}
   actions={<Button icon={<Refresh/>} onClick={()=>f.reload()} loading={f.busy&&!!v}>Actualizar</Button>}/>
  {!v&&f.busy&&<section className="card"><Esqueleto segundos={f.segundos}/></section>}
  {!v&&!f.busy&&f.error&&<EmptyState art="shield" tone="warn" title={f.error.code==='acceso'?'Tu rol no tiene acceso a este panel':'No disponible ahora'} body={f.error.texto} action={f.error.code==='acceso'?undefined:<Button icon={<Refresh/>} onClick={()=>f.reload()}>Reintentar</Button>}/>}
  {v&&<>
   <p className="mp-prov" role="note"><Icon name="info" size={16}/><span><b>Provisional.</b> Fuente: el Tracker de Excel, no todos los tickets ni todos los pedidos. {MENSAJE_COMPLETO}</span></p>
   <Seccion id="mp-mapa" titulo="Casos por estado" kind="observed" intro="Cada mosaico es un estado; el número es la cantidad de casos del Tracker. Es un cartograma: todos los estados pesan igual, no es un mapa a escala.">
    {v.status==='unavailable'?<NoDisponible onRetry={()=>f.reload()}/>
     :v.status==='empty'||!v.cobertura?<Vacio>Todavía no hay direcciones interpretables en el Tracker. {MENSAJE_COMPLETO}</Vacio>
     :<>
      <div className="mp-barra">
       <div className="mp-seg" role="group" aria-label="País">
        {(['US','MX'] as const).map(p=><button key={p} type="button" aria-pressed={pais===p} onClick={()=>cambiar(p)}>{p==='US'?'Estados Unidos':'México'}<small>{num(v.cobertura!.pais[p])}</small></button>)}
       </div>
       <ol className="mp-leyenda" aria-label="Leyenda de la escala de casos">
        {lim.length===0?<li>Sin casos visibles</li>:lim.map(l=><li key={l.paso}><i data-paso={l.paso} aria-hidden="true"/>{l.desde===l.hasta?num(l.desde):`${num(l.desde)}–${num(l.hasta)}`}</li>)}
        <li><i data-paso="0" aria-hidden="true"/>Sin casos visibles</li>
       </ol>
      </div>
      {delPais.length===0?<Vacio>No hay estados de {pais==='US'?'Estados Unidos':'México'} con 5 casos o más.</Vacio>
       :<div className="mp-cuerpo">
         <div className="mp-mapa-col">
          <MapaCuadricula pais={pais} datos={datos} max={max} seleccion={actual?.clave??null} onElegir={elegir} etiqueta={`Mapa de casos por estado de ${pais==='US'?'Estados Unidos':'México'}`}/>
         </div>
         <Panel e={actual} total={totalPais}/>
        </div>}
      {textoOcultos(v.ocultos)&&<p className="fg-sm">{textoOcultos(v.ocultos)}</p>}
     </>}
   </Seccion>

   <Seccion id="mp-cobertura" titulo="Cobertura de la dirección" kind="observed" intro="Qué parte del Tracker permite ubicar un caso. Lo demás no se estima: simplemente no está en el mapa.">
    {v.status==='unavailable'||!v.cobertura?<NoDisponible onRetry={()=>f.reload()}/>:<>
     <p className="mp-big" aria-label={textoCobertura(v.cobertura)}>{num(v.cobertura.interpretables)}<small>de {num(v.cobertura.filas)} filas del Tracker traen dirección interpretable ({pctTxt(v.cobertura.pctInterpretablesDeFilas)})</small></p>
     <div className="mp-cob" role="img" aria-label={`${num(v.cobertura.interpretables)} filas interpretables, ${num(v.cobertura.conDireccion-v.cobertura.interpretables)} con dirección no interpretable, ${num(v.cobertura.filas-v.cobertura.conDireccion)} sin dirección`}>
      <i style={{inlineSize:`${(v.cobertura.interpretables*100)/Math.max(1,v.cobertura.filas)}%`}} data-t="ok"/><i style={{inlineSize:`${((v.cobertura.conDireccion-v.cobertura.interpretables)*100)/Math.max(1,v.cobertura.filas)}%`}} data-t="mal"/>
     </div>
     <ul className="mp-cob-l"><li><b>{num(v.cobertura.interpretables)}</b> con estado leído</li><li><b>{num(v.cobertura.conDireccion-v.cobertura.interpretables)}</b> con dirección que no se pudo leer</li><li><b>{num(v.cobertura.filas-v.cobertura.conDireccion)}</b> sin dirección</li></ul>
     <p className="fg-sm">{textoCobertura(v.cobertura)}</p></>}
   </Seccion>

   {v.status==='ok'&&tabla.length>0&&<details className="card mp-tabla-det" open>
    <summary><Icon name="list" size={16}/> Tabla equivalente del mapa ({pais==='US'?'Estados Unidos':'México'})</summary>
    <div className="fg-tabla-wrap" tabIndex={0} role="region" aria-label="Tabla de casos por estado">
     <table className="fg-tabla" aria-label={`Casos por estado, ${pais==='US'?'Estados Unidos':'México'}`}>
      <thead><tr><th scope="col">Estado</th><th scope="col" className="fg-r">Casos</th><th scope="col" className="fg-r">% de los casos con estado</th></tr></thead>
      <tbody>{tabla.map(r=><tr key={r.clave}><th scope="row">{r.estado}</th><td className="fg-r">{num(r.casos)}</td><td className="fg-r">{pctTxt(r.pct)}</td></tr>)}</tbody>
     </table>
    </div>
   </details>}

   <Seccion id="mp-quejas" titulo="Quejas por cada 100 pedidos" intro="La medida que sí permite comparar estados: cuántos pedidos terminan en queja, no cuántos casos hay.">
    <EmptyState art="plug" compact title="No disponible" body={<>Se necesita el estado de envío de cada pedido y las conversaciones asociadas. {MENSAJE_COMPLETO} El cálculo ya está listo y se enciende solo cuando existan pedidos con estado.</>}
     action={<LinkButton href="/connections" variant="secondary" size="sm" icon={<Arrow/>}>Ver fuentes conectadas</LinkButton>}/>
   </Seccion>

   <details className="card fg-como">
    <summary><Icon name="info" size={16}/> Cómo se calculó</summary>
    <ul>
     <li>Fuente: las hojas del Tracker de Excel que tienen columna de dirección (última versión de cada fila; se excluyen las hojas espejo WTR y WPR para no duplicar). Cada fila cuenta como un caso; un mismo cliente puede aparecer en más de una hoja.</li>
     <li>El estado se lee de la dirección en memoria y el texto se descarta: la aplicación no guarda ni muestra direcciones, calles, nombres ni ciudades. Orden de lectura: nombre del estado, abreviatura con código postal, código postal de EE. UU. (tabla ZIP) y, si la dirección dice México, código postal de México (tabla SEPOMEX). Es una lectura aproximada: algunos códigos fronterizos pueden caer en el estado vecino.</li>
     <li>Privacidad: solo se muestran estados con 5 casos o más y desgloses con 5 o más; lo demás se agrupa. Si un grupo «Otros» quedaría con menos de 5, se une al desglose más pequeño para que no pueda restarse.</li>
     <li>No es una tasa: más casos en un estado puede ser más ventas ahí. Para comparar estados hacen falta pedidos con estado de envío (Amazon, Walmart y Shopify conectados).</li>
     <li>Consulta del {v.generatedAt.slice(0,10)}. Cifras observadas, provisionales.</li>
    </ul>
   </details>
  </>}
 </div>;
}
