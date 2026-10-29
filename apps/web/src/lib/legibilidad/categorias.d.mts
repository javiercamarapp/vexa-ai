import type {Tr} from './trad.mjs';
export const FAMILIAS:Readonly<Record<string,string>>;
export const CATEGORIAS:Readonly<Record<string,string>>;
export const CATEGORIA_RUIDO:string;
export const TOTAL_CATEGORIAS:number;
export function etiquetaCategoria(categoria:unknown,t?:Tr|null):string;
export function categoriaOriginal(texto:unknown):string;
export function esCategoriaRuido(categoria:unknown):boolean;
