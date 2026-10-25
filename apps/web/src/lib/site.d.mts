export const SITE_URL_RESPALDO: string;
export function siteUrl(env?: string | undefined): string;
export const SITE: Readonly<{nombre:string;corto:string;anteriorNombre:string;titulo:string;descripcion:string;idioma:string;locale:string;categoria:string;palabrasClave:readonly string[];contacto:string;og:Readonly<{ancho:number;alto:number;alt:string}>}>;
export const RUTAS_PUBLICAS: readonly string[];
export const PREFIJOS_PRIVADOS: readonly string[];
export function metadatosPublicos(o:{titulo?:string;descripcion?:string;ruta:string}): import('next').Metadata;
export function jsonLd(base?: string): Record<string, unknown>;
export const ROBOTS_PRIVADO: Readonly<{index:false;follow:false;nocache:true}>;
