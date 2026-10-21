// Contrato puro de GET /api/economics (parseo de parámetros) y mapeo de errores: un timeout es 504 economic_query_timeout, nunca el 503 genérico.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseEconomicsQuery,economicErrorResponse,QueryRejected} from '../src/app/api/economics/query';
const q=(s:string)=>new URLSearchParams(s);
const scope='start=2026-07-01T00:00:00.000Z&end=2026-10-01T00:00:00.000Z&currency=USD&exponent=2&basis=marketplace_line_price&timezone=UTC';
const code=(f:()=>unknown)=>{try{f();}catch(e){return e instanceof QueryRejected?[e.status,e.code]:'otro';}return null;};
test('sin view: contrato histórico (auto) con alcance',()=>{const r=parseEconomicsQuery(q(scope));assert.equal(r.view,'auto');assert.equal(r.scope!.exponent,2);});
test('overview acepta limit; page no acepta alcance; history exige entityId',()=>{
 assert.equal(parseEconomicsQuery(q(scope+'&view=overview&limit=20')).limit,20);
 const p=parseEconomicsQuery(q('view=page&limit=100&kind=refund&filterCurrency=USD'));assert.deepEqual(p.filters,{kind:'refund',currency:'USD'});
 assert.deepEqual(code(()=>parseEconomicsQuery(q('view=page&currency=USD'))),[400,'unsupported_filter']);
 assert.deepEqual(code(()=>parseEconomicsQuery(q('view=history'))),[400,'entity_id_invalid']);
 assert.equal(parseEconomicsQuery(q('view=history&entityId=abc')).entityId,'abc');
});
test('rechaza claves desconocidas, repetidas, view inválida, limit no numérico y alcance incompleto',()=>{
 assert.deepEqual(code(()=>parseEconomicsQuery(q(scope+'&x=1'))),[400,'unsupported_filter']);
 assert.deepEqual(code(()=>parseEconomicsQuery(q(scope+'&currency=EUR'))),[400,'unsupported_filter']);
 assert.deepEqual(code(()=>parseEconomicsQuery(q(scope+'&view=otra'))),[400,'unsupported_filter']);
 assert.deepEqual(code(()=>parseEconomicsQuery(q('view=page&limit=abc'))),[400,'limit_invalid']);
 assert.deepEqual(code(()=>parseEconomicsQuery(q('view=overview'))),[400,'scope_required']);
 assert.deepEqual(code(()=>parseEconomicsQuery(q(scope+'&view=overview&cursor=x'))),[400,'unsupported_filter']);
});
test('errores: timeout -> 504 con reintento; 409/400 conservan estado; desconocido -> 503',()=>{
 for(const e of [{code:'57014'},{code:'economic_query_timeout',status:504},{message:'canceling statement due to statement timeout'}]){const r=economicErrorResponse(e);assert.equal(r.status,504);assert.equal(r.body.error.code,'economic_query_timeout');assert.equal(r.body.error.retryable,true);assert.equal(r.headers['Retry-After'],'5');}
 assert.equal(economicErrorResponse({status:409,code:'entry_version_conflict'}).status,409);
 assert.equal(economicErrorResponse({status:400,code:'scope_invalid'}).body.error.detail,'scope_invalid');
 const g=economicErrorResponse(new Error('boom'));assert.equal(g.status,503);assert.equal(g.body.error.code,'economic_request_failed');assert.equal(g.body.error.detail,undefined);
});
