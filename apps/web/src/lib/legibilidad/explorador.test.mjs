import test from 'node:test';import assert from 'node:assert/strict';
import {agruparCitas,citasDistintas,hayImporteConocido,textoConversaciones,textoCitas,resumenResultados,AVISO_TERCEROS,AVISO_IMPORTE} from './explorador.mjs';
import {ESPERA} from './espera.mjs';
const c=(over={})=>({runId:'r1',messageRevisionId:'m1',quoteHash:'h1',quote:'Hola',role:'customer',category:'Dealers: Partnership',...over});
test('QA2-007: la misma cita en varias corridas se muestra una vez con ×N, en orden estable',()=>{
 const g=agruparCitas([c({runId:'r1'}),c({runId:'r2'}),c({runId:'r3'}),c({runId:'r4'}),c({messageRevisionId:'m2',quoteHash:'h2',quote:'Otra'})]);
 assert.equal(g.length,2);assert.equal(g[0].veces,4);assert.equal(g[0].runId,'r1');assert.equal(g[1].veces,1);assert.equal(citasDistintas([c(),c({runId:'r2'}),c({quoteHash:'h9'})]),2);
});
test('el mismo texto en MENSAJES distintos no se funde (el origen es distinto)',()=>{assert.equal(agruparCitas([c(),c({messageRevisionId:'m2'})]).length,2);});
test('sin citas: lista vacía y distintas null si no es una lista',()=>{assert.deepEqual(agruparCitas([]),[]);assert.deepEqual(agruparCitas(null),[]);assert.equal(citasDistintas(undefined),null);});
test('el aviso de terceros dice lo que se redacta y lo que no',()=>{assert.match(AVISO_TERCEROS,/correos, teléfonos y números largos/);assert.match(AVISO_TERCEROS,/nombres o direcciones de terceros/);assert.match(AVISO_TERCEROS,/no lo compartas fuera de tu organización/);});
test('QA2-006: el importe solo se avisa una vez cuando ninguno es conocido; desconocido ≠ 0',()=>{
 const sin=[{metrics:[{amount_minor:null}]},{metrics:[{amount_minor:null}]}];
 assert.equal(hayImporteConocido(sin),false);assert.equal(hayImporteConocido([...sin,{metrics:[{amount_minor:'0'}]}]),true,'un cero real SÍ es un importe conocido');assert.equal(hayImporteConocido([]),false);
 assert.match(AVISO_IMPORTE,/desconocido.*no cero/);
});
test('textos de la fila: plural/singular y null cuando no se sabe',()=>{
 assert.equal(textoConversaciones(1),'1 conversación');assert.equal(textoConversaciones(1234),'1,234 conversaciones');assert.equal(textoConversaciones(null),null);assert.equal(textoConversaciones(0),'0 conversaciones');
 assert.equal(textoCitas(1),'1 cita distinta');assert.equal(textoCitas(3),'3 citas distintas');assert.equal(textoCitas(undefined),null);
});
test('línea de resultados tras buscar o filtrar',()=>{
 assert.equal(resumenResultados({total:394}),'394 problemas coinciden.');assert.equal(resumenResultados({total:1,texto:'envío'}),'1 problema coincide con «envío».');
 assert.equal(resumenResultados({total:12,texto:'x',estado:'partial'}),'12 problemas coinciden con «x» y cobertura parcial.');
});
test('QA2-007: espera de evidencia inmediata y con texto propio',()=>{assert.equal(ESPERA.evidencia.titulo,'Verificando la evidencia…');assert.ok(ESPERA.evidencia.detalle.length>10);assert.doesNotMatch(ESPERA.explorador.detalle,/hasta 30 segundos/);});
