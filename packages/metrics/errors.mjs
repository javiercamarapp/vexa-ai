// Errores de dominio del libro económico. Viven en su propio módulo para que repository.mjs y overview.mjs no se importen en círculo.
export class EconomicError extends Error{constructor(code,status=409){super(code);this.code=code;this.status=status;}}
/** Un timeout de sentencia de Postgres (57014) o de la cola de la conexión NO es «falla genérica»: es 504 con reintento posible. */
export const isQueryTimeout=e=>!!e&&(e.code==='57014'||/statement timeout|canceling statement due to/i.test(String(e.message??'')));
export const asTimeout=e=>isQueryTimeout(e)?new EconomicError('economic_query_timeout',504):e;
