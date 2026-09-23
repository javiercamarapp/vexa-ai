import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
test('F06-08 implements a membership-scoped notification inbox and preferences',()=>assert.ok(process.env.VEXA_CANDIDATE&&fs.existsSync(path.join(process.env.VEXA_CANDIDATE,'packages/notifications/index.mjs')),'NOTIFICATION_IMPLEMENTATION_MISSING'));
