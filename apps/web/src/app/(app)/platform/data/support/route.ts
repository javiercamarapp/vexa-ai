import {NextRequest, NextResponse} from 'next/server';
import {ACTIVE_ORG, SUPPORT_MARK, config} from '../../../../../lib/auth';
import {parseSupportInput} from '../../../../../lib/platform/support-input';
import {HEADERS, readJson} from '../../../../../components/platform/server/copilot-http';
import {FIXTURES, platformAccessForRequest} from '../../_lib/access';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
/**
 * «Ver como»: inicia o termina la sesión de soporte (solo lectura). La autoridad es la RPC platform_support (require_admin + motivo + tope 60 min + auditoría).
 * Aquí solo se traduce el resultado a cookies: organización activa y marca de soporte (para la guardia HTTP). Ningún dato de cliente pasa por esta ruta.
 */
export async function POST(request: NextRequest) {
  let finish = (r: NextResponse) => r;
  const fail = (status: number, code: string) => finish(NextResponse.json({error: {code}}, {status, headers: HEADERS}));
  try {
    const r = await platformAccessForRequest(request); finish = r.finish;
    const input = parseSupportInput(await readJson(request));
    if (!input) return fail(400, 'platform_input_invalid');
    const secure = !!config()?.secure, base = {httpOnly: true, secure, sameSite: 'lax' as const, path: '/'};
    if (FIXTURES) {
      const response = finish(NextResponse.json({data: input.operation === 'start' ? {tenantId: input.tenant, expiresAt: new Date(Date.now() + input.minutes * 60000).toISOString(), simulated: true} : {ended: true, simulated: true}}, {headers: HEADERS}));
      if (input.operation === 'start') { const exp = Math.floor(Date.now() / 1000) + input.minutes * 60; response.cookies.set(SUPPORT_MARK, String(exp), {...base, maxAge: input.minutes * 60}); response.cookies.set(ACTIVE_ORG, input.tenant, {...base, maxAge: input.minutes * 60}); }
      else { response.cookies.set(SUPPORT_MARK, '', {...base, maxAge: 0}); }
      return response;
    }
    const result = await r.access.client!.rpc('platform_support', {p_input: input.operation === 'start' ? {...input, confirmed: true} : input});
    if (result.error) {
      const e = result.error, known = /^platform_[a-z_]+$/.test(e.message) ? e.message : 'platform_unavailable';
      return fail(e.code === '42501' ? 403 : e.code === 'P0001' ? 409 : ['22023', '22P02', '23514'].includes(e.code) ? 400 : 503, known);
    }
    const data = result.data as {id?: string; tenantId?: string; expiresAt?: string; ended?: boolean};
    const response = finish(NextResponse.json({data}, {headers: HEADERS}));
    if (input.operation === 'start' && data.expiresAt && data.tenantId) {
      const seconds = Math.max(1, Math.floor((Date.parse(data.expiresAt) - Date.now()) / 1000));
      response.cookies.set(SUPPORT_MARK, String(Math.floor(Date.parse(data.expiresAt) / 1000)), {...base, maxAge: seconds});
      response.cookies.set(ACTIVE_ORG, data.tenantId, {...base, maxAge: seconds});
    } else if (input.operation === 'end') {
      // Se retira la marca y la organización elegida: el administrador vuelve a su propio contexto (o a la consola si no tiene organizaciones).
      response.cookies.set(SUPPORT_MARK, '', {...base, maxAge: 0});
      response.cookies.set(ACTIVE_ORG, '', {...base, maxAge: 0});
    }
    return response;
  } catch (error) {
    const e = error as {status?: number}; return fail([400, 401, 403, 413].includes(e.status ?? 0) ? e.status! : 503, e.status === 403 ? 'platform_access_denied' : 'platform_unavailable');
  }
}
