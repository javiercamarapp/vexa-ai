import test from 'node:test';import assert from 'node:assert/strict';
import {etiquetaBase,sinJerga} from './jerga.mjs';
test('la base interna se traduce y la desconocida pierde los guiones bajos',()=>{
 assert.equal(etiquetaBase('marketplace_line_price'),'Precio de línea de marketplace');assert.equal(etiquetaBase('otra_base_x'),'otra base x');assert.equal(etiquetaBase(null),'');
});
test('sin jerga: ledger, asientos y economic_fx_versions se traducen',()=>{
 const t=sinJerga('economic_fx_versions está vacío. 80,000 asientos en el ledger. Asientos totales');
 assert.doesNotMatch(t,/economic_fx_versions|ledger|asiento/i);assert.match(t,/versiones de tipo de cambio/);assert.match(t,/registros del libro/);assert.match(t,/Registros del libro totales/);
});
