import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
test('F04-07 evaluation implementation must exist',()=>{assert.ok(process.env.VEXA_CANDIDATE,'CANDIDATE_REQUIRED');assert.ok(fs.existsSync(path.join(process.env.VEXA_CANDIDATE,'packages/intelligence/evaluation/evaluate.mjs')),'F0407_IMPLEMENTATION_MISSING');});
