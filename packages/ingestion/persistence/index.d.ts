import type {DatabaseScope} from '../../platform/src/db';
import type {CSVRecord, SourceEnvelope} from '../index';
export interface EnvelopeRecord {
 envelope: SourceEnvelope;
 /** Trusted caller resolves payload_ref before calling; hash is rechecked here. */
 payload: Record<string, unknown>;
 row_ref: string | number;
 mapping_version: string;
}
export interface PersistenceResult {
 status: 'inserted' | 'duplicate' | 'conflict' | 'rejected';
 canonical_id?: string;
 code: string;
 field?: string | null;
 row_ref?: number;
 raw_hash?: string;
}
/** Atomic with its enclosing createDatabase.transaction('import'); no commit here.
 * Repeating the identical import row returns its original outcome without recounting.
 * An envelope without a resolved payload is durably rejected, never guessed.
 */
export function persistCanonical(scope: DatabaseScope, input: {importId: string; record: CSVRecord | EnvelopeRecord | SourceEnvelope}): Promise<PersistenceResult>;

export interface CanonicalHead { id: string; version: number; state: 'unique'|'ambiguous'|'selected'; selected_revision_id: string|null; }
export interface CanonicalRevision { id: string; canonical_id: string; source_revision: string; content_hash: string; snapshot: Array<{table:string;row:Record<string,unknown>}>; }
export function readCanonicalHistory(scope: DatabaseScope, input:{canonicalId:string}): Promise<{head:CanonicalHead;revisions:CanonicalRevision[]}|null>;
export function selectCanonicalRevision(scope: DatabaseScope, input:{canonicalId:string;revisionId:string;expectedVersion:number;reason:string}): Promise<{status:'selected';canonical_id:string;revision_id:string;version:number}|{status:'conflict';code:'SELECTION_CAS_CONFLICT'}>;
export function persistNormalizationRejection(scope: DatabaseScope, input:{importId:string;error:{code:string;field?:string|null};rowRef:number;rawHash:string;batchHash:string;mappingVersion:string}): Promise<PersistenceResult>;
