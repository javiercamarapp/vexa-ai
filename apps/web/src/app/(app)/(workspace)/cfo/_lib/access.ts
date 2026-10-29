import 'server-only';
import {NextRequest} from 'next/server';
import {createDatabase, forDownload} from '@vexa/platform/db';
import {AccessError, ACTIVE_ORG, assertOrigin, config, identity, resolveSession} from '../../../../../lib/auth';
import {requestAuth} from '../../../../../lib/auth-http';
import {serverPool} from '../../../../../lib/imports/server';
import {workspaceSession} from '../../../../../lib/workspace/server';
import {argsHash} from '../../../../../components/platform/server/copilot-http';
import {buildCfoReport, createCfoRepository, type SummaryMeta, exposureFixture, FIXTURE_WATERMARK, ledgerMonthlyFixture, serializeReport, type CfoReport, type Principal} from '../../../../../../../../packages/cfo-copilot/src/index.mjs';

/** Solo `next dev` con VEXA_UI_FIXTURES=1: datos 100 % sintéticos, sin Supabase. Nunca activo en una compilación de producción. */
export const FIXTURES = process.env.NODE_ENV === 'development' && process.env.VEXA_UI_FIXTURES === '1';
export const CFO_ROLES = ['owner', 'analyst'] as const;
export type Role = 'owner' | 'analyst' | 'operator' | 'viewer';
export type CfoAccess = {mode: 'fixture' | 'live'; userId: string; tenantId: string; role: Role; database?: ReturnType<typeof createDatabase>; demo?: string};
export const allowed = (role: string) => (CFO_ROLES as readonly string[]).includes(role);
export const FIXTURE_TENANT = '00000000-0000-4000-8000-000000000001';

/** Acceso desde una página (cookies de la sesión). */
export async function cfoAccessForPage(search: Record<string, string | string[] | undefined> = {}): Promise<CfoAccess> {
  if (FIXTURES) {
    const as = typeof search.as === 'string' && ['owner', 'analyst', 'operator', 'viewer'].includes(search.as) ? search.as as Role : 'owner';
    return {mode: 'fixture', userId: 'fixture-user', tenantId: FIXTURE_TENANT, role: as, demo: typeof search.demo === 'string' ? search.demo : undefined};
  }
  const {client, session} = await workspaceSession();
  return {mode: 'live', userId: session.user.id, tenantId: session.active.tenant_id, role: session.active.role, database: createDatabase({identity: identity(client), pool: serverPool(), selectedTenant: session.active.tenant_id})};
}
/** Acceso desde una ruta de datos: sesión + (en POST) comprobación de origen. */
export async function cfoAccessForRequest(request: NextRequest, options: {download?: boolean} = {}): Promise<{access: CfoAccess; finish: ReturnType<typeof requestAuth>['finish']}> {
  const search = Object.fromEntries(request.nextUrl.searchParams);
  if (FIXTURES) return {access: await cfoAccessForPage(search), finish: r => r};
  const c = config(); if (!c) throw new AccessError(503, 'configuration_required');
  if (request.method === 'POST') assertOrigin(request.headers.get('origin'), c.origin);
  const auth = requestAuth(request), id = identity(auth.client);
  const session = await resolveSession(id, request.cookies.get(ACTIVE_ORG)?.value);
  // «Ver como» nunca descarga (decide la sesión de soporte de la base, no la cookie vexa_support).
  if (options.download && session.support) throw new AccessError(403, 'support_export_blocked');
  return {access: {mode: 'live', userId: session.user.id, tenantId: session.active.tenant_id, role: session.active.role, database: forDownload(createDatabase({identity: id, pool: serverPool(), selectedTenant: session.active.tenant_id}), options.download === true)}, finish: auth.finish};
}
export const principalOf = (a: CfoAccess): Principal => ({kind: 'tenant_member', verified: true, userId: a.userId, tenantId: a.tenantId, role: a.role});

export type ReportResult = {status: 'ok'; report: CfoReport; synthetic: boolean; exposureStatus: string} | {status: 'empty' | 'timeout'; synthetic: boolean; summary?: SummaryMeta};
export async function loadReport(access: CfoAccess): Promise<ReportResult> {
  if (access.mode === 'fixture') return {status: 'ok', synthetic: true, exposureStatus: 'ok', report: buildCfoReport(ledgerMonthlyFixture(), {watermark: FIXTURE_WATERMARK, now: new Date('2026-10-20T14:00:00Z'), exposure: exposureFixture({attested: access.demo === 'vinculos'})})};
  const repo = createCfoRepository({database: access.database!});
  const led = await repo.ledgerMonthly();
  if (led.status !== 'ok') return {status: led.status, synthetic: false, summary: led.summary};
  const exp = await repo.exposure(); // una exposición que expira se informa como «sin atestar»; nunca se inventa
  return {status: 'ok', synthetic: false, exposureStatus: exp.status, report: {...buildCfoReport(led.rows, {watermark: led.watermark, exposure: exp.status === 'ok' ? exp : undefined, complete: led.complete}), summary: led.summary}};
}
export const publicReport = (r: ReportResult) => r.status === 'ok' ? {...r, report: serializeReport(r.report)} : r;

/** Bitácora fail-closed del Copiloto CFO: fila en public.cfo_access_log (propuesta de migración) ANTES de leer. */
export function cfoAudit(access: CfoAccess) {
  const memory = ((globalThis as unknown as {__cfoAudit?: unknown[]}).__cfoAudit ??= []) as unknown[];
  return {async record(e: {tool: string | null; args: unknown; outcome: string}) {
    if (access.mode === 'fixture') { memory.push({...e, at: new Date().toISOString()}); return; }
    await access.database!.transaction('propose', s => s.query('INSERT INTO public.cfo_access_log(tenant_id,actor_id,tool,args_hash,outcome) VALUES($1,$2,$3,$4,$5)', [s.tenantId, s.userId, e.tool, e.tool ? argsHash(e.args) : null, e.outcome.replace(/[^a-z_:]/g, '_').slice(0, 40)]));
  }};
}
