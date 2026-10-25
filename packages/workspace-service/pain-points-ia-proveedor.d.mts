import type {ProveedorIA} from './pain-points-ia.d.mts';
export const ANTHROPIC_URL: string;
export function iaHabilitada(env?: Record<string, string | undefined>): boolean;
export function crearProveedorReal(env?: Record<string, string | undefined>, o?: {fetchImpl?: typeof fetch; timeoutMs?: number}): ProveedorIA | null;
