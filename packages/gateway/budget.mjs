import {randomUUID} from 'node:crypto';
export function minor(value) {
  if(typeof value!=='string'||!/^\d{1,30}$/.test(value)) throw new Error('invalid_minor');
  return BigInt(value);
}
/** Test adapter ONLY. A durable implementation must provide atomic reserve, fenced
 * attempt recording and monotonic settlement under tenant-scoped transactions.
 * A crash leaves reserved/uncertain amounts held; never expire/release blindly. */
export class InMemoryBudgetRepository {
  #rows=new Map(); #budgets=new Map();
  constructor({budgets=[]}={}) {for(const b of budgets)this.#budgets.set(JSON.stringify([b.tenantId,b.window]),minor(b.limitMinor));}
  async reserve(request) {
    const {tenantId,taskKey,window,fingerprint}=request;
    if(!tenantId||!taskKey||!window||!fingerprint||request.currency!=='USD'||request.exponent!==6)throw new Error('invalid_reservation');
    const key=JSON.stringify([tenantId,taskKey]);
    if(this.#rows.has(key))return {acquired:false,reason:this.#rows.get(key).fingerprint===fingerprint?'duplicate_task':'idempotency_conflict'};
    const limit=this.#budgets.get(JSON.stringify([tenantId,window]));
    const amount=minor(request.amountMinor),requestedLimit=minor(request.tenantLimitMinor);
    const used=[...this.#rows.values()].filter(r=>r.tenantId===tenantId&&r.window===window).reduce((sum,r)=>sum+BigInt(r.state==='settled'?r.actualMinor:r.heldMinor),0n);
    if(limit===undefined||amount<=0n||used+amount>limit||used+amount>requestedLimit)return {acquired:false,reason:'budget_exceeded'};
    const row={...request,id:randomUUID(),state:'reserved',heldMinor:amount.toString(),actualMinor:null,reportedMinor:'0',attempts:[]};
    this.#rows.set(key,row);return {acquired:true,reservationId:row.id};
  }
  #row(id){const row=[...this.#rows.values()].find(r=>r.id===id);if(!row)throw new Error('missing_reservation');return row;}
  async recordAttempt(id,attempt) {const row=this.#row(id);if(row.state!=='reserved')throw new Error('invalid_state');row.attempts.push(structuredClone(attempt));}
  async finalize(id,{state,actualMinor,reportedMinor}) {
    const row=this.#row(id);if(row.state!=='reserved')throw new Error('invalid_state');
    if(!['settled','uncertain'].includes(state))throw new Error('invalid_state');
    const reported=minor(reportedMinor);
    if(state==='settled'&&(actualMinor===null||minor(actualMinor)!==reported))throw new Error('invalid_settlement');
    row.state=state;row.actualMinor=state==='settled'?actualMinor:null;row.reportedMinor=reported.toString();
    // Preserve all reserved capacity on uncertainty, including known overages.
    row.heldMinor=(reported>BigInt(row.heldMinor)?reported:BigInt(row.heldMinor)).toString();
  }
  snapshot(){return structuredClone([...this.#rows.values()]);}
}
