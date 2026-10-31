export const ROTULO_AUTO:string;export const AVISO_AUTO:string;
import type {Tr} from './trad.mjs';
export const rotuloAuto:(t?:Tr|null)=>string;export const avisoAuto:(t?:Tr|null)=>string;
export function tituloDescriptivo(input?:{label?:string|null;temas?:{category:string;count:number}[]|null;conversaciones?:number|null;max?:number;t?:Tr|null}):{principal:string;temas:{nombre:string;n:number}[];texto:string;conversaciones:number|null}|null;
