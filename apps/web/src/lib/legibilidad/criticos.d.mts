import type {Tr} from './trad.mjs';
export function fraseCriticosT(t: Tr | null | undefined, c: {grupos: number; senales?: number | null}): string;
export function avisoCriticosT(t: Tr | null | undefined, c: {grupos: number; senales?: number | null}): string;
export function avisoDeMeta(t: Tr | null | undefined, meta: {critical_counts?: {groups: number; signals?: number | null} | null; critical_notice?: string | null} | null | undefined): string | null;
