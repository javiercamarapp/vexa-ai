'use client';
import {sourceRefLabel} from '../../lib/source-ref.mjs';
import {useT} from '../i18n/proveedor';
import {IdChip} from './id-chip';
/** A figure's source in plain language (idioma activo); the technical reference is kept in the tooltip and copied with one click. */
export function SourceRef({value,showLabel=true}:{value:string;showLabel?:boolean}){const t=useT();return <IdChip value={value} label={showLabel?t('tr.lg.sr.fuente'):undefined} text={sourceRefLabel(value,t)}/>;}
