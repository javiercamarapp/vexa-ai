// Tipos de lo que consumen los componentes del sitio (T7) de marcadores.mjs. Solo declara; la lógica vive en marcadores.mjs.
export type CtxMarcadores = {contacto: string | null; seguridad: string | null; fechaRevision: string | null; razonSocial: string | null};
export type Aprobaciones = {version?: number; condiciones?: Record<string, {cumplida: boolean}>; campos?: Record<string, Record<string, {hash: string}>>} & Record<string, unknown>;
export type OpcionesPublicacion = {aprobaciones?: Aprobaciones; ctx?: CtxMarcadores; prefijo?: string};
export function contextoPorDefecto(): CtxMarcadores;
export function publicar<T>(arbol: T, opciones?: OpcionesPublicacion): {arbol: T; omitidas: {ruta: string; motivos: string[]}[]; sustituidas: unknown[]; estados: unknown[]};
export function proyectarArbol(nodo: unknown, lang: 'es' | 'en'): unknown;
export function resolverMarcadores(texto: string, ctx?: CtxMarcadores): {texto: string; sinResolver: string[]};
export function construirMailto(a: {contacto: string; asunto?: string; cuerpo?: string}): string | null;
export function estadoPagina(pagina: unknown, opciones?: {aprobaciones?: Aprobaciones; ctx?: CtxMarcadores; tipo?: string}): {id: string; publicable: boolean; motivos: string[]; hojas: unknown[]};
export function aprobacionesVacias(): Aprobaciones;
