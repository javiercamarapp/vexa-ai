import {sourceRefLabel} from '../../lib/source-ref.mjs';
import {IdChip} from './id-chip';
/** A figure's source in plain Spanish; the technical reference is kept in the tooltip and copied with one click. */
export function SourceRef({value,showLabel=true}:{value:string;showLabel?:boolean}){return <IdChip value={value} label={showLabel?'Fuente':undefined} text={sourceRefLabel(value)}/>;}
