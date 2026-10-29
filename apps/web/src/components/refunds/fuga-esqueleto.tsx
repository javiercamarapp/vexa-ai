'use client';
import {RovaqCargando} from '../rovaq-cargando';
import {useT} from '../i18n/proveedor';
import './fuga.css';
/** Solo el logo animado, sin texto visible. */
export function Skeleton({}:{lineas?:number;segundos?:number;compacto?:boolean}){
 const t=useT();
 return <RovaqCargando compacto mensaje={t('tr.fuga.cargando')}/>;
}
