import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {totalExam} from './support/F02-durable/total-exam.mjs';
test('F02-02 total real product: local SSR + durable ports; independent review pending',{timeout:290000},async()=>{
 const candidate=path.resolve(process.env.VEXA_CANDIDATE??'.');
 assert.ok(fs.existsSync(path.join(candidate,'packages/jobs/index.mjs')),'IMPLEMENTATION_MISSING: packages/jobs/index.mjs');
 await totalExam(candidate);
});
