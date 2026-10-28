// Tipos mínimos de lo que consumen los módulos TypeScript (apps/web/src/lib/onboarding/setup-servidor.ts). El resto del módulo lo usan solo archivos .mjs.
export const SUMMARY_TIMEOUT_MS: number;
export function attempt<T>(s: {query: (text: string, params?: readonly any[]) => Promise<{rows: any[]}>}, work: () => Promise<T>, timeoutMs?: number): Promise<{value?: T; timeout?: true; unavailable?: true}>;
