// Generador de recomendaciones en español (QA1-021): una acción concreta + por qué, categorías más frecuentes con su conteo, sin plantillas en inglés.
//   node --test packages/recommendations/tests/generate-es.test.mjs
import test from 'node:test';import assert from 'node:assert/strict';
import {proposeRecommendation as proponer,GENERATOR_VERSION} from '../generate.mjs';
import {etiquetaCategoria} from '../../../apps/web/src/lib/legibilidad/categorias.mjs';
const proposeRecommendation=(x)=>proponer({etiqueta:etiquetaCategoria,...x});
const problem={id:'P1',title:'Order: Spare Parts',version:7};
const ref=(category,severity='low',i=0)=>({runId:'R',messageRevisionId:'M'+category+i,quote:'Necesito una pieza '+i,quoteHash:'a'.repeat(63)+(i%10),role:'customer',category,severity});
const muchas=(spec)=>spec.flatMap(([c,n,sev])=>Array.from({length:n},(_,i)=>ref(c,sev??'low',i)));
const INGLES=/unassessed|Order: Spare Parts|Warranty: |Shipping: |Dealers: |Feedback: |Other: /;

test('sin traductor el generador es neutro (categoría tal cual) y con el diccionario sale en español',()=>{assert.match(proponer({problem,evidenceRefs:muchas([['Order: Spare Parts',1]])}).rationale,/«Order: Spare Parts» \(1 cita\)/);});
test('el texto sale en español: título traducido y estado causal «sin evaluar», sin la etiqueta en inglés ni «unassessed»',()=>{
 const x=proposeRecommendation({problem,evidenceRefs:muchas([['Order: Spare Parts',3]])});
 for(const t of [x.action,x.rationale,...x.preconditions])assert.doesNotMatch(t,INGLES,t);
 assert.match(x.action,/«Pedido: Refacciones»/);assert.match(x.rationale,/Estado causal: sin evaluar/);assert.equal(x.causalState,'unassessed','el valor interno no cambia');
});
test('lista las 3 categorías MÁS FRECUENTES con su conteo, orden por frecuencia y luego alfabético, y dice cuántas quedan fuera',()=>{
 const refs=muchas([['Order: Spare Parts',5],['Shipping: Questions',9],['Warranty: Battery Replacement',5],['Feedback: Positive',2],['Dealers: Partnership',1],['Other: Gift Hunters',1]]);
 const x=proposeRecommendation({problem,evidenceRefs:refs});
 const m=x.rationale.match(/las más frecuentes son ([^.]+)\./);assert.ok(m,x.rationale);
 assert.equal(m[1],'«Envío: Preguntas» (9 citas), «Garantía: Reemplazo de batería» (5 citas), «Pedido: Refacciones» (5 citas) y 3 categorías más');
 assert.doesNotMatch(x.rationale+x.action,/Gift Hunters|Dealers|Distribuidores|Opinión/,'no lista las categorías menos frecuentes');
 const otra=proposeRecommendation({problem,evidenceRefs:[...refs].reverse()});
 assert.deepEqual(otra,x,'orden estable: no depende del orden de las citas');
});
test('la rama de la acción depende de las categorías dominantes, no de una cita suelta',()=>{
 const x=proposeRecommendation({problem,evidenceRefs:muchas([['Order: Spare Parts',20],['Shipping: Delivery Not Received',1]])});
 assert.doesNotMatch(x.action,/transport/i);assert.match(x.action,/Investigar/);
 const y=proposeRecommendation({problem,evidenceRefs:muchas([['Shipping: Delivery Not Received',4],['Order: Spare Parts',1]])});
 assert.match(y.action,/transport|entrega/i);
});
test('«Pre-sale: Product Question» ya no cuenta como calidad de producto',()=>{
 const x=proposeRecommendation({problem:{...problem,title:'Pre-sale: Product Question'},evidenceRefs:muchas([['Pre-sale: Product Question',4]])});
 assert.doesNotMatch(x.action,/inspección de producto/);
});
test('una sola acción: una oración de acción, una de por qué; con señales críticas lo dice y la prioridad lo refleja',()=>{
 const x=proposeRecommendation({problem,evidenceRefs:[...muchas([['Order: Spare Parts',4]]),ref('Order: Spare Parts','high',9)]});
 assert.match(x.rationale,/1 de ellas es una señal crítica/);assert.equal(x.priority,'high');
 assert.equal(x.action.split(/(?<=\.)\s/).length,1,'una sola oración de acción');
});
test('conserva lo pedido por la seguridad: crítico, precondiciones, sin autorizar acciones externas, sin importes',()=>{
 const x=proposeRecommendation({problem,evidenceRefs:muchas([['Safety: Smoke',1,'unknown']])});
 assert.equal(x.priority,'critical');assert.match(x.action,/humana urgente/);assert.ok(x.preconditions.some(p=>/no autoriza recalls/.test(p)));
 assert.ok(x.preconditions.length>=4);assert.equal(x.automaticExternalAction,false);assert.equal(x.causalClaim,false);assert.match(x.rationale,/No estima ahorros/);
 assert.doesNotMatch(x.action+x.rationale,/\$|USD/);
});
test('estados causales traducidos y la causa confirmada solo con evidencia',()=>{
 const base={problem,evidenceRefs:muchas([['Order: Spare Parts',2]])};
 assert.match(proposeRecommendation({...base,causality:{claim:{state:'hypothesis',version:3,probableCause:'x',evidenceIds:['E']}}}).rationale,/Estado causal: causa probable, no confirmada\. Los síntomas citados no acreditan/);
 const c=proposeRecommendation({...base,causality:{claim:{state:'confirmed',version:4,probableCause:'Lote defectuoso',evidenceIds:['E']}}});
 assert.match(c.rationale,/evaluación operacional versión 4 confirma: Lote defectuoso/);assert.equal(c.causalClaim,false);
 assert.match(proposeRecommendation(base).preconditions.join(' '),/sin confirmación/);
});
test('la versión del generador cambia: lo guardado antes conserva su versión',()=>{assert.equal(GENERATOR_VERSION,'conditioned-rules-v2');});
test('compatible con la guarda de la base: 1..500 citas verificadas, el texto cabe en los topes de revisión',()=>{
 for(const n of [1,50,500]){const x=proposeRecommendation({problem,evidenceRefs:Array.from({length:n},(_,i)=>ref('Order: Spare Parts','low',i))});
  assert.ok(x.action.length>=20&&x.action.length<=2000);assert.ok(x.rationale.length>=20&&x.rationale.length<=4000-260,'deja margen para la frase de muestra que añade el repositorio');
  for(const p of x.preconditions)assert.ok(p.length>=10&&p.length<=500);assert.ok(x.preconditions.length<=10);}
 assert.throws(()=>proposeRecommendation({problem,evidenceRefs:[]}),e=>e.status===400);
});
