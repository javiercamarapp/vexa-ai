'use client';
import {useMemo,useState,type ReactNode} from 'react';
import {useIdioma,useT} from '../i18n/proveedor';
import {LOCALE_INTL,type Clave,type Traductor} from '../../lib/i18n';
import {numero} from '../../lib/i18n/formato';
import {StatusChip} from '../ui/status-chip';
import {Notice} from '../ui/notice';
import {SegmentedControl} from '../ui/segmented';
type Column<T>={key:string;header:ReactNode;render:(row:T)=>ReactNode;align?:'start'|'num'};
import '../confianza/confianza.css';
import type {Cobertura,Faltan,CardBase,TarjetaAv,TarjetaBv,TarjetaCv,TarjetaDv,TarjetaEv,TarjetaFv,CanalA,FilaSku,EstadoCco} from '../../../../../packages/workspace-service/cco.mjs';
import {mayor,mesTxt,diaTxt,selloCco,tonoDeEstado} from './cco-modelo.mjs';
import './cco.css';

/** Tabla del sistema (mismas clases que DataTable) sin atributos style: la altura no se limita porque cada tabla trae pocas filas. */
function DataTable<T>({columns,rows,rowKey,caption,empty}:{columns:Column<T>[];rows:T[];rowKey:(r:T)=>string;caption:string;maxHeight?:string;empty?:ReactNode}){
 if(!rows.length)return <>{empty}</>;
 return <div className="ui-table-wrap" tabIndex={0} role="region" aria-label={caption}>
  <table className="ui-table"><caption className="sr-only">{caption}</caption>
   <thead><tr>{columns.map(c=><th key={c.key} scope="col" data-align={c.align}>{c.header}</th>)}</tr></thead>
   <tbody>{rows.map(r=><tr key={rowKey(r)}>{columns.map(c=><td key={c.key} data-align={c.align}>{c.render(r)}</td>)}</tr>)}</tbody>
  </table></div>;
}
const NOMBRE_CANAL:Record<string,string>={amazon:'Amazon',walmart:'Walmart',bestbuy:'Best Buy',shopify:'Shopify'};
const CLAVE_LAT=['menos_de_1_dia','1_dia','2_dias','3_o_mas_dias','sin_dato'] as const;
const k=(x:string)=>x as Clave;

/** Un valor desconocido se dice «Sin dato» (con su explicación); nunca se pinta como 0. */
export function SinDato(){const t=useT();return <span className="cco-nd" title={t('cco.ndTip')}>{t('cco.nd')}</span>;}
function Oculto({n=5}:{n?:number}){const t=useT();return <span className="cco-nd" title={t('cco.menosDeTip')}>{t('cco.menosDe',{n})}</span>;}

