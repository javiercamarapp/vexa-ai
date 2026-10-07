import test from 'node:test';
import assert from 'node:assert/strict';
import { readRequestBytes, readRequestText, readRequestJson } from '../src/lib/request-body';

const request = (body: BodyInit, extra: RequestInit = {}) => new Request('http://127.0.0.1/synthetic', {
  method: 'POST', body, ...extra, ...({ duplex: 'half' } as RequestInit),
});

test('body limit counts UTF-8 bytes and preserves valid JSON at the boundary', async () => {
  const text = '{"value":"á"}';
  assert.deepEqual(await readRequestJson(request(text), Buffer.byteLength(text)), { value: 'á' });
  await assert.rejects(readRequestText(request(text), Buffer.byteLength(text) - 1), { status: 413 });
});

test('chunked input stops and cancels at the limit without trusting Content-Length', async () => {
  let reads = 0, cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { reads++; controller.enqueue(new Uint8Array(16)); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  await assert.rejects(readRequestBytes(request(body, { headers: { 'content-length': '1' } }), 32), { status: 413 });
  assert.equal(reads, 3);
  assert.equal(cancelled, true);
});

test('oversized declared length is rejected before reading the stream', async () => {
  let reads = 0, cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { reads++; controller.enqueue(new Uint8Array(16)); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  await assert.rejects(readRequestBytes(request(body, { headers: { 'content-length': '33' } }), 32), { status: 413 });
  assert.equal(reads, 0); assert.equal(cancelled, true);
});

test('stalled input times out and cancellation does not wait on an upstream producer', async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    cancel() { cancelled = true; return new Promise(() => {}); },
  });
  await assert.rejects(readRequestBytes(request(body), 32, 20), { status: 408 });
  assert.equal(cancelled, true);
});

test('request abort cancels a pending read', async () => {
  const controller = new AbortController(); let cancelled = false;
  const body = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
  const result = readRequestBytes(request(body, { signal: controller.signal }), 32);
  controller.abort();
  await assert.rejects(result, { status: 408 }); assert.equal(cancelled, true);
});

test('malformed UTF-8 is rejected and a subsequent valid request works', async () => {
  await assert.rejects(readRequestText(request(new Uint8Array([0xff])), 32), { status: 400 });
  assert.equal(await readRequestText(request('ok'), 32), 'ok');
});

test('concurrent stalled requests are bounded and slots are released after cancellation', async () => {
  const controllers = Array.from({ length: 64 }, () => new AbortController());
  const pending = controllers.map(controller => readRequestBytes(request(new ReadableStream(), { signal: controller.signal }), 32));
  const settled = Promise.allSettled(pending);
  try { await assert.rejects(readRequestBytes(request('ok'), 32), { status: 429 }); }
  finally { controllers.forEach(controller => controller.abort()); await settled; }
  assert.equal(await readRequestText(request('ok'), 32), 'ok');
});
