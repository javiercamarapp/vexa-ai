/** All money is USD, exponent 6 (micro-USD), serialized unsigned decimal integers. */
export interface ReservationRequest {
  tenantId: string; taskKey: string; window: string; fingerprint: string;
  amountMinor: string; tenantLimitMinor: string; currency: 'USD'; exponent: 6;
}
export type ReservationResult =
  | {acquired: true; reservationId: string}
  | {acquired: false; reason: 'duplicate_task'|'idempotency_conflict'|'budget_exceeded'};
/** Server-owned port. reserve MUST serialize quota checks and inserts across workers.
 * Unique (tenantId, taskKey), fingerprint immutable, no TTL-based release.
 * Enforce an authoritative tenant/window limit independently of request parameters.
 * Writes must be durable before resolving; errors must leave reservations held.
 * recordAttempt must fence ownership and preserve append-only history.
 * finalize must be monotonic/atomic, recording known overages rather than clamping.
 * The gateway does NOT provide DB transactions, auth or durable publication.
 */
export interface BudgetRepository {
  reserve(request: ReservationRequest): Promise<ReservationResult>;
  recordAttempt(reservationId: string, attempt: {
    index: number; state: 'started'|'received'|'not_sent'; model?: string; provider?: string;
    pricingVersion?: string; ceilingMinor?: string; startedAt?: number;
    httpStatus?: number; remoteIdHash?: string|null; usage?: Record<string,number>;
    reportedMinor?: string|null; receivedAt?: number;
  }): Promise<void>;
  finalize(reservationId: string, result: {
    state: 'settled'|'uncertain'; actualMinor: string|null; reportedMinor: string;
  }): Promise<void>;
}
/** Single-process test adapter. Never production durable storage. */
export class InMemoryBudgetRepository implements BudgetRepository {
  constructor(options?: {budgets?: Array<{tenantId:string;window:string;limitMinor:string}>});
  reserve: BudgetRepository['reserve'];
  recordAttempt: BudgetRepository['recordAttempt'];
  finalize: BudgetRepository['finalize'];
  snapshot(): unknown[];
}
export function minor(value: string): bigint;
