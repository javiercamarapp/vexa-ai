import type {ReactNode} from 'react';
import {Icon} from './icons';
/** Aviso en línea. info = neutro, warn = datos parciales, error = falló algo. Márgenes iguales arriba y abajo (16 px; 0 en los extremos). */
export function Notice({tone='info',title,children,actions}:{tone?:'info'|'warn'|'error';title?:ReactNode;children?:ReactNode;actions?:ReactNode}){
 return <div className="ui-notice ui-reset" data-tone={tone} role={tone==='error'?'alert':'status'}>
  <span className="ui-notice-icon" aria-hidden="true"><Icon name="info" size={14}/></span>
  <div className="ui-notice-body">{title&&<strong className="ui-notice-title">{title}</strong>}{children&&<div className="ui-notice-text">{children}</div>}</div>
  {actions&&<div className="ui-notice-actions">{actions}</div>}
 </div>;
}
