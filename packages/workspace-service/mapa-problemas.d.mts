export type Celdas = {items: {etiqueta: string; n: number}[]; otros: number; ocultoTodo: boolean};
export type EstadoMapa = {clave: string; pais: 'US' | 'MX'; codigo: string; nombre: string; n: number; tipos: Celdas; motivos: Celdas; retailers: Celdas};
export type MapaVista = {
  status: 'ok' | 'empty' | 'unavailable'; generatedAt: string; class: 'observed'; provisional: true; fuente: string; nota: string; minimoPorCelda: number;
  cobertura?: {filas: number; conDireccion: number; interpretables: number; pctInterpretablesDeDireccion: number | null; pctInterpretablesDeFilas: number | null; pais: {US: number; MX: number}};
  estados?: EstadoMapa[]; ocultos?: {estados: number; casos: number; minimo: number};
};
export type GeoPedido = {orderId: string; canal: 'amazon' | 'walmart' | 'shopify' | 'bestbuy'; estado: string | null; ciudad?: string | null; mes: string};
export const K_MIN: number;
export function direccionDeFila(o: Record<string, string> | null | undefined): string | null;
export function filaGeo(sheet: string, o: Record<string, string>): {hoja: string; tipo: string; tieneDireccion: boolean; estado: string | null; motivo: string | null; retailer: string | null};
export function suprimirCeldas(conteos: Record<string, number>, k?: number): Celdas;
export function agregarGeo(filas: ReturnType<typeof filaGeo>[], k?: number): Required<Pick<MapaVista, 'cobertura' | 'estados' | 'ocultos'>>;
export function quejasPor100Pedidos(pedidos: GeoPedido[], conversaciones: {orderId: string | null}[], o?: {minPedidos?: number; k?: number}): {clave: string; nombre: string | null; pedidos: number | null; quejas: number | null; por100: number | null; nota: string | null}[];
export function createGeoMapRepository(o: {database: unknown; now?: () => Date; budgets?: Record<string, number>}): {get(): Promise<MapaVista>};
