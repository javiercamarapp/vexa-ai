import test from 'node:test';
import {root,read,checkSource,checkReadiness,checkEnvironments,checkFixture,checkRegister} from './foundation.mjs';
test('F00-04: preparation contract only',async()=>{await checkFixture(read('tests/fixtures/syn-e2e-v1.json'));});
