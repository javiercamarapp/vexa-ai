import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {ACTIVE_ORG, AccessError, authClient, config, identity, resolveSession} from '../../lib/auth';
import {InvitacionesPendientes, type Invitacion, type InvitacionVencida} from '../../components/sin-acceso';
import {LinkButton} from '../../components/ui/button';
import {Notice} from '../../components/ui/notice';
import './sin-acceso.css';
export const metadata = {title: 'Sin acceso a una organización'};
export const dynamic = 'force-dynamic';
type Invitaciones = {pending: Invitacion[]; expired: InvitacionVencida[]};
/**
 * Usuario con sesión válida pero sin organización: en lugar del genérico «acceso denegado» se le dice qué le falta.
 * Invitaciones pendientes (aceptables aquí mismo), vencidas (pedir reenvío al dueño), nada (contactar), o administrador de plataforma (ir a la consola).
 */
const FIXTURES = process.env.NODE_ENV === 'development' && process.env.VEXA_UI_FIXTURES === '1';
/** Vista previa sintética (solo `next dev` con fixtures): ?estado=pendiente|vencida|nada, &admin=1. */
function fixture(estado: string | undefined, admin: boolean): {inv: Invitaciones; isAdmin: boolean} {
  const soon = new Date(Date.UTC(2026, 9, 30, 18, 0)).toISOString();
  if (estado === 'vencida') return {inv: {pending: [], expired: [{organization: 'Empresa de demostración (sintética)', role: 'analyst', expiredAt: soon}]}, isAdmin: admin};
  if (estado === 'nada') return {inv: {pending: [], expired: []}, isAdmin: admin};
  return {inv: {pending: [{id: '00000000-0000-4000-8000-0000000000a1', organization: 'Empresa de demostración (sintética)', role: 'analyst', expiresAt: soon}, {id: '00000000-0000-4000-8000-0000000000a2', organization: 'Segunda empresa de demostración (sintética)', role: 'viewer', expiresAt: soon}], expired: []}, isAdmin: admin};
}
export default async function SinAcceso({searchParams}: {searchParams?: Promise<{estado?: string; admin?: string}>}) {
  if (FIXTURES) { const q = (await searchParams) ?? {}; const f = fixture(q.estado, q.admin === '1'); return <Vista inv={f.inv} isAdmin={f.isAdmin} />; }
  if (!config()) redirect('/login');
  const jar = await cookies(), client = authClient({getAll: () => jar.getAll(), set: () => {}});
  const user = await client.auth.getUser();
  if (user.error || !user.data.user) redirect('/login');
  // Si en realidad sí tiene una organización válida, no se queda aquí.
  let tieneOrganizacion = false;
  try { await resolveSession(identity(client), jar.get(ACTIVE_ORG)?.value, {fallback: true}); tieneOrganizacion = true; }
  catch (error) { if (!(error instanceof AccessError)) throw error; if (error.status === 401) redirect('/login'); if (error.status !== 403) throw error; }
  if (tieneOrganizacion) redirect('/overview');
  const [platform, mine] = await Promise.all([client.rpc('platform_manage', {p_input: {operation: 'status'}}), client.rpc('team_my_invitations')]);
  const isAdmin = !platform.error && platform.data?.administrator === true;
  // Si la función aún no está aplicada en la base, se trata como «sin invitaciones» (no se inventa nada).
  const inv: Invitaciones = !mine.error && mine.data ? {pending: mine.data.pending ?? [], expired: mine.data.expired ?? []} : {pending: [], expired: []};
  return <Vista inv={inv} isAdmin={isAdmin} />;
}
function Vista({inv, isAdmin}: {inv: Invitaciones; isAdmin: boolean}) {
  return <section className="home access-flow acceso-sistema" aria-labelledby="sa-titulo">
    <h1 id="sa-titulo">{inv.pending.length ? 'Tienes una invitación pendiente' : 'Tu cuenta aún no pertenece a una organización'}</h1>
    {inv.pending.length > 0 && <InvitacionesPendientes invitaciones={inv.pending} />}
    {inv.pending.length === 0 && inv.expired.length > 0 && <>
      <Notice tone="warn">Tu invitación venció. Pide a quien te invitó que la reenvíe.</Notice>
      <ul className="sa-lista">{inv.expired.map((e, i) => <li key={i} className="card sa-tarjeta"><div><strong>{e.organization}</strong><small>Rol {e.role}</small></div></li>)}</ul>
    </>}
    {inv.pending.length === 0 && inv.expired.length === 0 && <Notice>No encontramos invitaciones para tu correo. Pide al responsable de tu organización que te invite con el mismo correo con el que iniciaste sesión.</Notice>}
    <div className="sa-acciones">
      {isAdmin && <LinkButton href="/platform" variant="primary">Ir a administración de plataforma</LinkButton>}
      <form action="/auth/logout" method="post"><button className="btn btn-secondary" type="submit">Cerrar sesión</button></form>
    </div>
  </section>;
}
