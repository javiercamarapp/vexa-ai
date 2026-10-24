import 'server-only';
import {authClient} from '../auth';
import {mfaDecision, mfaRequired, type MfaVerdict} from './mfa';
type Client = ReturnType<typeof authClient>;
export type MfaState = {required: boolean; verdict: MfaVerdict; level: string | null; verifiedFactors: Array<{id: string; name: string | null}>; pendingFactors: Array<{id: string}>};
/** Estado de MFA de la sesión actual. Con la exigencia apagada no hace ninguna llamada de red extra (devuelve ok). */
export async function mfaVerdictFor(client: Client): Promise<MfaVerdict> {
  if (!mfaRequired()) return 'ok';
  try { const r = await client.auth.mfa.getAuthenticatorAssuranceLevel(); return mfaDecision(true, r.error ? null : r.data); } catch { return 'unverifiable'; }
}
export async function mfaState(client: Client): Promise<MfaState> {
  const required = mfaRequired(), [aal, factors] = await Promise.all([client.auth.mfa.getAuthenticatorAssuranceLevel().catch(() => null), client.auth.mfa.listFactors().catch(() => null)]);
  const level = aal && !aal.error ? aal.data.currentLevel : null;
  const all = factors && !factors.error ? factors.data.all : [];
  return {required, level, verdict: mfaDecision(required, aal && !aal.error ? aal.data : null),
    verifiedFactors: all.filter(f => f.factor_type === 'totp' && f.status === 'verified').map(f => ({id: f.id, name: f.friendly_name ?? null})),
    pendingFactors: all.filter(f => f.factor_type === 'totp' && f.status !== 'verified').map(f => ({id: f.id}))};
}
