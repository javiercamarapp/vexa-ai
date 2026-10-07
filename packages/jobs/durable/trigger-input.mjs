// Scheduler triggers carry no tenant or work payload: only an empty body or {}.
export async function readTriggerInput(request, {timeoutMs = 5000} = {}) {
  if (new URL(request.url).search) throw Error('BODY_NOT_ALLOWED');
  if (request.signal.aborted) throw Error('BODY_TIMEOUT');
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 2)) {
    void request.body?.cancel().catch(() => {});
    throw Error('BODY_NOT_ALLOWED');
  }
  if (!request.body) return;
  const reader = request.body.getReader();
  let size = 0, body = '', timer, abort;
  const stop = new Promise((_, reject) => {
    abort = () => reject(Error('BODY_TIMEOUT'));
    timer = setTimeout(abort, timeoutMs);
    request.signal.addEventListener('abort', abort, {once: true});
    if (request.signal.aborted) abort();
  });
  try {
    for (;;) {
      const {done, value} = await Promise.race([reader.read(), stop]);
      if (done) break;
      size += value.byteLength;
      if (size > 2) throw Error('BODY_NOT_ALLOWED');
      body += Buffer.from(value).toString('utf8');
    }
    if (body !== '' && (request.method !== 'POST' || body !== '{}')) throw Error('BODY_NOT_ALLOWED');
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}
