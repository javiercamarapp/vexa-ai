'use client';
import {useT} from '../i18n/proveedor';
import type {Clave} from '../../lib/i18n';
import type {ReactNode} from 'react';
import {PageHeader} from '../ui/page-header';
import {TabsLinea} from '../panel-comun/tabs-linea';
import '../panel-comun/panel-comun.css';
export type VistaDatos='resumen'|'fuentes'|'cobertura'|'importaciones'|'historico'|'analisis';
const TABS:{key:VistaDatos;label:Clave;href:string}[]=[
 {key:'resumen',label:'datos.tab.resumen',href:'/confianza'},{key:'fuentes',label:'datos.tab.fuentes',href:'/connections'},{key:'cobertura',label:'datos.tab.cobertura',href:'/sources'},
 {key:'importaciones',label:'datos.tab.importaciones',href:'/imports'},{key:'historico',label:'datos.tab.historico',href:'/history'},{key:'analisis',label:'datos.tab.analisis',href:'/analysis'}];
/** Encabezado idéntico de las seis pantallas de Datos y confianza: eyebrow, H1, UNA línea, acciones a la derecha y pestañas. */
export function DatosCabecera({actual,title,description,actions}:{actual:VistaDatos;title:string;description:string;actions?:ReactNode}){
 const t=useT();
 return <><PageHeader eyebrow={t('datos.eyebrow')} title={title} description={description} actions={actions}/><TabsLinea label={t('datos.secciones')} tabs={TABS.map(x=>({...x,label:t(x.label)}))} actual={actual}/></>;
}
