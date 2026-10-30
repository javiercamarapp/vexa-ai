import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {authClient, config} from '../../../lib/auth';
import {mfaState} from '../../../lib/platform/mfa-server';
import {MfaPanel} from '../../../components/platform/mfa-panel';
import {OwnerMfaPanel, type OrgOpcion} from '../../../components/platform/owner-mfa-panel';
import {LinkButton} from '../../../components/ui/button';
import {Notice} from '../../../components/ui/notice';
import './seguridad.css';
import {ROBOTS_PRIVADO} from '../../../lib/site.mjs';
import {metaTitulo} from '../../../lib/i18n/titulo';
import {traductor, type Traductor} from '../../../lib/i18n';
import {idiomaActual} from '../../../lib/i18n/servidor';
import {IdiomaLocal} from '../../../components/i18n/proveedor';
import type {Idioma} from '../../../lib/i18n';
export const generateMetadata=()=>metaTitulo('meta.titulo.seguridad',{robots: ROBOTS_PRIVADO});
export const dynamic = 'force-dynamic';
/** Verificación en dos pasos (TOTP) de los administradores de plataforma. Fuera del layout de /platform para no bloquearse a sí misma cuando la exigencia esté encendida. */
const FIXTURES = process.env.NODE_ENV === 'development' && process.env.VEXA_UI_FIXTURES === '1';
export default async function Seguridad({searchParams}: {searchParams: Promise<{requerido?: string}>}) {
  const idioma = await idiomaActual(), t = traductor(idioma);
  // Vista previa sintética (solo `next dev` con fixtures): sin sesión ni Supabase.
  if (FIXTURES) return <Vista t={t} idioma={idioma} requerido={(await searchParams).requerido === '1'} state={{required: false, verdict: 'ok', level: 'aal1', verifiedFactors: [], pendingFactors: []}} esAdmin orgs={[]} />;
  if (!config()) redirect('/login');
  const jar = await cookies(), client = authClient({getAll: () => jar.getAll(), set: () => {}});
  const user = await client.auth.getUser(); if (user.error || !user.data.user) redirect('/login');
  const grant = await client.rpc('platform_manage', {p_input: {operation: 'status'}}), esAdmin = !grant.error;
  // Propietarios de organización: su propio TOTP y la opción de su organización. Cada uno ve solo las organizaciones donde es propietario activo.
  const own = await client.from('memberships').select('tenant_id').eq('user_id', user.data.user.id).eq('status', 'active').eq('role', 'owner');
  const ids = own.error ? [] : (own.data ?? []).map(m => m.tenant_id as string);
  if (!esAdmin && !ids.length) return <section className="home access-flow acceso-sistema"><h1>{t('meta.titulo.seguridad')}</h1><p>{t('tr.seg.soloAdmin2')}</p><LinkButton href="/">{t('tr.seg.volver')}</LinkButton></section>;
  const names = ids.length ? await client.from('organizations').select('id,name').in('id', ids).order('name') : {data: [] as Array<{id: string; name: string}>, error: null};
  const orgs: OrgOpcion[] = await Promise.all((names.error ? [] : names.data ?? []).map(async o => {
    const r = await client.rpc('org_security', {p_tenant: o.id, p_input: {operation: 'get'}});
    return r.error || !r.data ? {tenantId: o.id, name: o.name, available: false, requireOwnerMfa: false, activeOwners: 0, ownersWithoutFactor: 0}
      : {tenantId: o.id, name: o.name, available: true, requireOwnerMfa: r.data.requireOwnerMfa === true, activeOwners: Number(r.data.activeOwners) || 0, ownersWithoutFactor: Number(r.data.ownersWithoutFactor) || 0};
  }));
  const state = await mfaState(client), requerido = (await searchParams).requerido === '1';
  return <Vista t={t} idioma={idioma} requerido={requerido} state={state} esAdmin={esAdmin} orgs={orgs} />;
}
function Vista({t, idioma, requerido, state, esAdmin, orgs}: {t: Traductor; idioma: Idioma; requerido: boolean; state: Parameters<typeof MfaPanel>[0]['state']; esAdmin: boolean; orgs: OrgOpcion[]}) {
  return <section className="home access-flow acceso-sistema" aria-labelledby="seg-titulo">
    <h1 id="seg-titulo">{t('meta.titulo.seguridad')}</h1>
    {requerido && <Notice tone="warn">{t('tr.seg.requerido')}</Notice>}
    <IdiomaLocal idioma={idioma}><MfaPanel state={state} /><OwnerMfaPanel orgs={orgs} /></IdiomaLocal>
    {esAdmin && <div className="sa-acciones"><LinkButton href="/platform">{t('tr.seg.irConsola')}</LinkButton></div>}
  </section>;
}
