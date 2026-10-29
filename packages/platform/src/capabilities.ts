// Fuente única de las acciones de base y los roles que pueden ejecutarlas. Módulo puro (sin dependencias de servidor)
// para que db.ts lo use y el catálogo de onboarding lo importe sin copiarlo.
export type Role = 'owner' | 'analyst' | 'operator' | 'viewer';
export type DatabaseAction = 'read' | 'notify' | 'materialize' | 'import' | 'configure' | 'propose' | 'approve' | 'execute' | 'retain' | 'export';
export const DATABASE_ACTION_ROLES: Record<DatabaseAction, readonly Role[]> = {
  notify: ['owner','analyst','operator','viewer'],
  read: ['owner','analyst','operator','viewer'], materialize: ['owner','analyst','operator','viewer'], import: ['owner','analyst'], configure: ['owner'],
  propose: ['owner','analyst','operator'], approve: ['owner'], execute: ['owner','operator'], retain: ['owner'],
  // Descarga masiva (CSV/JSON): mismas lecturas que 'read', pero jamás en sesión de soporte (AUTH-01).
  export: ['owner','analyst','operator','viewer'],
};
/** Pantallas que mezclan importes de dinero (CFO, Brechas, Fuga, CCO): propietarios y analistas. Fuente única; menú, página y API la usan y el servidor responde 403 al resto. */
export const MONEY_SCREEN_ROLES: readonly Role[] = ['owner','analyst'];
/** Pestaña CCO (/cco): seis preguntas del director de cliente. Mezcla ingreso bruto, así que es de roles de dinero. */
export const CCO_ROLES: readonly Role[] = MONEY_SCREEN_ROLES;
