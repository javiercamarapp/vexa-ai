import type {ReglaRedirect, ReglaRewrite} from '../../src/lib/host-routing.mjs';
export const MODO_ENRUTAMIENTO: 'next-config' | 'middleware';
export const MATCHER_MIDDLEWARE: readonly {source: string; missing: readonly {type: 'header'; key: string; value: string}[]}[];
export function reglasHost(opciones?: {produccion?: boolean}): {redirects: ReglaRedirect[]; beforeFiles: ReglaRewrite[]; afterFiles: ReglaRewrite[]; fallback: ReglaRewrite[]};
