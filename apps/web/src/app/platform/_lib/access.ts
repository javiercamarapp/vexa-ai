import 'server-only';
import {cookies} from 'next/headers';
import {NextRequest} from 'next/server';
import {AccessError, assertOrigin, authClient, config} from '../../../lib/auth';
import {requestAuth} from '../../../lib/auth-http';
import {argsHash} from '../../../components/platform/server/copilot-http';
import {buildPlatformView, platformFixture, type PlatformView, type Principal} from '../../../../../../packages/cfo-copilot/src/index.mjs';

export const FIXTURES = process.env.NODE_ENV === 'development' && process.env.VEXA_UI_FIXTURES === '1';
type Client = ReturnType<typeof authClient>;
export type Access = {mode: 'fixture' | 'live'; userId: string; client?: Client};
export type PlatformState =
  | {status: 'ok'; view: PlatformView; synthetic: boolean}
  | {status: 'partial'; reason: string; organizations: Array<{id: string; name: string; createdAt: string}>; audit: Array<{id: string; actorId: string; operation: string; tenantId: string | null; createdAt: string}>}
  | {status: 'denied' | 'error'};

/** Administrador de plataforma verificado por la RPC (sesión viva + grant activo). El rol del JWT nunca es autoridad. */
export async function platformAccessForPage(): Promise<Access | null> {
  if (FIXTURES) return {mode: 'fixture', userId: 'fixture-admin'};
  if (!config()) return null;
  const jar = await cookies(), client = authClient({getAll: () => jar.getAll(), set: () => {}});
  const user = await client.auth.getUser(); if (user.error || !user.data.user) return null;
  const grant = await client.rpc('platform_manage', {p_input: {operation: 'status'}});
  return grant.error ? null : {mode: 'live', userId: user.data.user.id, client};
}
export async function platformAccessForRequest(request: NextRequest): Promise<{access: Access; finish: ReturnType<typeof requestAuth>['finish']}> {
  if (FIXTURES) return {access: {mode: 'fixture', userId: 'fixture-admin'}, finish: r => r};
  const c = config(); if (!c) throw new AccessError(503, 'platform_configuration_required');
  if (request.method === 'POST') assertOrigin(request.headers.get('origin'), c.origin);
  const auth = requestAuth(request), user = await auth.client.auth.getUser();
  if (user.error || !user.data.user) throw new AccessError(401, 'platform_authentication_required');
  const grant = await auth.client.rpc('platform_manage', {p_input: {operation: 'status'}});
  if (grant.error) throw new AccessError(403, 'platform_access_denied');
  return {access: {mode: 'live', userId: user.data.user.id, client: auth.client}, finish: auth.finish};
}
export const principalOf = (a: Access): Principal => ({kind: 'platform_admin', verified: true, userId: a.userId});

export async function loadPlatform(access: Access): Promise<PlatformState> {
  if (access.mode === 'fixture') return {status: 'ok', synthetic: true, view: buildPlatformView(platformFixture())};
  const client = access.client!;
  const snap = await client.rpc('platform_observe', {p_input: {operation: 'snapshot'}});
  const audit = await client.rpc('platform_manage', {p_input: {operation: 'audit'}});
  if (!snap.error && snap.data) {
    const raw = {...snap.data, opsSignals: snap.data.opsSignals?.length ? snap.data.opsSignals : [
      {kind: 'statement_timeout', status: 'unknown', title: 'Consultas canceladas por statement_timeout', detail: 'Sin fuente conectada: aún no se leen los registros de Postgres desde la consola.', observedAt: null, source: null},
      {kind: 'cron', status: 'unknown', title: 'Procesos programados (cron)', detail: 'Sin fuente conectada: no hay latidos registrados.', observedAt: null, source: null},
      {kind: 'disk', status: 'unknown', title: 'Disco de la base de datos', detail: 'Sin fuente conectada: la consola aún no lee el uso de disco.', observedAt: null, source: null}],
      audit: audit.data?.items ?? []};
    return {status: 'ok', synthetic: false, view: buildPlatformView(raw)};
  }
  const list = await client.rpc('platform_manage', {p_input: {operation: 'list'}});
  if (list.error) return {status: 'error'};
  const missing = snap.error?.code === '42883' || snap.error?.code === 'PGRST202';
  return {status: 'partial', reason: missing ? 'La función de observabilidad (platform_observe) aún no está aplicada en la base. Solo se muestran organizaciones y auditoría.' : 'La consulta de observabilidad falló o superó el tiempo permitido. Solo se muestran organizaciones y auditoría.', organizations: list.data?.items ?? [], audit: audit.data?.items ?? []};
}
/** Bitácora fail-closed: RPC platform_copilot_audit (propuesta). Sin ella, el copiloto no ejecuta herramientas. */
export function platformAudit(access: Access) {
  const memory = ((globalThis as unknown as {__platformAudit?: unknown[]}).__platformAudit ??= []) as unknown[];
  return {async record(e: {tool: string | null; args: {organizationId?: string} | unknown; outcome: string}) {
    if (access.mode === 'fixture') { memory.push({...e, at: new Date().toISOString()}); return; }
    const org = (e.args as {organizationId?: string} | null)?.organizationId;
    const r = await access.client!.rpc('platform_copilot_audit', {p_input: {tool: e.tool ?? 'none', outcome: e.outcome.replace(/[^a-z_:]/g, '_').slice(0, 40), argsHash: argsHash(e.args), ...(org ? {organizationId: org} : {})}});
    if (r.error) throw new Error('audit_unavailable');
  }};
}
