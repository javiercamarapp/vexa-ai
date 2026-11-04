export type FilaEnlace={retailer:string;entidad:string;tipo:string;total:number|null;ligados:number|null;sinId:number|null;sinLigar:number|null;denominador:number|null;cobertura:number|null};
export type FilaDevolucion={retailer:string;mes:string|null;devoluciones:number|null;sinId:number|null;denominador:number|null;conPedido:number|null;conEnvio:number|null;coberturaPedido:number|null;coberturaEnvio:number|null};
export type FilaPeriodoEnvios={retailer:string;desde:string|null;hasta:string|null};
/** ok: hay resumen; sin_resumen: nunca calculado o migración sin aplicar; tiempo: la lectura agotó su tiempo. */
export type EstadoLectura='ok'|'sin_resumen'|'tiempo';
export type CoberturaPedidosCruda={enlaces:FilaEnlace[]|null;devoluciones:FilaDevolucion[]|null;periodoEnvios:FilaPeriodoEnvios[]|null;refreshedAt:{enlaces:string|null;devoluciones:string|null};lectura:{enlaces:EstadoLectura;devoluciones:EstadoLectura}};
export const RESUMEN_SQL:string;export const PERIODO_ENVIOS_SQL:string;
export function createOrderCoverageRepository(options:{database:any;timeoutMs?:number}):{coverage():Promise<CoberturaPedidosCruda>};
