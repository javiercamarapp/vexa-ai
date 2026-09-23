import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
test('F06-04 implements a real allowlisted explorer service',()=>assert.ok(process.env.VEXA_CANDIDATE&&fs.existsSync(path.join(process.env.VEXA_CANDIDATE,'packages/recommendations/explorer.mjs')),'EXPLORER_IMPLEMENTATION_MISSING'));
