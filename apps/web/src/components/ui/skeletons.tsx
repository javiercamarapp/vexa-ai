import {RovaqCargando} from '../rovaq-cargando';
/**
 * Los esqueletos ya no imitan la forma final: mientras no hay datos se muestra SOLO el logo animado (sin texto visible; el mensaje es solo para lectores de pantalla).
 * Se conservan los nombres y las props para no tocar a los llamadores; `count`/`rows` ya no dibujan filas ni tarjetas.
 */
export function SkeletonStats({}:{count?:number}){return <RovaqCargando compacto mensaje="Cargando datos autorizados"/>;}
export function SkeletonChart({height=180}:{height?:number}){return <div style={{minHeight:height,display:'grid',placeItems:'center'}}><RovaqCargando compacto mensaje="Cargando gráfica"/></div>;}
export function SkeletonRows({}:{rows?:number}){return <RovaqCargando compacto mensaje="Cargando"/>;}
export function SkeletonCards({}:{count?:number}){return <RovaqCargando compacto mensaje="Cargando"/>;}
