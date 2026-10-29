'use client';
import type {ReactNode} from 'react';
import {useT} from '../i18n/proveedor';
import type {Traductor} from '../../lib/i18n';
import {Button,Refresh} from './button';
import {Icon} from './icons';
import {EmptyState} from './empty-state';
import {SkeletonChart} from './skeletons';
import s from './legibilidad.module.css';
/** Mensaje claro según el código HTTP: 503/504 = el servicio está lento, no que no haya datos. */
export function mensajeError(t:Traductor,status:number,que:string){
 if(status===503||status===504)return t('tr.ui.err503',{que});
 if(status===401||status===403)return t('tr.ui.err403',{que});
 return t('tr.ui.errGen',{que});
}
/** Estados de una gráfica: cargando (esqueleto), error (con reintento), vacío (con razón) o contenido. */
export function ChartState({busy,hasData,error,status=0,que,onRetry,retryLabel,empty,height=200,children}:{busy:boolean;hasData:boolean;error:string;status?:number;que?:string;onRetry:()=>void;retryLabel?:string;empty?:ReactNode;height?:number;children:ReactNode}){
 const t=useT();
 if(error&&!hasData)return <div className={s.chartState+' notice-bar'} role="alert"><div className={s.retryRow}><Icon name="info" size={14}/><span>{mensajeError(t,status,que??t('tr.ui.losDatos'))}</span><Button size="sm" icon={<Refresh/>} loading={busy} onClick={onRetry}>{retryLabel??t('hoy.reintentar')}</Button></div></div>;
 if(busy&&!hasData)return <div role="status" aria-busy="true"><span className="sr-only">{t('comun.cargando')}</span><SkeletonChart height={height}/></div>;
 if(!hasData)return <>{empty??<EmptyState compact art="chart" title={t('prob.aunSinDatos')} body={t('tr.ui.sinDatosMostrar')}/>}</>;
 return <>{children}</>;
}
