'use client';
// Piezas de la pantalla /setup (Configuración): solo lectura, sin estilos en línea, sin estado propio salvo el botón de copiar.
// Se pueden renderizar solas (pruebas de marcado por rol): reciben la lista ya calculada por calcularAsistente().
import {useState} from 'react';
import Link from '../workspace/navigation-lifecycle';
import type {Clave,Traductor} from '../../lib/i18n';
import type {Role} from '@vexa/platform/capabilities';
import type {ItemAsistente,DatosHoja,Conciliacion} from '../../lib/onboarding/asistente.mjs';
import type {Pista} from '../../lib/onboarding/catalogo.mjs';
import {PageHeader} from '../ui/page-header';
import {AvisoSoporte} from './checklist';
import './onboarding.css';
import './setup.css';

const txt=(t:Traductor,k:string,v?:Record<string,string|number>)=>t(k as Clave,v);
/** Lista de roles legible en el idioma activo («Analista o Administrador del espacio»). */
export function listaDeRoles(t:Traductor,roles:readonly Role[],locale:string):string{
 const nombres=roles.map(r=>t(('shell.rol.'+r) as Clave));
 try{return new Intl.ListFormat(locale,{style:'long',type:'disjunction'}).format(nombres);}catch{return nombres.join(' / ');}
}
/** Etiqueta del estado de un paso. «otro» y «desconocido» son propios de /setup; el resto reutiliza las del checklist. */
export const etiquetaEstado=(t:Traductor,estado:string)=>estado==='otro'?t('onb.setup.estado.otro'):estado==='desconocido'?t('onb.setup.estado.desconocido'):txt(t,'onb.check.estado.'+estado);

/** Texto plano de la hoja para soporte: nunca lleva un secreto; el token se entrega por otro canal. */
export function textoHoja(t:Traductor,h:DatosHoja):string{
 return [
  t('onb.setup.hoja.titulo'),
  `${t('onb.setup.hoja.proveedor')}: ${h.proveedor}`,
  `${t('onb.setup.hoja.organizacion')}: ${h.organizacion} (${h.tenantId})`,
  `${t('onb.setup.hoja.cuenta')}: ${h.cuenta??t('onb.setup.hoja.cuentaPendiente')}`,
  `${t('onb.setup.hoja.credencial')}: ${h.credencial}`,
  `${t('onb.setup.hoja.permisos')}: ${h.permisos.join(', ')}`,
  `${t('onb.setup.hoja.permisosOpcionales')}: ${h.opcionales.join(', ')}`,
  t('onb.setup.hoja.nota'),
 ].join('\n');
}
/** «Copiar hoja para soporte» (paso mixto del CRM). Sin «Probar ahora»: probar la conexión exige rotar la credencial. El texto queda visible por si el portapapeles no está disponible. */
export function CopiarHoja({t,hoja}:{t:Traductor;hoja:DatosHoja}){
 const [estado,setEstado]=useState<'' | 'ok' | 'fallo'>('');
 const texto=textoHoja(t,hoja);
 async function copiar(){
  try{await navigator.clipboard.writeText(texto);setEstado('ok');}catch{setEstado('fallo');}
 }
 return <div className="setup-hoja">
  <button type="button" className="onb-btn-sec" onClick={copiar}>{t('onb.setup.hoja.boton')}</button>
  <span className="setup-hoja-estado" role="status">{estado==='ok'?t('onb.setup.hoja.copiada'):estado==='fallo'?t('onb.setup.hoja.fallo'):''}</span>
  <details><summary>{t('onb.setup.hoja.resumen')}</summary><pre className="setup-hoja-texto" tabIndex={0}>{texto}</pre></details>
 </div>;
}

/** Indicador «pedidos ligados a un cliente»: con su base si hay una verificable; si no, «pendiente de conciliación» sin cifra. Nunca un porcentaje inventado. */
export function IndicadorConciliacion({t,c,fecha,formato}:{t:Traductor;c:Conciliacion;fecha:string|null;formato:(n:number)=>string}){
 const principal=c.tipo==='base'?t('onb.setup.conc.base',{ligados:formato(c.ligados??0),total:formato(c.total??0)})
  :c.tipo==='hay_ligas'?t('onb.setup.conc.hayLigas'):c.tipo==='sin_pedidos'?t('onb.setup.conc.sinPedidos'):c.tipo==='sin_resumen'?t('onb.setup.conc.sinResumen'):t('onb.setup.conc.pendiente');
 return <section className="setup-conc" aria-labelledby="setup-conc-titulo" data-tipo={c.tipo}>
  <h2 id="setup-conc-titulo">{t('onb.setup.conc.titulo')}</h2>
  <p className="setup-conc-cifra">{principal}</p>
  {(c.tipo==='base'||c.tipo==='hay_ligas')&&<p>{t('onb.setup.conc.pendiente')}</p>}
  {fecha&&<p className="setup-nota">{t('onb.setup.conc.fecha',{fecha})}</p>}
  <p className="setup-nota">{t('onb.setup.conc.nota')}</p>
 </section>;
}

