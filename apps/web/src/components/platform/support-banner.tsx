'use client';
import {useEffect, useState} from 'react';
import {mmss, secondsLeft} from '../../lib/platform/support-time';
import {useT} from '../i18n/proveedor';
import './support-banner.css';
const RETRASO_VUELTA_MS = 8000;
/**
 * Banner persistente de «ver como»: lo calcula el servidor (la organización y el vencimiento vienen de la base, no del navegador).
 * Cuenta regresiva. Al llegar a 00:00 NO se cambia de pantalla en silencio: se dice con claridad que la sesión venció (también a mitad de un recorrido)
 * y se ofrece volver a la consola; si nadie lo hace, vuelve solo tras unos segundos. «Salir» la termina antes.
 */
export function SupportBanner({tenantId, tenantName, reason, expiresAt}: {tenantId: string; tenantName: string; reason: string; expiresAt: string}) {
  const t = useT();
  const [left, setLeft] = useState<number>(() => secondsLeft(expiresAt)), [busy, setBusy] = useState(false);
  const vencida = left === 0;
  async function salir() {
    if (busy) return; setBusy(true);
    try { await fetch('/platform/data/support', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({operation: 'end'}), signal: AbortSignal.timeout(15000)}); } catch { /* la sesión caduca sola; se vuelve a la consola igual */ }
    // Cambió el contexto de organización: se descarta el caché de navegación.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- cookies de organización y soporte cambiaron
    window.location.assign(`/platform/organizaciones/${tenantId}`);
  }
  useEffect(() => {
    const id = setInterval(() => setLeft(secondsLeft(expiresAt)), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  useEffect(() => {
    if (!vencida) return;
    const id = setTimeout(() => { void salir(); }, RETRASO_VUELTA_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- salir solo depende de busy y se llama una vez al vencer
  }, [vencida]);
  if (vencida) return <div className="soporte-barra" data-vencida="" role="alert" aria-label={t('soporte.banner.region')}>
    <p><strong>{t('soporte.banner.vencida')}</strong></p>
    <button type="button" className="btn btn-sm btn-secondary" onClick={() => void salir()} disabled={busy} aria-busy={busy || undefined}>{t('soporte.banner.volver')}</button>
  </div>;
  return <div className="soporte-barra" role="region" aria-label={t('soporte.banner.region')}>
    <p><strong>{t('soporte.banner.modo')}</strong> · {t('soporte.banner.viendo')} <strong>{tenantName}</strong> {t('soporte.banner.comoAdmin')}<span className="soporte-motivo"> · {t('soporte.banner.motivo', {motivo: reason})}</span></p>
    <span className="soporte-tiempo" suppressHydrationWarning>{t('soporte.banner.caduca')} <time>{mmss(left)}</time></span>
    <button type="button" className="btn btn-sm btn-secondary" onClick={() => void salir()} disabled={busy} aria-busy={busy || undefined}>{t('soporte.banner.salir')}</button>
  </div>;
}
