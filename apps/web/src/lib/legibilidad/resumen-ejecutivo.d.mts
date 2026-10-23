export function kpiConversaciones(conv:unknown,ahora?:Date):{valor:number|null;mes:string|null;delta:{value:string;dir:'up'|'down'|'flat'}|null;rotulo:string;estimado:boolean;spark?:number[]}|null;
export function kpiPedidos(led:unknown,ahora?:Date):{amountMinor:string|null;mes:string|null;currency:string;exponent:number;count?:number;unknown?:number;delta:{value:string;dir:'up'|'down'|'flat'}|null;rotulo:string}|null;
export function topProblemas(items:readonly unknown[],n?:number):readonly unknown[];
export function estadoFuentes(view:unknown,cortes?:{libro?:string|null;conversaciones?:string|null}):{cargadas:number|null;total:number|null;sinCargar:string[];analisis:{incorporadas:number;de:number;pct:number}|null;cortes:{etiqueta:string;dia:string|null}[]};
