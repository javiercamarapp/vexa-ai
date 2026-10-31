export const CUENTA_MS: number;
export const FALLO_MS: number;
export const TICK_MS: number;
/** ¿Un paso «ir» alcanzado por este origen puede viajar solo? Solo 'siguiente' y 'abrir'. */
export function armadoTras(origen: string): boolean;
export interface EntradaViaje {tipo?: string; armado: boolean; elemento: 'buscando' | 'existe' | 'ausente'; movimientoReducido?: boolean; focoEnCampo?: boolean; formularioSucio?: boolean}
export type MotivoPlan = 'no-ir' | 'no-armado' | 'buscando' | 'movimiento-reducido' | 'campo' | 'formulario' | 'ok';
export interface PlanViaje {armar: boolean; ms: number; manual: boolean; motivo: MotivoPlan}
export function planearViaje(e: EntradaViaje): PlanViaje;
export const MOTIVOS_CANCELACION: readonly string[];
export type FaseViaje = 'inactivo' | 'cuenta' | 'manual' | 'viajando' | 'fallo';
export interface EstadoViaje {fase: FaseViaje; restan: number; motivo: string | null}
export const estadoViajeInicial: () => EstadoViaje;
export type EventoViaje = {tipo: 'planear'; plan: PlanViaje} | {tipo: 'cancelar'; motivo: string} | {tipo: 'tick' | 'siguiente' | 'manual' | 'clic' | 'plazo' | 'reiniciar'};
export function reducirViaje(estado: EstadoViaje, evento: EventoViaje): {estado: EstadoViaje; efecto: 'viajar' | null};
export interface DepsViaje {alCambiar?: (e: EstadoViaje) => void; alViajar?: () => void; programar?: (f: () => void, ms: number) => unknown; cancelar?: (id: unknown) => void}
export function crearViaje(deps?: DepsViaje): {enviar: (e: EventoViaje) => EstadoViaje; estado: () => EstadoViaje; reiniciar: () => EstadoViaje; destruir: () => void};
