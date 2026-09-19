import test from 'node:test';
import assert from 'node:assert/strict';
import {redirectOracle,revocationOracle} from './oracles.mjs';
const origin='http://127.0.0.1:3640';
test('safe fallback accepts normalized external backslash destination',()=>{
  redirectOracle('/\\example.invalid/escape','/',origin);
});
test('redirect controls preserve local destination and reject external result',()=>{
  redirectOracle('/safe','/safe',origin);
  redirectOracle('https://example.invalid/escape','/',origin);
  assert.throws(()=>redirectOracle('/safe','/',origin),/REDIRECT_LOCAL/);
  assert.throws(()=>redirectOracle('/safe','https://example.invalid/safe',origin),/REDIRECT_ORIGIN/);
});
test('revocation does not accept redirect to protected or arbitrary same-origin route',()=>{
  for(const location of ['/dashboard','/','/organization','//example.invalid/login'])
    assert.throws(()=>revocationOracle(307,location,origin),/REVOKED/);
});
test('explicit denial and local login remain valid positive controls',()=>{
  for(const status of [401,403,404])revocationOracle(status,undefined,origin);
  revocationOracle(303,'/login?reason=revoked',origin);
  assert.throws(()=>revocationOracle(200,'/login',origin),/REVOKED/);
});
