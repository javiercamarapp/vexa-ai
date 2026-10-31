'use client';
import type {ReactNode} from 'react';
import {useT} from '../i18n/proveedor';
/** UNA sola línea compacta (30 px) para periodo, segmentos, selects, chips y botones. Nunca se apila: en móvil hace scroll horizontal.
 *  Los hijos van directos; `<FilterSpacer/>` empuja lo que sigue a la derecha. */
export function FilterBar({label,children,className}:{label?:string;children:ReactNode;className?:string}){
 const t=useT();
 return <div className={'ui-filterbar'+(className?' '+className:'')} role="group" aria-label={label??t('tr.ui.filtros')}>{children}</div>;
}
export function FilterSpacer(){return <span className="ui-filterbar-spacer" aria-hidden="true"/>;}
