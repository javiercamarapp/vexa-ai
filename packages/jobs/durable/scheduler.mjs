// Local scheduler exercising exactly the hosted HTTP protocol. No tenant in request.
import {setTimeout as delay} from 'node:timers/promises';

const env = process.env;
const interval = Number(env.VEXA_WORKER_INTERVAL_MS ?? 30000);
let url;
try { url = new URL(env.VEXA_WORKER_ENDPOINT ?? ''); }
catch { throw Error('CONFIGURATION_REQUIRED'); }
if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(url.hostname)) throw Error('TLS_REQUIRED');
if (!env.VEXA_WORKER_TRIGGER_SECRET || !Number.isFinite(interval) || interval < 10000 || interval > 60000) throw Error('CONFIGURATION_REQUIRED');

const controller = new AbortController();
const stop = () => controller.abort();
const once = process.argv.includes('--once');
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
try {
  while (!controller.signal.aborted) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {Authorization: 'Bearer ' + env.VEXA_WORKER_TRIGGER_SECRET},
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(55000)]),
        redirect: 'error',
      });
      console.log('worker_http_status=' + response.status);
      // The scheduler needs the status only; never retain or log response payloads.
      await response.body?.cancel();
      if (once && !response.ok) process.exitCode = 1;
    } catch {
      if (controller.signal.aborted) break;
      console.error('worker_transport_error');
      if (once) process.exitCode = 1;
    }
    if (once || controller.signal.aborted) break;
    try { await delay(interval, undefined, {signal: controller.signal}); }
    catch (error) { if (!controller.signal.aborted) throw error; }
  }
} finally {
  process.removeListener('SIGTERM', stop);
  process.removeListener('SIGINT', stop);
}
