import 'server-only';
import { cookies } from 'next/headers';
import { AccessError, ACTIVE_ORG, authClient, identity, resolveSession } from '../auth';
import type { ReadPort } from './data';
import type { Resource } from './contracts';

export async function workspaceSession() {
 const jar=await cookies();
 const client=authClient({getAll:()=>jar.getAll(),set:()=>{}});
 const session=await resolveSession(identity(client),jar.get(ACTIVE_ORG)?.value);
 return {client,session};
}
interface WorkspacePort extends ReadPort {
 resourceScope(input:{resource:Resource;id:string}):Promise<Record<string,string|string[]|null>>;
}
/** F01-04 is the authenticated UI boundary, not acceptance of the F06 data provider.
 * No provider is registered in this baseline yet. Fail explicitly, never serve
 * fixture rows, invented metrics or an empty result for an unavailable service.
 * The separately tested integration branch supplies the actual database adapter.
 */
export function workspaceService(client:ReturnType<typeof authClient>,selectedTenant?:string):WorkspacePort {
 void client;void selectedTenant;
 throw new AccessError(503,'workspace_unavailable');
}
