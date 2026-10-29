export const BAJA_ALCANCE: 'weekly';
export const BAJA_VIGENCIA_DIAS: number;
export function firmarBaja(o: {secret: string; tenantId: string; userId: string; now?: Date; vigenciaDias?: number}): string;
export function verificarBaja(o: {secret: string; token: string; now?: Date}): {ok: true; tenantId: string; userId: string} | {ok: false; motivo: 'sin_secreto' | 'formato' | 'firma' | 'expirado' | 'alcance'};
export function urlBaja(appOrigin: string, token: string, idioma?: 'es' | 'en'): string;
export function paginaBaja(o: {tono?: 'ok' | 'error' | 'aviso'; titulo: string; texto: string; enlace?: {href: string; texto: string} | null; appOrigin?: string | null; idioma?: 'es' | 'en'}): string;
export function createBajaHandler(o: {secret: string | undefined; aplicar: (a: {tenantId: string; userId: string; resubscribe: boolean}) => Promise<{ok: boolean; estado?: string} | null>; appOrigin?: string | null; now?: () => Date; log?: (etiqueta: string) => void; idioma?: 'es' | 'en' | ((request: Request) => 'es' | 'en')}): (request: Request) => Promise<Response>;
