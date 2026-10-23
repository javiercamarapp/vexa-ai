//   node --test apps/web/src/lib/legibilidad/recomendaciones-vista.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {traducirTaxonomia,siguientePaso,resumenRecomendaciones,responsable} from './recomendaciones-vista.mjs';
test('traduce solo etiquetas exactas de la taxonomía, sin tocar el resto ni palabras sueltas',()=>{
 assert.equal(traducirTaxonomia('Solicitar revisión humana urgente de «Warranty: Battery Replacement»: contrastar los indicios de Feedback: Negative, Order: Cancel, Not Shipped.'),
  'Solicitar revisión humana urgente de «Garantía: Reemplazo de batería»: contrastar los indicios de Opinión: Negativa, Pedido: Cancelación, aún sin enviar.');
 assert.equal(traducirTaxonomia('Order: Cancel, Shipped'),'Pedido: Cancelación, ya enviado','prefiere la etiqueta más larga');
 assert.equal(traducirTaxonomia('Order: Spare Partsx Feedback: Negativeness'),'Order: Spare Partsx Feedback: Negativeness','no corta palabras');
 assert.equal(traducirTaxonomia('Texto ya en español'),'Texto ya en español');
 assert.equal(traducirTaxonomia(undefined),undefined);
});
test('siguiente paso según el estado real',()=>{
 assert.match(siguientePaso({status:'dismissed'}),/Descartada/);
 assert.match(siguientePaso({status:'proposed',stale:true}),/propuesta vigente/);
 assert.match(siguientePaso({status:'proposed',drafts:[{}],canMutate:true}),/borrador de intervención/);
 assert.match(siguientePaso({status:'proposed',canMutate:false}),/Consulta/);
 assert.match(siguientePaso({status:'proposed',canMutate:true,ownerId:null}),/Asignar un responsable/);
 assert.match(siguientePaso({status:'proposed',canMutate:true,ownerId:'u'}),/Crear una intervención/);
 assert.equal(responsable({ownerId:null}),'Sin asignar');
});
test('resumen: propuestas, críticas, sin responsable, con borrador',()=>{
 const r=resumenRecomendaciones([{status:'proposed',priority:'critical',ownerId:null},{status:'proposed',priority:'normal',ownerId:'u',drafts:[{}]},{status:'dismissed',priority:'critical'}]);
 assert.deepEqual(r,{total:3,propuestas:2,descartadas:1,criticas:1,sinResponsable:1,conBorrador:1});
 assert.equal(resumenRecomendaciones(null).total,0);
});
