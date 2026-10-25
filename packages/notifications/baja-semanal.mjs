// Baja de un clic del reporte semanal (L6). Token HMAC-SHA256 con expiración larga (400 días por defecto), sin sesión: lleva tenant + usuario + alcance, nunca un correo.
// El enlace del correo abre GET /api/baja?t=… (una sola acción, sin pasos) y List-Unsubscribe-Post usa POST con el mismo token (RFC 8058). Idempotente y reversible («Volver a suscribirme»).
// Sin PII en registros: solo etiquetas fijas. La página no muestra el correo ni el nombre de nadie.
import {createHmac, timingSafeEqual} from 'node:crypto';

export const BAJA_ALCANCE = 'weekly';
export const BAJA_VIGENCIA_DIAS = 400;
const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const b64 = b => Buffer.from(b).toString('base64url');
const firma = (secret, cuerpo) => createHmac('sha256', secret).update('rovaq-baja-v1.' + cuerpo).digest('base64url');
const secretoOk = s => typeof s === 'string' && s.length >= 32;

/** Token «v1.<payload>.<firma>». Lanza si el secreto es corto o los ids no son UUID. */
export function firmarBaja({secret, tenantId, userId, now = new Date(), vigenciaDias = BAJA_VIGENCIA_DIAS}) {
  if (!secretoOk(secret)) throw Error('baja_secret_required');
  if (!UUID.test(tenantId ?? '') || !UUID.test(userId ?? '')) throw Error('baja_ids_invalid');
  if (!Number.isInteger(vigenciaDias) || vigenciaDias < 1 || vigenciaDias > 800) throw Error('baja_vigencia_invalid');
  const cuerpo = b64(JSON.stringify({t: tenantId, u: userId, s: BAJA_ALCANCE, e: Math.floor(now.getTime() / 1000) + vigenciaDias * 86400}));
  return `v1.${cuerpo}.${firma(secret, cuerpo)}`;
}
/** {ok:true, tenantId, userId} o {ok:false, motivo: formato|firma|expirado|alcance}. La firma se comprueba ANTES de leer el contenido. */
export function verificarBaja({secret, token, now = new Date()}) {
  if (!secretoOk(secret)) return {ok: false, motivo: 'sin_secreto'};
  if (typeof token !== 'string' || token.length > 400 || !/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) return {ok: false, motivo: 'formato'};
  const [, cuerpo, sig] = token.split('.');
  const esperada = Buffer.from(firma(secret, cuerpo)), dada = Buffer.from(sig);
  if (esperada.length !== dada.length || !timingSafeEqual(esperada, dada)) return {ok: false, motivo: 'firma'};
  let p; try { p = JSON.parse(Buffer.from(cuerpo, 'base64url').toString()); } catch { return {ok: false, motivo: 'formato'}; }
  if (!p || p.s !== BAJA_ALCANCE) return {ok: false, motivo: 'alcance'};
  if (!UUID.test(p.t ?? '') || !UUID.test(p.u ?? '') || !Number.isInteger(p.e)) return {ok: false, motivo: 'formato'};
  if (Math.floor(now.getTime() / 1000) >= p.e) return {ok: false, motivo: 'expirado'};
  return {ok: true, tenantId: p.t, userId: p.u};
}
/** Enlace del correo (mismo origen HTTPS de la app). */
export function urlBaja(appOrigin, token) {
  const o = new URL(appOrigin);
  if (o.protocol !== 'https:' || o.pathname !== '/' || o.search || o.hash || o.username) throw Error('invalid_origin');
  return new URL('/api/baja?t=' + token, o.origin).href;
}

// ---------------------------------------------------------------- página de confirmación
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
const CSP = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const CABECERAS = {'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': CSP, 'Content-Type': 'text/html; charset=utf-8'};
/** Una página sola, sin scripts ni recursos externos: tema claro/oscuro, mismo tono de la marca. */
export function paginaBaja({tono = 'ok', titulo, texto, enlace = null, appOrigin = null}) {
  const color = tono === 'ok' ? '#16784a' : tono === 'error' ? '#ac2440' : '#86580d';
  const inicio = appOrigin ? `<a class="s" href="${esc(appOrigin)}">Ir a Rovaq</a>` : '';
  return `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(titulo)} · Rovaq</title><style>
:root{color-scheme:light dark;--bg:#f6f6f7;--card:#fff;--ink:#0e0e10;--mut:#5a5a61;--bd:#e4e4e6;--ac:${color};--btn:#0e0e10;--btnt:#fff}
@media(prefers-color-scheme:dark){:root{--bg:#0e0e10;--card:#17171a;--ink:#f4f4f5;--mut:#a3a3ab;--bd:#2a2a2f;--btn:#f4f4f5;--btnt:#0e0e10;--ac:${tono === 'ok' ? '#6fd6a3' : tono === 'error' ? '#ffb3c3' : '#f0c987'}}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;background:var(--bg);color:var(--ink);font:400 15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{width:100%;max-width:440px;background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:32px 24px;text-align:center}
.m{font:700 22px/1 system-ui,sans-serif;letter-spacing:-.02em;margin:0 0 24px}.i{width:44px;height:44px;border-radius:999px;margin:0 auto 16px;display:grid;place-items:center;border:2px solid var(--ac);color:var(--ac);font-weight:700}
h1{font-size:20px;line-height:1.3;margin:0 0 8px}p{margin:0 0 16px;color:var(--mut)}a.b,a.s{display:inline-block;min-height:40px;line-height:40px;padding:0 16px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px}
a.b{background:var(--btn);color:var(--btnt)}a.s{color:var(--ink);border:1px solid var(--bd)}.f{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}small{display:block;margin-top:16px;color:var(--mut);font-size:12px}
</style></head><body><main role="main"><p class="m">rovaq</p><div class="i" aria-hidden="true">${tono === 'ok' ? '✓' : '!'}</div><h1>${esc(titulo)}</h1><p>${esc(texto)}</p><div class="f">${enlace ? `<a class="b" href="${esc(enlace.href)}">${esc(enlace.texto)}</a>` : ''}${inicio}</div><small>Rovaq nunca te pedirá tu contraseña por correo.</small></main></body></html>`;
}
const pagina = (status, args) => new Response(paginaBaja(args), {status, headers: CABECERAS});

