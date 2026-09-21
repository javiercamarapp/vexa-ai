import type {DatabaseScope,DatabaseAction} from '../platform/src/db.js';
export interface ComparisonDatabase {transaction<T>(action:DatabaseAction,work:(scope:DatabaseScope)=>Promise<T>):Promise<T>}
export interface ComparisonScope {dateStart:string;dateEnd:string;timezone:string;currency:string;dateBasis:'conversation';sources:string[];channels:string[]}
export interface Money {amountMinor:string|null;knownSubtotalMinor:string;knownCount:number;totalCount:number;status:string}
export interface ComparisonSnapshot {id:string;createdAt:string;scope:ComparisonScope;method:{pipelineVersion:string;mappingVersions:string[];taxonomyVersion:string;currencyExponents:Record<string,number>};watermark:string;inputHash:string;summary:{conversations:number;sourceConversations:number;messages:number;orders:number;channels:Record<string,number>;money:Record<string,Money>;warnings:string[]}}
export interface ComparisonResult {state:'comparable'|'no_comparable';reasons:string[];before:ComparisonSnapshot;after:ComparisonSnapshot;channels:Array<{channel:string;before:number;after:number;delta:number}>;money:Record<string,{before:Money|null;after:Money|null;deltaMinor:string|null}>;counts:Record<string,{before:number;after:number;delta:number}>;savings:null;causallyAttributed:false;notice:string}
export function comparisonScope(input:unknown):ComparisonScope;
export function compareSnapshots(before:ComparisonSnapshot,after:ComparisonSnapshot):ComparisonResult;
export function createComparisonRepository(options:{database:ComparisonDatabase}):Readonly<{capture(scope:ComparisonScope):Promise<ComparisonSnapshot>;list(options?:{cursor?:string|null}):Promise<{snapshots:ComparisonSnapshot[];nextCursor:string|null}>;compare(ids:{beforeId:string;afterId:string}):Promise<ComparisonResult>}>;
