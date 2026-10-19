export type EpistemicKind='observed'|'estimated'|'inferred'|'unclassified';
export const KINDS:Readonly<Record<EpistemicKind,{label:string;hint:string}>>;
export function epistemicKind(metric:{kind?:string;status?:string}|null|undefined):EpistemicKind;
