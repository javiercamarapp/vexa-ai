'use client';
import type {ReactNode} from 'react';
import {useId} from 'react';
/** CSS tooltip for short explanations: shown on hover and keyboard focus, linked by aria-describedby. For anything long use a Popover. */
export function Tip({label,children,align='center'}:{label:string;children:ReactNode;align?:'start'|'center'|'end'}){
 const id=useId();
 return <span className="tip" data-align={align}><span className="tip-target" tabIndex={0} aria-describedby={id}>{children}</span><span role="tooltip" id={id} className="tip-bubble">{label}</span></span>;
}
