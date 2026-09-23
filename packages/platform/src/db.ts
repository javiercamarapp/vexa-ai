/** Server-only SQL boundary. Inject a dedicated PostgreSQL pool; never a browser/service-key client.
 * The pool login must be allowed to SET ROLE vexa_backend, must not own domain tables,
 * and must not have SUPERUSER/BYPASSRLS. No driver or Auth implementation is duplicated here.
 */
import { AccessError, resolveSession, type IdentityPort, type Membership } from '@vexa/platform/session';
export type SqlValue = string | number | bigint | boolean | null | readonly string[];
export interface SqlResult<Row> { rows: Row[]; rowCount: number | null }
export interface SqlConnection {
  query<Row = Record<string, unknown>>(text: string, values?: readonly SqlValue[]): Promise<SqlResult<Row>>;
  release(): void;
}
export interface SqlPool { connect(): Promise<SqlConnection> }
export type DatabaseAction = 'read' | 'notify' | 'materialize' | 'import' | 'configure' | 'propose' | 'approve' | 'execute' | 'retain';
const roles: Record<DatabaseAction, readonly Membership['role'][]> = {
  notify: ['owner','analyst','operator','viewer'],
  read: ['owner','analyst','operator','viewer'], materialize: ['owner','analyst','operator','viewer'], import: ['owner','analyst'], configure: ['owner'],
  propose: ['owner','analyst','operator'], approve: ['owner'], execute: ['owner','operator'], retain: ['owner'],
};
export interface DatabaseScope {
  readonly tenantId: string;
  readonly userId: string;
  readonly role: Membership['role'];
  readonly permissionsVersion: number;
  /** Trusted repository code only: SQL identifiers are static; all data goes in $n parameters. */
  query<Row = Record<string, unknown>>(text: string, values?: readonly SqlValue[]): Promise<SqlResult<Row>>;
}
function databaseError(error: unknown): AccessError {
  if (error instanceof AccessError) return error;
  const code = (error as {code?: string})?.code;
  if (code === '42501') return new AccessError(403,'database_permission_denied');
  if (['23505','23503','23514','40001','40P01'].includes(code ?? '')) return new AccessError(409,'database_conflict');
  if (['22P02','22003'].includes(code ?? '')) return new AccessError(400,'database_input_invalid');
  return new AccessError(503,'database_unavailable');
}
/** selectedTenant is the server session selector, not a body tenant. Membership is revalidated per call. */
export function createDatabase(options: {identity: IdentityPort; pool?: SqlPool; selectedTenant?: string}) {
  if (typeof window !== 'undefined') throw new AccessError(503,'database_server_only');
  const {identity, pool, selectedTenant} = options;
  return Object.freeze({
    async transaction<T>(action: DatabaseAction, work: (scope: DatabaseScope) => Promise<T>): Promise<T> {
      if (!Object.hasOwn(roles,action)) throw new AccessError(403,'database_action_invalid');
      if (!pool) throw new AccessError(503,'database_not_configured');
      let connection: SqlConnection | undefined;
      let open = false;
      try {
        const session = await resolveSession(identity,selectedTenant);
        const userId=session.user.id, tenantId=session.active.tenant_id;
        connection = await pool.connect();
        await connection.query(action === 'read' ? 'BEGIN READ ONLY' : 'BEGIN'); open = true;
        await connection.query('SET LOCAL ROLE vexa_backend');
        await connection.query("SELECT set_config('request.jwt.claim.sub',$1,true), set_config('vexa.tenant_id',$2,true), set_config('statement_timeout','10000',true), set_config('vexa.action',$3,true)",[userId,tenantId,action]);
        const current = await connection.query<Membership>(
          "SELECT tenant_id,user_id,role,status,permissions_version FROM public.memberships WHERE tenant_id=$1 AND user_id=$2 AND status='active'",
          [tenantId,userId]);
        const member=current.rows[0];
        if (!member || member.user_id!==userId || member.tenant_id!==tenantId || member.status!=='active') throw new AccessError(403,'organization_not_authorized');
        if (!roles[action].includes(member.role)) throw new AccessError(403,'role_insufficient');
        let active = true;
        const sql = connection;
        const scope: DatabaseScope = Object.freeze({tenantId:member.tenant_id,userId:member.user_id,role:member.role,permissionsVersion:member.permissions_version,
          query<Row>(text:string, values:readonly SqlValue[]=[]):Promise<SqlResult<Row>> {
            if(!active) return Promise.reject(new AccessError(503,'database_scope_expired'));
            return sql.query<Row>(text,values);
          }});
        let result:T;
        try { result=await work(scope); } finally { active=false; }
        await connection.query('COMMIT'); open=false;
        return result;
      } catch(error) {
        if(connection && open) { try {await connection.query('ROLLBACK');} catch {/* Original sanitized failure wins. */} }
        throw databaseError(error);
      } finally { if(connection) { try { connection.release(); } catch { /* Never expose driver details during cleanup. */ } } }
    },
  });
}
/** Absence is distinct from query failure; only an actual empty result becomes 404. */
export function requireRow<Row>(result:SqlResult<Row>):Row {
  if(result.rows.length===0) throw new AccessError(404,'resource_not_found');
  return result.rows[0];
}
