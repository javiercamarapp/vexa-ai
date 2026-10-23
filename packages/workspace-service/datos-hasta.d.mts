export const FUENTES:Readonly<Record<string,string>>;
export const EXPLICACION:string;
export function diaCorte(v:string|null|undefined):string|null;
export function datosHastaPorFuente(cortes:Record<string,string|null|undefined>|null|undefined):{clave:string;etiqueta:string;dia:string|null;texto:string}[];
export function lineaDatosHasta(cortes:Record<string,string|null|undefined>|null|undefined):string;
