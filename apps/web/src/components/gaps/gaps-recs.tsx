'use client';
import {useId,useState} from 'react';
import type {Recomendacion} from '../../../../../packages/workspace-service/brechas.mjs';
import {useT} from '../i18n/proveedor';
import {Button} from '../ui/button';
import {KindBadge} from '../ui/kind-badge';
import {Icon} from '../ui/icons';
import {Vacio} from '../refunds/fuga-partes';
import {Campo} from '../refunds/fuga-estimador';
import {estimar,formulaA,porcentaje,usd,usdNum} from './gaps-modelo.mjs';
import '../dinero/dinero.css';

/** Clave donde se deja el borrador para el flujo de recomendaciones (mismo navegador, solo en esta pestaña). */
export type Supuesto={id:string;texto:string};
export const CLAVE_BORRADOR='vexa:borrador-recomendacion';

/** Estimador con candado (mismos campos y reglas que «Fuga de reembolsos»): sin supuestos tecleados no hay número. La base es el dinero devuelto observado de la recomendación elegida. */
export function EstimadorBrecha({recs,onSupuestos}:{recs:Recomendacion[];onSupuestos:(s:Supuesto|null)=>void}){
 const t=useT();
 const [sel,setSel]=useState(''),[pP,setPP]=useState(''),[pR,setPR]=useState('');
 const id=useId(),elegidas=recs.filter(r=>r.impacto.usdMinor&&r.tipo!=='cross_sell'&&r.tipo!=='empujar'),r0=elegidas.find(r=>r.id===sel)??elegidas[0]??null;
 const e={pP:porcentaje(pP),pR:porcentaje(pR)};
 const est=estimar({baseUsdMinor:r0?.baseMinor??null,ticketsRepiten:null,pctProveedor:e.pP,pctRecuperable:e.pR,costoContacto:{vacio:true},pctEvitable:{vacio:true}});
 return <div className="fg-est">
  <p className="fg-intro">{t('tr.brecha.estIntro')}</p>
  {elegidas.length===0?<Vacio>{t('tr.brecha.estSinBase')}</Vacio>:<>
   <fieldset className="fg-bloque"><legend>{t('tr.brecha.estLeyenda')}</legend>
    <div className="fg-campo"><label htmlFor={id}>{t('tr.fuga.estBase')}</label>
     <select id={id} value={r0?.id??''} onChange={ev=>{setSel(ev.target.value);onSupuestos(null);}}>{elegidas.map(r=><option key={r.id} value={r.id}>{r.titulo} ({usd(r.baseMinor)})</option>)}</select></div>
    <Campo etiqueta={t('tr.brecha.estPctProv')} ayuda={t('tr.brecha.estPctProvAyuda')} valor={pP} onChange={v=>{setPP(v);onSupuestos(null);}} sufijo="%" modo="decimal" entrada={e.pP as {error?:string}}/>
    <Campo etiqueta={t('tr.fuga.estPctRec')} ayuda={t('tr.brecha.estPctRecAyuda')} valor={pR} onChange={v=>{setPR(v);onSupuestos(null);}} sufijo="%" modo="decimal" entrada={e.pR as {error?:string}}/>
   </fieldset>
   <div className="fg-est-out" role="status" aria-live="polite" data-lock={est.A?undefined:true}>
    {est.A?<><KindBadge kind="estimated" hint={t('tr.fuga.estHint')}/><p className="fg-est-t">{t('tr.fuga.estTitulo')}</p>
     <p><b className="fg-stat">{usdNum(est.A.valorUsd)}</b> {t('tr.brecha.estRecuperable')} <span className="fg-sm">= {formulaA(est.A)}</span></p>
     <p className="fg-sm">{t('tr.brecha.estNota')}</p>
     <Button size="sm" onClick={()=>onSupuestos({id:r0!.id,texto:t('tr.brecha.estTexto',{base:usd(r0!.baseMinor),titulo:r0!.titulo,pP,pR,valor:usdNum(est.A!.valorUsd)})})}>{t('tr.brecha.estIncluir')}</Button></>
     :<><Icon name="lock" size={18}/><p>{t('tr.brecha.estFalta')}</p></>}
   </div></>}
 </div>;
}

