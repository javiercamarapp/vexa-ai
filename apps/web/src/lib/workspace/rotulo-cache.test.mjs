import test from 'node:test';import assert from 'node:assert/strict';
import {textoCache} from './rotulo-cache.mjs';
test('un dato de caché siempre lleva su antigüedad; uno recién leído no lleva rótulo',()=>{
 assert.equal(textoCache(null),null);
 assert.equal(textoCache(42000,{actualizando:true}),'Mostrando la última carga (hace 42 s).');
 assert.equal(textoCache(240000),'Mostrando la última carga (hace 4 min).');
 assert.match(textoCache(600000,{viejo:true}),/hace 10 min\)\. No se pudo actualizar ahora; se conserva este dato\.$/);
});
