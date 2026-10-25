import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {authClient, config} from '../../lib/auth';
import {mfaState} from '../../lib/platform/mfa-server';
import {MfaPanel} from '../../components/platform/mfa-panel';
import {LinkButton} from '../../components/ui/button';
import {Notice} from '../../components/ui/notice';
import './seguridad.css';
import {ROBOTS_PRIVADO} from '../../lib/site.mjs';
export const metadata = {title: 'Seguridad de la cuenta', robots: ROBOTS_PRIVADO};
export const dynamic = 'force-dynamic';
/** Verificación en dos pasos (TOTP) de los administradores de plataforma. Fuera del layout de /platform para no bloquearse a sí misma cuando la exigencia esté encendida. */
const FIXTURES = process.env.NODE_ENV === 'development' && process.env.VEXA_UI_FIXTURES === '1';
export default async function Seguridad({searchParams}: {searchParams: Promise<{requerido?: string}>}) {
  // Vista previa sintética (solo `next dev` con fixtures): sin sesión ni Supabase.
  if (FIXTURES) return <Vista requerido={(await searchParams).requerido === '1'} state={{required: false, verdict: 'ok', level: 'aal1', verifiedFactors: [], pendingFactors: []}} />;
  if (!config()) redirect('/login');
  const jar = await cookies(), client = authClient({getAll: () => jar.getAll(), set: () => {}});
  const user = await client.auth.getUser(); if (user.error || !user.data.user) redirect('/login');
  const grant = await client.rpc('platform_manage', {p_input: {operation: 'status'}});
  if (grant.error) return <section className="home access-flow acceso-sistema"><h1>Seguridad de la cuenta</h1><p>La verificación en dos pasos solo aplica a administradores de plataforma.</p><LinkButton href="/">Volver</LinkButton></section>;
  const state = await mfaState(client), requerido = (await searchParams).requerido === '1';
  return <Vista requerido={requerido} state={state} />;
}
function Vista({requerido, state}: {requerido: boolean; state: Parameters<typeof MfaPanel>[0]['state']}) {
  return <section className="home access-flow acceso-sistema" aria-labelledby="seg-titulo">
    <h1 id="seg-titulo">Seguridad de la cuenta</h1>
    {requerido && <Notice tone="warn">La consola de plataforma exige verificación en dos pasos. Complétala para continuar.</Notice>}
    <MfaPanel state={state} />
    <div className="sa-acciones"><LinkButton href="/platform">Ir a la consola de plataforma</LinkButton></div>
  </section>;
}
