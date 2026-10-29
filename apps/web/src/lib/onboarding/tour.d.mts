import type {Pista} from './catalogo.mjs';
export interface PasoTour {
  readonly id: string; readonly tipo: 'ir' | 'info' | 'cierre'; readonly clave: 'ir' | 'que' | 'clave' | 'accion' | 'cierre';
  readonly pantalla: string | null; readonly grupo: number; readonly href: string | null; readonly ilu: string;
  readonly objetivos: readonly string[]; readonly titulo: string | null; readonly cuerpo: string | null; readonly catalogo: string | null;
}
export function pantallasDe(pista: Pista | null): string[];
export type ModoTour = 'corto' | 'completo';
export const MODOS: readonly ModoTour[];
export const ESENCIALES: Readonly<Partial<Record<Pista, readonly (readonly [string, readonly string[]])[]>>>;
export function construirTour(pista: Pista | null, modo?: ModoTour): PasoTour[];
export function gruposDe(pasos: readonly PasoTour[]): {href: string; grupo: number; desde: number}[];
