import test from 'node:test';
import {root,read,checkSource,checkReadiness,checkEnvironments,checkFixture,checkRegister} from './foundation.mjs';
test('F00-03: preparation contract only',async()=>{checkEnvironments(read('docs/blueprint/environments.json'));});
