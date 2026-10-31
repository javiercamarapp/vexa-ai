export type ClasePP = 'O' | 'E' | 'I';
export type DineroPP =
  | {sinDato: false; tipo: 'bruto'; currency: string; exponent: number; minor: string; supuesta?: true; conCancelados?: string}
  | {sinDato: true; causa: 'sin_fuente' | 'no_disponible' | 'no_aplica'; motivo: string};
export type VolumenPP =
  | {sinDato: false; n: number; unidad: string; sinMonto?: number}
  | {sinDato: true; causa: 'sin_fuente' | 'no_disponible' | 'no_aplica'; motivo: string};
export type PuntoPP = {
  id: string; tema: string; nombre: string; descripcion: string; padre: string | null; agregado: boolean;
  dinero: DineroPP; volumen: VolumenPP; clase: ClasePP;
  cobertura: {texto: string; conMonto?: number; total?: number} | null;
  fuente: {etiqueta: string; tabla: string | null};
  periodo: {desde: string; hasta: string} | null; corte: string | null; actualizado: string | null;
  otrasMonedas: {currency: string; exponent: number; minor: string; n: number}[];
  proxy: {de: string; rotulo: string} | null; proxies?: string[]; solapaCon: string[];
  evidencia: {disponible: boolean; tipo?: 'libro' | 'tracker'; motivo?: string};
  calculo: string[]; noSabemos: string[];
  detalle: Record<string, unknown> | null;
};
export type TemaPP = {id: string; nombre: string; c: number};
export type PainVista = {
  version: string; generatedAt: string; currency: 'USD'; exponent: 2; tipoDinero: 'bruto'; temas: readonly TemaPP[]; clases: Record<ClasePP, string>;
  puntos: PuntoPP[]; partes: Record<string, 'ok' | 'unavailable' | 'not_computed'>; nota: string;
};
export const TEMAS: readonly TemaPP[];
export const CLASES: Record<ClasePP, string>;
export const PAIN_BUDGETS_MS: Readonly<Record<string, number>>;
export const PAIN_VERSION: string;
export function armarPuntos(f: Record<string, unknown>): PuntoPP[];
export function leerWalmartPendiente(s: unknown, o?: {timeoutMs?: number}): Promise<{n: number; known: number; minor: string; desde: string | null; hasta: string | null; refreshedAt: string | null; watermark: string | null} | null>;
export function leerGarantia(s: unknown, o?: {timeoutMs?: number}): Promise<{total: number; hojas: Record<string, number>} | null>;
export function leerRepetido(s: unknown, o?: {timeoutMs?: number}): Promise<false | null | {contactos: number; contactosDosOMas: number; pct: number | null; pctSinVincular: number | null; corte: string | null; refreshedAt: string | null}>;
export function createPainPointsRepository(o: {database: unknown; now?: () => Date; budgets?: Record<string, number>}): {get(o?: {idioma?: 'es' | 'en'}): Promise<PainVista>};
