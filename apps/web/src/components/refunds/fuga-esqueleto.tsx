'use client';
import {RovaqCargando} from '../rovaq-cargando';
import './fuga.css';
/** Solo el logo animado, sin texto visible. */
export function Skeleton(_p:{lineas?:number;segundos?:number;compacto?:boolean}){
 return <RovaqCargando compacto mensaje="Cargando fuga de reembolsos"/>;
}
