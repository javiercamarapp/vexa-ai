export function traducirTaxonomia<T>(texto:T):T;
export function siguientePaso(item:{status:string;stale?:boolean;drafts?:unknown[];canMutate?:boolean;ownerId?:string|null}|null|undefined):string|null;
export function responsable(item:{ownerId?:string|null}|null|undefined):string;
export function resumenRecomendaciones(items:readonly {status:string;priority?:string;ownerId?:string|null;drafts?:unknown[]}[]|null|undefined):{total:number;propuestas:number;descartadas:number;criticas:number;sinResponsable:number;conBorrador:number};
