// Tipos mínimos para la app Next (TypeScript). Los contratos detallados viven en los comentarios de cada módulo.
export type Kind = 'observed' | 'estimated' | 'inferred' | 'unclassified';
export interface Figure { id: string; label: string; display: string; kind: Kind; coverage: {known: number | null; eligible: number | null; bps: number | null; label: string}; how: string; value: unknown; unit: string | null; scope: string | null }
export interface Delta { bps: number | null; display: string; vs: string; pp?: boolean }
export type Metric = Figure & {delta: Delta | null};
export interface MonthCell { month: string; partial: boolean; n: number; known: number; amount: string; ticket?: string | null; amountDisplay: string; ticketDisplay?: string }
export interface OrderBase { base: string; label: string; additive: boolean; series: MonthCell[]; total: {n: number; known: number; amount: string}; ticket: string | null; channels: Array<{channel: string; label: string; n: number; known: number; amount: string; ticket: string | null; shareBps: number | null}>; channelSeries?: Array<{channel: string; label: string; series: Array<{month: string; n: number; known: number; amount: string}>}> }
export interface CurrencyBlock { currency: string; exponent: number; orderBases: OrderBase[]; refunds: {base: string; label: string; series: MonthCell[]; total: {n: number; known: number; amount: string}; channels: Array<{channel: string; label: string; n: number; known: number; amount: string; orders: number; rateBps: number | null}>}; rate: {series: Array<{month: string; partial: boolean; orders: number; refunds: number; bps: number | null; display: string}>; total: {orders: number; refunds: number; bps: number | null}; channels: string[]; excluded: string[]}; ordersAll: Array<{month: string; partial: boolean; n: number}> }
export interface CfoAlert { id: string; severity: 'alta' | 'media' | 'baja' | 'info'; title: string; detail: string; kind: Kind; how: string; cta: {label: string; href: string} | null }
export interface Projection { id: string; currency: string; metric: 'ingresos' | 'pedidos'; kind: 'estimated'; window: string[]; points: Array<{month: string; mid: number; low: number; high: number; midDisplay: string; lowDisplay: string; highDisplay: string}>; method: string; label: string; sigma: number }
export interface SummaryMeta {source: 'summary' | 'direct'; freshness: 'fresh' | 'stale' | 'unknown' | 'absent' | 'partial' | 'unavailable' | 'timeout' | 'skipped'; refreshedAt: string | null; cutoff: string | null; label: string | null; missingMonths?: string[] | null}
export interface CfoReport {
  summary?: SummaryMeta; generatedAt: string; watermark: string | null; complete: boolean; months: string[]; partialMonths: string[]; completeMonths: string[]; lastComplete: string | null; prevComplete: string | null; currencies: string[];
  channels: Array<{channel: string; label: string; hasRefundSource: boolean}>; perCurrency: CurrencyBlock[]; kpis: Array<{currency: string; month: string | null; metrics: Metric[]}>;
  mix: {orders: Array<{channel: string; label: string; n: number; shareBps: number | null; family: string}>; ordersFig: Figure; byCurrency: Array<{currency: string; base: string; baseLabel: string; total: string; items: Array<{channel: string; label: string; display: string; shareBps: number | null}>}>};
  quality: {totalRows: number; figs: Record<string, Figure>; nonRecorded: Record<string, number>; byChannel: Array<{channel: string; label: string; rows: number; noCurrency: number; ordersNoAmount: number; refundsNoAmount: number; completenessBps: number | null; hasRefundSource: boolean}>; unaccounted: Array<{currency: string; exponent: number; orderRows: number; refundRows: number; orderMinor: string; refundMinor: string; orderFig: Figure; refundFig: Figure}>; notEstimable: {rows: number; reason: string}};
  projections: Projection[]; alerts: CfoAlert[];
  exposure: {state: 'ok' | 'sin_atestar'; attestedLinks: number; kind: Kind; message?: string; note?: string; additive?: boolean; coverageComplete?: boolean; cta?: {label: string; href: string}; rows: Array<Figure & {problemId: string; title: string; currency: string; linkedOrders: number}>};
  glossary: Array<{term: string; body: string}>; rule: string; idioma?: 'es' | 'en';
}
export function buildCfoReport(rows: unknown[], options?: {watermark?: string | null; exposure?: unknown; now?: Date; complete?: boolean; idioma?: 'es' | 'en'}): CfoReport;
export function serializeReport(report: CfoReport): CfoReport;
export function monthMetrics(report: CfoReport, currency: string, month: string): {partial: boolean; metrics: Metric[]} | null;
export function reportRows(report: CfoReport): Array<{section: string; id: string; label: string; scope: string; value: string; kind: Kind; coverage: string; how: string}>;
export function toCsv(report: CfoReport, meta?: {synthetic?: boolean}): string;
export function toPdf(report: CfoReport, meta?: {synthetic?: boolean; org?: string}): Buffer;
export function ledgerMonthlyFixture(): unknown[];
export function exposureFixture(options?: {attested?: boolean}): {attestedLinks: number; coverageComplete: boolean; rows: unknown[]};
export const FIXTURE_WATERMARK: string;
export function createCfoRepository(options: {database: unknown; now?: () => Date; timeoutMs?: number}): {ledgerMonthly(options?: {months?: number}): Promise<{status: 'ok' | 'empty' | 'timeout'; rows: unknown[]; watermark: string | null; complete: boolean; window: {start: string; end: string; months: number}; summary: SummaryMeta}>; exposure(): Promise<{status: 'ok' | 'empty' | 'timeout'; attestedLinks: number; rows: unknown[]; coverageComplete: boolean}>};
export const bigintReplacer: (key: string, value: unknown) => unknown;
export function money(minor: string | null, currency: string, exponent?: number): string;
export function int(n: number | null): string;
export function pct(bps: number | null): string;
export function monthLabel(key: string): string;
// platform
export function platformFixture(): any;
export function buildPlatformView(raw: any, options?: {now?: string}): PlatformView;
export const EXPECTED_SOURCES: ReadonlyArray<{key: string; label: string}>;
export const HEALTH: Record<string, string>;
export const SEVERITY_LABEL: Record<string, string>;
export const usd: (micro: string | null) => string;
export interface PlatformView { generatedAt: string; organizations: any[]; counts: {healthy: number; attention: number; critical: number}; kpis: any; jobs: {totals: any; failed: any[]}; sources: any[]; alerts: any[]; opsSignals: any[]; audit: any[]; aiCosts: any[] }
// copilot
export interface Principal { kind: 'platform_admin' | 'tenant_member'; verified: boolean; userId: string; tenantId?: string; role?: string }
export interface Tool { name: string; label: string; scope: 'platform' | 'tenant'; roles?: string[]; description: string; input: unknown; run(args: any, ctx: any): Promise<any> }
export interface Reply { mode: string; answer: string; steps: unknown[]; citations: Array<{label: string; href: string}>; figures: unknown[]; costMicro: string; guard: {ok: boolean; violations: string[]}; budget: {spent: string; cap: string; pctBps: number | null; exhausted: boolean} }
export interface Copilot { scope: string; status(principal: Principal): {scope: string; tools: unknown[]; budget: Reply['budget']; mode: string}; ask(input: {principal: Principal; question?: string; history?: unknown[]; tool?: string | null; args?: unknown; ctx?: unknown}): Promise<Reply> }
export class CopilotError extends Error { code: string; status: number; constructor(code: string, status?: number) }
export function createCopilot(options: {scope: 'platform' | 'tenant'; tools: Tool[]; model: unknown; audit: {record(entry: any): Promise<void>}; budget?: any; limits?: unknown; clock?: () => number; hits?: Map<string, number[]>}): Copilot;
export function createBudget(options?: {monthlyCapMicro?: bigint | number | string; spentMicro?: bigint | number | string}): any;
export function createSimulatedModel(options?: {scope?: 'platform' | 'tenant'; costMicroPerTurn?: number}): unknown;
export const CFO_TOOLS: Tool[];
export const PLATFORM_TOOLS: Tool[];
export const CFO_SHORTCUTS: {suggestions: string[]; categories: Array<{title: string; questions: string[]}>; direct: Record<string, {tool: string; args: Record<string, unknown>}>};
export const PLATFORM_SHORTCUTS: {suggestions: string[]; categories: Array<{title: string; questions: string[]}>; direct: Record<string, {tool: string; args: Record<string, unknown>}>};