/**
 * Manejador HTTP (GET del enlace, POST de List-Unsubscribe-Post). `aplicar({tenantId,userId,resubscribe})` escribe en la base y devuelve {ok,estado}; se inyecta (el real usa la acción
 * 'weekly_unsubscribe' de la función SQL). Sin sesión: la autorización ES el token firmado. Registro: solo etiquetas fijas.
 */
export function createBajaHandler({secret, aplicar, appOrigin = null, now = () => new Date(), log = () => {}}) {
  return async request => {
    const url = new URL(request.url);
    const metodo = request.method;
    if (metodo !== 'GET' && metodo !== 'POST') return new Response('Method Not Allowed', {status: 405, headers: {Allow: 'GET, POST', 'Cache-Control': 'no-store'}});
    if (!secretoOk(secret) || typeof aplicar !== 'function') { log('baja_no_configurada'); return pagina(503, {tono: 'aviso', titulo: 'No disponible por ahora', texto: 'No pudimos procesar tu baja desde este enlace. Entra a Rovaq y ajusta tus avisos en Configuración → Notificaciones.', appOrigin}); }
    const t = url.searchParams.getAll('t');
    for (const k of url.searchParams.keys()) if (k !== 't' && k !== 'r') { log('baja_parametro_invalido'); return pagina(400, {tono: 'error', titulo: 'Enlace no válido', texto: 'Este enlace no es válido. Usa el enlace de baja del último reporte que recibiste.', appOrigin}); }
    if (t.length !== 1) return pagina(400, {tono: 'error', titulo: 'Enlace no válido', texto: 'Este enlace no es válido. Usa el enlace de baja del último reporte que recibiste.', appOrigin});
    const v = verificarBaja({secret, token: t[0], now: now()});
    if (!v.ok) {
      log('baja_token_' + v.motivo);
      return v.motivo === 'expirado'
        ? pagina(410, {tono: 'aviso', titulo: 'Este enlace venció', texto: 'Por seguridad los enlaces de baja caducan. Entra a Rovaq y ajusta tus avisos en Configuración → Notificaciones, o usa el enlace de un reporte más reciente.', appOrigin})
        : pagina(400, {tono: 'error', titulo: 'Enlace no válido', texto: 'Este enlace no es válido o fue modificado. Usa el enlace de baja del último reporte que recibiste.', appOrigin});
    }
    const resub = metodo === 'GET' && url.searchParams.get('r') === '1';
    let r;
    try { r = await aplicar({tenantId: v.tenantId, userId: v.userId, resubscribe: resub}); } catch { r = null; }
    if (!r || r.ok !== true) {
      log(r ? 'baja_destinatario_desconocido' : 'baja_fallo_base');
      return r ? pagina(404, {tono: 'aviso', titulo: 'No encontramos tu suscripción', texto: 'Ya no formas parte de este espacio, así que no recibirás este reporte.', appOrigin})
        : pagina(503, {tono: 'aviso', titulo: 'No pudimos registrar tu baja', texto: 'Tu enlace sigue siendo válido: vuelve a abrirlo en unos minutos. Si prefieres, ajusta tus avisos en Rovaq → Configuración → Notificaciones.', appOrigin});
    }
    log(resub ? 'baja_revertida' : 'baja_registrada');
    if (metodo === 'POST') return new Response('ok', {status: 200, headers: {'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8'}});
    return resub
      ? pagina(200, {tono: 'ok', titulo: 'Volverás a recibir el reporte', texto: 'Listo: el reporte semanal volverá a llegar a tu correo cada lunes.', appOrigin})
      : pagina(200, {tono: 'ok', titulo: 'Listo, ya no recibirás el reporte semanal', texto: 'No te enviaremos más el reporte semanal de este espacio. Los avisos de seguridad y de acceso a tu cuenta no se pueden desactivar.', enlace: {href: urlResub(url), texto: 'Volver a suscribirme'}, appOrigin});
  };
}
const urlResub = u => { const o = new URL(u.href); o.searchParams.set('r', '1'); return o.pathname + o.search; };
