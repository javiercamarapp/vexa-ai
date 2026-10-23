import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeRecommendation,GENERATOR_VERSION} from '../generate.mjs';
const refs=n=>Array.from({length:n},(_,i)=>({runId:'r'+i,quote:'texto '+i,category:i%3===0?'Order: Spare Parts':i%3===1?'Warranty: Tool Replacement':'Shipping: Delivery Not Received',severity:'low',messageRevisionId:'m'+i}));
const ES={'Order: Spare Parts':'Pedido: Refacciones','Warranty: Tool Replacement':'Garantía: Reemplazo de herramienta','Shipping: Delivery Not Received':'Envío: Entrega no recibida'};
const etiqueta=x=>ES[x]??x;
test('A5: el generador vigente produce español claro con acción, por qué, estado causal y condiciones, sin estados en inglés',()=>{
 const r=proposeRecommendation({problem:{title:'Order: Spare Parts',version:2},evidenceRefs:refs(12),causality:null,etiqueta});
 assert.equal(r.generatorVersion,GENERATOR_VERSION);
 assert.match(r.action,/^[A-ZÁÉÍÓÚ]/);
 assert.ok(r.action.length<260,'una sola acción concreta, no una lista de categorías');
 assert.match(r.rationale,/^Por qué: 12 citas autorizadas en 3 categorías; las más frecuentes son/);
 assert.match(r.rationale,/Estado causal: sin evaluar/);
 for(const campo of [r.action,r.rationale,...r.preconditions])assert.ok(!/unassessed|hypothesis|Shipping:|Warranty:|Order:|Delivery Not/.test(campo),campo);
 assert.ok(r.preconditions.length>=3&&r.preconditions.every(p=>typeof p==='string'&&/^[A-ZÁÉÍÓÚ]/.test(p)));
 assert.equal(r.automaticExternalAction,false);
});
test('A5: una acción crítica no repite la lista de categorías (queda en «Evidencia»)',()=>{
 const r=proposeRecommendation({problem:{title:'Pedido: Refacciones',version:1},evidenceRefs:refs(30).map((e,i)=>({...e,category:'Cat '+i,severity:i===0?'critical':'low'})),causality:{claim:{criticalReview:true,state:'unassessed',evidenceIds:[],version:0}}});
 assert.equal(r.priority,'critical');
 assert.doesNotMatch(r.action,/Cat 1|Cat 2/);
 assert.match(r.rationale,/y 27 categorías más/);
});
