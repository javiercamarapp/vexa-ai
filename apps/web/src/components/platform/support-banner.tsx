'use client';
import {useEffect, useState} from 'react';
import {mmss, secondsLeft} from '../../lib/platform/support-time';
import './support-banner.css';
/**
 * Banner persistente de «ver como»: lo calcula el servidor (la organización y el vencimiento vienen de la base, no del navegador).
 * Cuenta regresiva; al llegar a 00:00 cierra la sesión y vuelve a la consola. «Salir» la termina antes.
 */
export function SupportBanner({tenantId, tenantName, reason, expiresAt}: {tenantId: string; tenantName: string; reason: string; expiresAt: string}) {
  const [left, setLeft] = useState<number>(() => secondsLeft(expiresAt)), [busy, setBusy] = useState(false);
  async function salir() {
    if (busy) return; setBusy(true);
    try { await fetch('/platform/data/support', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({operation: 'end'}), signal: AbortSignal.timeout(15000)}); } catch { /* la sesión caduca sola; se vuelve a la consola igual */ }
    // Cambió el contexto de organización: se descarta el caché de navegación.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- cookies de organización y soporte cambiaron
    window.location.assign(`/platform/organizaciones/${tenantId}`);
  }
  useEffect(() => {
    const t = setInterval(() => { const s = secondsLeft(expiresAt); setLeft(s); if (s === 0) { clearInterval(t); void salir(); } }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- salir solo depende de busy y se llama una vez al vencer
  }, [expiresAt]);
  return <div className="soporte-barra" role="region" aria-label="Modo soporte, solo lectura">
    <p><strong>Modo soporte</strong> · viendo <strong>{tenantName}</strong> como administrador de Rovaq · solo lectura<span className="soporte-motivo"> · motivo: {reason}</span></p>
    <span className="soporte-tiempo" suppressHydrationWarning>Caduca en <time>{mmss(left)}</time></span>
    <button type="button" className="btn btn-sm btn-secondary" onClick={() => void salir()} disabled={busy} aria-busy={busy || undefined}>Salir</button>
  </div>;
}
