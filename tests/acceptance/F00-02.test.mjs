import test from 'node:test';
import {root,read,checkSource,checkReadiness,checkEnvironments,checkFixture,checkRegister} from './foundation.mjs';
test('F00-02: preparation contract only',async()=>{checkReadiness(read('docs/blueprint/pilot-readiness.json'));});
