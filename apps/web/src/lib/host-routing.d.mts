export const HOST_APP: string;
export const ORIGEN_APP: string;
export const HOST_SITIO: string;
export const HOST_WWW: string;
export const ORIGEN_SITIO: string;
export const HOSTS_LANDING: readonly string[];
export const HOSTS_ANTIGUOS: readonly string[];
export const PREFIJO_INTERNO: string;
export const SEGMENTO_404: string;
export const RUTAS_APP: readonly string[];
export function normalizarHost(valor: unknown): string;
export function rutaSiempreAbierta(pathname: string): boolean;
export function esActivoPublico(pathname: string): boolean;
export function rutaPublicaDeInterna(pathname: string): string | null;
export function destinoInterno(pathname: string): string;
export type DecisionHost =
  | {tipo: 'pasar'}
  | {tipo: 'activo'}
  | {tipo: 'reescribir'; destino: string; noEncontrada?: true}
  | {tipo: 'redirigir'; url: string; status: 308};
export function decidirHost(args: {host: unknown; pathname: string; search?: string; produccion?: boolean}): DecisionHost;
export function rutaConAutenticacion(pathname: string): boolean;
export function ES_HOST_LANDING(host: unknown): boolean;
export type HasHost = {type: 'host'; value: string};
export type ReglaRedirect = {source: string; destination: string; has: HasHost[]; permanent: true};
export type ReglaRewrite = {source: string; destination: string; has: HasHost[]};
export function reglasNext(opciones?: {produccion?: boolean}): {redirects: ReglaRedirect[]; beforeFiles: ReglaRewrite[]; afterFiles: ReglaRewrite[]; fallback: ReglaRewrite[]};
