import type {Tr} from './trad.mjs';
export const SEVERIDAD: Readonly<Record<string, string>>;
export function severidadDe(s: string, t?: Tr | null): string;
export function tonoSeveridad(s: string | null | undefined): 'ok' | 'warn' | 'bad' | 'neutral';
export type ResumenEvidencia = {titulo: string | null; otros: number; severidad: string | null; citas: number; sinConclusion: boolean};
export function resumenEvidencia(ev: unknown): ResumenEvidencia | null;
