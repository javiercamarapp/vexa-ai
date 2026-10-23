'use client';
import type {ReactNode} from 'react';
import {PageHeader} from '../ui/page-header';
import {TabsLinea} from '../panel-comun/tabs-linea';
import '../panel-comun/panel-comun.css';
export type VistaDatos='resumen'|'fuentes'|'cobertura'|'importaciones'|'historico'|'analisis';
const TABS:{key:VistaDatos;label:string;href:string}[]=[
 {key:'resumen',label:'Resumen',href:'/confianza'},{key:'fuentes',label:'Fuentes',href:'/connections'},{key:'cobertura',label:'Cobertura',href:'/sources'},
 {key:'importaciones',label:'Importaciones',href:'/imports'},{key:'historico',label:'Histórico',href:'/history'},{key:'analisis',label:'Análisis',href:'/analysis'}];
/** Encabezado idéntico de las seis pantallas de Datos y confianza: eyebrow, H1, UNA línea, acciones a la derecha y pestañas. */
export function DatosCabecera({actual,title,description,actions}:{actual:VistaDatos;title:string;description:string;actions?:ReactNode}){
 return <><PageHeader eyebrow="Datos y confianza" title={title} description={description} actions={actions}/><TabsLinea label="Secciones de Datos y confianza" tabs={TABS} actual={actual}/></>;
}
