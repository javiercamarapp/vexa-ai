'use client';
import {useT,useIdioma} from '../i18n/proveedor';
import {RovaqCargando} from '../rovaq-cargando';
import type { ReactNode } from 'react';
import {EmptyState} from '../ui/empty-state';
import {Icon} from '../ui/icons';
import {fechaCorteLegible} from '../../lib/legibilidad/fechas.mjs';
export type State = {kind:'loading'}|{kind:'error';message:string;code:string}|{kind:'empty'}|{kind:'partial'|'stale'|'ready';coverage:string;watermark:string|null};
const NOTICE={partial:'estado.parcial',stale:'estado.desactualizado',ready:'estado.listo'} as const;
/** loading = shaped skeleton · error = calm card with retry (role alert; real failures only) · empty = illustrated state · partial/stale = one-line notice. */
export function DataState({state,children,cta}:{state:State;children?:ReactNode;cta?:ReactNode}){
 const t=useT(),idioma=useIdioma();
 if(state.kind==='loading')return <RovaqCargando compacto mensaje={t('estado.cargandoDatos')}/>;
 if(state.kind==='error')return <div role="alert" className="card state-error-card"><span className="state-error-icon" aria-hidden="true"><Icon name="alert" size={18}/></span><div><h2>{t('estado.errorTitulo')}</h2><p>{state.message}</p><p className="state-ref">{t('estado.referencia')} <code>{state.code}</code></p></div><a className="btn btn-secondary btn-sm" href="">{t('comun.reintentar')}</a></div>;
 if(state.kind==='empty')return <EmptyState art="search" title={t('estado.vacioTitulo')} body={t('estado.vacioCuerpo')} action={cta}/>;
 const tone=state.kind==='ready'?'info':'warn';
 return <><div role="status" className="notice-bar" data-tone={tone}><Icon name={state.kind==='ready'?'check':'info'} size={14}/><strong>{t(NOTICE[state.kind])}</strong><span>{state.coverage} · {t('estado.corte')} <time dateTime={state.watermark??undefined}>{state.watermark?fechaCorteLegible(state.watermark,{idioma}):t('estado.sinCorte')}</time></span></div>{children}</>;
}
