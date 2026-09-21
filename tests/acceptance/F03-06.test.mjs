import test from 'node:test';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {pureMutants} from './support/F03-comparison/mutants.mjs';
import {setup} from './support/F03-comparison/harness.mjs';import {domain} from './support/F03-comparison/domain.mjs';
test('F03-06 frozen migration comparison real SQL Auth API browser',{timeout:540000},async t=>{const evidence=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-f0306-external-'));t.diagnostic('EVIDENCE:'+evidence);let h;try{h=await setup(process.env.VEXA_CANDIDATE,evidence);await domain(t,h);await t.test('comparison method, money precision and coverage mutants fail their oracles',()=>pureMutants(process.env.VEXA_CANDIDATE,evidence));h.verifySources();}finally{if(h)await h.close();}});
