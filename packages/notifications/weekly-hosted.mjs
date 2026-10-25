// Disparador interno del reporte semanal (L5): solo con el secreto del worker (CRON_SECRET igual al trigger), sin cuerpo ni query, un ciclo a la vez, respuesta sin datos personales.
// Misma forma que /api/internal/crm y /worker. `ejecutar()` recorre las organizaciones configuradas con el ACTOR DE SISTEMA (identidad del worker) y devuelve solo conteos.
import {createHash, timingSafeEqual} from 'node:crypto';
const digest = v => createHash('sha256').update(v).digest();
const reply = (code, status, extra = {}) => Response.json({code, ...extra}, {status, headers: {'Cache-Control': 'private, no-store'}});

export function createWeeklyHostedHandler({secret, ejecutar, timeoutMs = 55000}) {
  let activo = false;
  return async request => {
    if (typeof secret !== 'string' || secret.length < 32 || typeof ejecutar !== 'function' || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 58000) return reply('WEEKLY_CONFIGURATION_REQUIRED', 503);
    if (request.method !== 'GET' && request.method !== 'POST') return reply('METHOD_NOT_ALLOWED', 405);
    if (!timingSafeEqual(digest(request.headers.get('authorization') ?? ''), digest('Bearer ' + secret))) return reply('UNAUTHORIZED', 401);
    if (new URL(request.url).search || request.headers.has('origin')) return reply('BODY_NOT_ALLOWED', 400);
    if (request.method === 'POST' && request.body) { const t = await request.text(); if (t !== '' && t !== '{}') return reply('BODY_NOT_ALLOWED', 400); }
    if (activo) return reply('CYCLE_BUSY', 409);
    activo = true;
    let timer;
    try {
      const resultado = await Promise.race([ejecutar({deadlineAt: Date.now() + timeoutMs}), new Promise((_, rej) => { timer = setTimeout(() => rej(Error('WEEKLY_TIMEOUT')), timeoutMs); })]);
      return reply('WEEKLY_COMPLETED', 200, {resultado});
    } catch (e) {
      return e?.message === 'WEEKLY_CONFIGURATION_REQUIRED' ? reply('WEEKLY_CONFIGURATION_REQUIRED', 503) : reply('WEEKLY_UNAVAILABLE', 503);
    } finally { clearTimeout(timer); activo = false; }
  };
}
