//   node --test apps/web/src/lib/legibilidad/recomendaciones-vista.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {traducirTaxonomia,siguientePaso,resumenRecomendaciones,responsable,textoLegible,etiquetaCausal,esDeGeneradorAnterior} from './recomendaciones-vista.mjs';
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

test('A5: texto v1 ilegible se presenta resumido y en español, sin tocar lo guardado',()=>{
 const accion='Solicitar revisión humana urgente de «Pedido: Refacciones»: contrastar los indicios de Distribuidores: Alianza comercial, Pedido: Refacciones, Garantía: Reemplazo de herramienta O con una inspección operacional independiente antes de cualquier medida externa.';
 assert.equal(textoLegible(accion),'Solicitar revisión humana urgente de «Pedido: Refacciones»: contrastar los indicios citados con una inspección operativa independiente antes de cualquier medida externa.');
 const porque='Propuesta condicionada para el problema versión 3, respaldada por 12 citas autorizadas en 12 categorías (Pedido: Refacciones, Garantía: Diagnóstico previo, Envío: Preguntas). Estado causal unassessed: los síntomas citados no acreditan por sí solos una causa. No estima ahorros ni atribuye efectos causales.';
 const r=textoLegible(porque);
 assert.match(r,/en 12 categorías \(las más frecuentes están en «Evidencia»\)\./);
 assert.match(r,/Estado causal: sin evaluar\. Los síntomas citados/);
 assert.ok(!/unassessed/.test(r));
 assert.equal(textoLegible('Contrastar los hitos de transporte de «X» con registros; documentar en qué etapa aparece la incidencia de Envío: Preguntas, Envío: Retraso. Fin'),'Contrastar los hitos de transporte de «X» con registros; documentar en qué etapa aparece la incidencia. Fin');
});
test('A5: lo que no es plantilla v1 pasa intacto; v2 no se altera',()=>{
 const v2='Por qué: 12 citas autorizadas en 4 categorías; las más frecuentes son «Pedido: Refacciones» (5 citas). Estado causal: sin evaluar. Los síntomas citados no acreditan por sí solos una causa.';
 assert.equal(textoLegible(v2),v2);
 assert.equal(textoLegible('Texto editado por una persona'),'Texto editado por una persona');
 assert.equal(textoLegible(undefined),undefined);
 assert.equal(textoLegible(textoLegible('Estado causal unassessed: los síntomas')),'Estado causal: sin evaluar. Los síntomas');
});
test('A5: estados causales y generador anterior',()=>{
 assert.equal(etiquetaCausal('unassessed'),'Sin evaluar');assert.equal(etiquetaCausal('algo_nuevo'),'algo_nuevo');
 assert.equal(esDeGeneradorAnterior({generatorVersion:'conditioned-rules-v1'}),true);
 assert.equal(esDeGeneradorAnterior({generatorVersion:'conditioned-rules-v2'}),false);
 assert.equal(esDeGeneradorAnterior({}),false);
});

test('A1 (auditoría 24-oct): la propuesta de Proceder nunca muestra la taxonomía en inglés y el paso 1 usa la capa de legibilidad',async()=>{
 const crudo='Solicitar revisión humana: contrastar los indicios citados de Dealers: Partnership, Dealers: Warranty, Feedback: Negative, Order: Cancel, Not Shipped con registros.';
 const r=textoLegible(crudo);
 for(const en of ['Dealers: Partnership','Dealers: Warranty','Feedback: Negative','Order: Cancel, Not Shipped'])assert.ok(!r.includes(en),en);
 assert.match(r,/Distribuidores: Alianza comercial, Distribuidores: Garantía, Opinión: Negativa, Pedido: Cancelación, aún sin enviar/);
 const {readFileSync}=await import('node:fs');
 const src=readFileSync(new URL('../../components/recommendations/flujo-acciones.tsx',import.meta.url),'utf8');
 assert.match(src,/\{textoLegible\(item\.action\)\}/);
 assert.ok(!/<p[^>]*>\{item\.action\}<\/p>/.test(src));
});
