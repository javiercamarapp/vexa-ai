/** Server-only SQL boundary. Inject a dedicated PostgreSQL pool; never a browser/service-key client.
 * The pool login must be allowed to SET ROLE vexa_backend, must not own domain tables,
 * and must not have SUPERUSER/BYPASSRLS. No driver or Auth implementation is duplicated here.
 */
import { AccessError, reportAccess, resolveSession, type IdentityPort, type Membership } from '@vexa/platform/session';
export type SqlValue = string | number | bigint | boolean | null | readonly string[];
export interface SqlResult<Row> { rows: Row[]; rowCount: number | null }
export interface SqlConnection {
  query<Row = Record<string, unknown>>(text: string, values?: readonly SqlValue[]): Promise<SqlResult<Row>>;
  release(): void;
}
export interface SqlPool { connect(): Promise<SqlConnection> }
import type { DatabaseAction } from '@vexa/platform/capabilities';
export type { DatabaseAction } from '@vexa/platform/capabilities';
// Las lecturas interactivas conservan 10 s. La preparación y publicación de cortes económicos (import) y la materialización recorren todo el libro (~85 mil asientos) y exceden 10 s bajo RLS; la duración total sigue acotada por maxDuration de la ruta.
const STATEMENT_TIMEOUT_MS: Record<DatabaseAction, string> = {read:'10000',notify:'10000',materialize:'45000',import:'55000',configure:'10000',propose:'10000',approve:'10000',execute:'10000',retain:'10000',export:'10000'};
import { DATABASE_ACTION_ROLES } from '@vexa/platform/capabilities';
const roles = DATABASE_ACTION_ROLES;
export interface DatabaseScope {
  readonly tenantId: string;
  readonly userId: string;
  readonly role: Membership['role'];
  readonly permissionsVersion: number;
  /** Trusted repository code only: SQL identifiers are static; all data goes in $n parameters. */
  query<Row = Record<string, unknown>>(text: string, values?: readonly SqlValue[]): Promise<SqlResult<Row>>;
}
/** Conexión cortada por el pooler (no un error de SQL). Una lectura se puede repetir entera con otra conexión. */
export function connectionLost(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as {code?: unknown; message?: unknown};
  return ['ECONNRESET','EPIPE','57P01','57P02','57P03','08000','08003','08006'].includes(String(e.code ?? '')) || /connection terminated|connection (?:is )?closed|client has encountered a connection error|server closed the connection|socket hang up/i.test(String(e.message ?? ''));
}
/** Clase de un fallo de base para el registro del servidor (sin mensajes ni datos: solo una etiqueta fija). */
export function failureClass(error: unknown): string {
  if (error instanceof AccessError) return error.code;
  const e = (error ?? {}) as {code?: unknown; message?: unknown};
  const code = String(e.code ?? ''), message = String(e.message ?? '');
  if (code === 'POOL_WAIT') return 'pool_wait_timeout';
  if (/timeout exceeded when trying to connect/i.test(message)) return 'connect_timeout';
  if (code === '57014') return 'statement_timeout';
  if (code === '25P04' || /idle-in-transaction|transaction timeout/i.test(message)) return 'transaction_timeout';
  if (connectionLost(error)) return 'connection_lost';
  if (code === '53300' || /too many connections|remaining connection slots/i.test(message)) return 'too_many_connections';
  if (/EMAXCONN|max client connections/i.test(message)) return 'pooler_saturated';
  if (code) return 'sqlstate_' + code.slice(0, 5);
  return 'other';
}
function databaseError(error: unknown): AccessError {
  if (error instanceof AccessError) return error;
  const code = (error as {code?: string})?.code;
  if (code === '42501') return new AccessError(403,'database_permission_denied');
  if (['23505','23503','23514','40001','40P01'].includes(code ?? '')) return new AccessError(409,'database_conflict');
  if (['22P02','22003'].includes(code ?? '')) return new AccessError(400,'database_input_invalid');
  return new AccessError(503,'database_unavailable');
}
/** Guardia de concurrencia que publica la aplicación (lib/security/concurrencia.ts): devuelve la función de liberación, o null si la organización ya tiene el máximo en curso. */
async function acquireHeavy(tenantId: string, action: string): Promise<(() => void) | null> {
  const guard = (globalThis as {__vexaConcurrency?: (tenant: string, action: string) => Promise<(() => void) | null>}).__vexaConcurrency;
  if (!guard) return () => {};
  try { return await guard(tenantId, action); } catch { return () => {}; }
}
/** selectedTenant is the server session selector, not a body tenant. Membership is revalidated per call. */
export function createDatabase(options: {identity: IdentityPort; pool?: SqlPool; selectedTenant?: string}) {
  if (typeof window !== 'undefined') throw new AccessError(503,'database_server_only');
  const {identity, pool, selectedTenant} = options;
  const lost = new WeakSet<object>();
  const api = {
    async transaction<T>(action: DatabaseAction, work: (scope: DatabaseScope) => Promise<T>): Promise<T> {
      // Solo lecturas: si el pooler corta la conexión a mitad, se repite la transacción completa una vez con otra conexión (nada se escribió).
      try { return await api.attempt(action, work); } catch (error) {
        if ((action === 'read' || action === 'export') && typeof error === 'object' && error !== null && lost.has(error)) return api.attempt(action, work);
        throw error;
      }
    },
    async attempt<T>(action: DatabaseAction, work: (scope: DatabaseScope) => Promise<T>): Promise<T> {
      const started = Date.now();
      if (!Object.hasOwn(roles,action)) throw new AccessError(403,'database_action_invalid');
      if (!pool) throw new AccessError(503,'database_not_configured');
      let connection: SqlConnection | undefined;
      let open = false;
      let releaseHeavy: (() => void) | undefined;
      try {
        const session = await resolveSession(identity,selectedTenant);
        const userId=session.user.id, tenantId=session.active.tenant_id;
        // GUARDIA CENTRAL de «ver como»: una sesión de soporte solo LEE. Ninguna otra acción llega a la base, sea cual sea la ruta que la pida.
        if (session.support && action === 'export') throw reportAccess(new AccessError(403,'support_export_blocked'));
        if (session.support && action !== 'read') throw reportAccess(new AccessError(403,'support_read_only'));
        // 'export' es una lectura para la base (READ ONLY y vexa.action='read'): solo la capa de aplicación la distingue.
        const sqlAction: DatabaseAction = action === 'export' ? 'read' : action;
        // H-01: tope de concurrencia por organización para acciones pesadas (exportar, importar, materializar). Falla abierto si la base de arrendamientos no responde.
        if (action === 'export' || action === 'import' || action === 'materialize') {
          const lease = await acquireHeavy(tenantId, action);
          if (!lease) throw new AccessError(429,'org_busy');
          releaseHeavy = lease;
        }
        connection = await pool.connect();
        await connection.query(sqlAction === 'read' ? 'BEGIN READ ONLY' : 'BEGIN'); open = true;
        await connection.query('SET LOCAL ROLE vexa_backend');
        await connection.query("SELECT set_config('request.jwt.claim.sub',$1,true), set_config('vexa.tenant_id',$2,true), set_config('statement_timeout',$4,true), set_config('vexa.action',$3,true)",[userId,tenantId,sqlAction,STATEMENT_TIMEOUT_MS[action]]);
        let member:Membership|undefined;
        if (session.support) {
          // Soporte: la base confirma la sesión vigente (vexa_support_active, migración 20261126000100). Sin esa rama la lectura falla cerrada.
          let granted=false;
          try { granted=(await connection.query<{ok:boolean}>('SELECT public.vexa_support_active($1::uuid) AS ok',[tenantId])).rows[0]?.ok===true; }
          catch (error) { if ((error as {code?:string})?.code==='42883') throw new AccessError(503,'support_read_unavailable'); throw error; }
          if (!granted) throw reportAccess(new AccessError(403,'organization_not_authorized'));
          member=session.active;
        } else {
          const current = await connection.query<Membership>(
            "SELECT tenant_id,user_id,role,status,permissions_version FROM public.memberships WHERE tenant_id=$1 AND user_id=$2 AND status='active'",
            [tenantId,userId]);
          member=current.rows[0];
        }
        if (!member || member.user_id!==userId || member.tenant_id!==tenantId || member.status!=='active') throw reportAccess(new AccessError(403,'organization_not_authorized'));
        if (!roles[action].includes(member.role)) throw reportAccess(new AccessError(403,'role_insufficient'));
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
        const sanitized = databaseError(error);
        // Los 503 de la base eran mudos (el mensaje se sanea y no quedaba rastro de la causa, QA-2 del 23-oct): se registra solo una etiqueta fija y el tiempo.
        if (sanitized.status === 503) console.warn('db-fallo ' + JSON.stringify({accion: action, clase: failureClass(error), ms: Date.now() - started}));
        if (connectionLost(error)) lost.add(sanitized);
        throw sanitized;
      } finally { try { releaseHeavy?.(); } catch { /* best effort */ } if(connection) { try { connection.release(); } catch { /* Never expose driver details during cleanup. */ } } }
    },
  };
  return Object.freeze({transaction: api.transaction});
}
/** Absence is distinct from query failure; only an actual empty result becomes 404. */
export function requireRow<Row>(result:SqlResult<Row>):Row {
  if(result.rows.length===0) throw new AccessError(404,'resource_not_found');
  return result.rows[0];
}
/** Cuántas filas devolvió una consulta de descarga (sin contenido): arreglo, {rows}, {items} o desconocido (null). */
export function contarFilas(result: unknown): number | null {
  if (Array.isArray(result)) return result.length;
  if (result && typeof result === 'object') { const r = result as {rows?: unknown; items?: unknown; length?: unknown}; if (Array.isArray(r.rows)) return r.rows.length; if (Array.isArray(r.items)) return r.items.length; }
  return null;
}
/** Rutas de descarga (CSV/JSON/HTML adjunto): toda lectura pasa a la acción 'export', que una sesión de soporte «ver como» no puede ejecutar (403 support_export_blocked).
 * `onExport` (opcional) se llama UNA vez por descarga, al terminar la primera consulta, con quién, en qué organización y cuántas filas (nunca contenido); un fallo suyo no afecta la descarga. */
export function forDownload<D extends {transaction: <T>(action: DatabaseAction, work: (scope: DatabaseScope) => Promise<T>) => Promise<T>}>(database: D, downloading: boolean, onExport?: (e: {tenantId: string; userId: string; rows: number | null}) => void): D {
  if (!downloading) return database;
  let emitted = false;
  return Object.freeze({...database, transaction: <T>(action: DatabaseAction, work: (scope: DatabaseScope) => Promise<T>): Promise<T> => {
    const mapped = action === 'read' ? 'export' : action;
    return database.transaction(mapped, async scope => {
      const result = await work(scope);
      if (mapped === 'export' && !emitted && onExport) { emitted = true; try { onExport({tenantId: scope.tenantId, userId: scope.userId, rows: contarFilas(result)}); } catch { /* el registro nunca rompe la descarga */ } }
      return result;
    });
  }}) as D;
}
