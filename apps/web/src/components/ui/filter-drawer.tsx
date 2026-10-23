'use client';
import {useState,type ReactNode} from 'react';
import {Drawer} from './overlay';
import {Icon} from './icons';
export type FilterChip={key:string;label:string;onRemove?:()=>void};
/** One «Filtros (n)» button + removable chips of what is active; the form itself lives in a drawer (Aplicar / Limpiar). */
export function FilterDrawer({title='Filtros',count,chips=[],formId,onClear,children,hint,open:openProp,onOpenChange}:{open?:boolean;onOpenChange?:(o:boolean)=>void;title?:string;count:number;chips?:FilterChip[];formId:string;onClear?:()=>void;children:(close:()=>void)=>ReactNode;hint?:ReactNode}){
 const [inner,setInner]=useState(false),open=openProp??inner,setOpen=(o:boolean)=>{setInner(o);onOpenChange?.(o);},close=()=>setOpen(false);
 return <div className="filter-bar">
  <button type="button" className="btn btn-secondary" onClick={()=>setOpen(true)} aria-haspopup="dialog"><Icon name="filter" size={14}/><span className="btn-label">Filtros</span>{count>0&&<span className="count-pill" aria-label={count+' activos'}>{count}</span>}</button>
  {chips.length>0&&<ul className="filter-chips" aria-label="Filtros activos">{chips.map(c=><li key={c.key} className="fchip"><span>{c.label}</span>{c.onRemove&&<button type="button" className="fchip-x" onClick={c.onRemove} aria-label={'Quitar '+c.label}><Icon name="x" size={11}/></button>}</li>)}</ul>}
  <Drawer open={open} onClose={close} title={title} subtitle={hint} footer={<>{onClear&&<button type="button" className="btn btn-ghost" onClick={()=>{onClear();close();}}>Limpiar</button>}<button type="submit" form={formId} className="btn btn-primary">Aplicar</button></>}>{children(close)}</Drawer>
 </div>;
}
