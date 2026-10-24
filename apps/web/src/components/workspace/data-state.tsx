import {RovaqCargando} from '../rovaq-cargando';
import type { ReactNode } from 'react';
import {EmptyState} from '../ui/empty-state';
import {Icon} from '../ui/icons';
import {SkeletonRows} from '../ui/skeletons';
import {fechaCorteLegible} from '../../lib/legibilidad/fechas.mjs';
export type State = {kind:'loading'}|{kind:'error';message:string;code:string}|{kind:'empty'}|{kind:'partial'|'stale'|'ready';coverage:string;watermark:string|null};
const NOTICE={partial:'Datos parciales: no equivalen al total',stale:'Datos desactualizados: revisa el corte',ready:'Corte disponible'};
/** loading = shaped skeleton · error = calm card with retry (role alert; real failures only) · empty = illustrated state · partial/stale = one-line notice. */
export function DataState({state,children,cta}:{state:State;children?:ReactNode;cta?:ReactNode}){
 if(state.kind==='loading')return <RovaqCargando compacto mensaje="Cargando datos autorizados"/>;
 if(state.kind==='error')return <div role="alert" className="card state-error-card"><span className="state-error-icon" aria-hidden="true"><Icon name="alert" size={18}/></span><div><h2>No pudimos cargar esta vista</h2><p>{state.message}</p><p className="state-ref">Referencia: <code>{state.code}</code></p></div><a className="btn btn-secondary btn-sm" href="">Volver a intentar</a></div>;
 if(state.kind==='empty')return <EmptyState art="search" title="Sin resultados para este alcance" body="La consulta terminó correctamente. Ajusta el periodo o los filtros, o importa datos desde el flujo autorizado." action={cta}/>;
 const tone=state.kind==='ready'?'info':'warn';
 return <><div role="status" className="notice-bar" data-tone={tone}><Icon name={state.kind==='ready'?'check':'info'} size={14}/><strong>{NOTICE[state.kind]}</strong><span>{state.coverage} · Corte: <time dateTime={state.watermark??undefined}>{state.watermark?fechaCorteLegible(state.watermark):'Sin corte publicado'}</time></span></div>{children}</>;
}
