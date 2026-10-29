export type ReglaCabecera = {source: string; has?: {type: 'host'; value: string}[]; missing?: {type: 'host'; value: string}[]; headers: {key: string; value: string}[]};
export const HOST_SITIO_RE: string;
export const URI_INFORMES_CSP: string;
export function cspSitioInforme(uriInformes?: string): string;
export function reglasEspejos(manifestMd?: Record<string, {url: string}>): ReglaCabecera[];
export function reglasPorHost(opciones?: {uriInformes?: string}): ReglaCabecera[];
