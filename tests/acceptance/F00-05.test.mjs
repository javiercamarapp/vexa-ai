import test from 'node:test';
import {root,read,checkSource,checkReadiness,checkEnvironments,checkFixture,checkRegister} from './foundation.mjs';
test('F00-05: preparation contract only',async()=>{checkRegister(read('docs/blueprint/gate-register.json'));});
