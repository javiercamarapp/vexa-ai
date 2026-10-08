import test from 'node:test';
import assert from 'node:assert/strict';
import {runSecurityComponents,securityTimeoutMs} from '../../support/F07-security/security-components.mjs';

test('F07-01: sequential local security components and explicit coverage closure', {timeout:securityTimeoutMs()}, async()=>{
  const result=await runSecurityComponents();
  assert.equal(result.status,'PASS',`F07_SECURITY_NOT_CLOSED: ${result.reason}; evidence=${result.evidence}`);
});
