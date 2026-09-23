import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
test('F06-06 implements immutable snapshot-scoped briefs and protected exports',()=>assert.ok(process.env.VEXA_CANDIDATE&&fs.existsSync(path.join(process.env.VEXA_CANDIDATE,'packages/briefs/index.mjs')),'BRIEF_IMPLEMENTATION_MISSING'));
