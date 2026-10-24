import 'server-only';
import type {Access} from '../../app/platform/_lib/access';

export type ClientRow = {id: string; name: string; createdAt: string | null; member: boolean; role: string | null};
export type SupportInfo = {id: string; tenantId: string; tenantName: string | null; reason: string; startedAt: string; expiresAt: string} | null;
export type ClientsPayload = {items: ClientRow[]; support: SupportInfo; truncated: boolean};
const FIXTURE_ORGS = [
  {id: '00000000-0000-4000-8000-000000000001', name: 'Organización de demostración (sintética)', member: true, role: 'owner'},
  {id: '00000000-0000-4000-8000-000000000002', name: 'Cliente de ejemplo A (sintético)', member: false, role: null},
  {id: '00000000-0000-4000-8000-000000000003', name: 'Cliente de ejemplo B (sintético)', member: false, role: null},
];
/** Todas las organizaciones (nombre e id: lo mismo que ya ve /platform/organizaciones) y cuáles son membresía propia del administrador. Sin correos ni contenido. */
export async function loadClients(access: Access): Promise<ClientsPayload> {
  if (access.mode === 'fixture') return {items: FIXTURE_ORGS.map(o => ({...o, createdAt: null})), support: null, truncated: false};
  const client = access.client!, items: ClientRow[] = [];
  let cursor: string | null = null, pages = 0;
  do {
    const page: {data: {items?: Array<{id: string; name: string; createdAt?: string}>; nextCursor?: string | null} | null; error: unknown} = await client.rpc('platform_manage', {p_input: cursor ? {operation: 'list', cursor} : {operation: 'list'}});
    if (page.error || !page.data) throw new Error('clients_unavailable');
    for (const o of page.data.items ?? []) items.push({id: o.id, name: o.name, createdAt: o.createdAt ?? null, member: false, role: null});
    cursor = page.data.nextCursor ?? null; pages++;
  } while (cursor && pages < 8);
  const mine = await client.from('memberships').select('tenant_id,role').eq('user_id', access.userId).eq('status', 'active');
  const roles = new Map<string, string>((mine.data ?? []).map((m: {tenant_id: string; role: string}) => [m.tenant_id, m.role]));
  for (const o of items) { o.member = roles.has(o.id); o.role = roles.get(o.id) ?? null; }
  items.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const active = await client.rpc('platform_support', {p_input: {operation: 'active'}});
  const s = active.data?.active === true ? active.data.session : null;
  return {items, truncated: !!cursor, support: s ? {id: s.id, tenantId: s.tenantId, tenantName: s.tenantName ?? null, reason: s.reason, startedAt: s.startedAt, expiresAt: s.expiresAt} : null};
}
