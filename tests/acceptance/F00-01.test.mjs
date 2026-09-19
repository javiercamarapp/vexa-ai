import test from 'node:test';
import {root,read,checkSource,checkReadiness,checkEnvironments,checkFixture,checkRegister} from './foundation.mjs';
test('F00-01: preparation contract only',async()=>{checkSource(read('docs/blueprint/source-review.json'),read('tests/fixtures/source-manifest.json',root));});
