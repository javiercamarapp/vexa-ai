'use client';
import {useState} from 'react';
import type {EmbeddingBudget} from '../lib/problems/contracts';
import {useT} from './i18n/proveedor';
const usd=(value:string)=>{const amount=BigInt(value);return `${amount/1000000n}.${String(amount%1000000n).padStart(6,'0')}`;};
export function EmbeddingBudgetPanel({budget,busy,onAction}:{budget:EmbeddingBudget;busy:boolean;onAction:(body:Record<string,unknown>)=>Promise<boolean>}){
 const t=useT();
 const [purpose,setPurpose]=useState('embedding'),[limit,setLimit]=useState(''),[reservationId,setReservationId]=useState(''),[actual,setActual]=useState(''),[evidence,setEvidence]=useState(''),[confirmedFor,setConfirmedFor]=useState<string|null>(null);
 const pending=budget.reservations.filter(row=>['reserved','uncertain'].includes(row.state));
 const selected=pending.find(row=>row.id===reservationId);
 const decision=JSON.stringify({id:selected?.id,version:selected?.version,window:selected?.window,actual,evidence});
 const confirmed=!!selected&&confirmedFor===decision;
 return <section aria-label={t('tr.emb.titulo')}><h2>{t('tr.emb.titulo')}</h2>
 <p>{t('tr.emb.nota')}</p>
 {budget.window?<><p>{t('tr.emb.ventana',{v:budget.window})}</p><p>{t('tr.emb.seNecesitan')}</p>
 <ul>{budget.limits.map(row=><li key={row.purpose}>{t('tr.emb.limLinea',{tipo:row.purpose==='all'?t('tr.emb.global'):t('tr.emb.agrupacion'),usd:usd(row.limitMinor),v:row.version})}</li>)}</ul>
 <form onSubmit={async event=>{event.preventDefault();const current=budget.limits.find(row=>row.purpose===purpose);if(await onAction({operation:'budget',purpose,limitUsd:limit,expectedWindow:budget.window,...(current?{expectedVersion:current.version}:{})}))setLimit('');}}>
 <label>{t('tr.emb.tipoLimite')}<select aria-label={t('tr.emb.tipoLimite')} disabled={busy} value={purpose} onChange={event=>setPurpose(event.target.value)}><option value="embedding">{t('tr.emb.agrupacion')}</option><option value="all">{t('tr.emb.globalVentana')}</option></select></label>
 <label>{t('tr.emb.limiteUsd')}<input required disabled={busy} inputMode="decimal" pattern="[0-9]+([.][0-9]{1,6})?" value={limit} onChange={event=>setLimit(event.target.value)}/></label><button disabled={busy}>{t('tr.emb.guardar')}</button>
 </form></>:<p role="status">{t('tr.emb.faltaVentana')}</p>}
 <h3>{t('tr.emb.pendientes')}</h3>
 {!pending.length?<p>{t('tr.emb.sinPendientes')}</p>:<ul>{pending.map(row=><li key={row.id}>{t('tr.emb.filaPend',{id:row.id,w:row.window,r:usd(row.heldMinor),p:usd(row.reportedMinor),c:row.actualMinor===null?t('tr.emb.desconocido'):t('tr.emb.usd',{v:usd(row.actualMinor)})})}</li>)}</ul>}
 {pending.length>0&&<form onSubmit={async event=>{event.preventDefault();if(!selected||!confirmed)return;if(await onAction({operation:'reconcile',reservationId:selected.id,expectedVersion:selected.version,expectedWindow:selected.window,actualUsd:actual,evidenceHash:evidence,confirmedProviderEvidence:true})){setReservationId('');setActual('');setEvidence('');setConfirmedFor(null);}}}>
 <label>{t('tr.emb.reserva')}<select aria-label={t('tr.emb.reserva')} required disabled={busy} value={reservationId} onChange={event=>{setReservationId(event.target.value);setConfirmedFor(null);}}><option value="">{t('tr.emb.selReserva')}</option>{pending.map(row=><option key={row.id} value={row.id}>{row.id} · {row.window}</option>)}</select></label>
 <label>{t('tr.emb.costoConf')}<input required disabled={busy} inputMode="decimal" pattern="[0-9]+([.][0-9]{1,6})?" value={actual} onChange={event=>{setActual(event.target.value);setConfirmedFor(null);}}/></label>
 <label>{t('tr.emb.huella')}<input required disabled={busy} pattern="[a-f0-9]{64}" value={evidence} onChange={event=>{setEvidence(event.target.value);setConfirmedFor(null);}}/></label>
 <label><input type="checkbox" disabled={busy||!selected} checked={confirmed} onChange={event=>setConfirmedFor(event.target.checked?decision:null)}/>{t('tr.emb.contraste')}</label>
 <button disabled={busy||!confirmed}>{t('tr.emb.conciliar')}</button>
 </form>}
 </section>;
}
