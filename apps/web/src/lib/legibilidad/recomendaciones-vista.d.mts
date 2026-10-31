import type {Tr} from './trad.mjs';
export function traducirTaxonomia<T>(texto:T):T;
export function siguientePaso(item:{status:string;stale?:boolean;drafts?:unknown[];canMutate?:boolean;ownerId?:string|null}|null|undefined):string|null;
export function responsable(item:{ownerId?:string|null}|null|undefined):string;
export function resumenRecomendaciones(items:readonly {status:string;priority?:string;ownerId?:string|null;drafts?:unknown[]}[]|null|undefined):{total:number;propuestas:number;descartadas:number;criticas:number;sinResponsable:number;conBorrador:number};

export function etiquetaCausal(estado:string,t?:Tr|null):string;
export const GENERADOR_VIGENTE:string;
export function esDeGeneradorAnterior(item:{generatorVersion?:string}|null|undefined):boolean;
export function textoLegible<T>(texto:T,t?:Tr|null):T;
