import type {SnapshotView} from '../metrics/snapshots.mjs';
import type {WorkspaceScope} from './contracts.mjs';
type Publication=Pick<SnapshotView,'id'|'scope'>;
export function publicationQuery(snapshot:Publication):URLSearchParams|null;
export function snapshotOverviewUrl(snapshot:Publication):string|null;
export function pinWorkspaceQuery(query:string|URLSearchParams,meta:{snapshot_id:string|null;scope_hash:string|null;scope:Omit<WorkspaceScope,'scope_hash'|'exponent'> & {exponent?:number|null}}):URLSearchParams;
export function latestWorkspaceQuery(query:string|URLSearchParams):URLSearchParams;
