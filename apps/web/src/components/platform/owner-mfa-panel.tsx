'use client';
import {useState} from 'react';
import {Button} from '../ui/button';
import {Notice} from '../ui/notice';
import {useT} from '../i18n/proveedor';
import type {Clave} from '../../lib/i18n';
export type OrgOpcion = {tenantId: string; name: string; available: boolean; requireOwnerMfa: boolean; activeOwners: number; ownersWithoutFactor: number};
const ERR: Record<string, Clave> = {owner_mfa_required: 'tr.seg.orgErrAal2', owner_mfa_needs_second_owner: 'tr.seg.orgErrDosProp'};
/** MFA obligatoria para propietarios, POR ORGANIZACIÓN (apagada por defecto). Con aviso previo del número de propietarios sin segundo factor. El cambio lo exige la base con AAL2 y dos propietarios. */
export function OwnerMfaPanel({orgs}: {orgs: OrgOpcion[]}) {
  const t = useT(), [busy, setBusy] = useState(''), [error, setError] = useState('');
  async function cambiar(tenantId: string, enabled: boolean) {
    setBusy(tenantId); setError('');
    try {
      const r = await fetch('/seguridad/data', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({operation: 'org_set', tenantId, enabled}), signal: AbortSignal.timeout(20000)});
      const j = await r.json();
      if (!r.ok) { setError(t(ERR[j?.error?.code] ?? 'tr.seg.orgErrGeneral')); return; }
      window.location.reload();
    } catch { setError(t('tr.seg.orgErrGeneral')); } finally { setBusy(''); }
  }
  if (!orgs.length) return null;
  return <section className="owner-mfa" aria-labelledby="owner-mfa-titulo">
    <h2 id="owner-mfa-titulo">{t('tr.seg.orgTitulo')}</h2>
    <p>{t('tr.seg.orgIntro')}</p>
    {orgs.map(o => <div key={o.tenantId} className="owner-mfa-org">
      <h3>{o.name}</h3>
      {!o.available ? <p>{t('tr.seg.orgNoDisp')}</p> : <>
        <p>{o.requireOwnerMfa ? t('tr.seg.orgActiva') : t('tr.seg.orgApagada')}</p>
        {!o.requireOwnerMfa && <Notice tone={o.ownersWithoutFactor > 0 ? 'warn' : 'info'}>{o.ownersWithoutFactor > 0 ? t('tr.seg.orgAviso', {n: o.ownersWithoutFactor, total: o.activeOwners}) : t('tr.seg.orgAvisoOk')}</Notice>}
        <Button variant={o.requireOwnerMfa ? 'ghost' : 'primary'} loading={busy === o.tenantId} disabled={Boolean(busy)} onClick={() => void cambiar(o.tenantId, !o.requireOwnerMfa)}>{o.requireOwnerMfa ? t('tr.seg.orgApagar') : t('tr.seg.orgEncender')}</Button>
      </>}
    </div>)}
    {error && <Notice tone="error">{error}</Notice>}
  </section>;
}
