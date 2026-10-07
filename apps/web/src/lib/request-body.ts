import { AccessError } from '@vexa/platform/session';

// Shared across Next route bundles in this Node process; not a distributed quota.
const registry = globalThis as typeof globalThis & { __rovaqBodyAdmission?: { active: number } };
const admission = registry.__rovaqBodyAdmission ??= { active: 0 };
const MAX_ACTIVE_READERS = 64;

// Bound the stream before decoding/parsing, including requests without Content-Length.
export async function readRequestBytes(request: Request, maxBytes: number, timeoutMs = 5000): Promise<Uint8Array<ArrayBuffer>> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new TypeError('Invalid request body limits');
  }
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    void request.body?.cancel().catch(() => {});
    throw new AccessError(413, 'input_limit');
  }
  if (request.signal.aborted) throw new AccessError(408, 'input_timeout');
  if (!request.body) return new Uint8Array();
  if (admission.active >= MAX_ACTIVE_READERS) {
    void request.body.cancel().catch(() => {});
    throw new AccessError(429, 'input_busy');
  }
  const reader = request.body.getReader();
  admission.active++;
  const chunks: Uint8Array[] = [];
  let total = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: () => void = () => {};
  const stopped = new Promise<never>((_, reject) => {
    abort = () => reject(new AccessError(408, 'input_timeout'));
    timer = setTimeout(abort, timeoutMs);
    request.signal.addEventListener('abort', abort, { once: true });
    if (request.signal.aborted) abort();
  });
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), stopped]);
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new AccessError(413, 'input_limit');
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } catch (error) {
    // Cancellation may wait on an upstream producer; do not delay the rejection.
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    admission.active--;
    clearTimeout(timer);
    request.signal.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}

export async function readRequestText(request: Request, maxBytes: number): Promise<string> {
  const bytes = await readRequestBytes(request, maxBytes);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new AccessError(400, 'input_invalid'); }
}

export async function readRequestJson(request: Request, maxBytes: number) {
  return JSON.parse(await readRequestText(request, maxBytes));
}

export async function boundedRequest(request: Request, maxBytes: number): Promise<Request> {
  if (request.method === 'GET' || request.method === 'HEAD') return request;
  return new Request(request.url, {
    method: request.method, headers: request.headers, signal: request.signal,
    body: await readRequestBytes(request, maxBytes),
  });
}
