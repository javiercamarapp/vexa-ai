/**
 * MFA (TOTP de Supabase Auth) para administradores de plataforma. EXIGENCIA ENCENDIDA POR DEFECTO (cierre de seguridad 29-oct; antes estaba apagada).
 *
 * Qué ofrece Supabase Auth (verificado en @supabase/auth-js del repo): auth.mfa.enroll({factorType:'totp'}) devuelve id + QR (SVG data-URI) + secreto + URI;
 * auth.mfa.challengeAndVerify({factorId, code}) sube la sesión a AAL2 y emite tokens nuevos (cookies); getAuthenticatorAssuranceLevel() da {currentLevel, nextLevel};
 * el JWT lleva el claim `aal`. Requiere TOTP habilitado en el proyecto (Auth > Multi-Factor), cosa del dueño.
 *
 * Exigencia: encendida salvo VEXA_PLATFORM_MFA=0 (servidor; también 'off' o 'false'), que es la bandera de emergencia para apagarla. Sin factor verificado el administrador
 * es llevado a /seguridad para enrolar TOTP (esa ruta solo pide sesión), así que nadie queda fuera sin salida. Encendida:
 *  - páginas de /platform: sin AAL2 se redirige a /seguridad;  - rutas /platform/data/* y /api/platform*: 403 platform_mfa_required;
 *  - en la base: vexa_platform.settings mfa_required=true exige aal2 al iniciar «ver como» (migración 20261126000000).
 * Si Auth no contesta con la exigencia encendida, falla cerrado (no se puede verificar = no se entra).
 */
export type Aal = {currentLevel: string | null; nextLevel: string | null};
export type MfaVerdict = 'ok' | 'enroll' | 'challenge' | 'unverifiable';
export const mfaRequired = (env: Record<string, string | undefined> = process.env) => !['0', 'off', 'false'].includes((env.VEXA_PLATFORM_MFA ?? '').trim().toLowerCase());
/** Decisión pura. `aal=null` = Auth no respondió. Con la exigencia apagada siempre es 'ok'. */
export function mfaDecision(required: boolean, aal: Aal | null): MfaVerdict {
  if (!required) return 'ok';
  if (!aal) return 'unverifiable';
  if (aal.currentLevel === 'aal2') return 'ok';
  return aal.nextLevel === 'aal2' ? 'challenge' : 'enroll';
}
export const CODE = /^\d{6}$/;
export type MfaInput = {operation: 'enroll'} | {operation: 'verify'; factorId: string; code: string} | {operation: 'cancel'; factorId: string};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseMfaInput(body: Record<string, unknown>): MfaInput | null {
  const keys = Object.keys(body);
  if (body.operation === 'enroll') return keys.length === 1 ? {operation: 'enroll'} : null;
  if (body.operation === 'verify' && keys.length === 3 && typeof body.factorId === 'string' && UUID.test(body.factorId) && typeof body.code === 'string' && CODE.test(body.code.replace(/\s/g, ''))) return {operation: 'verify', factorId: body.factorId, code: body.code.replace(/\s/g, '')};
  if (body.operation === 'cancel' && keys.length === 2 && typeof body.factorId === 'string' && UUID.test(body.factorId)) return {operation: 'cancel', factorId: body.factorId};
  return null;
}

/** Ventana de «sesión reciente» para inscribir el PRIMER factor: quien roba una sesión vieja no puede registrar su propio TOTP y volverlo permanente (R2-01, AUTH-04). */
export const ENROLL_RECENT_MS = 30 * 60 * 1000;
export type EnrollVerdict = 'ok' | 'reauth_required' | 'aal2_required';
/** Decisión pura para `enroll`. Con un factor ya verificado, agregar otro exige AAL2 (si no, cualquier sesión AAL1 robada sumaría su propio factor). Sin factores, exige haber iniciado sesión hace poco. */
export function enrollDecision(input: {hasVerifiedFactor: boolean; level: string | null; lastSignInAt: string | null | undefined; now?: number}): EnrollVerdict {
  if (input.hasVerifiedFactor) return input.level === 'aal2' ? 'ok' : 'aal2_required';
  const t = input.lastSignInAt ? Date.parse(input.lastSignInAt) : NaN, now = input.now ?? Date.now();
  return Number.isFinite(t) && now - t >= 0 && now - t <= ENROLL_RECENT_MS ? 'ok' : 'reauth_required';
}
/** Entrada de la opción de MFA de propietarios por organización (`/seguridad/data`): leer o cambiar `require_owner_mfa`. */
export type OrgSecurityInput = {operation: 'org_get'; tenantId: string} | {operation: 'org_set'; tenantId: string; enabled: boolean};
export function parseOrgSecurityInput(body: Record<string, unknown>): OrgSecurityInput | null {
  const keys = Object.keys(body), id = typeof body.tenantId === 'string' && UUID.test(body.tenantId) ? body.tenantId : null;
  if (!id) return null;
  if (body.operation === 'org_get') return keys.length === 2 ? {operation: 'org_get', tenantId: id} : null;
  if (body.operation === 'org_set' && keys.length === 3 && typeof body.enabled === 'boolean') return {operation: 'org_set', tenantId: id, enabled: body.enabled};
  return null;
}
