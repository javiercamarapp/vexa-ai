import type {ReactNode} from 'react';
/** Retain native table semantics while giving narrow screens a keyboard-scrollable viewport. */
export function ScrollTable({label,children}:{label:string;children:ReactNode}){
 return <div className="table-scroll" role="region" aria-label={label} tabIndex={0}>{children}</div>;
}