function Insignia({estado}:{estado:EstadoCco}){
 const t=useT();
 return <StatusChip tone={tonoDeEstado(estado)} title={t(k(`cco.estado.${estado}Tip`))}>{t(k(`cco.estado.${estado}`))}</StatusChip>;
}
function Cob({c}:{c:Cobertura}){
 const t=useT(),idioma=useIdioma();
 return <li>{t(k(`cco.cob.${c.clave}`),{pct:c.pct===null||c.pct===undefined?'—':numero(idioma,c.pct,{maximumFractionDigits:1}),conocido:numero(idioma,c.conocido),elegible:c.elegible===null?'—':numero(idioma,c.elegible)})}</li>;
}
function Faltan({items}:{items:Faltan[]}){
 const t=useT();
 if(!items.length)return null;
 return <section className="cco-bloque" aria-label={t('cco.faltaTitulo')}><h3>{t('cco.faltaTitulo')}</h3>
  <ul className="cco-faltan">{items.map(x=><li key={x.clave+x.quien}><span>{t(k(`cco.falta.${x.clave}`))}</span><b className="cco-quien" data-quien={x.quien}>{t(k(`cco.pedirA.${x.quien}`))}</b></li>)}</ul></section>;
}
function Salvedades({ids,minimo}:{ids:string[];minimo:number}){
 const t=useT();
 if(!ids.length)return null;
 return <section className="cco-bloque" aria-label={t('cco.salvTitulo')}><h3>{t('cco.salvTitulo')}</h3><ul className="cco-lista">{ids.map(x=><li key={x}>{t(k(`cco.salv.${x}`),{n:minimo})}</li>)}</ul></section>;
}
/** Marco común de las seis tarjetas: letra, pregunta, insignia, lo que sí hay, cuerpo, sello, salvedades y lo que falta. */
export function Marco({card,minimo,consultado,children}:{card:CardBase;minimo:number;consultado:string;children?:ReactNode}){
 const t=useT(),idioma=useIdioma(),locale=LOCALE_INTL[idioma],id=card.id;
 const sello=card.clase&&card.fuente&&card.estado!=='falta'?selloCco(t,locale,{clase:card.clase,fuente:card.fuente,corte:card.corte,consultado}):null;
 return <section className="card cco-card" aria-labelledby={`cco-${id}`} data-estado={card.estado}>
  <header className="cco-head"><span className="cco-letra" aria-hidden="true">{id}</span>
   <div className="cco-head-t"><h2 id={`cco-${id}`}>{t(k(`cco.${id}.titulo`))}</h2><p className="cco-pregunta">{t(k(`cco.${id}.pregunta`))}</p></div>
   <Insignia estado={card.estado}/></header>
  <div className="cco-bloque"><h3>{t('cco.hoy')}</h3><p className="cco-hoy">{t(k(`cco.${id}.hoy`))}</p></div>
  {card.indisponible&&<Notice tone="warn">{t(card.indisponible==='not_installed'?'cco.noInstalado.cuerpo':'cco.noDisp')}</Notice>}
  {children}
  {card.cobertura&&card.cobertura.length>0&&<ul className="cco-cob">{card.cobertura.map(c=><Cob key={c.clave} c={c}/>)}</ul>}
  {sello&&<ul className="sello" data-clase={sello.clase} title={sello.texto} aria-label={t('conf.procedencia',{texto:sello.texto})}><li className="sello-clase">{sello.claseTxt}</li><li>{sello.fuente}</li><li>{sello.hasta}</li>{sello.actualizado&&<li>{sello.actualizado}</li>}</ul>}
  <Salvedades ids={card.salvedades} minimo={minimo}/>
  <Faltan items={card.faltan}/>
 </section>;
}

// ---- A: rendimiento por SKU, dentro de la ventana común del canal ----
function TablaSkus({canal,moneda,trackerOk}:{canal:CanalA;moneda:CanalA['monedas'][number];trackerOk:boolean}){
 const t=useT(),idioma=useIdioma(),locale=LOCALE_INTL[idioma];
 const dinero=(minor:string|null,exp:number)=>{const v=mayor(minor,exp);return v===null?<SinDato/>:new Intl.NumberFormat(locale,{style:'currency',currency:moneda.moneda,maximumFractionDigits:exp>0?2:0}).format(v);};
 const cols:Column<FilaSku>[]=[
  {key:'sku',header:t('cco.th.sku'),render:r=><code>{r.sku}</code>},
  {key:'lin',header:t('cco.th.lineas'),align:'num',render:r=>numero(idioma,r.lineas)},
  {key:'bru',header:t('cco.th.bruto'),align:'num',render:r=>dinero(r.brutoMinor,r.exponente)},
  {key:'ref',header:t('cco.th.reembolsos'),align:'num',render:r=>r.reembolsos===null?<SinDato/>:<>{numero(idioma,r.reembolsos)}{r.reembolsosSinImporte?<small className="cco-sub"> {t('cco.reembSinImporte',{n:numero(idioma,r.reembolsosSinImporte)})}</small>:null}</>},
  {key:'pc',header:t('cco.th.porCien'),align:'num',render:r=>r.porCien===null?<SinDato/>:numero(idioma,r.porCien,{maximumFractionDigits:1})},
  {key:'imp',header:t('cco.th.importeReemb'),align:'num',render:r=>r.reembolsos===null?<SinDato/>:dinero(r.reembolsoMinor,r.exponente)},
  {key:'def',header:t('cco.th.defectos'),align:'num',render:r=>r.defectos===null?(trackerOk?<Oculto/>:<SinDato/>):numero(idioma,r.defectos)},
 ];
 return <DataTable columns={cols} rows={moneda.top} rowKey={r=>canal.canal+moneda.moneda+r.sku} caption={`${NOMBRE_CANAL[canal.canal]??canal.canal} ${moneda.moneda}`} maxHeight="none" empty={<p className="cco-vacio">{t('cco.sinFilas')}</p>}/>;
}
export function TarjetaA({card,minimo,consultado}:{card:TarjetaAv;minimo:number;consultado:string}){
 const t=useT(),idioma=useIdioma(),locale=LOCALE_INTL[idioma];
 const [sel,setSel]=useState<string|null>(null);
 const canal=card.canales.find(c=>c.canal===sel)??card.canales[0];
 const ventana=(c:CanalA)=>({canal:NOMBRE_CANAL[c.canal]??c.canal,desde:mesTxt(c.ventana.desde,locale)??'—',fin:mesTxt(c.ventana.hasta,locale)??'—',meses:numero(idioma,c.ventana.meses)});
 const opciones=useMemo(()=>card.canales.map(c=>({value:c.canal,label:NOMBRE_CANAL[c.canal]??c.canal})),[card.canales]);
 return <Marco card={card} minimo={minimo} consultado={consultado}>
  {canal&&<div className="cco-bloque">
   {card.canales.length>1&&<SegmentedControl options={opciones} value={canal.canal} onChange={setSel} label={t('cco.canalAria')} size="sm"/>}
   <p className="cco-ventana">{t('cco.ventana',ventana(canal))}</p>
   {!canal.devolucionesDisponibles&&<Notice tone="info">{t('cco.devNoDisp')}</Notice>}
   {canal.monedas.length===0&&<p className="cco-vacio">{t('cco.sinFilas')}</p>}
   {canal.monedas.map(m=><div key={m.moneda} className="cco-tabla"><p className="cco-moneda">{t('cco.moneda',{moneda:m.moneda})}</p><TablaSkus canal={canal} moneda={m} trackerOk={card.trackerDisponible!==false}/></div>)}
  </div>}
  {card.ventanasDistintas&&<p className="cco-nota">{t('cco.ventanasDistintas')}</p>}
  {card.sinVentana&&card.sinVentana.length>0&&<p className="cco-nota">{t('cco.sinVentana',{canales:card.sinVentana.map(c=>NOMBRE_CANAL[c]??c).join(', ')})}</p>}
 </Marco>;
}

