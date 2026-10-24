export const SOURCES: readonly string[];
export const SOURCE_TO_REFRESH: Readonly<Record<string, string[]>>;
export function refreshInsights(database: unknown, options?: {source?: string; since?: string | null; budgetMs?: number}): Promise<any>;
export function recordSourceSync(database: unknown, input: {source: string; method: string; ok: boolean; newRecords?: number | null; error?: string | null; latencyMs?: number | null; nextRunAt?: string | null; expectedEverySeconds?: number | null; dataWatermark?: string | null}): Promise<unknown>;
export function createAfterWork(options?: {source?: string; method?: string; enabled?: boolean; budgetMs?: number; expectedEverySeconds?: number | null; refresh?: Function; record?: Function; now?: () => number; warm?: ((database: unknown, input: {what: string}) => Promise<unknown>) | null; progressed?: (r: any) => boolean}): (database: unknown, result: any, info?: {error?: unknown; startedAt?: number}) => Promise<{status: string; code?: string; refreshed?: unknown[]; perfFrio?: unknown}>;
export function perfFrioQue(targets: string[]): 'sla' | 'ledger' | 'all' | null;
export function refreshPerfFrio(database: unknown, options?: {what?: string}): Promise<any>;
