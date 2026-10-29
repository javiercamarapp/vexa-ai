export type EpistemicKind='observed'|'estimated'|'inferred'|'unclassified';
export const KINDS:Readonly<Record<EpistemicKind,{label:string;hint:string}>>;
export function epistemicKind(metric:{kind?:string;status?:string}|null|undefined):EpistemicKind;
export type KindOrNoData=EpistemicKind|'nodata';
export const SIN_DATOS:Readonly<{label:string;hint:string}>;
export function epistemicKindConCobertura(metric:{kind?:string;status?:string}|null|undefined,sinDatos:boolean):KindOrNoData;
export function kindInfo(k:KindOrNoData|string,t?:((clave:any,vars?:Record<string,string|number>)=>string)|null):{label:string;hint:string};
