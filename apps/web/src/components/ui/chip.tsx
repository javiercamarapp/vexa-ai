import type {ReactNode} from 'react';
import {Icon} from './icons';
export type ChipTone='neutral'|'ok'|'warn'|'bad'|'info';
/** Píldora de texto: envuelve a varias líneas en lugar de recortarse. `onRemove` añade una «x» con nombre accesible. */
export function Chip({children,tone='neutral',onRemove,removeLabel}:{children:ReactNode;tone?:ChipTone;onRemove?:()=>void;removeLabel?:string}){
 return <span className="ui-chip" data-tone={tone}><span className="ui-chip-text">{children}</span>{onRemove&&<button type="button" className="ui-chip-x ui-reset" onClick={onRemove} aria-label={removeLabel??'Quitar'}><Icon name="x" size={11}/></button>}</span>;
}
/** Lista de píldoras que envuelve (flex-wrap) sin recortar ni heredar estilos de navegación. */
export function ChipList({items,label,children}:{items?:{key:string;node:ReactNode}[];label?:string;children?:ReactNode}){
 return <ul className="ui-chiplist ui-reset" aria-label={label}>{items?items.map(i=><li key={i.key}>{i.node}</li>):children}</ul>;
}
