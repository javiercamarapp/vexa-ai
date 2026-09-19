import test from 'node:test';
import assert from 'node:assert/strict';
import {redirectOracle,revocationOracle,readOnlyNavigation} from './oracles.mjs';
const origin='http://127.0.0.1:3640';
test('observing selection after forbidden POST never replays the browser form',async()=>{
  let active='authorized-A2';const requests=[];
  // Browser behavior reproduced against real app in the diagnostic: reload on
  // the POST result replays original A, not the body changed by route.fetch.
  const page={reload:async()=>{requests.push('POST A');active='authorized-A';},goto:async url=>requests.push(`GET ${url}`)};
  await readOnlyNavigation(page,origin);
  assert.equal(active,'authorized-A2','observer changed active organization');
  assert.deepEqual(requests,[`GET ${origin}`]);
});
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