// ---- B: SKU sin venta reciente (inferido) ----
export function TarjetaB({card,minimo,consultado}:{card:TarjetaBv;minimo:number;consultado:string}){
 const t=useT(),idioma=useIdioma(),locale=LOCALE_INTL[idioma];
 const [meses,setMeses]=useState<3|6|9>(3);
 const filas=Array.isArray(card.top)?[]:card.top[String(meses) as '3'|'6'|'9'];
 const um=card.umbrales.find(u=>u.meses===meses);
 const cols:Column<(typeof filas)[number]>[]=[
  {key:'sku',header:t('cco.th.sku'),render:r=><code>{r.sku}</code>},
  {key:'ult',header:t('cco.th.ultimoMes'),render:r=>mesTxt(r.ultimoMes,locale)??<SinDato/>},
  {key:'ms',header:t('cco.th.mesesSin'),align:'num',render:r=>numero(idioma,r.mesesSinVenta)},
  {key:'l9',header:t('cco.th.lineas9'),align:'num',render:r=>numero(idioma,r.lineas9m)},
  {key:'ch',header:t('cco.th.canales'),render:r=>r.canales.map(c=>NOMBRE_CANAL[c]??c).join(', ')},
 ];
 return <Marco card={card} minimo={minimo} consultado={consultado}>
  {card.umbrales.length>0&&<div className="cco-bloque">
   <SegmentedControl options={card.umbrales.map(u=>({value:String(u.meses),label:t('cco.B.umbral',{n:numero(idioma,u.meses)}),count:u.skus}))} value={String(meses)} onChange={v=>setMeses(Number(v) as 3|6|9)} label={t('cco.B.umbralAria')} size="sm"/>
   <p className="cco-ventana">{t('cco.B.resumen',{sin:numero(idioma,um?.skus??0),total:numero(idioma,card.total??0),n:numero(idioma,meses),mes:mesTxt(card.referencia,locale)??'—'})}</p>
   <DataTable columns={cols} rows={filas} rowKey={r=>r.sku} caption={t('cco.B.titulo')} maxHeight="none" empty={<p className="cco-vacio">{t('cco.B.sinFilas')}</p>}/>
  </div>}
 </Marco>;
}

