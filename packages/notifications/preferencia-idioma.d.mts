export const IDIOMA_DE_RESPALDO: 'es';
export const SQL_IDIOMAS: string;
export function idiomasDePersonas(database: {transaction: (action: string, work: (s: {query: (sql: string, values?: unknown[]) => Promise<{rows: unknown[]}>}) => Promise<any>) => Promise<any>} | null | undefined, userIds: string[], opciones?: {action?: string}): Promise<Map<string, 'es' | 'en'>>;
export function mapaDeFilas(filas: unknown[] | null | undefined): Map<string, 'es' | 'en'>;
export function idiomasConConsulta(consultar: ((sql: string, values: unknown[]) => Promise<{rows: unknown[]}>) | null | undefined, userIds: string[]): Promise<Map<string, 'es' | 'en'>>;
export function idiomaDeLaPersona(preferencias: Map<string, 'es' | 'en'> | null | undefined, userId: string): 'es' | 'en';
