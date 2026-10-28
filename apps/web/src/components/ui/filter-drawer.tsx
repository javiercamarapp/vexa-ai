'use client';
import {useT} from '../i18n/proveedor';
import {useState,type ReactNode} from 'react';
import {Drawer} from './overlay';
import {Icon} from './icons';
export type FilterChip={key:string;label:string;onRemove?:()=>void};
/** One «Filtros (n)» button + removable chips of what is active; the form itself lives in a drawer (Aplicar / Limpiar). */
export function FilterDrawer({title,count,chips=[],formId,onClear,children,hint,open:openProp,onOpenChange}:{open?:boolean;onOpenChange?:(o:boolean)=>void;title?:string;count:number;chips?:FilterChip[];formId:string;onClear?:()=>void;children:(close:()=>void)=>ReactNode;hint?:ReactNode}){
 const t=useT(),[inner,setInner]=useState(false),open=openProp??inner,setOpen=(o:boolean)=>{setInner(o);onOpenChange?.(o);},close=()=>setOpen(false);
 return <div className="filter-bar">
  <button type="button" className="btn btn-secondary" onClick={()=>setOpen(true)} aria-haspopup="dialog"><Icon name="filter" size={14}/><span className="btn-label">{t('alcance.filtros')}</span>{count>0&&<span className="count-pill" aria-label={t('alcance.nActivos',{n:count})}>{count}</span>}</button>
  {chips.length>0&&<ul className="filter-chips" aria-label={t('alcance.filtrosActivos')}>{chips.map(c=><li key={c.key} className="fchip"><span>{c.label}</span>{c.onRemove&&<button type="button" className="fchip-x" onClick={c.onRemove} aria-label={t('alcance.quitar',{filtro:c.label})}><Icon name="x" size={11}/></button>}</li>)}</ul>}
  <Drawer open={open} onClose={close} size="sm" title={title??t('alcance.filtros')} subtitle={hint} footer={<>{onClear&&<button type="button" className="btn btn-ghost" onClick={()=>{onClear();close();}}>{t('alcance.limpiar')}</button>}<button type="submit" form={formId} className="btn btn-primary">{t('alcance.aplicar')}</button></>}><p className="ov-summary" role="status">{count>0?<><b>{count}</b> {count===1?t('alcance.unFiltro'):t('alcance.variosFiltros')}{chips.length>0&&<> · {chips.map(c=>c.label).join(' · ')}</>}</>:t('alcance.sinFiltros')}</p>{children(close)}</Drawer>
 </div>;
}
