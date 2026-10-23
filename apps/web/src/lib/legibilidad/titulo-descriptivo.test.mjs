//   node --test apps/web/src/lib/legibilidad/titulo-descriptivo.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {tituloDescriptivo} from './titulo-descriptivo.mjs';
test('categoría en español + 2 temas más frecuentes con conteos + conversaciones',()=>{
 const t=tituloDescriptivo({label:'Warranty: Troubleshooting (before deciding)',conversaciones:92,temas:[
  {category:'Warranty: Troubleshooting (before deciding)',count:300},{category:'Warranty: Battery Replacement',count:124},{category:'Warranty: Charger Replacement',count:60},{category:'Feedback: Negative',count:9}]});
 assert.equal(t.principal,'Garantía · diagnóstico previo a decidir');
 assert.deepEqual(t.temas,[{nombre:'reemplazo de batería',n:124},{nombre:'reemplazo de cargador',n:60}]);
 assert.equal(t.texto,'Garantía · diagnóstico previo a decidir (reemplazo de batería 124, reemplazo de cargador 60) · 92 conv.');
});
test('un tema de otra familia conserva su etiqueta completa; la propia categoría no se repite',()=>{
 const t=tituloDescriptivo({label:'Order: Spare Parts',temas:[{category:'Order: Spare Parts',count:5},{category:'Feedback: Negative',count:3}]});
 assert.equal(t.texto,'Pedido · refacciones (opinión: negativa 3)');
});
test('sin temas disponibles o sin etiqueta no se inventa nada; el orden es estable',()=>{
 assert.equal(tituloDescriptivo({label:'Shipping: Questions',temas:null,conversaciones:null}).texto,'Envío · preguntas');
 assert.equal(tituloDescriptivo({label:''}),null);
 const a=tituloDescriptivo({label:'x',temas:[{category:'B',count:2},{category:'A',count:2}]});
 assert.deepEqual(a.temas.map(x=>x.nombre),['a','b'],'empate por nombre');
 assert.equal(tituloDescriptivo({label:'Other: Sponsorship',temas:[{category:'Y',count:0}]}).temas.length,0,'conteo 0 no es tema');
});
