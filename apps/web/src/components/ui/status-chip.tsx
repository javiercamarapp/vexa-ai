import type {ReactNode} from 'react';
/** Status = dot + text with a soft tint. Never colour alone. */
export function StatusChip({tone='neutral',children,title}:{tone?:'ok'|'warn'|'bad'|'info'|'neutral'|'muted';children:ReactNode;title?:string}){
 return <span className="status-chip" data-tone={tone} title={title}><i aria-hidden="true"/>{children}</span>;
}
