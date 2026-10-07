import test from 'node:test';
import assert from 'node:assert/strict';
import {readTriggerInput} from '../trigger-input.mjs';
import {createHostedHandler} from '../hosted.mjs';
import {createCRMHostedHandler} from '../../../connectors/hosted.mjs';
import {createExtractionHostedHandler} from '../../../intelligence/hosted.mjs';

const secret = 'SYN-local-trigger-secret-0123456789abcdef';
const request = (body, extra={}) => new Request('http://127.0.0.1/api/internal/test', {
  method:'POST', headers:{authorization:'Bearer '+secret}, body, duplex:'half', ...extra,
});

test('trigger permits only empty body or exact empty object', async () => {
  for(const body of ['', '{}']) await readTriggerInput(request(body));
  for(const body of [' ', '[]', '{ }', '{"tenantId":"SYN-B"}']) {
    await assert.rejects(readTriggerInput(request(body)), /BODY_NOT_ALLOWED/);
  }
});

test('trigger cancels a chunked oversized stream after at most three bytes', async () => {
  let pulls=0, cancelled=false;
  const body=new ReadableStream({pull(c){pulls++;c.enqueue(new Uint8Array([123]));},cancel(){cancelled=true;}},{highWaterMark:0});
  await assert.rejects(readTriggerInput(request(body)), /BODY_NOT_ALLOWED/);
  assert.equal(pulls,3);assert.equal(cancelled,true);
});

test('trigger cancels stalled and aborted streams', async () => {
  let cancelled=false;
  await assert.rejects(readTriggerInput(request(new ReadableStream({cancel(){cancelled=true;}})), {timeoutMs:20}), /BODY_TIMEOUT/);
  assert.equal(cancelled,true);
  const controller=new AbortController();const pending=readTriggerInput(request(new ReadableStream(),{signal:controller.signal}));
  controller.abort();await assert.rejects(pending,/BODY_TIMEOUT/);
});

for(const [name,create] of [['imports',createHostedHandler],['crm',createCRMHostedHandler],['extraction',createExtractionHostedHandler]]) {
  test(name+': bad secret does not read body or start runtime; oversized body cannot dispatch',async()=>{
    let calls=0,reads=0;
    const handler=create({secret,runtime:async()=>{calls++;return{idle:true,close:async()=>{}};}});
    const unauthorized=request(new ReadableStream({pull(){reads++;}},{highWaterMark:0}),{headers:{authorization:'Bearer SYN-wrong'}});
    assert.equal((await handler(unauthorized)).status,401);assert.equal(reads,0);assert.equal(calls,0);
    assert.equal((await handler(request('{"tenantId":"SYN-B"}'))).status,400);assert.equal(calls,0);
    assert.equal((await handler(request('{}'))).status,200);assert.equal(calls,1);
  });
}

test('imports: runtime cleanup failure releases the hosted execution guard',async()=>{
  let calls=0;
  const handler=createHostedHandler({secret,runtime:async()=>{
    calls++;return {idle:true,close:async()=>{if(calls===1)throw Error('SYN_CLOSE_FAILURE');}};
  }});
  await assert.rejects(handler(request('{}')),/SYN_CLOSE_FAILURE/);
  assert.equal((await handler(request('{}'))).status,200,'NEXT_TRIGGER_MUST_NOT_STAY_BUSY');
  assert.equal(calls,2);
});
