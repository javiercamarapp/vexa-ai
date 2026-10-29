'use client';
import {useId,useState} from 'react';
import type {FugaVista} from '../../../../../packages/workspace-service/fuga-reembolsos.mjs';
import {useT} from '../i18n/proveedor';
import {KindBadge} from '../ui/kind-badge';
import {Icon} from '../ui/icons';
import {dinero,estimar,formulaA,formulaB,num,porcentaje,usd,usdNum} from './fuga-modelo.mjs';
import './fuga.css';

export function Campo({etiqueta,ayuda,valor,onChange,sufijo,modo,entrada}:{etiqueta:string;ayuda:string;valor:string;onChange:(v:string)=>void;sufijo:string;modo:'decimal'|'numeric';entrada:{error?:string}}){
 const id=useId(),t=useT();
 return <div className="fg-campo"><label htmlFor={id}>{etiqueta}</label>
  <div className="fg-campo-in"><input id={id} inputMode={modo} autoComplete="off" value={valor} onChange={e=>onChange(e.target.value)} aria-describedby={id+'-a'} aria-invalid={entrada.error?true:undefined} placeholder={t('tr.fuga.estPlaceholder')}/><span aria-hidden="true">{sufijo}</span></div>
  <p id={id+'-a'} className={entrada.error?'fg-campo-err':'fg-sm'}>{entrada.error??ayuda}</p></div>;
}
/** Estimador con candado: sin supuestos tecleados NO hay número; con ellos, «Estimado con tus supuestos» y la cuenta a la vista. Nada se guarda ni se envía. */
export function Estimador({v}:{v:FugaVista}){
 const t=useT();
 const [sel,setSel]=useState<string>('top10');
 const [pP,setPP]=useState(''),[pR,setPR]=useState(''),[cc,setCC]=useState(''),[pE,setPE]=useState('');
 const top=v.skus.status==='ok'?v.skus.top:[];
 const baseMinor=v.titular.status==='ok'&&top.length?(sel==='top10'?String(top.reduce((a,r)=>a+BigInt(r.usdNetoMinor),0n)):top.find(r=>r.sku===sel)?.usdNetoMinor??null):null;
 const rep=v.contactoRepetido.status==='ok'?v.contactoRepetido.ticketsQueRepiten90:null;
 const e={pP:porcentaje(pP),pR:porcentaje(pR),cc:dinero(cc),pE:porcentaje(pE)};
 const r=estimar({baseUsdMinor:baseMinor,ticketsRepiten:rep,pctProveedor:e.pP,pctRecuperable:e.pR,costoContacto:e.cc,pctEvitable:e.pE});
 const hay=r.A||r.B;
 return <div className="fg-est">
  <p className="fg-intro">{t('tr.fuga.estIntro')}</p>
  <div className="fg-est-grid">
   <fieldset className="fg-bloque"><legend>{t('tr.fuga.estLeyendaProv')}</legend>
    <div className="fg-campo"><label htmlFor="fg-base">{t('tr.fuga.estBase')}</label>
     <select id="fg-base" value={sel} onChange={ev=>setSel(ev.target.value)}>{top.length>0&&<option value="top10">{t('tr.fuga.optTop10',{n:10,usd:usd(String(top.reduce((a,x)=>a+BigInt(x.usdNetoMinor),0n)))})}</option>}{top.map(x=><option key={x.sku} value={x.sku}>{x.sku} ({usd(x.usdNetoMinor)})</option>)}</select></div>
    <Campo etiqueta={t('tr.fuga.estPctProv')} ayuda={t('tr.fuga.estPctProvAyuda')} valor={pP} onChange={setPP} sufijo="%" modo="decimal" entrada={e.pP as {error?:string}}/>
    <Campo etiqueta={t('tr.fuga.estPctRec')} ayuda={t('tr.fuga.estPctRecAyuda')} valor={pR} onChange={setPR} sufijo="%" modo="decimal" entrada={e.pR as {error?:string}}/>
   </fieldset>
   <fieldset className="fg-bloque"><legend>{t('tr.fuga.estLeyendaCosto')}</legend>
    <p className="fg-sm">{rep!==null?t('tr.fuga.baseObs',{n:num(rep),d:90}):t('tr.fuga.baseNoDisp')}</p>
    <Campo etiqueta={t('tr.fuga.costoContacto')} ayuda={t('tr.fuga.costoContactoAyuda')} valor={cc} onChange={setCC} sufijo="USD" modo="decimal" entrada={e.cc as {error?:string}}/>
    <Campo etiqueta={t('tr.fuga.pctEvitable')} ayuda={t('tr.fuga.pctEvitableAyuda')} valor={pE} onChange={setPE} sufijo="%" modo="decimal" entrada={e.pE as {error?:string}}/>
   </fieldset>
  </div>
  <div className="fg-est-out" role="status" aria-live="polite" data-lock={hay?undefined:true}>
   {hay?<>
    <KindBadge kind="estimated" hint={t('tr.fuga.estHint')}/><p className="fg-est-t">{t('tr.fuga.estTitulo')}</p>
    {r.A&&<p><b className="fg-stat">{usdNum(r.A.valorUsd)}</b> {t('tr.fuga.recPorReclamo')} <span className="fg-sm">= {formulaA(r.A)}</span></p>}
    {r.B&&<p><b className="fg-stat">{usdNum(r.B.valorUsd)}</b> {t('tr.fuga.costoEvitable')} <span className="fg-sm">= {formulaB(r.B)}</span></p>}
    <p className="fg-sm">{t('tr.fuga.estNotaCampo')}</p></>
   :<><Icon name="lock" size={18}/><p>{t('tr.fuga.estFaltaBloque')}</p></>}
  </div>
 </div>;
}
