import type {TrendsView} from '../../../../../packages/workspace-service/trends.mjs';
export type InsightClase='observed'|'estimated'|'inferred';
export type Insight={id:string;texto:string;fuente:string;cobertura:string;clase:InsightClase;vacio?:undefined}|{id:string;vacio:true;razon:string;fuente:string;texto?:undefined};
export type FilaCategoria={category:string;count:number};
export function variacion(actual:string,anterior:string):{dir:'sube'|'baja'|'igual';texto:string}|null;
export function dosMesesCompletos<T extends {month:string}>(series:readonly T[]|null|undefined,ahora?:Date):[T,T]|null;
export function insightsResumen(input?:{trends?:TrendsView|null;categorias?:FilaCategoria[]|null;ahora?:Date}):Insight[];
type ItemMin={title:string;evidence:unknown[];metrics:{kind:string;amount_minor:string|null;currency:string;exponent:number;coverage?:{known_n:number;eligible_n:number}}[]};
export function insightsProblemas(input?:{items?:ItemMin[];moneda?:string|null}):Insight[];
