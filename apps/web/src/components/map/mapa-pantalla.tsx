'use client';
import {ConMarca} from '../ui/brand-mark';
import {RovaqCargando} from '../rovaq-cargando';
import {useMemo,useState} from 'react';
import {useT} from '../i18n/proveedor';
import type {MapaVista,EstadoMapa,Celdas} from '../../../../../packages/workspace-service/mapa-problemas.mjs';
import {PageHeader} from '../ui/page-header';
import {Button,LinkButton,Refresh,Arrow} from '../ui/button';
import {EmptyState} from '../ui/empty-state';
import {Icon} from '../ui/icons';
import {NoDisponible,Seccion,Vacio} from '../refunds/fuga-partes';
import {KindBadge} from '../ui/kind-badge';
import {useVista} from './use-vista';
import {MapaGeo,type Mosaico} from './mapa-geo';
import {PAISES,filasTabla,limitesRampa,num,pctTxt} from './mapa-modelo.mjs';
import './mapa.css';

const forma=(d:unknown)=>typeof d==='object'&&d!==null&&'status' in d&&'provisional' in d;
function Esqueleto({}:{segundos:number}){
 const t=useT();
 return <RovaqCargando compacto mensaje={t('mapa.cargando')}/>;
}
function Lista({titulo,celdas,max=2}:{titulo:string;celdas:Celdas;max?:number}){
  const t=useT();
  if(celdas.ocultoTodo)return <section className="mp-lista"><h3>{titulo}</h3><p className="fg-sm">{t('mapa.sinDesglose')}</p></section>;
  const vis=celdas.items.slice(0,max),mas=celdas.items.length-vis.length+(celdas.otros>0?1:0);
  const tope=Math.max(1,...vis.map(i=>i.n));
  return <section className="mp-lista" aria-label={titulo}><h3>{titulo}{mas>0&&<small> · {t('mapa.mas',{n:mas})}</small>}</h3>
   <ul>{vis.map(i=><li key={i.etiqueta}><span><ConMarca marca={titulo===t('mapa.retailer')?i.etiqueta:null}>{i.etiqueta}</ConMarca></span><b>{num(i.n)}</b><i style={{inlineSize:`${Math.max(4,(i.n*100)/tope)}%`}} aria-hidden="true"/></li>)}</ul></section>;
}
/** Ranking de los estados con más casos: barras finas en el verde de Geografía; el elegido lleva marca roja. */
function Ranking({estados,sel,onElegir}:{estados:EstadoMapa[];sel:string|null;onElegir:(c:string)=>void;pais:'US'|'MX'}){
 const t=useT();
 const top=[...estados].sort((a,b)=>b.n-a.n).slice(0,8),tope=Math.max(1,top[0]?.n??1);
 return <section className="mp-rank" aria-label={t('mapa.rankAria',{n:top.length})}>
  <h3>{t('mapa.rankTitulo')}</h3>
  <ol>{top.map((e,i)=><li key={e.clave}><button type="button" aria-pressed={sel===e.clave} onClick={()=>onElegir(e.clave)}><em>{i+1}</em><span>{e.nombre}</span><i style={{'--w':`${Math.max(4,(e.n*100)/tope)}%`} as React.CSSProperties} aria-hidden="true"/><b>{num(e.n)}</b></button></li>)}</ol>
 </section>;
}
function Panel({e,total,estados,pais,sel,onElegir,ocultos}:{e:EstadoMapa|null;total:number;estados:EstadoMapa[];pais:'US'|'MX';sel:string|null;onElegir:(c:string)=>void;ocultos:string|null}){
 const t=useT();
 const d=e??[...estados].sort((a,b)=>b.n-a.n)[0]??null;
 return <aside className="mp-panel" aria-live="polite" aria-label={d?t('mapa.detalleDe',{nombre:d.nombre}):t('mapa.detalle')}><div className="mp-panel-in">
  <Ranking estados={estados} sel={sel} onElegir={onElegir} pais={pais}/>
  {d&&<div className="mp-det">
   <p className="eyebrow">{e?(d.pais==='US'?t('mapa.us'):t('mapa.mx')):t('mapa.mayor')}</p>
   <p className="mp-panel-t">{d.nombre}<span><b>{num(d.n)}</b> {d.n===1?t('mapa.caso'):t('mapa.casos')} · {t('mapa.pctConEstado',{pct:pctTxt(total>0?Math.round((d.n*1000)/total)/10:null)})}</span></p>
   <div className="mp-listas"><Lista titulo={t('mapa.tipo')} celdas={d.tipos}/><Lista titulo={t('mapa.motivo')} celdas={d.motivos}/><Lista titulo={t('mapa.retailer')} celdas={d.retailers}/></div>
  </div>}
  <p className="mp-pie">{t('mapa.pie')}{ocultos?` ${ocultos}`:''}</p>
 </div></aside>;
}

