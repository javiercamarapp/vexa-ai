export type BorradorEntrada = {item: {title: string; action: string; rationale: string; kind?: string}; responsableNombre?: string; fechaCompromiso?: string; citas?: {role: string; category: string; quote: string}[]; skus?: {sku: string; canal?: string; n?: number; usdBrutoMinor?: string | null}[]; periodo?: {inicio?: string; fin?: string}; generadoEn?: string};
export type Archivo = {id: string; titulo: string; formato: 'HTML' | 'Markdown' | 'CSV'; nombre: string; mime: string; contenido: string};
export function sinPII(t: unknown): string;
export function tipoDeRecomendacion(item: any): 'cross_sell' | 'proveedor' | 'general';
export function correoProveedor(i: BorradorEntrada): Archivo[];
export function faqEquipo(i: BorradorEntrada): Archivo[];
export function listasSkus(i: BorradorEntrada): Archivo[];
export function campanaCrossSelling(i: BorradorEntrada): Archivo[];
export function generarBorradores(i: BorradorEntrada): {tipo: string; archivos: Archivo[]; avisos: string[]; enviado: false};
