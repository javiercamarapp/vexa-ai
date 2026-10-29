'use client';
import {useT} from '../i18n/proveedor';
import {etiquetaBaseT} from '../../lib/i18n/menu';
import {ConMarca} from '../ui/brand-mark';
import type {FormEvent} from 'react';
import {OverlaySection} from '../ui/overlay';
import type {Scope} from '../../lib/workspace/contracts';
import {BASES,etiquetaBase} from '../../lib/legibilidad/jerga.mjs';

const SOURCES=[['hubspot','HubSpot'],['zendesk','Zendesk'],['csv','CSV'],['excel','Excel']] as const;
/** Form values describe the requested view; a published snapshot is resolved by the server. Lives inside the «Filtros» drawer. */
export function SharedFilters({scope,onApply,formId='scope-filters',onDone}:{scope:Scope & {basis?:string;exponent?:number};onApply:(query:URLSearchParams)=>void;formId?:string;onDone?:()=>void}){
 const submit=(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();const data=new FormData(event.currentTarget),query=new URLSearchParams();
  for(const key of ['date_start','date_end','currency','date_basis','timezone','snapshot_id','basis','exponent']){
   const value=String(data.get(key)??'').trim();if(value)query.set(key,value);
  }
  for(const sku of [...new Set(String(data.get('sku_lines')??'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean))].sort())query.append('sku',sku);
  for(const source of data.getAll('source').map(String).sort())query.append('source',source);
  onApply(query);onDone?.();
 };
 const t=useT();
 return <form id={formId} className="ov-form" aria-label={t('filtros.compartidos')} onSubmit={submit}>
  <OverlaySection title={t('filtros.periodo')}><div className="ov-pair">
   <label className="field">{t('filtros.desde')}<input type="date" name="date_start" defaultValue={scope.date_start.slice(0,10)} required/></label>
   <label className="field">{t('filtros.hasta')}<input type="date" name="date_end" defaultValue={scope.date_end.slice(0,10)} required/></label></div></OverlaySection>
  <OverlaySection title={t('filtros.monedaBase')}><div className="ov-pair">
   <label className="field">{t('filtros.moneda')}<input name="currency" defaultValue={scope.currency} pattern="[A-Z]{3}" maxLength={3} required/></label>
   <label className="field">{t('filtros.base')}<select name="basis" defaultValue={scope.basis??'net'} required>{[...new Set([...Object.keys(BASES),scope.basis??'net'])].map(k=><option key={k} value={k}>{etiquetaBaseT(t,k,etiquetaBase(k,t))}</option>)}</select></label></div></OverlaySection>
  <OverlaySection title={t('filtros.fuentes')}><fieldset className="field"><legend className="sr-only">{t('filtros.fuentes')}</legend><div className="check-row">{SOURCES.map(([value,label])=><label key={value} className="check-chip"><input type="checkbox" name="source" value={value} defaultChecked={scope.source.includes(value)}/><span><ConMarca marca={value}>{label}</ConMarca></span></label>)}</div><small>{t('filtros.fuentesNota')}</small></fieldset></OverlaySection>
  <OverlaySection title={t('filtros.producto')}><label className="field">{t('filtros.skuLinea')}<textarea name="sku_lines" defaultValue={scope.sku.join('\n')} rows={3}/><small>{t('filtros.skuNota')}</small></label></OverlaySection>
  <OverlaySection title={t('filtros.avanzado')}><details className="ov-avanzado"><summary>{t('filtros.mostrarAvanzado')}</summary><div className="ov-pair">
   <label className="field">{t('filtros.decimales')}<input name="exponent" type="number" min="0" max="4" defaultValue={scope.exponent}/></label>
   <label className="field">{t('filtros.publicacion')}<input name="snapshot_id" defaultValue={scope.snapshot_id??''} placeholder={t('filtros.ultimaPublicada')}/></label></div></details>
   <p className="ov-help">{t('filtros.ayuda')}</p></OverlaySection>
  <input type="hidden" name="date_basis" value={scope.date_basis}/><input type="hidden" name="timezone" value="UTC"/>
 </form>;
}
