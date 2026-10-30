export type MemberFileKind = 'sales_by_sku' | 'marketplace_orders' | 'marketplace_returns' | 'reviews' | 'speedship_shipments';
export const MEMBER_FILE_PARSER: 'member-file-v1';
export const MEMBER_FILE_KINDS: readonly MemberFileKind[];
export const MAX_REPORTED_ERRORS: number;
export interface MemberFileOptions {kind: string; contentType: string; sheet?: string | null; timezone?: string; dateFormat?: 'iso' | 'ymd' | 'dmy' | 'mdy'; currency?: string | null; observedAt?: string}
export interface MemberFileAmount {currency: string; exponent: number; amount_minor: string; rows: number}
export interface MemberFileReason {code: string; field: string | null; count: number; first_line: number}
export interface MemberFileAggregates {
  date_field: string; date_min: string | null; date_max: string | null; distinct_skus: number | null; distinct_orders: number | null; quantity_total: number | null;
  amount_kind: string | null; amount_label: 'Observada' | null; amount_rows: number; amount_missing: number; amounts: MemberFileAmount[]; rating_histogram: Record<string, number> | null;
}
export interface MemberFilePreview {
  parser: string; kind: MemberFileKind; content_type: string; sheet: string | null; sheets: string[];
  options: {timezone: string; date_format: string; currency: string | null};
  headers: {total: number; recognized: Record<string, string>; ignored: string[]; ignored_count: number; missing_required: string[]; ambiguous: string[]};
  headers_ok: boolean; rows: {read: number; accepted: number; rejected: number; duplicates: number};
  reasons: MemberFileReason[]; errors: {line: number; field: string | null; code: string}[]; errors_truncated: boolean;
  aggregates: MemberFileAggregates | null; can_register: boolean; blocker: 'headers' | 'currency_required' | 'sheet_required' | 'no_valid_rows' | null;
}
export interface MemberFileKindInfo {kind: MemberFileKind; required: string[]; optional: string[]; amount_group: string | null; columns: {key: string; type: string; aliases: string[]; required: boolean}[]}
export function normalizeHeader(header: unknown): string;
export function excelSerialToIso(value: string): string | null;
export function memberFileKindInfo(kind: string): MemberFileKindInfo | null;
export function previewMemberFile(bytes: Uint8Array, options: MemberFileOptions): MemberFilePreview;
export function memberFileProvenance(preview: MemberFilePreview, input: {fileSha256: string; size: number; registeredBy: string; registeredAt?: string}): Record<string, unknown>;
