import {mutants} from './support/F03-sync/mutants.mjs';
import {boundaries} from './support/F03-sync/boundaries.mjs';
import {scope} from './support/F03-sync/scope.mjs';
import test from 'node:test';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {setup} from './support/F03-sync/harness.mjs';import {domain} from './support/F03-sync/domain.mjs';
import * as sync from './support/F01-03/sync/oracles.mjs';import {foreignKeys} from './support/F01-03/oracles.mjs';
test('F03-03 real PostgreSQL page transactions and recovery',{timeout:540000},async t=>{
 const evidence=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-f0303-external-'));t.diagnostic('EVIDENCE:'+evidence);let h;const result={node:process.version,status:'running',started:new Date().toISOString()};fs.writeFileSync(path.join(evidence,'receipt.json'),JSON.stringify(result),{mode:0o600});
 try{h=await setup(process.env.VEXA_CANDIDATE,evidence);await domain(t,h);await boundaries(t,h);await scope(t,h);await t.test('008 schema/grants/RLS/FKs',()=>{const f=sync.seedStandalone(h);sync.schema(h,foreignKeys(h));sync.access(h,f, f.actors);for(const fk of foreignKeys(h).filter(k=>sync.tables.includes(k.table)))sync.fk(h,f,fk);fs.writeFileSync(path.join(evidence,'mutants.json'),JSON.stringify(mutants(h,f)),{mode:0o600});});h.verifySources();result.status='executed';result.verdict='consult-node-exit-and-subtests';}
 catch(e){result.status='failed';result.error=e.code??e.message;throw e;}finally{if(h)await h.close();result.finished=new Date().toISOString();fs.writeFileSync(path.join(evidence,'receipt.json'),JSON.stringify(result),{mode:0o600});}
});
