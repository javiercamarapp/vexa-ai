import test from 'node:test';import assert from 'node:assert/strict';
import {cifraBrief,cifraTitular,accionPrincipal,resumenVigilar,criticosAparte,estadoAccion,etiquetaBase,tituloEs} from './brief.mjs';
const M=(kind,over={})=>({kind,label:kind,amount_minor:null,known_subtotal:null,currency:'USD',exponent:2,coverage:{known_n:0,eligible_n:0},...over});
test('subtotal conocido en lugar de «Desconocido»: se muestra el valor y se rotula como no total (QA1-024)',()=>{
 const c=cifraBrief(M('allOrders',{known_subtotal:'168696198',coverage:{known_n:812,eligible_n:1000}}));
 assert.equal(c.tipo,'subtotal');assert.equal(c.valor,'168696198');assert.match(c.rotulo,/no es el total/);
});
test('reembolsos sin registros elegibles = «Sin cobertura», nunca cero ni desconocido genérico',()=>{
 assert.equal(cifraBrief(M('refunds')).tipo,'sin_cobertura');
 assert.equal(cifraBrief(M('refunds',{known_subtotal:'0',coverage:{known_n:0,eligible_n:20}})).tipo,'sin_cobertura','subtotal 0 sin ningún registro conocido no es un dato');
 assert.equal(cifraBrief(M('x',{coverage:{known_n:3,eligible_n:9}})).tipo,'desconocida');
 assert.equal(cifraBrief(M('x',{amount_minor:'0',coverage:{known_n:3,eligible_n:3}})).tipo,'exacta','un cero publicado sí es un cero');
});
test('el titular prefiere exposición exacta, luego una exacta, luego el subtotal rotulado',()=>{
 const exp=M('exposure',{amount_minor:'500',coverage:{known_n:1,eligible_n:1}}),ord=M('allOrders',{known_subtotal:'900',coverage:{known_n:2,eligible_n:3}});
 assert.equal(cifraTitular([ord,exp]).m.kind,'exposure');
 const t=cifraTitular([M('exposure'),ord,M('refunds')]);assert.equal(t.tipo,'subtotal');assert.equal(t.m.kind,'allOrders');
 assert.equal(cifraTitular([M('exposure'),M('refunds')]),null);assert.equal(cifraTitular([]),null);
});
const P=(id,title,extra={})=>({id,title,rank:1,rankingBasis:'published_priority',critical:false,evidenceCount:3,...extra});
test('«Qué hacer» sale de las prioridades: la acción del problema de mayor rango; si ninguna corresponde, null (no una acción de otro problema)',()=>{
 const top3=[P('a','Order: Spare Parts'),P('b','Warranty: Battery Replacement'),P('c','Shipping: Questions')];
 const acciones=[{id:'r1',title:'Shipping: Delivery Not Received',kind:'recommendation',status:'proposed'},{id:'r2',title:'Warranty: Battery Replacement',kind:'recommendation',status:'proposed'}];
 assert.equal(accionPrincipal(top3,acciones).accion.id,'r2');assert.equal(accionPrincipal(top3,acciones).problema.id,'b');
 assert.equal(accionPrincipal(top3,[acciones[0]]),null);assert.equal(accionPrincipal([],acciones),null);
});
test('«Qué vigilar» usa el total registrado en la selección y dice cuántos se detallan; briefs antiguos sin selección no inventan un total',()=>{
 const crit=[P('a','x'),P('b','y'),P('c','z'),P('d','w'),P('e','v')];
 assert.deepEqual(resumenVigilar({critical:crit,selection:{criticalCandidates:49}}),{total:49,listados:5,omitidos:44});
 assert.deepEqual(resumenVigilar({critical:crit}),{total:null,listados:5,omitidos:null});
});
test('los críticos que ya son prioridad no se repiten como tarjeta',()=>{
 const a=P('a','x'),b=P('b','y'),c=P('c','z'),d=P('d','w');
 const r=criticosAparte({top3:[a,b,c],critical:[a,d]});assert.deepEqual(r.nuevos.map(p=>p.id),['d']);assert.deepEqual(r.repetidos.map(p=>p.id),['a']);
});
test('estados y títulos en español',()=>{
 assert.equal(estadoAccion('proposed'),'Propuesta');assert.equal(estadoAccion('algo-nuevo'),'algo-nuevo');
 assert.equal(etiquetaBase(P('a','x')),'Prioridad publicada');assert.match(etiquetaBase(P('a','x',{rankingBasis:'evidence_count'})),/cantidad de evidencia/);
 assert.equal(tituloEs('Order: Spare Parts'),'Pedido: Refacciones');
});
