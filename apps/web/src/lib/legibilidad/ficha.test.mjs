//   node --test apps/web/src/lib/legibilidad/ficha.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {resumenAdjuntos,serieConversaciones,cambioMensual,estadoIntervencion,encabezadoFicha,IMPACTO_NO_DISPONIBLE} from './ficha.mjs';
import {etiquetaMotivo} from '../../../../../packages/workspace-service/critico.mjs';

test('adjuntos: sin respuesta es «No disponible ahora», no 0; con 0 enlazados lo dice y avisa la cobertura global', () => {
  assert.deepEqual(resumenAdjuntos({state:'unavailable'}),{valor:null,detalle:'No disponible ahora',nota:null});
  assert.equal(resumenAdjuntos(null).valor,null);
  const r=resumenAdjuntos({state:'ok',total:0,conversaciones:0,porClase:{},cobertura:{enlazados:783,total:8188}});
  assert.equal(r.valor,0);assert.match(r.detalle,/Ninguno enlazado/);assert.match(r.nota,/783 de 8,188/);
  const c=resumenAdjuntos({state:'ok',total:6,conversaciones:3,porClase:{imagen:5,video:1},cobertura:null});
  assert.equal(c.detalle,'5 imágenes · 1 video en 3 conversaciones');
});
test('la serie rotula los meses incompletos y el cambio mensual los excluye', () => {
  const v={status:'ok',series:[{month:'2026-07',conversations:100},{month:'2026-08',conversations:150},{month:'2026-09',conversations:40}],completeness:{partialMonths:['2026-09']}};
  const s=serieConversaciones(v);
  assert.deepEqual(s.map(p=>p.partial),[false,false,true]);
  const c=cambioMensual(s);
  assert.equal(c.a.month,'2026-08');assert.equal(c.pct,50);
  assert.equal(serieConversaciones({status:'timeout'}),null);
  assert.equal(cambioMensual([{month:'a',value:0,partial:false},{month:'b',value:5,partial:false}]).pct,null,'base cero: sin porcentaje');
  assert.equal(cambioMensual([{month:'a',value:3,partial:false}]),null);
});
test('intervención: sin intervención solo cuando hay recomendación; el encabezado traduce categoría y motivo', () => {
  assert.equal(estadoIntervencion(null),null);
  assert.equal(estadoIntervencion({intervention:null}),'Sin intervención');
  assert.equal(estadoIntervencion({intervention:'measuring'}),'En medición');
  const h=encabezadoFicha({label:'Warranty: Battery Replacement',grupo:{n:1,de:12},critical:{critical:true,signals:60,reason:'severity'}},etiquetaMotivo);
  assert.equal(h.categoria,'Garantía: Reemplazo de batería');assert.equal(h.grupo,'Grupo 1 de 12');assert.match(h.motivo,/severidad alta/);assert.equal(h.senales,60);
  assert.equal(encabezadoFicha({label:'x',grupo:null,critical:null}).critico,null);
  assert.match(IMPACTO_NO_DISPONIBLE,/No disponible/);
});