// ---- C: bodegas, latencia de despacho ----
export function TarjetaC({card,minimo,consultado}:{card:TarjetaCv;minimo:number;consultado:string}){
 const t=useT(),idioma=useIdioma();
 const cols:Column<TarjetaCv['bodegas'][number]>[]=[
  {key:'b',header:t('cco.th.bodega'),render:r=>r.bodega},
  ...CLAVE_LAT.map(l=>({key:l,header:t(k(`cco.lat.${l}`)),align:'num' as const,render:(r:TarjetaCv['bodegas'][number])=>r.latencia[l]===undefined?<Oculto n={minimo}/>:numero(idioma,r.latencia[l])})),
 ];
 return <Marco card={card} minimo={minimo} consultado={consultado}>
  {card.bodegas.length>0?<div className="cco-bloque"><DataTable columns={cols} rows={card.bodegas} rowKey={r=>r.bodega} caption={t('cco.C.titulo')} maxHeight="none"/>
   {!!card.ocultos&&<p className="cco-nota">{t('cco.C.ocultos',{n:numero(idioma,card.ocultos)})}</p>}</div>
   :<p className="cco-vacio">{t('cco.C.sinCeldas')}</p>}
 </Marco>;
}

// ---- D: casos por estado ----
export function TarjetaD({card,minimo,consultado}:{card:TarjetaDv;minimo:number;consultado:string}){
 const t=useT(),idioma=useIdioma();
 const cols:Column<TarjetaDv['estados'][number]>[]=[
  {key:'e',header:t('cco.th.estado'),render:r=>`${r.nombre} · ${r.pais}`},
  {key:'n',header:t('cco.th.casos'),align:'num',render:r=>numero(idioma,r.n)},
  {key:'t',header:t('cco.th.tipo'),render:r=>r.tipos[0]?`${r.tipos[0].etiqueta}`:<Oculto n={minimo}/>},
  {key:'r',header:t('cco.th.retailer'),render:r=>r.retailers[0]?`${r.retailers[0].etiqueta}`:<Oculto n={minimo}/>},
 ];
 return <Marco card={card} minimo={minimo} consultado={consultado}>
  {card.estados.length>0?<div className="cco-bloque"><DataTable columns={cols} rows={card.estados} rowKey={r=>r.clave} caption={t('cco.D.titulo')} maxHeight="none"/>
   {card.pais&&<p className="cco-nota">{t('cco.D.casosPais',{us:numero(idioma,card.pais.US),mx:numero(idioma,card.pais.MX)})}</p>}
   {card.ocultos&&card.ocultos.estados>0&&<p className="cco-nota">{t('cco.D.ocultos',{estados:numero(idioma,card.ocultos.estados),min:numero(idioma,card.ocultos.minimo),casos:numero(idioma,card.ocultos.casos)})}</p>}</div>
   :<p className="cco-vacio">{t('cco.D.sinEstados')}</p>}
 </Marco>;
}

// ---- E: casos del Tracker por subcanal (parcial y con sesgo) ----
export function TarjetaE({card,minimo,consultado}:{card:TarjetaEv;minimo:number;consultado:string}){
 const t=useT(),idioma=useIdioma();
 const cols:Column<TarjetaEv['subcanales'][number]>[]=[{key:'s',header:t('cco.th.subcanal'),render:r=>t(k(`cco.sub.${r.subcanal}`))},{key:'n',header:t('cco.th.casos'),align:'num',render:r=>numero(idioma,r.n)}];
 return <Marco card={card} minimo={minimo} consultado={consultado}>
  <div className="cco-bloque"><h3>{t('cco.E.subtitulo')}</h3>
   <DataTable columns={cols} rows={card.subcanales} rowKey={r=>r.subcanal} caption={t('cco.E.subtitulo')} maxHeight="none" empty={<p className="cco-vacio">{t('cco.E.sinFilas')}</p>}/></div>
 </Marco>;
}

// ---- F: siempre sin dato ----
export function TarjetaF({card,minimo,consultado}:{card:TarjetaFv;minimo:number;consultado:string}){
 const t=useT();
 return <Marco card={card} minimo={minimo} consultado={consultado}><Notice tone="info">{t('cco.F.nodata')}</Notice></Marco>;
}
export type {Traductor};
export {diaTxt};
