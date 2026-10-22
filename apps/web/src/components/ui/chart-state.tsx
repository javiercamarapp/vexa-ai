import type {ReactNode} from 'react';
import {Button,Refresh} from './button';
import {Icon} from './icons';
import {EmptyState} from './empty-state';
import {SkeletonChart} from './skeletons';
import s from './legibilidad.module.css';
/** Mensaje claro según el código HTTP: 503/504 = el servicio está lento, no que no haya datos. */
export function mensajeError(status:number,que='los datos'){
 if(status===503||status===504)return `El servicio tardó en responder al consultar ${que}. Suele resolverse al reintentar.`;
 if(status===401||status===403)return `Tu acceso no permite consultar ${que}. Vuelve a iniciar sesión.`;
 return `No se pudo consultar ${que}.`;
}
/** Estados de una gráfica: cargando (esqueleto), error (con reintento), vacío (con razón) o contenido. */
export function ChartState({busy,hasData,error,status=0,que='los datos',onRetry,retryLabel='Reintentar',empty,height=200,children}:{busy:boolean;hasData:boolean;error:string;status?:number;que?:string;onRetry:()=>void;retryLabel?:string;empty?:ReactNode;height?:number;children:ReactNode}){
 if(error&&!hasData)return <div className={s.chartState+' notice-bar'} role="alert"><div className={s.retryRow}><Icon name="info" size={14}/><span>{mensajeError(status,que)}</span><Button size="sm" icon={<Refresh/>} loading={busy} onClick={onRetry}>{retryLabel}</Button></div></div>;
 if(busy&&!hasData)return <div role="status" aria-busy="true"><span className="sr-only">Cargando…</span><SkeletonChart height={height}/></div>;
 if(!hasData)return <>{empty??<EmptyState compact art="chart" title="Aún sin datos" body="Todavía no hay datos para mostrar."/>}</>;
 return <>{children}</>;
}
