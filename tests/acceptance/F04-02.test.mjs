import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {setup} from '../../support/F04-budget/harness.mjs';
import {domain} from '../../support/F04-budget/domain.mjs';
import {security} from '../../support/F04-budget/security.mjs';
import {integration} from '../../support/F04-budget/gateway.mjs';
import {normalization} from '../../support/F04-budget/normalization.mjs';
import {notSent} from '../../support/F04-budget/not-sent.mjs';
test('F04-02 durable budget exists and passes local PostgreSQL Auth boundary',{timeout:300000},async t=>{const candidate=path.resolve(process.env.VEXA_CANDIDATE??process.cwd());for(const f of ['packages/gateway/durable-budget.mjs','supabase/migrations/0011_ai_budget.sql'])assert.ok(fs.existsSync(path.join(candidate,f)),'F04_BUDGET_IMPLEMENTATION_MISSING:'+f);const evidence=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-f0402-external-'));fs.chmodSync(evidence,0o700);let h;try{h=await setup(candidate,evidence);assert.equal(typeof h.budgetModule.createDurableBudgetRepository,'function');await domain(t,h);await security(t,h);await integration(t,h);await notSent(t,h);await normalization(t,h);h.verifySources();}finally{if(h)await h.close();console.log('F04_BUDGET_EVIDENCE:'+evidence);}});
