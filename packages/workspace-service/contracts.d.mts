export class WorkspaceError extends Error {code:string;status:number;constructor(code:string,status?:number)}
export type WorkspaceScope={date_start:string;date_end:string;timezone:string;date_basis:string;currency:string;basis:string;exponent:number|null;sku:string[];source:string[];snapshot_id:string|null;scope_hash:string|null};
export function parseWorkspaceQuery(query:URLSearchParams,options?:{now?:Date|string}):{scope:WorkspaceScope;resource:'metrics'|'problems';limit:number;cursor:string|null};
export function canonicalScopeHash(input:{baseSnapshotId:string;baseScopeHash:string;filters:Record<string,unknown>;mappingIds:string[];problemVersions?:{problemId:string;versionId:string|null}[];version:string}):string;
export function cursorAuthHash(context:{tenantId:string;userId:string;role:string;permissionsVersion:string|number},dataScopeHash:string,snapshotId:string):string;
export function encodeCursor(input:{after:string;resource:string;authHash:string;snapshotId:string;dataScopeHash:string}):string;
export function decodeCursor(raw:string|null,expected:{resource:string;authHash:string;snapshotId:string;dataScopeHash:string}):string|null;
