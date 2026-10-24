import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {authClient, config} from '../../lib/auth';
import {mfaState} from '../../lib/platform/mfa-server';
import {MfaPanel} from '../../components/platform/mfa-panel';
import {LinkButton} from '../../components/ui/button';
import './seguridad.css';
export const metadata = {title: 'Seguridad de la cuenta'};
export const dynamic = 'force-dynamic';
/** Verificación en dos pasos (TOTP) de los administradores de plataforma. Fuera del layout de /platform para no bloquearse a sí misma cuando la exigencia esté encendida. */
export default async function Seguridad({searchParams}: {searchParams: Promise<{requerido?: string}>}) {
  if (!config()) redirect('/login');
  const jar = await cookies(), client = authClient({getAll: () => jar.getAll(), set: () => {}});
  const user = await client.auth.getUser(); if (user.error || !user.data.user) redirect('/login');
  const grant = await client.rpc('platform_manage', {p_input: {operation: 'status'}});
  if (grant.error) return <section className="home access-flow"><h1>Seguridad de la cuenta</h1><p>La verificación en dos pasos solo aplica a administradores de plataforma.</p><LinkButton href="/">Volver</LinkButton></section>;
  const state = await mfaState(client), requerido = (await searchParams).requerido === '1';
  return <section className="home access-flow" aria-labelledby="seg-titulo">
    <h1 id="seg-titulo">Seguridad de la cuenta</h1>
    {requerido && <p role="alert">La consola de plataforma exige verificación en dos pasos. Complétala para continuar.</p>}
    <MfaPanel state={state} />
    <LinkButton href="/platform">Ir a la consola de plataforma</LinkButton>
  </section>;
}
