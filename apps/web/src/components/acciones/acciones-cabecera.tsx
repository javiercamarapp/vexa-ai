'use client';
import type {ReactNode} from 'react';
import {useSearchParams} from 'next/navigation';
import {PageHeader} from '../ui/page-header';
import {TabsLinea} from '../panel-comun/tabs-linea';
import {consultaAlcance} from '../../lib/workspace/alcance.mjs';
import type {VistaAccion} from './accion-fila';
import './acciones.css';
import '../panel-comun/panel-comun.css';
export const DESCRIPCION='Decide sobre cada recomendación y sigue lo aprobado hasta su resultado; nada se envía solo.';
/** Encabezado único de Acciones: eyebrow + H1 + una línea + UNA barra de acciones + pestañas Por decidir | En curso | Resultados.
 *  /recommendations e /interventions son alias de la misma pantalla: solo cambia la pestaña activa. */
export function AccionesCabecera({actual,cuentas,acciones}:{actual:VistaAccion;cuentas?:Partial<Record<VistaAccion,number|null>>;acciones?:ReactNode}){
 const q=consultaAlcance(useSearchParams().toString()),sufijo=(v:string)=>(q?q+'&':'')+'vista='+v;
 const tabs:{key:VistaAccion;label:string;href:string;count?:number|null}[]=[
  {key:'por-decidir',label:'Por decidir',href:'/recommendations'+(q?'?'+q:''),count:cuentas?.['por-decidir']},
  {key:'en-curso',label:'En curso',href:'/interventions?'+sufijo('en-curso'),count:cuentas?.['en-curso']},
  {key:'resultados',label:'Resultados',href:'/interventions?'+sufijo('resultados'),count:cuentas?.resultados}];
 return <>
  <PageHeader eyebrow="Acciones" title="Acciones" description={DESCRIPCION} actions={acciones}/>
  <TabsLinea label="Etapas del ciclo de acciones" tabs={tabs} actual={actual}/>
 </>;
}
