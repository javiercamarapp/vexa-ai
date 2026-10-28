import type {DatabaseAction, Role} from '@vexa/platform/capabilities';
export type Pista = 'propietario' | 'analista' | 'operador' | 'lector' | 'plataforma' | 'soporte';
export type Superficie = 'tour' | 'checklist' | 'setup';
export type PrerrequisitoId = 'conexion_activa' | 'historial_importado' | 'corte_publicado' | 'equipo_invitado' | 'accion_propuesta' | 'resultado_registrado' | 'pedidos_cargados' | 'pedidos_ligados';
export interface PasoOnboarding {
  readonly id: string;
  readonly pista: Pista;
  readonly accion: DatabaseAction;
  readonly href: string | null;
  readonly superficie: Superficie;
  readonly prerrequisito: PrerrequisitoId | null;
  readonly espera: 'propietario' | null;
  readonly textos: {readonly titulo: string; readonly cuerpo: string};
}
export const PISTAS: readonly Pista[];
export const ROL_DE_PISTA: Readonly<Record<Pista, Role | null>>;
export const ACCIONES: readonly DatabaseAction[];
export const ACCIONES_DE_ESCRITURA: readonly DatabaseAction[];
export const PRERREQUISITOS: Readonly<Record<PrerrequisitoId, {readonly fuente: string; readonly tercero: 'crm' | 'correo' | 'push' | null}>>;
export const CATALOGO: readonly PasoOnboarding[];
export function pasosDe(pista: Pista, superficie?: Superficie): PasoOnboarding[];
export function rolesConCapacidad(accion: DatabaseAction): Role[];
export function rolTieneCapacidad(rol: Role, accion: DatabaseAction): boolean;
export function clavesDePista(pista: Pista): string[];
export const CLAVES_SETUP: readonly string[];
export const CLAVES_UI: readonly string[];
export function problemasDePaso(paso: PasoOnboarding, menuVisible: (o: {role?: string; interno?: boolean}) => readonly unknown[]): string[];
