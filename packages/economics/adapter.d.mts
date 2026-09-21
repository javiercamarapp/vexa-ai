export type MinorUnits = string | null;
export interface Authorization {tenantId:string;permissionsVersion:string}
export interface LedgerSnapshot {tenantId:string;id:string;asOf:string;sources:Array<{sourceAccount:string;watermark:string|null;complete:boolean}>}
export interface LedgerScope {start:string;end:string;timezone:string;dateBasis:'occurred_at';currency:string;exponent:number;basis:string}
export interface LedgerRecord {id:string;tenantId:string;sourceAccount:string;externalId:string;sourceRevision:string;occurredAt:string;recordedAt:string;currency:string;exponent:number;basis:string;amountMinor:MinorUnits;provenance:'observed'|'approved_manual';evidenceRef:string}
export interface LedgerOrder extends LedgerRecord {status:'recorded'|'pending'|'cancelled'|'unknown'}
/** Refund amount nonnegative; reversal negative (or zero), unlike kernel magnitudes. */
export interface LedgerEvent extends LedgerRecord {kind:'refund'|'reversal';status:'settled'|'pending'|'cancelled'|'unknown';reversalOf:string|null}
export interface LedgerLink {tenantId:string;problemId:string;orderId:string;evidenceRef:string;relationVersion:string}
export interface LedgerInput {authorization:Authorization;snapshot:LedgerSnapshot;scope:LedgerScope;orders:LedgerOrder[];events:LedgerEvent[];links:LedgerLink[]}
export interface LedgerMetric {amountMinor:MinorUnits;knownSubtotalMinor:MinorUnits;knownCount:number;totalCount:number;status:'complete'|'partial'|'unavailable';currency:string;exponent:number;basis:string;window:Pick<LedgerScope,'start'|'end'|'dateBasis'|'timezone'>;missingReasons:string[];evidenceRefs:string[]}
export interface LedgerBundle {schemaVersion:'vexa-ledger-adapter-v1';tenantId:string;snapshotId:string;scope:LedgerScope;scopeHash:string;inputHash:string;metrics:{allOrders:LedgerMetric;exposure:{global:LedgerMetric;byProblem:Record<string,LedgerMetric>;problemRowsAreAdditive:false};refunds:LedgerMetric};issues:Array<{code:string;entityType?:string;id?:string}>;excluded:{outsideWindow:number;otherCurrency:number;otherBasis:number;afterSnapshot:number;cancelled:number;pending:number}}
export class LedgerAdapterError extends Error {code:string;constructor(code:string)}
export function adaptLedger(input:LedgerInput):LedgerBundle;
