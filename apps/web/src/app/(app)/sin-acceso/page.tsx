import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {ACTIVE_ORG, AccessError, authClient, config, identity, resolveSession} from '../../../lib/auth';
import {SinAccesoVista} from '../../../components/sin-acceso-vista';
import type {Invitacion, InvitacionVencida} from '../../../components/sin-acceso';
import {idiomaActual} from '../../../lib/i18n/servidor';
import {traductor} from '../../../lib/i18n';
import './sin-acceso.css';
import {ROBOTS_PRIVADO} from '../../../lib/site.mjs';
import {metaTitulo} from '../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.sin-acceso',{robots: ROBOTS_PRIVADO});
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
  if (FIXTURES) { const q = (await searchParams) ?? {}; const f = fixture(q.estado, q.admin === '1'); return <SinAccesoVista inv={f.inv} isAdmin={f.isAdmin} t={traductor(await idiomaActual())} />; }
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
  return <SinAccesoVista inv={inv} isAdmin={isAdmin} t={traductor(await idiomaActual())} />;
}
