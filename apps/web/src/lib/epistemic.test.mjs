import test from 'node:test';import assert from 'node:assert/strict';
import {epistemicKind,KINDS} from './epistemic.mjs';
test('refunds and orders are observed facts',()=>{assert.equal(epistemicKind({kind:'refunds',status:'complete'}),'observed');assert.equal(epistemicKind({kind:'allOrders'}),'observed');});
test('exposure is inferred (evidence link, not a loss)',()=>{assert.equal(epistemicKind({kind:'exposure'}),'inferred');});
test('models, scenarios and modeled status are estimated',()=>{assert.equal(epistemicKind({kind:'future_scenario'}),'estimated');assert.equal(epistemicKind({kind:'support_model'}),'estimated');assert.equal(epistemicKind({kind:'replacement',status:'modeled'}),'estimated');});
test('an unknown kind is never presented as observed',()=>{assert.equal(epistemicKind(null),'unclassified');assert.equal(epistemicKind({}),'unclassified');assert.equal(epistemicKind({kind:'something_new'}),'unclassified');});
test('every class has a label and a hint',()=>{for(const k of ['observed','estimated','inferred','unclassified']){assert.ok(KINDS[k].label&&KINDS[k].hint);}});
import {epistemicKindConCobertura,SIN_DATOS} from './epistemic.mjs';
test('sin cobertura la insignia es «Sin datos», no Observado ni Inferido',()=>{
 assert.equal(epistemicKindConCobertura({kind:'refunds'},true),'nodata');assert.equal(epistemicKindConCobertura({kind:'exposure'},true),'nodata');
 assert.equal(epistemicKindConCobertura({kind:'refunds'},false),'observed');assert.equal(epistemicKindConCobertura({kind:'exposure'},false),'inferred');
 assert.equal(SIN_DATOS.label,'Sin datos');assert.match(SIN_DATOS.hint,/No es cero/);
});
