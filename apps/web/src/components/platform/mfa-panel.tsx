'use client';
import {useState} from 'react';
import {Button} from '../ui/button';
import {Notice} from '../ui/notice';
import {CODE} from '../../lib/platform/mfa';
import {useT} from '../i18n/proveedor';
import type {Clave} from '../../lib/i18n';
type State = {required: boolean; verdict: string; level: string | null; verifiedFactors: Array<{id: string; name: string | null}>; pendingFactors: Array<{id: string}>};
const ERR: Record<string, Clave> = {mfa_code_invalid: 'tr.pl.mfaCodigo', mfa_factor_exists: 'tr.pl.mfaFactor', mfa_unavailable: 'tr.pl.mfaNoDisp', mfa_reauth_required: 'tr.seg.reauth', mfa_aal2_required: 'tr.seg.soloAal2'};
/** Inscripción y verificación TOTP. El QR lo genera Supabase (SVG); el secreto se muestra una vez por si la app no puede escanear. */
export function MfaPanel({state}: {state: State}) {
  const t = useT();
  const [enroll, setEnroll] = useState<{factorId: string; qr: string; secret: string} | null>(null), [code, setCode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const verified = state.verifiedFactors[0], factorId = enroll?.factorId ?? verified?.id;
  async function call(body: Record<string, unknown>) {
    setBusy(true); setError('');
    try { const r = await fetch('/seguridad/data', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body), signal: AbortSignal.timeout(20000)}); const j = await r.json(); if (!r.ok) { setError(ERR[j?.error?.code] ? t(ERR[j?.error?.code]) : t('tr.pl.mfaFallo')); return null; } return j.data; }
    catch { setError(t('tr.pl.mfaReintentar')); return null; } finally { setBusy(false); }
  }
  async function start() { const d = await call({operation: 'enroll'}); if (d) setEnroll(d); }
  async function verify() { if (!factorId) return; const d = await call({operation: 'verify', factorId, code}); if (d?.verified) { setCode(''); window.location.reload(); } }
  async function cancel() { const f = enroll?.factorId ?? state.pendingFactors[0]?.id; if (!f) return; const d = await call({operation: 'cancel', factorId: f}); if (d) { setEnroll(null); window.location.reload(); } }
  const aal2 = state.level === 'aal2';
  return <div className="mfa-panel">
    <p>{t('tr.pl.mfaEstado')} <strong>{aal2 ? t('tr.pl.mfaVerificada') : verified ? t('tr.pl.mfaInscrito') : t('tr.pl.mfaSin')}</strong>. {t('tr.pl.mfaExigencia')} <strong>{state.required ? t('tr.pl.mfaEncendida') : t('tr.pl.mfaApagada')}</strong>{state.required ? '' : t('tr.pl.mfaNadieBloquea')}.</p>
    {!verified && !enroll && <Button variant="primary" loading={busy} onClick={() => void start()}>{t('tr.pl.mfaActivar')}</Button>}
    {enroll && <>
      <p>{t('tr.pl.mfaEscanea')}</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG data-URI emitido por Auth; next/image no aplica */}
      <img className="mfa-qr" src={enroll.qr} alt={t('tr.pl.mfaQr')} width={176} height={176} />
      <p><code>{enroll.secret}</code></p>
    </>}
    {factorId && !aal2 && <form onSubmit={e => { e.preventDefault(); void verify(); }} className="mfa-form">
      <label>{t('tr.pl.mfaCodigo6', {n: 6})}<input inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={e => setCode(e.target.value)} /></label>
      <Button type="submit" variant="primary" loading={busy} disabled={!CODE.test(code.replace(/\s/g, ''))}>{enroll ? t('tr.pl.mfaConfirmar') : t('tr.pl.mfaVerificar')}</Button>
      {(enroll || state.pendingFactors.length > 0) && <Button variant="ghost" onClick={() => void cancel()} disabled={busy}>{t('tr.pl.mfaCancelar')}</Button>}
    </form>}
    {error && <Notice tone="error">{error}</Notice>}
  </div>;
}
