import type { ReactNode } from 'react';
export type State = {kind:'loading'}|{kind:'error';message:string;code:string}|{kind:'empty'}|{kind:'partial'|'stale'|'ready';coverage:string;watermark:string|null};
export function DataState({state,children}:{state:State;children?:ReactNode}){
 if(state.kind==='loading')return <div role="status" aria-busy="true" className="state-panel">Cargando datos autorizados…</div>;
 if(state.kind==='error')return <div role="alert" className="state-panel error"><h2>No pudimos cargar esta vista</h2><p>{state.message}</p><p>Referencia: <code>{state.code}</code></p><a href="">Volver a intentar</a></div>;
 if(state.kind==='empty')return <div role="status" className="state-panel"><h2>Sin resultados para este alcance</h2><p>La consulta terminó correctamente. Revisa el periodo y los filtros o importa datos desde el flujo autorizado.</p></div>;
 return <><div role="status" className={'state-panel '+state.kind}><strong>{{partial:'Datos parciales: no equivalen al total',stale:'Datos desactualizados: revisa el corte',ready:'Snapshot disponible'}[state.kind]}</strong><p>Cobertura: {state.coverage} · Corte: <time>{state.watermark??'Sin corte publicado'}</time></p></div>{children}</>;
}
