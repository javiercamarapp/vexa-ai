'use client';
import {useState} from 'react';
import {FilterBar,FilterSpacer} from '../ui/filter-bar';
import {SegmentedControl} from '../ui/segmented';
import {FilterDrawer,type FilterChip} from '../ui/filter-drawer';
import {SharedFilters} from './shared-filters';
import {etiquetaBase} from '../../lib/legibilidad/jerga.mjs';
import {periodoLegible} from '../../lib/workspace/alcance.mjs';
import type {Scope} from '../../lib/workspace/contracts';
type ViewScope=Scope & {basis?:string;exponent?:number};
type Period='month'|'30d'|'90d'|'12m'|'custom';
const day=(d:Date)=>d.toISOString().slice(0,10);
const addDays=(d:Date,n:number)=>new Date(d.getTime()+n*86400000);
function presets(now=new Date()){
 const today=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())),tomorrow=addDays(today,1);
 return {
  month:[day(new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1))),day(new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1)))],
  '30d':[day(addDays(tomorrow,-30)),day(tomorrow)],'90d':[day(addDays(tomorrow,-90)),day(tomorrow)],'12m':[day(addDays(tomorrow,-365)),day(tomorrow)]
 } as Record<Exclude<Period,'custom'>,string[]>;
}
const LABELS:Record<string,string>={hubspot:'HubSpot',zendesk:'Zendesk',csv:'CSV',excel:'Excel'};
/** Period as a segmented control + one «Filtros (n)» button; what is active shows as removable chips. No always-open forms. */
export function ScopeBar({scope,onApply,onLatest,busy,extra,formId='scope-filters'}:{scope:ViewScope;onApply:(q:URLSearchParams)=>void;onLatest?:()=>void;busy?:boolean;extra?:React.ReactNode;formId?:string}){
 const p=presets(),start=scope.date_start.slice(0,10),end=scope.date_end.slice(0,10);
 const current=(Object.keys(p) as (keyof typeof p)[]).find(k=>p[k][0]===start&&p[k][1]===end)??'custom';
 const base=()=>{const q=new URLSearchParams();q.set('date_start',start);q.set('date_end',end);q.set('currency',scope.currency);q.set('basis',scope.basis??'net');q.set('date_basis',scope.date_basis);q.set('timezone','UTC');if(scope.exponent!==undefined&&scope.exponent!==null)q.set('exponent',String(scope.exponent));scope.sku.forEach(s=>q.append('sku',s));scope.source.forEach(s=>q.append('source',s));if(scope.snapshot_id)q.set('snapshot_id',scope.snapshot_id);return q;};
 const [abierto,setAbierto]=useState(false);
 const pick=(v:Period)=>{if(v==='custom'){setAbierto(true);return;}const q=base();q.set('date_start',p[v][0]);q.set('date_end',p[v][1]);onApply(q);};
 const without=(key:'sku'|'source')=>{const q=base();q.delete(key);onApply(q);};
 const chips:FilterChip[]=[{key:'range',label:periodoLegible(start,end)??`${start} → ${end}`},{key:'cur',label:`${scope.currency} · ${etiquetaBase(scope.basis??'net')}`}];
 if(scope.source.length)chips.push({key:'src',label:scope.source.map(s=>LABELS[s]??s).join(', '),onRemove:()=>without('source')});
 if(scope.sku.length)chips.push({key:'sku',label:scope.sku.length===1?'SKU '+scope.sku[0]:scope.sku.length+' SKU',onRemove:()=>without('sku')});
 const count=(current==='month'?0:1)+(scope.source.length?1:0)+(scope.sku.length?1:0)+(scope.currency!=='USD'?1:0)+((scope.basis??'net')!=='net'?1:0);
 const options:{value:Period;label:string}[]=[{value:'month',label:'Este mes'},{value:'30d',label:'30 días'},{value:'90d',label:'90 días'},{value:'12m',label:'12 meses'},{value:'custom' as Period,label:'Personalizado'}];
 return <FilterBar label="Periodo y filtros">
  <SegmentedControl label="Periodo" options={options} value={current} onChange={pick}/>
  <FilterDrawer open={abierto} onOpenChange={setAbierto} count={count} chips={chips} formId={formId} title="Filtros" hint="Periodo, moneda, fuentes y producto del alcance compartido." onClear={()=>{const q=new URLSearchParams();onApply(q);}}>{close=><SharedFilters key={JSON.stringify(scope)} formId={formId} scope={scope} onApply={onApply} onDone={close}/>}</FilterDrawer>
  <FilterSpacer/>
  {onLatest&&<button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onLatest}>Última publicación</button>}
  {extra}
 </FilterBar>;
}
