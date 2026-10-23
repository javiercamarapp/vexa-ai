import test from 'node:test';import assert from 'node:assert/strict';
import {lineaDatosHasta,diaCorte,datosHastaPorFuente,EXPLICACION} from '../datos-hasta.mjs';
test('una fecha por fuente y la explicación de que son independientes',()=>{
 const l=lineaDatosHasta({libro:'2026-10-05T00:00:00.000Z',conversaciones:'2026-10-22'});
 assert.equal(l,'Libro económico (pedidos y reembolsos): datos hasta el 5 oct 2026 · Conversaciones: datos hasta el 22 oct 2026. '+EXPLICACION);
});
test('fecha desconocida no se inventa ni se hereda de otra fuente',()=>{
 assert.equal(diaCorte(null),null);assert.equal(diaCorte('basura'),null);
 assert.match(lineaDatosHasta({libro:null,conversaciones:'2026-10-22'}),/Libro económico[^·]*sin fecha de corte/);
 assert.equal(datosHastaPorFuente({csv:'2026-09-30'}).length,1);assert.equal(lineaDatosHasta({}),'');
});
