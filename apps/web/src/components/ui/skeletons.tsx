import {RovaqCargando} from '../rovaq-cargando';
import {useT} from '../i18n/proveedor';
/**
 * Los esqueletos ya no imitan la forma final: mientras no hay datos se muestra SOLO el logo animado (sin texto visible; el mensaje es solo para lectores de pantalla).
 * Se conservan los nombres y las props para no tocar a los llamadores; `count`/`rows` ya no dibujan filas ni tarjetas.
 */
export function SkeletonStats({}:{count?:number}){const t=useT();return <RovaqCargando compacto mensaje={t('tr.ui.cargandoAut')}/>;}
export function SkeletonChart({height=180}:{height?:number}){const t=useT();return <div style={{minHeight:height,display:'grid',placeItems:'center'}}><RovaqCargando compacto mensaje={t('tr.ui.cargandoGrafica')}/></div>;}
export function SkeletonRows({}:{rows?:number}){const t=useT();return <RovaqCargando compacto mensaje={t('comun.cargando')}/>;}
export function SkeletonCards({}:{count?:number}){const t=useT();return <RovaqCargando compacto mensaje={t('comun.cargando')}/>;}
