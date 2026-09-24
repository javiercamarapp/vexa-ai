'use client';
import {useState} from 'react';
import type {EmbeddingBudget} from '../lib/problems/contracts';
const usd=(value:string)=>{const amount=BigInt(value);return `${amount/1000000n}.${String(amount%1000000n).padStart(6,'0')}`;};
export function EmbeddingBudgetPanel({budget,busy,onAction}:{budget:EmbeddingBudget;busy:boolean;onAction:(body:Record<string,unknown>)=>Promise<boolean>}){
 const [purpose,setPurpose]=useState('embedding'),[limit,setLimit]=useState(''),[reservationId,setReservationId]=useState(''),[actual,setActual]=useState(''),[evidence,setEvidence]=useState(''),[confirmedFor,setConfirmedFor]=useState<string|null>(null);
 const pending=budget.reservations.filter(row=>['reserved','uncertain'].includes(row.state));
 const selected=pending.find(row=>row.id===reservationId);
 const decision=JSON.stringify({id:selected?.id,version:selected?.version,window:selected?.window,actual,evidence});
 const confirmed=!!selected&&confirmedFor===decision;
 return <section aria-label="Consumo de agrupación"><h2>Consumo de agrupación</h2>
 <p>Configurar límites o conciliar costos no activa el proveedor ni solicita una agrupación.</p>
 {budget.window?<><p>Ventana de agrupación: {budget.window}</p><p>Se necesitan un límite global y otro de agrupación. El global también limita otros usos que compartan esta ventana.</p>
 <ul>{budget.limits.map(row=><li key={row.purpose}>{row.purpose==='all'?'Global':'Agrupación'}: {usd(row.limitMinor)} USD · versión {row.version}</li>)}</ul>
 <form onSubmit={async event=>{event.preventDefault();const current=budget.limits.find(row=>row.purpose===purpose);if(await onAction({operation:'budget',purpose,limitUsd:limit,expectedWindow:budget.window,...(current?{expectedVersion:current.version}:{})}))setLimit('');}}>
 <label>Tipo de límite de agrupación<select aria-label="Tipo de límite de agrupación" disabled={busy} value={purpose} onChange={event=>setPurpose(event.target.value)}><option value="embedding">Agrupación</option><option value="all">Global de esta ventana</option></select></label>
 <label>Límite de agrupación en USD<input required disabled={busy} inputMode="decimal" pattern="[0-9]+([.][0-9]{1,6})?" value={limit} onChange={event=>setLimit(event.target.value)}/></label><button disabled={busy}>Guardar límite de agrupación</button>
 </form></>:<p role="status">Falta configurar la ventana de consumo del servicio de agrupación. Los costos pendientes todavía se pueden conciliar.</p>}
 <h3>Costos pendientes de conciliación</h3>
 {!pending.length?<p>No hay costos de agrupación pendientes.</p>:<ul>{pending.map(row=><li key={row.id}>{row.id} · Ventana: {row.window} · Reservado: {usd(row.heldMinor)} USD · Reportado: {usd(row.reportedMinor)} USD · Costo final: {row.actualMinor===null?'desconocido':`${usd(row.actualMinor)} USD`}</li>)}</ul>}
 {pending.length>0&&<form onSubmit={async event=>{event.preventDefault();if(!selected||!confirmed)return;if(await onAction({operation:'reconcile',reservationId:selected.id,expectedVersion:selected.version,expectedWindow:selected.window,actualUsd:actual,evidenceHash:evidence,confirmedProviderEvidence:true})){setReservationId('');setActual('');setEvidence('');setConfirmedFor(null);}}}>
 <label>Reserva de agrupación<select aria-label="Reserva de agrupación" required disabled={busy} value={reservationId} onChange={event=>{setReservationId(event.target.value);setConfirmedFor(null);}}><option value="">Selecciona una reserva</option>{pending.map(row=><option key={row.id} value={row.id}>{row.id} · {row.window}</option>)}</select></label>
 <label>Costo confirmado de agrupación en USD<input required disabled={busy} inputMode="decimal" pattern="[0-9]+([.][0-9]{1,6})?" value={actual} onChange={event=>{setActual(event.target.value);setConfirmedFor(null);}}/></label>
 <label>Huella SHA-256 del recibo de agrupación<input required disabled={busy} pattern="[a-f0-9]{64}" value={evidence} onChange={event=>{setEvidence(event.target.value);setConfirmedFor(null);}}/></label>
 <label><input type="checkbox" disabled={busy||!selected} checked={confirmed} onChange={event=>setConfirmedFor(event.target.checked?decision:null)}/>Contrasté este costo de agrupación con evidencia del proveedor.</label>
 <button disabled={busy||!confirmed}>Conciliar costo de agrupación</button>
 </form>}
 </section>;
}
