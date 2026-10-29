import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {authClient, config} from '../../lib/auth';
import {mfaState} from '../../lib/platform/mfa-server';
import {MfaPanel} from '../../components/platform/mfa-panel';
import {LinkButton} from '../../components/ui/button';
import {Notice} from '../../components/ui/notice';
import './seguridad.css';
import {ROBOTS_PRIVADO} from '../../lib/site.mjs';
import {metaTitulo} from '../../lib/i18n/titulo';
import {traductor, type Traductor} from '../../lib/i18n';
import {idiomaActual} from '../../lib/i18n/servidor';
export const generateMetadata=()=>metaTitulo('meta.titulo.seguridad',{robots: ROBOTS_PRIVADO});
export const dynamic = 'force-dynamic';
/** Verificación en dos pasos (TOTP) de los administradores de plataforma. Fuera del layout de /platform para no bloquearse a sí misma cuando la exigencia esté encendida. */
const FIXTURES = process.env.NODE_ENV === 'development' && process.env.VEXA_UI_FIXTURES === '1';
export default async function Seguridad({searchParams}: {searchParams: Promise<{requerido?: string}>}) {
  const t = traductor(await idiomaActual());
  // Vista previa sintética (solo `next dev` con fixtures): sin sesión ni Supabase.
  if (FIXTURES) return <Vista t={t} requerido={(await searchParams).requerido === '1'} state={{required: false, verdict: 'ok', level: 'aal1', verifiedFactors: [], pendingFactors: []}} />;
  if (!config()) redirect('/login');
  const jar = await cookies(), client = authClient({getAll: () => jar.getAll(), set: () => {}});
  const user = await client.auth.getUser(); if (user.error || !user.data.user) redirect('/login');
  const grant = await client.rpc('platform_manage', {p_input: {operation: 'status'}});
  if (grant.error) return <section className="home access-flow acceso-sistema"><h1>{t('meta.titulo.seguridad')}</h1><p>{t('tr.seg.soloAdmin')}</p><LinkButton href="/">{t('tr.seg.volver')}</LinkButton></section>;
  const state = await mfaState(client), requerido = (await searchParams).requerido === '1';
  return <Vista t={t} requerido={requerido} state={state} />;
}
function Vista({t, requerido, state}: {t: Traductor; requerido: boolean; state: Parameters<typeof MfaPanel>[0]['state']}) {
  return <section className="home access-flow acceso-sistema" aria-labelledby="seg-titulo">
    <h1 id="seg-titulo">{t('meta.titulo.seguridad')}</h1>
    {requerido && <Notice tone="warn">{t('tr.seg.requerido')}</Notice>}
    <MfaPanel state={state} />
    <div className="sa-acciones"><LinkButton href="/platform">{t('tr.seg.irConsola')}</LinkButton></div>
  </section>;
}
