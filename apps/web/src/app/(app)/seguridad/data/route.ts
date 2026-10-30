import {NextRequest, NextResponse} from 'next/server';
import {AccessError, assertOrigin, config, cupoDeUsuario, PRIVATE_HEADERS} from '../../../../lib/auth';
import {requestAuth} from '../../../../lib/auth-http';
import {enrollDecision, parseMfaInput, parseOrgSecurityInput} from '../../../../lib/platform/mfa';
import {readJson} from '../../../../components/platform/server/copilot-http';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
const headers = {...PRIVATE_HEADERS, 'Referrer-Policy': 'no-referrer', Vary: 'Cookie'};
/** Inscribe y verifica un factor TOTP de la propia cuenta. Los tokens nuevos (AAL2) salen como cookies httpOnly por finish(). Nunca se registra el código ni el secreto. */
export async function POST(request: NextRequest) {
  let finish = (r: NextResponse) => r;
  const fail = (status: number, code: string) => finish(NextResponse.json({error: {code}}, {status, headers}));
  try {
    const c = config(); if (!c) throw new AccessError(503, 'auth_not_configured');
    assertOrigin(request.headers.get('origin'), c.origin);
    const auth = requestAuth(request); finish = auth.finish;
    const user = await auth.client.auth.getUser(); if (user.error || !user.data.user) return fail(401, 'authentication_required');
    try { await cupoDeUsuario(user.data.user.id); } catch { return fail(429, 'rate_limited'); }
    // Pueden usar esta ruta los administradores de plataforma (la RPC verifica el grant y la sesión viva) y los propietarios de alguna organización (para su propio TOTP y la opción de su organización).
    const grant = await auth.client.rpc('platform_manage', {p_input: {operation: 'status'}});
    let allowed = !grant.error;
    if (!allowed) { const own = await auth.client.from('memberships').select('tenant_id').eq('user_id', user.data.user.id).eq('status', 'active').eq('role', 'owner').limit(1); allowed = !own.error && (own.data?.length ?? 0) > 0; }
    if (!allowed) return fail(403, 'platform_access_denied');
    const body = await readJson(request);
    // Opción de MFA obligatoria para propietarios de una organización (apagada por defecto). La base exige además AAL2 y dos propietarios para cambiarla.
    const org = parseOrgSecurityInput(body);
    if (org) {
      const r = await auth.client.rpc('org_security', {p_tenant: org.tenantId, p_input: org.operation === 'org_get' ? {operation: 'get'} : {operation: 'set', enabled: org.enabled, confirmed: true}});
      if (r.error) { const m = r.error.message ?? ''; return fail(/owner_mfa_required/.test(m) ? 403 : /team_owner_required/.test(m) ? 403 : /owner_mfa_needs_second_owner/.test(m) ? 409 : 503, /owner_mfa_required|team_owner_required|owner_mfa_needs_second_owner/.exec(m)?.[0] ?? 'mfa_unavailable'); }
      return finish(NextResponse.json({data: r.data}, {headers}));
    }
    const input = parseMfaInput(body); if (!input) return fail(400, 'mfa_input_invalid');
    if (input.operation === 'enroll') {
      // R2-01: con un factor ya verificado, otro solo se agrega con AAL2; el primero exige haber iniciado sesión hace poco.
      const [lf, lv] = await Promise.all([auth.client.auth.mfa.listFactors(), auth.client.auth.mfa.getAuthenticatorAssuranceLevel()]);
      if (lf.error || lv.error) return fail(503, 'mfa_unavailable');
      const verdict = enrollDecision({hasVerifiedFactor: lf.data.all.some(f => f.factor_type === 'totp' && f.status === 'verified'), level: lv.data.currentLevel, lastSignInAt: user.data.user.last_sign_in_at});
      if (verdict !== 'ok') return fail(403, verdict === 'aal2_required' ? 'mfa_aal2_required' : 'mfa_reauth_required');
      const r = await auth.client.auth.mfa.enroll({factorType: 'totp', friendlyName: 'Rovaq ' + new Date().toISOString().slice(0, 10)});
      if (r.error || !r.data) return fail(r.error?.status === 422 ? 409 : 503, r.error?.status === 422 ? 'mfa_factor_exists' : 'mfa_unavailable');
      return finish(NextResponse.json({data: {factorId: r.data.id, qr: r.data.totp.qr_code, secret: r.data.totp.secret}}, {headers}));
    }
    if (input.operation === 'cancel') {
      // Solo descarta un factor SIN verificar (inscripción abandonada); un factor verificado no se quita desde aquí.
      const list = await auth.client.auth.mfa.listFactors(); const f = list.data?.all.find(x => x.id === input.factorId);
      if (!f || f.status === 'verified') return fail(409, 'mfa_factor_not_cancellable');
      const r = await auth.client.auth.mfa.unenroll({factorId: input.factorId}); return r.error ? fail(503, 'mfa_unavailable') : finish(NextResponse.json({data: {cancelled: true}}, {headers}));
    }
    const r = await auth.client.auth.mfa.challengeAndVerify({factorId: input.factorId, code: input.code});
    if (r.error) return fail(r.error.status === 400 || r.error.status === 422 ? 400 : 503, r.error.status === 400 || r.error.status === 422 ? 'mfa_code_invalid' : 'mfa_unavailable');
    return finish(NextResponse.json({data: {verified: true}}, {headers}));
  } catch (error) {
    const e = error as {status?: number}; return fail([400, 401, 403, 413].includes(e.status ?? 0) ? e.status! : 503, e.status === 403 ? 'csrf_rejected' : 'mfa_unavailable');
  }
}
