/** Server-authorized context. UUID validation does not authenticate membership. */
export interface SourceContext {
  tenant_id: string; connection_id: string;
  source: 'csv' | 'hubspot' | 'zendesk'; source_account_id: string;
}
export interface SourceEnvelope extends SourceContext {
  entity_type: string; external_id: string; source_revision: string;
  occurred_at: string | null; observed_at: string; content_hash: string;
  payload_ref: string; deleted_at: string | null; adapter_version?: 'csv-message-v1';
}
export interface EnvelopeInput {
  entity_type: string; external_id: string; payload_ref: string;
  source_revision?: string | null; occurred_at?: string | null;
  observed_at: string; deleted_at?: string | null;
}
export class IngestionError extends Error { code: string; field: string | null; line?:number; constructor(code: string, field?: string | null); }
export function requiredString(value: unknown, field: string): string;
export function timestamp(value: unknown, field?: string, nullable?: boolean): string | null;
export function contentHash(value: unknown): string;
export function validateContext(context: SourceContext): SourceContext;
export function createEnvelope(context: SourceContext, record: EnvelopeInput, payload: unknown): Readonly<SourceEnvelope>;
export function identityKey(envelope: SourceEnvelope): string;
export function revisionKey(envelope: SourceEnvelope): string;
export class RevisionLedger {
  readonly size: number;
  apply(envelope: SourceEnvelope): { status: 'inserted' | 'duplicate' | 'revision'; identity_key: string };
  history(envelope: SourceEnvelope): Readonly<SourceEnvelope>[];
}
export interface AliasApproval { tenant_id: string; canonical_id: string; evidence_ref: string; approved_by: string; version: string; }
export class ExplicitAliases {
  approve(envelopes: SourceEnvelope[], approval: AliasApproval): string;
  resolve(envelope: SourceEnvelope): string;
}
export interface CSVLimits { maxBytes?: number; maxRows?: number; maxColumns?: number; maxFieldChars?: number; }
export interface RowError { code: string; field: string | null; line: number; }
export function parseCSV(input: string | Uint8Array, limits?: CSVLimits): { rows: {values: string[]; line: number}[]; errors: RowError[] };
export interface CSVRecord {
  money?: Money;
  envelope: SourceEnvelope;
  raw_payload: Record<string,string>;
  message: { text: string; role: 'customer'|'agent'|'internal'|'unknown'; customer_id: string|null; sku: string|null; order_id: string|null; conversation_external_id: string|null; content_format: 'plain_text'; redaction: 'none' };
  row_ref: number; row_hash: string; batch_hash: string; mapping_version: string;
}
export function normalizeCSV(input: string | Uint8Array, options: { context: SourceContext; observed_at: string; mappingVersion: string; limits?: CSVLimits }): {
  records: CSVRecord[]; errors: RowError[]; batch_hash: string; mapping_version: string;
  coverage: { accepted: number; rejected: number; unknown_customers: number; unknown_skus: number };
};

export function adaptCSVRaw(envelope: SourceEnvelope, raw: Record<string,string>): CSVRecord['message'];

export type CSVStreamEvent = {type:'row'; values:string[]; line:number} | ({type:'error'} & RowError);
/** maxRows counts all raw records, including the header. Message normalization counts data records. */
export function parseCSVStream(source: AsyncIterable<Uint8Array>, options?: CSVLimits & {signal?: AbortSignal}): AsyncGenerator<CSVStreamEvent, void, unknown>;
export interface Money { amount_minor:string; currency:string; exponent:number; }
export function parseMoney(amount:string, currency:string): Money;
export interface XLSXLimits extends CSVLimits { maxExpandedBytes?:number; maxSheets?:number; maxEntries?:number; maxXMLNodes?:number; }
/** Restricted transitional OOXML; no macros, external relationships, ZIP64, encryption or style/date conversion. */
export function parseXLSX(input:Uint8Array, limits?:XLSXLimits): {sheets:{name:string; rows:{line:number; values:(string|null)[]}[]; errors:RowError[]}[]};