/** Pantalla «Mapa de problemas» (/map): casos por estado, provisional desde el Tracker. Honesta: cobertura a la vista, sin direcciones ni ciudades. */
export function MapaPantalla({organization}:{organization?:string}){
 const t=useT();
 const nombrePais=(p:'US'|'MX')=>p==='US'?t('mapa.us'):t('mapa.mx');
 const textoCobertura=(c:NonNullable<MapaVista['cobertura']>)=>t('mapa.cobTexto',{interp:num(c.interpretables),filas:num(c.filas),conDir:num(c.conDireccion),pct:pctTxt(c.pctInterpretablesDeDireccion)});
 const textoOcultos=(o:MapaVista['ocultos'])=>!o||!o.estados?null:t(o.estados===1?'mapa.ocultosUno':'mapa.ocultosVarios',{n:num(o.estados),min:o.minimo,casos:num(o.casos)});
 const f=useVista<MapaVista>('/api/map',forma);
 const [pais,setPais]=useState<'US'|'MX'>('US'),[sel,setSel]=useState<string|null>(null);
 const v=f.data;
 const estados=useMemo(()=>v?.estados??[],[v]);
 const delPais=useMemo(()=>estados.filter(e=>e.pais===pais),[estados,pais]);
 const datos=useMemo(()=>new Map<string,Mosaico>(delPais.map(e=>[e.clave,{clave:e.clave,nombre:e.nombre,n:e.n}])),[delPais]);
 const max=Math.max(0,...delPais.map(e=>e.n));
 const totalPais=delPais.reduce((a,e)=>a+e.n,0);
 const actual=delPais.find(e=>e.clave===sel)??null;
 const elegir=(c:string)=>setSel(c);
 const cambiar=(p:'US'|'MX')=>{setPais(p);setSel(null);};
 const lim=limitesRampa(max);
 const tabla=filasTabla(delPais,totalPais);
 if(!v&&f.busy)return <RovaqCargando mensaje=""/>;
 return <div className="task-page stack mp-page">
  <PageHeader eyebrow={t('mapa.eyebrow')} title={t('mapa.titulo')} description={<>{t('mapa.desc')}{organization?` ${organization}.`:''}</>}/>
  {!v&&f.busy&&<section className="card"><Esqueleto segundos={f.segundos}/></section>}
  {!v&&!f.busy&&f.error&&<EmptyState art="shield" tone="warn" title={f.error.code==='acceso'?t('vista.sinAcceso'):t('vista.noDisponible')} body={f.error.texto} action={f.error.code==='acceso'?undefined:<Button icon={<Refresh/>} onClick={()=>f.reload()}>{t('vista.reintentar')}</Button>}/>}
  {v&&<>
   <p className="mp-prov" role="note"><Icon name="info" size={16}/><span><b>{t('mapa.provisional')}</b> {t('mapa.notaProv')}</span></p>
   <section className="card mp-card" aria-labelledby="mp-mapa">
    {v.status==='unavailable'?<><h2 id="mp-mapa" className="mp-h2">{t('mapa.casosPorEstado')}</h2><NoDisponible onRetry={()=>f.reload()}/></>
     :v.status==='empty'||!v.cobertura?<><h2 id="mp-mapa" className="mp-h2">{t('mapa.casosPorEstado')}</h2><Vacio>{t('mapa.sinDirecciones')} {t('mapa.msgCompleto')}</Vacio></>
     :<>
      <div className="mp-barra">
       <h2 id="mp-mapa" className="mp-h2" title={t('mapa.casosPorEstadoTip')}>{t('mapa.casosPorEstado')}</h2>
       <div className="mp-seg" role="group" aria-label={t('mapa.pais')}>
        {(['US','MX'] as const).map(p=><button key={p} type="button" aria-pressed={pais===p} onClick={()=>cambiar(p)}>{nombrePais(p)}<small>{num(v.cobertura!.pais[p])}</small></button>)}
       </div>
       <p className="mp-ayuda">{t('mapa.ayudaZoom')}</p>
       <KindBadge kind="observed"/>
      </div>
      {delPais.length===0?<Vacio>{t('mapa.sinEstados',{pais:nombrePais(pais)})}</Vacio>
       :<div className="mp-cuerpo">
         <div className="mp-mapa-col">
          <MapaGeo pais={pais} datos={datos} max={max} total={totalPais} nombres={PAISES[pais].nombres} seleccion={actual?.clave??null} onElegir={elegir} etiqueta={t('mapa.mapaAria',{pais:nombrePais(pais)})}/>
          <ol className="mp-leyenda" aria-label={t('mapa.leyendaAria')}>
           {lim.map(l=><li key={l.paso}><i data-paso={l.paso} aria-hidden="true"/>{l.desde===l.hasta?num(l.desde):`${num(l.desde)}–${num(l.hasta)}`}</li>)}
           <li><i data-paso="0" aria-hidden="true"/>{t('mapa.sinDato')}</li>
           <li><i data-sel="1" aria-hidden="true"/>{t('mapa.elegido')}</li>
          </ol>
         </div>
         <Panel e={actual} total={totalPais} estados={delPais} pais={pais} sel={actual?.clave??null} onElegir={elegir} ocultos={textoOcultos(v.ocultos)}/>
        </div>}
     </>}
   </section>

   <div className="mp-dos">
   <Seccion id="mp-cobertura" titulo={t('mapa.cobTitulo')} kind="observed" intro={t('mapa.cobIntro')}>
    {v.status==='unavailable'||!v.cobertura?<NoDisponible onRetry={()=>f.reload()}/>:<>
     <p className="mp-big" aria-label={textoCobertura(v.cobertura)}>{num(v.cobertura.interpretables)}<small>{t('mapa.cobBig',{filas:num(v.cobertura.filas),pct:pctTxt(v.cobertura.pctInterpretablesDeFilas)})}</small></p>
     <div className="mp-cob" role="img" aria-label={t('mapa.cobAria',{a:num(v.cobertura.interpretables),b:num(v.cobertura.conDireccion-v.cobertura.interpretables),c:num(v.cobertura.filas-v.cobertura.conDireccion)})}>
      <i style={{inlineSize:`${(v.cobertura.interpretables*100)/Math.max(1,v.cobertura.filas)}%`}} data-t="ok"/><i style={{inlineSize:`${((v.cobertura.conDireccion-v.cobertura.interpretables)*100)/Math.max(1,v.cobertura.filas)}%`}} data-t="mal"/>
     </div>
     <ul className="mp-cob-l"><li><b>{num(v.cobertura.interpretables)}</b> {t('mapa.cobLeido')}</li><li><b>{num(v.cobertura.conDireccion-v.cobertura.interpretables)}</b> {t('mapa.cobIlegible')}</li><li><b>{num(v.cobertura.filas-v.cobertura.conDireccion)}</b> {t('mapa.cobSin')}</li></ul>
     <p className="fg-sm">{textoCobertura(v.cobertura)}</p></>}
   </Seccion>
   <Seccion id="mp-quejas" titulo={t('mapa.quejasTitulo')} intro={t('mapa.quejasIntro')}>
    <div className="mp-nd"><b>{t('mapa.noDisp')}</b><p>{t('mapa.quejasCuerpo')} {t('mapa.msgCompleto')} {t('mapa.quejasPie')}</p>
     <LinkButton href="/connections" variant="secondary" size="sm" icon={<Arrow/>}>{t('mapa.verFuentes')}</LinkButton></div>
   </Seccion>
   </div>

   {v.status==='ok'&&tabla.length>0&&<details className="card mp-tabla-det" open>
    <summary><Icon name="list" size={16}/> {t('mapa.tablaEq',{pais:nombrePais(pais)})}</summary>
    <div className="fg-tabla-wrap" tabIndex={0} role="region" aria-label={t('mapa.tablaRegion')}>
     <table className="fg-tabla" aria-label={t('mapa.tablaAria',{pais:nombrePais(pais)})}>
      <thead><tr><th scope="col">{t('mapa.thEstado')}</th><th scope="col" className="fg-r">{t('mapa.thCasos')}</th><th scope="col" className="fg-r">{t('mapa.thPct')}</th></tr></thead>
      <tbody>{tabla.map(r=><tr key={r.clave}><th scope="row">{r.estado}</th><td className="fg-r">{num(r.casos)}</td><td className="fg-r">{pctTxt(r.pct)}</td></tr>)}</tbody>
     </table>
    </div>
   </details>}


   <details className="card fg-como">
    <summary><Icon name="info" size={16}/> {t('mapa.como')}</summary>
    <ul>
     <li>{t('mapa.como1')}</li>
     <li>{t('mapa.como2')}</li>
     <li>{t('mapa.como3')}</li>
     <li>{t('mapa.como4')}</li>
     <li>{t('mapa.como5',{fecha:v.generatedAt.slice(0,10)})}</li>
    </ul>
   </details>
  </>}
 </div>;
}
