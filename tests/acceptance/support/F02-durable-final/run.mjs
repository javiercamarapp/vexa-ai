import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {examine} from './exam.mjs';
delete process.env.F02_CASE_FILTER;
const evidence=process.env.F02_FINAL_EVIDENCE??fs.mkdtempSync(path.join(os.tmpdir(),'f02-final-evidence-'));
console.log('EVIDENCE',evidence);
const result=await examine(process.env.VEXA_CANDIDATE,evidence);console.log('ENTRYDIRECT_FULL',result.status);process.exitCode=result.status==='PASS'?0:1;
