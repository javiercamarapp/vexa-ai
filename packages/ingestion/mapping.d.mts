import type {SourceContext,Money,RowError} from './index';
export interface Mapping {columns:{role?:string|null;conversation?:string|null;id:string;text:string;date?:string|null;order?:string|null;sku?:string|null;amount?:string|null;currency?:string|null;customer?:string|null};timezone:string;dateFormat:'iso'|'ymd'|'dmy'|'mdy';currency:string|null;sheet?:string|null}
export interface Preview {mapping_version:string;input_rows:number;headers:string[];sheets:string[];sample:{limit:number;representative:false;rows:{line:number;row_ref:number;id:string;text:string;occurred_at:string|null;order:string|null;sku:string|null;customer:string|null;money:Money|null}[]};coverage:{accepted:number;rejected:number;duplicates:number;pending:number};errors:RowError[];coverage_kind:'validation';deduplication:string}
export function canonicalMapping(mapping:Mapping):Mapping;
export function mappingVersion(mapping:Mapping):string;
export function normalizeDate(value:string|null,timezone:string,format:string):string|null;
export function previewImport(bytes:Uint8Array,options:{contentType:string;mapping:Mapping;context:SourceContext;observedAt:string;sampleLimit?:number}):Preview;
export function inspectImport(bytes:Uint8Array,options:{contentType:string;sheet?:string|null;discover?:boolean}):{headers:string[];sheets:string[];rows:{line:number;values:(string|null)[]}[];errors:RowError[]};
export function exportRowErrors(errors:RowError[]):string;
