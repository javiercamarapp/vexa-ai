'use client';
import {useEffect,useRef,useState} from 'react';
import type {Recommendation} from '../../../../../packages/recommendations/index.mjs';
import {generarBorradores,type Archivo,type BorradorEntrada} from '../../../../../packages/recommendations/borradores.mjs';
import {Drawer} from '../ui/overlay';
import {Button} from '../ui/button';
import {Icon} from '../ui/icons';
import {StatusChip} from '../ui/status-chip';
import {etiquetaCategoria} from '../../lib/legibilidad/categorias.mjs';
import {endpointFuga} from '../refunds/use-fuga';
import {persona,type Miembro,type FlowItem} from './flujo-vista';
import css from './flujo.module.css';

type Estado={fase:'cargando'}|{fase:'listo';tipo:string;archivos:Archivo[];avisos:string[]}|{fase:'error';texto:string};
type SkuFila={sku:string;n:number;usdBrutoMinor:string|null;canales:{canal:string;n:number;usdBrutoMinor:string|null}[]};
function descargar(a:Archivo){const url=URL.createObjectURL(new Blob([a.contenido],{type:a.mime}));const el=document.createElement('a');el.href=url;el.download=a.nombre;document.body.appendChild(el);el.click();el.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
/**
 * Borradores de la acción. Se generan EN EL NAVEGADOR con lo que la pantalla ya tiene (citas verificadas y enmascaradas + SKUs del libro de reembolsos).
 * No se envía nada: el humano los revisa, los descarga y los envía por su cuenta.
 */
export function BorradoresDrawer({open,onClose,item,miembros}:{open:boolean;onClose:()=>void;item:FlowItem;miembros:Miembro[]}){
 const [estado,setEstado]=useState<Estado|null>(null),[vista,setVista]=useState<string|null>(null),hecho=useRef(false);
 const apr=item.flow?.events.find(e=>e.kind==='approved');
 useEffect(()=>{
  if(!open||hecho.current)return;hecho.current=true;setEstado({fase:'cargando'});const abort=new AbortController();
  void (async()=>{
   let citas:BorradorEntrada['citas']=[],skus:BorradorEntrada['skus']=[];const avisos:string[]=[];
   try{const r=await fetch('/api/recommendations/'+item.id,{cache:'no-store',signal:abort.signal});if(r.ok){const j=await r.json();citas=(j.data?.evidenceRefs??[]).slice(0,3).map((e:{role:string;category:string;quote:string})=>({role:e.role,category:e.category,quote:e.quote}));}else avisos.push('No se pudieron verificar las citas: el borrador sale sin ejemplos.');}catch{if(abort.signal.aborted)return;avisos.push('No se pudieron verificar las citas: el borrador sale sin ejemplos.');}
   try{const r=await fetch(endpointFuga(new URLSearchParams({date_start:item.scope.date_start,date_end:item.scope.date_end})),{cache:'no-store',signal:abort.signal});if(r.ok){const j=await r.json();const top=(j.data?.skus?.top??[]) as SkuFila[];skus=top.slice(0,15).flatMap(s=>(s.canales??[]).filter(c=>c.canal==='walmart'||c.canal==='amazon').map(c=>({sku:s.sku,canal:c.canal,n:c.n,usdBrutoMinor:c.usdBrutoMinor})));}else avisos.push(r.status===403||r.status===401?'Tu rol no puede ver los SKUs del libro de reembolsos: las listas por canal no se generaron.':'No se pudieron leer los SKUs del libro de reembolsos ahora; las listas por canal no se generaron.');}catch{if(abort.signal.aborted)return;avisos.push('No se pudieron leer los SKUs del libro de reembolsos ahora; las listas por canal no se generaron.');}
   if(abort.signal.aborted)return;
   try{const r=generarBorradores({item,responsableNombre:persona(apr?.ownerId??item.ownerId,miembros),fechaCompromiso:apr?.dueDate??undefined,citas,skus,periodo:{inicio:item.scope.date_start,fin:item.scope.date_end}});setEstado({fase:'listo',tipo:r.tipo,archivos:r.archivos,avisos:[...avisos,...r.avisos.filter(a=>!(avisos.length&&/SKUs/.test(a)))]});}catch{setEstado({fase:'error',texto:'No se pudieron preparar los borradores. Tu recomendación no cambió; reintenta cerrando y abriendo este panel.'});hecho.current=false;}
  })();
  return()=>{abort.abort();hecho.current=false;};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[open]);
 return <Drawer open={open} onClose={onClose} width={620} title="Borradores de la acción" subtitle={etiquetaCategoria(item.title)}>
  <div className="stack">
   <p className={css.aviso} role="note"><strong>No se ha enviado nada.</strong> Son borradores para que los revises, ajustes y envíes tú desde tus propios canales. No incluyen nombres, correos ni teléfonos de clientes.</p>
   {estado?.fase==='cargando'&&<p className="state" role="status">Preparando borradores con las citas y los SKUs del periodo…</p>}
   {estado?.fase==='error'&&<p className="state state-error" role="alert">{estado.texto}</p>}
   {estado?.fase==='listo'&&<>
    {estado.avisos.map((a,i)=><p key={i} className="state" role="status">{a}</p>)}
    <ul className="row-list">{estado.archivos.map(a=><li key={a.id} className={css.archivo}>
     <div className={css.archivoTxt}><strong>{a.titulo}</strong><span>{a.nombre}</span></div>
     <StatusChip tone="neutral">{a.formato}</StatusChip>
     <div className={css.acciones}><Button size="sm" variant="ghost" onClick={()=>setVista(v=>v===a.id?null:a.id)} aria-expanded={vista===a.id}>{vista===a.id?'Ocultar vista previa':'Vista previa'}</Button><Button size="sm" variant="primary" icon={<Icon name="download" size={14}/>} onClick={()=>descargar(a)}>Descargar</Button></div>
     {vista===a.id&&(a.formato==='HTML'?<iframe className={css.marco} title={'Vista previa: '+a.titulo} sandbox="" srcDoc={a.contenido}/>:<pre className={css.vista}>{a.contenido.slice(0,4000)}</pre>)}
    </li>)}</ul>
    {estado.archivos.length===0&&<p className="state">No hay borradores para generar con los datos disponibles.</p>}
   </>}
  </div>
 </Drawer>;
}
export type {Recommendation};
