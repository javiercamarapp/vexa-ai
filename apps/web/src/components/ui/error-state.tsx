import type {ReactNode} from 'react';
import {Button,Refresh} from './button';
/** Error con reintento VISIBLE. Úsalo cuando falla la carga (no cuando simplemente no hay datos: eso es EmptyState). */
export function ErrorState({title='No se pudo cargar',body,onRetry,retryLabel='Reintentar',busy=false,compact=false}:{title?:string;body?:ReactNode;onRetry?:()=>void;retryLabel?:string;busy?:boolean;compact?:boolean}){
 return <div className="ui-state ui-reset" data-kind="error" data-compact={compact||undefined} role="alert"><h3 className="ui-state-title">{title}</h3>{body&&<p className="ui-state-body">{body}</p>}{onRetry&&<div className="ui-state-actions"><Button size="sm" icon={<Refresh/>} loading={busy} onClick={onRetry}>{retryLabel}</Button></div>}</div>;
}
