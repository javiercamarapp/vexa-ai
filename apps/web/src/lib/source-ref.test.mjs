import test from 'node:test';import assert from 'node:assert/strict';
import {sourceRefLabel} from './source-ref.mjs';
test('technical source references become plain Spanish and never show "snapshot:"',()=>{
 for(const ref of ['snapshot:exposure.global','snapshot:orders.all','snapshot:refunds.settled','snapshot:model.replacement','snapshot:exposure.00000000-0000-4000-8000-000000000101','snapshot:refunds.00000000-0000-4000-8000-000000000101','snapshot:other.kind','conv:00000000-0000-4000-8000-000000000801#m3']){
  const label=sourceRefLabel(ref);assert.ok(label&&!/snapshot:/.test(label),ref+' -> '+label);}
 assert.equal(sourceRefLabel('snapshot:refunds.settled'),'Reembolsos liquidados · total del corte');
 assert.equal(sourceRefLabel('conv:00000000-0000-4000-8000-000000000801#m3'),'Conversación · mensaje 3');
 assert.equal(sourceRefLabel('algo-desconocido'),'algo-desconocido');assert.equal(sourceRefLabel(null),'');
});
