import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// External control-plane entry. The principal updates the gate register before
// prepare; an authored file is not acceptance or evidence of a remote run.
test('F01-05: reviewed CI contract and four actual trusted jobs', async () => {
  assert.ok(process.env.VEXA_CANDIDATE, 'VEXA_CANDIDATE obligatorio');
  const exam=fileURLToPath(new URL('./support/F01-05/exam.py',import.meta.url));
  const child=spawn('python3',['-B',exam,'--candidate',process.env.VEXA_CANDIDATE],{stdio:'inherit'});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  assert.equal(code,0,'F01-05 requires all four jobs, no skips or pending adapters');
});
