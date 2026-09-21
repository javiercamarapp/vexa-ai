import {security} from './support/F03-health/security.mjs';
import test from 'node:test';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {setup} from './support/F03-health/harness.mjs';import {domain} from './support/F03-health/domain.mjs';
test('F03-05 durable connector health real Auth SQL API and browser',{timeout:540000},async t=>{const evidence=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-f0305-external-'));t.diagnostic('EVIDENCE:'+evidence);let h;try{h=await setup(process.env.VEXA_CANDIDATE,evidence);await domain(t,h);await security(t,h);h.verifySources();}finally{if(h)await h.close();}});
