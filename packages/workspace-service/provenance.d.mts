export type CoverageSource={key:string;label:string;loaded:boolean;status:'ok'|'empty'|'timeout';class:'observed'|'estimated';imports:number;openImports:number;total:number;incorporated:number;rejected:number;pending:number;lastUpdate:string|null;detail:string[];rejectionNote:string|null;rejectionBreakdown?:RejectionBreakdown;sheets?:{closed:number;total:number};topVersion?:{label:string|null;rank:number;sha:string};counts?:{facts:number;resolved:number;pending:number;blocked:number;retained:number;links:number|null}};
export type RejectionBreakdown={status:'ok'|'unavailable';metadataOnly:number|null;bodyIncomplete:number|null;roleAmbiguous:number|null;otherDefects:number|null;defects:number|null;conversationRows:number|null;conversationIncorporated:number|null;incorporatedShare:number|null};
export type CoverageView={generatedAt:string;basis:'imports+tables';note:string;sources:CoverageSource[]};
export type OriginStep={step:'message_revision'|'source_record'|'import_row'|'import_file';label:string;hash:string|null;hashShort:string|null;detail:string};
export type OriginView={messageRevisionId:string;complete:boolean;chain:OriginStep[];gap:string|null};
export function rejectionNote(input:{total:number;incorporated:number;rejected:number;pending:number},idioma?:string):string|null;
export const EXPECTED_SOURCES:readonly {key:string;label:string}[];
export function createProvenanceRepository(options:{database:any}):{coverage(o?:{idioma?:string}):Promise<CoverageView>;origin(input:{messageRevisionId:string}):Promise<OriginView>};

export function rejectionBreakdown(input:{total:number;incorporated:number;rejected:number;codes:Record<string,number>|null}):RejectionBreakdown;
export function hubspotRejectionNote(input:{total:number;incorporated:number;rejected:number;pending:number},b:RejectionBreakdown|undefined):string|null;
