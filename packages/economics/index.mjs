/** Pure arithmetic kernel. Caller must supply ONE authorized tenant, compatible
 * basis/window, canonical identities and a complete scope. Never infers currency,
 * causation, customer identity, event linkage or data completeness. */
function identity(value, label='id') {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} required`);
  return value;
}
function currency(value) {
  if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)) throw new TypeError('Invalid currency code');
  return value; // ISO membership and minor-unit exponent belong to versioned catalog.
}
function money(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) throw new TypeError('Invalid nonnegative minor-unit money');
  return BigInt(value);
}
function dedupe(records, fields) {
  if (!Array.isArray(records)) throw new TypeError('records must be an array');
  const map=new Map();
  for(const r of records){
    identity(r.id); currency(r.currency); money(r.amountMinor);
    const key=JSON.stringify(fields.map(f=>r[f]??null));
    const prior=map.get(r.id);
    if(prior && prior.key!==key) throw new Error(`Identity conflict: ${r.id}`);
    map.set(r.id,{key,record:r});
  }
  return [...map.values()].map(v=>v.record);
}

export function aggregateMoney(records) {
  const groups=new Map();
  for(const r of dedupe(records,['amountMinor','currency'])){
    const g=groups.get(r.currency)??{sum:0n,known:0,total:0};
    g.total++;
    const amount=money(r.amountMinor);
    if(amount!==null){g.sum+=amount;g.known++;}
    groups.set(r.currency,g);
  }
  return Object.fromEntries([...groups].sort(([a],[b])=>a.localeCompare(b)).map(([code,g])=>[
    code,{amountMinor:g.known===g.total?g.sum.toString():null,knownSubtotalMinor:g.sum.toString(),knownCount:g.known,totalCount:g.total,status:g.known===g.total?'complete':'partial'}
  ]));
}

export function exposureForProblems(orders,links) {
  const canonical=dedupe(orders,['amountMinor','currency']);
  const byId=new Map(canonical.map(o=>[o.id,o]));
  const global=new Set(); const problems=new Map();
  for(const link of links){
    identity(link.problemId,'problemId'); identity(link.orderId,'orderId');
    if(!byId.has(link.orderId)) throw new Error(`Missing order: ${link.orderId}`);
    global.add(link.orderId);
    const set=problems.get(link.problemId)??new Set();set.add(link.orderId);problems.set(link.problemId,set);
  }
  const aggregate=ids=>aggregateMoney([...ids].map(id=>byId.get(id)));
  return {global:aggregate(global),byProblem:Object.fromEntries([...problems].sort(([a],[b])=>a.localeCompare(b)).map(([id,ids])=>[id,aggregate(ids)])),problemRowsAreAdditive:false};
}

export function netRefunds(events) {
  const unique=dedupe(events,['kind','status','amountMinor','currency','reversalOf']);
  for(const e of unique){
    if(!['refund','reversal'].includes(e.kind)) throw new TypeError('Invalid event kind');
    if(!['settled','pending','cancelled'].includes(e.status)) throw new TypeError('Invalid event status');
    if(e.kind==='reversal') identity(e.reversalOf,'reversalOf');
    else if(e.reversalOf!=null) throw new TypeError('Refund cannot reference reversalOf');
  }
  const settled=unique.filter(e=>e.status==='settled');
  const refunds=new Map(settled.filter(e=>e.kind==='refund').map(e=>[e.id,e]));
  const reversals=new Map();
  for(const e of settled.filter(e=>e.kind==='reversal')){
    const original=refunds.get(e.reversalOf);
    if(!original) throw new Error('Missing settled original refund; reconciliation required');
    if(e.currency!==original.currency) throw new Error('Reversal currency mismatch');
    const current=reversals.get(e.reversalOf)??{known:0n,unknown:false};
    const value=money(e.amountMinor);
    if(value===null) current.unknown=true; else current.known+=value;
    const cap=money(original.amountMinor);
    if(cap!==null && current.known>cap) throw new Error('Reversals exceed original refund');
    reversals.set(e.reversalOf,current);
  }
  return aggregateMoney([...refunds.values()].map(r=>{
    const amount=money(r.amountMinor);const rev=reversals.get(r.id);
    return {...r,amountMinor:amount===null||rev?.unknown?null:(amount-(rev?.known??0n)).toString()};
  }));
}

export function revenueRiskScenario({affectedCustomers,relevantRevenueMinor,probabilityBps,currency:code,horizonDays,assumptionId}) {
  currency(code); identity(assumptionId,'assumptionId');
  if(!Number.isSafeInteger(affectedCustomers)||affectedCustomers<0) throw new TypeError('Invalid affectedCustomers');
  if(!Number.isSafeInteger(horizonDays)||horizonDays<=0) throw new TypeError('Invalid horizonDays');
  if(probabilityBps!==null && (!Number.isInteger(probabilityBps)||probabilityBps<0||probabilityBps>10000)) throw new TypeError('Invalid probabilityBps');
  const value=money(relevantRevenueMinor);
  const amount=value===null||probabilityBps===null?null:
    ((BigInt(affectedCustomers)*value*BigInt(probabilityBps)+5000n)/10000n).toString();
  return {kind:'scenario',amountMinor:amount,currency:code,horizonDays,assumptionId,rounding:'half-up once to minor unit',status:amount===null?'unavailable':'modeled',causallyAttributed:false};
}
