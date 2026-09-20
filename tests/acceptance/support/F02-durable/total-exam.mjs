// Executable total; never consult receipts or synthetic reference implementations.
import assert from 'node:assert/strict';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {ssrExam} from './ssr-exam.mjs';
export async function totalExam(candidate){
 await ssrExam(candidate);
 const base=path.dirname(new URL(import.meta.url).pathname);
 const env={...process.env,VEXA_CANDIDATE:candidate};delete env.F02_PROBE_CASE;delete env.F02_BYTES_HASH_ONLY;delete env.NODE_TEST_CONTEXT;
 const command=['--test','--test-concurrency=1',...['product-probe.test.mjs','product-expiry.test.mjs','product-bytes.test.mjs'].map(f=>path.join(base,f))];
 const r=spawnSync(process.execPath,command,{env,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
 console.log('TOTAL_NODE_COMMAND',JSON.stringify([process.execPath,...command]),'EXIT',r.status);process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');assert.equal(r.status,0,'TOTAL_PRODUCT_NODE_ORACLES');
 console.log('F02_02_TOTAL_PRODUCT_PASS_REVIEW_PENDING');
}
if(process.argv[1]===new URL(import.meta.url).pathname)await totalExam(path.resolve(process.env.VEXA_CANDIDATE??'.'));
