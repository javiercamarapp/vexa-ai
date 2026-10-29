import type {ReactNode} from 'react';
import {useT} from '../i18n/proveedor';
import {Button,Refresh} from './button';
/** Error con reintento VISIBLE. Úsalo cuando falla la carga (no cuando simplemente no hay datos: eso es EmptyState). */
export function ErrorState({title,body,onRetry,retryLabel,busy=false,compact=false}:{title?:string;body?:ReactNode;onRetry?:()=>void;retryLabel?:string;busy?:boolean;compact?:boolean}){
 const t=useT();
 return <div className="ui-state ui-reset" data-kind="error" data-compact={compact||undefined} role="alert"><h3 className="ui-state-title">{title??t('tr.ui.noSePudoCargar')}</h3>{body&&<p className="ui-state-body">{body}</p>}{onRetry&&<div className="ui-state-actions"><Button size="sm" icon={<Refresh/>} loading={busy} onClick={onRetry}>{retryLabel??t('hoy.reintentar')}</Button></div>}</div>;
}