export interface PropsLista{t:Traductor;locale:string;items:ItemAsistente[];siguiente:string|null;hoja:DatosHoja|null;soloLectura?:boolean}
/** Lista ordenada de pasos. Un paso con enlace solo aparece si el rol puede ejecutarlo; si no puede, dice a quién pedirlo. */
export function ListaPasos({t,locale,items,siguiente,hoja,soloLectura=false}:PropsLista){
 return <ol className="setup-lista" aria-label={t('onb.setup.listaAria')}>
  {items.map((i,n)=>{
   const idT=`setup-paso-${n}`;
   const quien=i.quien.length>=4?t('onb.setup.quienCualquiera'):listaDeRoles(t,i.quien,locale);
   return <li key={i.id} className="setup-paso" data-estado={i.estado} data-siguiente={siguiente===i.id||undefined} aria-labelledby={idT}>
    <div className="setup-paso-cab"><h3 id={idT}>{txt(t,i.textos.titulo)}</h3><span className="onb-estado">{etiquetaEstado(t,i.estado)}</span></div>
    <p className="setup-meta">{t('onb.setup.tiempo',{min:i.min})}{' · '}{t('onb.setup.quien',{quien})}</p>
    <p className="setup-pide"><span className="setup-rotulo">{t('onb.setup.pide')}</span>{' '}{txt(t,i.textos.cuerpo)}</p>
    {i.mixto&&<p className="setup-nota">{t('onb.setup.mixto')}</p>}
    {i.esperaA&&<p className="setup-espera">{t('onb.ui.esperando',{quien:txt(t,i.esperaA)})}</p>}
    {i.nota&&<p className="setup-nota">{txt(t,i.nota)}</p>}
    {!i.puede&&<p className="setup-nota">{t('onb.setup.noPuedes',{quien:listaDeRoles(t,i.quien,locale)})}</p>}
    {siguiente===i.id&&<p><strong>{t('onb.check.siguiente')}</strong></p>}
    {i.puede&&i.mixto&&hoja&&!soloLectura&&<CopiarHoja t={t} hoja={hoja}/>}
    {i.puede&&i.href&&!soloLectura&&<p className="setup-accion"><Link href={i.href} className="onb-enlace">{t('onb.setup.irAHacerlo')}<span className="sr-only">{': '}{txt(t,i.textos.titulo)}</span></Link></p>}
   </li>;
  })}
 </ol>;
}

export interface PropsVista{t:Traductor;locale:string;pista:Pista|null;rolEtiqueta:string;soporteTerminado:boolean;cargando:boolean;errorDeLectura:boolean;
 lista:{items:ItemAsistente[];progreso:{hechos:number;total:number};siguiente:string|null}|null;conciliacion:Conciliacion|null;fechaResumen:string|null;hoja:DatosHoja|null}
/** Pantalla completa a partir de datos ya resueltos. Soporte («Ver como») y las vistas sin pista solo muestran un aviso: ningún paso, ningún enlace, ninguna lectura. */
export function SetupVista({t,locale,pista,rolEtiqueta,soporteTerminado,cargando,errorDeLectura,lista,conciliacion,fechaResumen,hoja}:PropsVista){
 const encabezado=<PageHeader title={t('onb.setup.titulo')} description={t('onb.setup.desc')}/>;
 const nf=new Intl.NumberFormat(locale);
 if(pista==='soporte'||soporteTerminado)return <section className="task-page stack setup-pantalla" aria-label={t('onb.setup.titulo')}>{encabezado}<AvisoSoporte/><p className="setup-aviso">{t('onb.setup.soporte')}</p></section>;
 if(!lista)return <section className="task-page stack setup-pantalla" aria-label={t('onb.setup.titulo')}>{encabezado}<p className="setup-aviso" role="note">{t('onb.setup.sinPista')}</p></section>;
 return <section className="task-page stack setup-pantalla" aria-label={t('onb.setup.titulo')} data-pista={pista??undefined} data-tour="setup">
  {encabezado}
  {rolEtiqueta&&<p className="setup-aviso" role="note">{t('onb.setup.rolActual',{rol:rolEtiqueta})}{pista==='lector'?' '+t('onb.setup.lector'):''}</p>}
  {cargando?<p role="status">{t('onb.check.cargando')}</p>:<>
   {errorDeLectura&&<p role="status">{t('onb.check.noDisponible')}</p>}
   {lista.progreso.total>0&&<div className="setup-progreso"><progress max={lista.progreso.total} value={lista.progreso.hechos} aria-label={t('onb.check.progreso',{hechos:lista.progreso.hechos,total:lista.progreso.total})}/><span>{t('onb.check.progreso',{hechos:lista.progreso.hechos,total:lista.progreso.total})}</span></div>}
   {conciliacion&&<IndicadorConciliacion t={t} c={conciliacion} fecha={fechaResumen} formato={n=>nf.format(n)}/>}
   <ListaPasos t={t} locale={locale} items={lista.items} siguiente={lista.siguiente} hoja={hoja}/>
  </>}
 </section>;
}
