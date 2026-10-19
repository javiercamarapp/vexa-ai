export type CoverageSource={key:string;label:string;loaded:boolean;imports:number;openImports:number;total:number;incorporated:number;rejected:number;pending:number;lastUpdate:string|null};
export type CoverageView={generatedAt:string;basis:'imports';note:string;sources:CoverageSource[]};
export type OriginStep={step:'message_revision'|'source_record'|'import_row'|'import_file';label:string;hash:string|null;hashShort:string|null;detail:string};
export type OriginView={messageRevisionId:string;complete:boolean;chain:OriginStep[];gap:string|null};
export const EXPECTED_SOURCES:readonly {key:string;label:string}[];
export function createProvenanceRepository(options:{database:any}):{coverage():Promise<CoverageView>;origin(input:{messageRevisionId:string}):Promise<OriginView>};
