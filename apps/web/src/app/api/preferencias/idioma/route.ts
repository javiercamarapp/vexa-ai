import 'server-only';
import {NextRequest, NextResponse} from 'next/server';
import {AccessError, assertOrigin, config, identity, PRIVATE_HEADERS} from '../../../../lib/auth';
import {requestAuth} from '../../../../lib/auth-http';
import {readRequestBytes} from '../../../../lib/request-body';
import {guardarIdiomaDePersona, type ClientePreferencias} from '../../../../lib/i18n/preferencia-idioma';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Guarda el idioma elegido en el selector (es | en) en la preferencia de la persona (public.user_preferences). Mejor esfuerzo: la interfaz ya cambió con la cookie rovaq_lang;
// aquí solo se recuerda para lo que el sistema genera sin petición (reporte semanal, avisos, push). Sin tabla o sin sesión responde 200 sin romper nada.
export async function POST(request: NextRequest) {
  const {client, finish} = requestAuth(request);
  const responder = (cuerpo: Record<string, unknown>, status = 200) => finish(NextResponse.json(cuerpo, {status, headers: PRIVATE_HEADERS}));
  try {
    const c = config();
    if (!c) return responder({guardado: false, motivo: 'sin_configuracion'}, 200);
    assertOrigin(request.headers.get('origin'), c.origin);
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return responder({guardado: false, motivo: 'idioma_invalido'}, 400);
    let entrada: unknown;
    try { entrada = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(await readRequestBytes(request, 256))); } catch { return responder({guardado: false, motivo: 'idioma_invalido'}, 400); }
    const idioma = entrada && typeof entrada === 'object' ? (entrada as {idioma?: unknown}).idioma : undefined;
    const usuario = await identity(client).getUser();
    // Sin sesión (p. ej. el selector de la pantalla de acceso): 200 silencioso, sin ruido de error en la consola del navegador.
    if (!usuario) return responder({guardado: false, motivo: 'sin_sesion'}, 200);
    const r = await guardarIdiomaDePersona(client as unknown as ClientePreferencias, usuario.id, idioma);
    return responder(r, r.guardado || r.motivo !== 'idioma_invalido' ? 200 : 400);
  } catch (error) {
    if (error instanceof AccessError && [403, 413, 429].includes(error.status)) return responder({guardado: false, motivo: 'sin_sesion'}, error.status);
    if (error instanceof AccessError && error.status === 401) return responder({guardado: false, motivo: 'sin_sesion'}, 200);
    return responder({guardado: false, motivo: 'error'}, 200);
  }
}
