import 'server-only';
import type {Access} from '../../app/(app)/platform/_lib/access';
import {FIXTURE_DETAIL, type OrgDetail} from './ficha-model';
export type OrgDetailResult = {status: 'ok'; detail: OrgDetail} | {status: 'notfound' | 'error'};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Ficha 360: la RPC verifica el grant, audita la consulta ANTES de leer y devuelve solo agregados. Un id mal formado ni siquiera llega a la base. */
export async function loadOrgDetail(access: Access, id: string): Promise<OrgDetailResult> {
  if (!UUID.test(id)) return {status: 'notfound'};
  if (access.mode === 'fixture') return {status: 'ok', detail: FIXTURE_DETAIL(id, Date.now())};
  const r = await access.client!.rpc('platform_org_detail', {p_tenant: id});
  if (r.error) return {status: r.error.code === '22023' ? 'notfound' : 'error'};
  return {status: 'ok', detail: r.data as OrgDetail};
}
