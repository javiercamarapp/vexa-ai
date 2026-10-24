'use client';
import {useState} from 'react';
import {Button} from '../ui/button';
import {CODE} from '../../lib/platform/mfa';
type State = {required: boolean; verdict: string; level: string | null; verifiedFactors: Array<{id: string; name: string | null}>; pendingFactors: Array<{id: string}>};
const ERR: Record<string, string> = {mfa_code_invalid: 'El código no es correcto o ya venció. Escribe el que muestra tu app ahora.', mfa_factor_exists: 'Ya existe un factor pendiente. Cancélalo e inténtalo de nuevo.', mfa_unavailable: 'No se pudo completar. Verifica que la verificación en dos pasos (TOTP) esté habilitada en el proyecto.'};
/** Inscripción y verificación TOTP. El QR lo genera Supabase (SVG); el secreto se muestra una vez por si la app no puede escanear. */
export function MfaPanel({state}: {state: State}) {
  const [enroll, setEnroll] = useState<{factorId: string; qr: string; secret: string} | null>(null), [code, setCode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const verified = state.verifiedFactors[0], factorId = enroll?.factorId ?? verified?.id;
  async function call(body: Record<string, unknown>) {
    setBusy(true); setError('');
    try { const r = await fetch('/seguridad/data', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body), signal: AbortSignal.timeout(20000)}); const j = await r.json(); if (!r.ok) { setError(ERR[j?.error?.code] ?? 'No se pudo completar.'); return null; } return j.data; }
    catch { setError('No se pudo completar. Inténtalo de nuevo.'); return null; } finally { setBusy(false); }
  }
  async function start() { const d = await call({operation: 'enroll'}); if (d) setEnroll(d); }
  async function verify() { if (!factorId) return; const d = await call({operation: 'verify', factorId, code}); if (d?.verified) { setCode(''); window.location.reload(); } }
  async function cancel() { const f = enroll?.factorId ?? state.pendingFactors[0]?.id; if (!f) return; const d = await call({operation: 'cancel', factorId: f}); if (d) { setEnroll(null); window.location.reload(); } }
  const aal2 = state.level === 'aal2';
  return <div className="mfa-panel">
    <p>Estado: <strong>{aal2 ? 'Verificada en esta sesión' : verified ? 'Factor inscrito; falta verificar esta sesión' : 'Sin verificación en dos pasos'}</strong>. Exigencia en la consola: <strong>{state.required ? 'encendida' : 'apagada'}</strong>{state.required ? '' : ' (nadie se bloquea todavía)'}.</p>
    {!verified && !enroll && <Button variant="primary" loading={busy} onClick={() => void start()}>Activar con app de autenticación</Button>}
    {enroll && <>
      <p>Escanea el código con tu app (Google Authenticator, 1Password, Authy…). Si no puedes escanear, escribe esta clave:</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG data-URI emitido por Auth; next/image no aplica */}
      <img className="mfa-qr" src={enroll.qr} alt="Código QR para la app de autenticación" width={176} height={176} />
      <p><code>{enroll.secret}</code></p>
    </>}
    {factorId && !aal2 && <form onSubmit={e => { e.preventDefault(); void verify(); }} className="mfa-form">
      <label>Código de 6 dígitos<input inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={e => setCode(e.target.value)} /></label>
      <Button type="submit" variant="primary" loading={busy} disabled={!CODE.test(code.replace(/\s/g, ''))}>{enroll ? 'Confirmar y activar' : 'Verificar sesión'}</Button>
      {(enroll || state.pendingFactors.length > 0) && <Button variant="ghost" onClick={() => void cancel()} disabled={busy}>Cancelar inscripción</Button>}
    </form>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
