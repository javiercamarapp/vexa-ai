// Libro de gasto con tope duro por lote y total. Fuente de verdad: JSONL append-only (una línea por llamada).
import fs from 'node:fs';
import path from 'node:path';
export class BudgetAbort extends Error{}
export function createLedger({dir,capTotalUsd,capBatchUsd,batchId,file='gasto-cohorte.jsonl',alsoRead=[]}){
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const p=path.join(dir,file);let total=0,batch=0,calls=0;
  if(fs.existsSync(p))for(const l of fs.readFileSync(p,'utf8').split('\n')){if(!l)continue;try{const e=JSON.parse(l);total+=e.usd;calls++;if(e.batch===batchId)batch+=e.usd;}catch{}}
  // Libros anteriores (p. ej. un --out distinto de una corrida previa): cuentan contra el tope TOTAL, nunca se reescriben.
  for(const extra of alsoRead){if(extra===p||!fs.existsSync(extra))continue;for(const l of fs.readFileSync(extra,'utf8').split('\n')){if(!l)continue;try{const e=JSON.parse(l);if(Number.isFinite(e.usd)&&e.usd>=0){total+=e.usd;calls++;}}catch{}}}
  let inflight=0;
  return{
    get total(){return total;},get batch(){return batch;},get calls(){return calls;},capTotalUsd,capBatchUsd,
    reserve(maxUsd){ // aborta ANTES de enviar si acumulado + en vuelo + máximo de esta llamada supera algún tope
      if(total+inflight+maxUsd>capTotalUsd)throw new BudgetAbort(`tope total US$${capTotalUsd}: gastado ${total.toFixed(4)} + en vuelo ${inflight.toFixed(4)} + máx ${maxUsd.toFixed(4)}`);
      if(batch+inflight+maxUsd>capBatchUsd)throw new BudgetAbort(`tope del lote US$${capBatchUsd}: gastado ${batch.toFixed(4)} + en vuelo ${inflight.toFixed(4)} + máx ${maxUsd.toFixed(4)}`);
      inflight+=maxUsd;let done=false;return()=>{if(!done){done=true;inflight-=maxUsd;}};
    },
    record({task,kind,usd,pt=null,ct=null,cached=null,cw=null,http=null}){ // usd = costo real; si faltó, el llamador pasa el máximo
      total+=usd;batch+=usd;calls++;
      fs.appendFileSync(p,JSON.stringify({ts:new Date().toISOString(),batch:batchId,task,kind,usd:+usd.toFixed(8),pt,ct,cached,cw,http})+'\n',{mode:0o600});
    },
    summary(){return{total_usd:+total.toFixed(6),batch_usd:+batch.toFixed(6),calls,cap_total_usd:capTotalUsd,cap_batch_usd:capBatchUsd};},
  };
}
