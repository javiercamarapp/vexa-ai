export function proyectarHistoria(history: unknown): Array<{id: string; version: number; provenance: Record<string, unknown>}>;
export function proyectarProblema<T extends {id: string}>(problem: T, options?: {auditoria?: boolean}): Record<string, unknown>;
