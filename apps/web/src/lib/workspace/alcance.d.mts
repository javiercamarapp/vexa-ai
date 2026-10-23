export const CLAVES_ALCANCE:readonly string[];
export function periodoAplica(pathname:string):boolean;
export function consultaAlcance(raw:string|URLSearchParams):string;
export function periodoLegible(inicio:string|null|undefined,fin:string|null|undefined):string|null;
export function periodosRapidos(ahora?:Date):Record<'month'|'30d'|'90d'|'12m',[string,string]>;
export const ETIQUETAS_PERIODO:Readonly<Record<'month'|'30d'|'90d'|'12m',string>>;
export function alcanceDeConsulta(raw:string|URLSearchParams,ahora?:Date):{inicio:string|null;fin:string|null;periodo:string|null;clave:string|null;moneda:string|null;base:string|null;snapshot:string|null;hayAlcance:boolean};
export function consultaConPeriodo(raw:string|URLSearchParams,inicio:string,fin:string):URLSearchParams;
export function hrefConAlcance(href: string, raw: string | URLSearchParams): string;
