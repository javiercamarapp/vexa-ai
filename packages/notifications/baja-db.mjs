// Escritura de la baja (L6) sin sesión de usuario: la autorización ES el token HMAC ya verificado por el manejador. La conexión usa el rol de la app y fija SOLO la acción
// 'weekly_unsubscribe'; la función SQL weekly_unsubscribe (20261127000000) valida que el usuario sea miembro real del tenant y es idempotente. Transacción propia y corta.
export function crearAplicarBaja({pool, statementTimeoutMs = 5000}) {
  return async ({tenantId, userId, resubscribe}) => {
    const c = await pool.connect();
    let abierta = false;
    try {
      await c.query('BEGIN'); abierta = true;
      await c.query('SET LOCAL ROLE vexa_backend');
      await c.query("SELECT set_config('vexa.action','weekly_unsubscribe',true), set_config('statement_timeout',$1,true)", [String(statementTimeoutMs)]);
      const r = (await c.query('SELECT public.weekly_unsubscribe($1::uuid,$2::uuid,$3::boolean) AS r', [tenantId, userId, resubscribe === true])).rows[0]?.r ?? null;
      await c.query('COMMIT'); abierta = false;
      return r;
    } catch (e) {
      if (abierta) { try { await c.query('ROLLBACK'); } catch { /* gana el error original */ } }
      throw e;
    } finally { try { c.release(); } catch { /* sin detalles del driver */ } }
  };
}
