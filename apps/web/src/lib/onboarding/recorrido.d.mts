export interface EstadoRecorrido { abierto: boolean; indice: number; terminado: boolean; iniciadoPorPersona: boolean }
export type EventoRecorrido = { tipo: 'abrir'; indice?: number } | { tipo: 'siguiente' | 'anterior' | 'cerrar' | 'ruta' };
export function estadoInicial(): EstadoRecorrido;
export function reducir(estado: EstadoRecorrido, evento: EventoRecorrido, total: number): EstadoRecorrido;
export function eventoDeTecla(key: string, etiquetaObjetivo?: string): EventoRecorrido | null;
export const OBJETIVOS: Readonly<Record<string, readonly string[]>>;
