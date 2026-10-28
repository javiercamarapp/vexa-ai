import type {Pista, PasoOnboarding} from './catalogo.mjs';
export type EstadoPaso = 'hecho' | 'salvedad' | 'esperando' | 'bloqueado' | 'pendiente' | 'informativo' | 'desconocido';
export interface Senales { conexion_activa: boolean; conexion_con_problema: boolean; historial_importado: boolean; corte_publicado: boolean; equipo_invitado: boolean; accion_propuesta: boolean; hay_intervenciones: boolean; resultado_registrado: boolean; pedidos_cargados: boolean; pedidos_ligados: boolean }
export interface ItemChecklist { id: string; href: string | null; textos: {titulo: string; cuerpo: string}; estado: EstadoPaso; cuenta: boolean; esperaA: string | null; nota: string | null }
export interface Checklist { items: ItemChecklist[]; visibles: ItemChecklist[]; plegados: ItemChecklist[]; progreso: {hechos: number; total: number}; esperan: number; siguiente: string | null; completo: boolean }
export const MAX_VISIBLES: number;
export const CLAVES_SENALES: readonly (keyof Senales)[];
export function normalizarSenales(crudo: unknown): Senales | null;
export function estadoDePaso(paso: Pick<PasoOnboarding, 'prerrequisito'> & {espera?: 'propietario' | null}, senales: Senales | null): {estado: EstadoPaso; cuenta: boolean; esperaA: string | null; nota: string | null};
export function calcularChecklist(pista: Pista, senales: Senales | null, opciones?: {maxVisibles?: number}): Checklist;
