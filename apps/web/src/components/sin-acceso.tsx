'use client';
import {useState} from 'react';
import {useLocaleIntl,useT} from './i18n/proveedor';
import {Button} from './ui/button';
import {Notice} from './ui/notice';
export type Invitacion = {id: string; organization: string; role: string; expiresAt: string};
export type InvitacionVencida = {organization: string; role: string; expiredAt: string};
const fecha = (iso: string, loc: string) => new Intl.DateTimeFormat(loc, {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}).format(new Date(iso));
/** Acepta con la sesión actual (la base valida correo confirmado, vigencia y que no seas ya miembro) y fija la organización. Reutiliza las rutas del enlace del correo. */
export function InvitacionesPendientes({invitaciones}: {invitaciones: Invitacion[]}) {
  const t = useT(), loc = useLocaleIntl();
  const ROL: Record<string, string> = {owner: t('tr.acc.rolOwner'), analyst: t('shell.rol.analyst'), operator: t('shell.rol.operator'), viewer: t('tr.acc.rolViewer')};
  const [busy, setBusy] = useState<string | null>(null), [error, setError] = useState('');
  async function aceptar(id: string) {
    setBusy(id); setError('');
    try {
      const r = await fetch(`/auth/invitations/${id}/session`, {method: 'POST', signal: AbortSignal.timeout(15000), headers: {'content-type': 'application/json'}, body: JSON.stringify({operation: 'accept'})});
      const j = await r.json(); if (!r.ok || !j.data?.tenantId) throw new Error();
      const form = new FormData(); form.set('tenant_id', j.data.tenantId);
      const e = await fetch('/auth/organization', {method: 'POST', signal: AbortSignal.timeout(15000), body: form});
      if (!e.ok) throw new Error();
      // La cookie de organización cambió: se descarta el caché de navegación previo.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- cookies de sesión y organización cambiaron
      window.location.assign('/');
    } catch { setError(t('tr.acc.errAceptar')); setBusy(null); }
  }
  return <>
    <p>{t('tr.acc.intro')}</p>
    <ul className="sa-lista">{invitaciones.map(i => <li key={i.id} className="card sa-tarjeta">
      <div><strong>{i.organization}</strong><small>{t('tr.acc.rolVence', {rol: ROL[i.role] ?? i.role, fecha: fecha(i.expiresAt, loc)})}</small></div>
      <Button variant="primary" loading={busy === i.id} disabled={busy !== null} onClick={() => void aceptar(i.id)}>{t('tr.acc.aceptar')}</Button>
    </li>)}</ul>
    {error && <Notice tone="error">{error}</Notice>}
  </>;
}
