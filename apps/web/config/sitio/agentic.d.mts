// Tipos de config/sitio/agentic.mjs (T2).
import type {FichaPagina, IdiomaSitio} from '../../src/lib/sitio/metadatos.mjs';
type Regla = {userAgent: string | string[]; allow?: string | string[]; disallow?: string | string[]};
type Cabecera = {key: string; value: string};
export const DISALLOW_SITIO: readonly string[];
export const BOTS_BUSQUEDA_Y_AGENTES: readonly string[];
export const BOTS_ENTRENAMIENTO: readonly string[];
export const BOTS_BLOQUEADOS: readonly string[];
export function reglasSitio(): Regla[];
export function reglasHostPrivado(): Regla[];
export function reglasCabecerasEspejos(fichas: FichaPagina[], espejoDe: (id: string, lang: IdiomaSitio) => string | null, base?: string): {source: string; headers: Cabecera[]}[];
export function reglasNegociacionMarkdown(fichas: FichaPagina[], espejoDe: (id: string, lang: IdiomaSitio) => string | null): {source: string; has: unknown[]; destination: string}[];
export const SECURITY_TXT_MARCADORES: readonly string[];
export function plantillaSecurityTxt(a: {correo: string; expira: string; base?: string}): string;
export function robotsParaHost(host: string | null | undefined, landingBase?: string): {rules: Regla[]; sitemap?: string};
