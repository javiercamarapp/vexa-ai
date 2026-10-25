import type {PainVista, PuntoPP} from './pain-points.d.mts';
export type RolIA = 'causa_raiz' | 'impacto' | 'accion';
export type SeveridadIA = 'baja' | 'media' | 'alta' | 'desconocida';
export type TonoConsenso = 'ok' | 'warn' | 'bad' | 'info';
export type LecturaIA = {
  rol: RolIA; estado: 'ok' | 'invalido' | 'error'; clase: 'inferred'; intento: number; motivoInvalido: string | null; proveedor: string | null; modelo: string | null;
  tokensIn: number | null; tokensOut: number | null; costoMicro: number | null;
  contenido: {severidad?: SeveridadIA; confianza?: number; lectura?: string; puntos?: string[]; supuestos?: string[]; categoria?: string; propuesta?: {titulo: string; pasos: string[]; evidencia: string; ejecucion: 'ninguna_hasta_orden'}; clase?: 'inferred'};
};
export type ConsensoIA = {
  estado: 'acuerdo' | 'acuerdo_parcial' | 'desacuerdo' | 'incompleto' | 'sin_lecturas'; tono: TonoConsenso; severidad: SeveridadIA | null; rango: [SeveridadIA, SeveridadIA] | null;
  confianza: number | null; completo: boolean; motivo: string; discrepancias: {rol: RolIA; severidad: SeveridadIA}[];
};
export type CorridaIA = {id: string; puntoId: string; corte: string; version: string; estado: 'completo' | 'parcial'; consenso: ConsensoIA; confianza: number | null; creadoEn: string; actualizadoEn: string; lecturas: LecturaIA[]; esActual?: boolean};
export type PresupuestoIA = {weekStart: string; capMicro: number; usedMicro: number; remainingMicro: number; exhausted: boolean; topeMicro: number};
export type EstadoIA = {
  version: string; puntoId: string; corte: string; habilitada: boolean; presupuesto: PresupuestoIA; topeAlcanzado: boolean; actual: CorridaIA | null; ultima: CorridaIA | null;
  clase: 'inferred'; ingreso: 'bruto'; roles: {id: RolIA; nombre: string; pregunta: string}[];
  resultado?: {reutilizado: boolean; nuevas: number; invalidas?: number; tope: boolean; enCurso?: boolean; motivoTope?: string | null; costoMicro: number};
  puedeAnalizar?: boolean;
};
export type ProveedorIA = {completar(i: {rol: RolIA; sistema: string; usuario: string; maxTokens: number}): Promise<{texto: string; tokensIn?: number; tokensOut?: number; costoMicro: number; modelo?: string; proveedor?: string}>};
export type StoreIA = {
  presupuesto(): Promise<Omit<PresupuestoIA, 'topeMicro'>>;
  reservar(clave: string, estimadoMicro: number): Promise<{allowed: boolean; reason?: string; usedMicro?: number}>;
  liquidar(clave: string, costoMicro: number | null): Promise<unknown>;
  buscarRun(puntoId: string, corte: string, version: string): Promise<CorridaIA | null>;
  ultimoRun(puntoId: string): Promise<CorridaIA | null>;
  guardar(payload: unknown): Promise<CorridaIA>;
};
export const PROMPT_VERSION: string;
export const TOPE_SEMANAL_MICRO: number;
export const ESTIMADO_POR_LECTURA_MICRO: number;
export const MAX_FILAS_EVIDENCIA: number;
export const SEVERIDADES: readonly SeveridadIA[];
export const CATEGORIAS_CAUSA: readonly string[];
export const LECTURAS: readonly {id: RolIA; nombre: string; pregunta: string; sistema: string}[];
export const TONO_CONSENSO: Record<string, TonoConsenso>;
export const CONFIANZA_MAX: number;
export function pareceTenerPII(t: string): boolean;
export function usdTxt(minor: string | number | bigint): string;
export function construirEntrada(punto: PuntoPP, evidencia?: unknown, o?: {maxFilas?: number}): {objeto: unknown; texto: string};
export function extraerJson(texto: string): Record<string, unknown> | null;
export function validarLectura(rol: RolIA, texto: string, entradaTexto: string): {ok: true; contenido: NonNullable<LecturaIA['contenido']>} | {ok: false; motivo: string};
export function consenso(lecturas: Pick<LecturaIA, 'rol' | 'estado' | 'contenido'>[]): ConsensoIA;
export function corteDe(punto: Pick<PuntoPP, 'corte'>, hoy?: Date): string;
export function createPainAiService(o: {store: StoreIA; provider: ProveedorIA | null; vista: () => Promise<PainVista>; evidencia?: {get(a: {id: string}): Promise<unknown>} | null; now?: () => Date; newId?: () => string; estimadoMicro?: number; maxFilas?: number}): {estado(a: {id: string}): Promise<EstadoIA>; analizar(a: {id: string}): Promise<EstadoIA>};
