import type { SourceContext, SourceEnvelope } from '../ingestion/index.js';
export interface HubSpotConfig {
 context: SourceContext; token: string; version: 'v3';
 /** Operator-declared scopes; NOT proof that the provider granted them. */
 scopes: string[];
 /** If present, fetch ONLY these direct thread IDs; no account-wide list request. */
 threadIds?: string[];
 archived?: boolean; inboxId?: string; includeTickets?: boolean; includeNotes?: boolean;
 fetch?: typeof globalThis.fetch; clock?: ()=>Date; sleep?: (milliseconds:number)=>Promise<void>;
 timeoutMs?: number; maxRetries?: number; maxDelayMs?: number; maxResponseBytes?: number;
 maxPages?: number; maxRecords?: number; deadlineMs?: number;
}
export interface Checkpoint {version:1;scope:string;cursor:string}
export interface Association {entity_type:'thread'|'ticket';external_id:string}
export interface ConnectorRecord {
 envelope:SourceEnvelope;payload:Record<string,unknown>;provider_updated_at:unknown;
 customer_id:null;sku:null;order_id:null;deleted:boolean;text:string|null;
 role:'customer'|'agent'|'internal'|'unknown';visibility:'public'|'internal'|'unknown';
 body_complete:boolean;conversation_id:string|null;associations:Association[];
 text_format?:'inert_html';
}
export interface RejectedRecord {
 index:number;code:string;field:string|null;
 /** Restricted quarantine: must never be logged or returned as a public error. */
 payload:unknown;context:Readonly<SourceContext>;observed_at:string;
}
export interface Page {
 records:ConnectorRecord[];errors:RejectedRecord[];
 /** Proposed only; persist records, quarantines, and checkpoint atomically in consumer. */
 checkpoint:Checkpoint|null;done:boolean;adapter_version:'vexa-hubspot-v2';
 coverage:{objects_read:number;accepted:number;rejected:number;threads_read:number;messages_read:number;bodies_missing:number;messages_complete:boolean;notes_bodies_missing:number;notes_complete:boolean;tickets_complete:boolean;archived:boolean;live_verified:false};
}
export interface Adapter {pages(options?:{checkpoint?:Checkpoint|null}):AsyncGenerator<Page,void,unknown>}
export class ConnectorError extends Error {
 code:string;status:number|null;retryable:boolean;retryAfterMs:number|null;state:'error'|'reconnect_required';
 constructor(code:string,details?:{status?:number|null;retryable?:boolean;retryAfterMs?:number|null});
}
export function createHubSpotAdapter(config:HubSpotConfig):Adapter;

export interface ZendeskConfig {
 context:SourceContext; token:string; subdomain:string; startTime:number;
 /** OAuth Bearer token; provider access and legitimate account authorization remain external checks. */
 fetch?:typeof globalThis.fetch; clock?:()=>Date; sleep?:(milliseconds:number)=>Promise<void>;
 timeoutMs?:number; maxRetries?:number; maxDelayMs?:number; maxResponseBytes?:number;
 maxPages?:number; maxRecords?:number; deadlineMs?:number;
}
export interface ZendeskRecord extends ConnectorRecord {
 /** Explicit ticket status=deleted only; never inferred from a failed request. */
 tombstone:boolean;
 role_evidence?:{user_id:string;provider_role:string|null}|null;
}
export interface ZendeskPage {
 records:ZendeskRecord[];errors:RejectedRecord[];
 /** Retained even when done=true, to resume the next incremental synchronization. */
 checkpoint:Checkpoint;done:boolean;adapter_version:'vexa-zendesk-v2';
 coverage:{objects_read:number;accepted:number;rejected:number;tickets_read:number;comments_read:number;messages_read:number;deleted_tickets:number;bodies_missing:number;messages_complete:boolean;live_verified:false};
}
export interface ZendeskAdapter {pages(options?:{checkpoint?:Checkpoint|null}):AsyncGenerator<ZendeskPage,void,unknown>}
export function createZendeskAdapter(config:ZendeskConfig):ZendeskAdapter;
