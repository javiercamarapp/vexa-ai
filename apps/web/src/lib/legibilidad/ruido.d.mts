export function esRuido(texto:unknown):boolean;
export function separarRuido<T>(items:readonly T[],textos:(item:T)=>(string|null|undefined)[],incluir?:boolean):{visibles:T[];ocultos:T[];ocultosN:number};
export function separarRuidoCategorias<T extends {category:string;count:number}>(filas:readonly T[],incluir?:boolean):{visibles:T[];gruposOcultos:number;incidenciasOcultas:number};
