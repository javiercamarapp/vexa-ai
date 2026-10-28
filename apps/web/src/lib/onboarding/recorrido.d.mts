export interface EstadoRecorrido { abierto: boolean; indice: number; terminado: boolean; iniciadoPorPersona: boolean }
export type EventoRecorrido = { tipo: 'abrir' | 'ir'; indice?: number } | { tipo: 'ruta'; ruta?: string } | { tipo: 'siguiente' | 'anterior' | 'cerrar' | 'clic' };
export function estadoInicial(): EstadoRecorrido;
export function reducir(estado: EstadoRecorrido, evento: EventoRecorrido, total: number, pasos?: ReadonlyArray<{tipo: string; href: string | null}>, ruta?: string | null): EstadoRecorrido;
export function teclasPropias(el: {tagName?: string; isContentEditable?: boolean; getAttribute?: (n: string) => string | null} | null | undefined): boolean;
export function eventoDeTecla(key: string, etiquetaObjetivo?: string, opciones?: {propias?: boolean; modificador?: boolean}): EventoRecorrido | null;
export const OBJETIVOS: Readonly<Record<string, readonly string[]>>;
