export function consultaFijada(scope:{date_start:string;date_end:string;timezone:string;date_basis:string;currency:string;basis?:string;exponent?:number|null;sku:string[];source:string[]},snapshotId:string,scopeHash:string):URLSearchParams;
export const LIMPIAR_RECOMENDACIONES:string[];export const LIMPIAR_BRIEFS:string[];export const PANTALLAS_PRINCIPALES:string[];
export function lecturasDePantalla(ruta:string,consulta?:string):{url:string;valida?:(j:unknown)=>unknown;luego?:(j:unknown)=>unknown[]|null}[];
export function precalentarPantallas(rutas:string[],consulta?:string,opciones?:unknown):number;
export function precalentarEnlace(href:string,opciones?:unknown):number;
