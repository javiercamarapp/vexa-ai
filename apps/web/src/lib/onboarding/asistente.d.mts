import type {Pista} from './catalogo.mjs';
import type {EstadoPaso, Senales} from './prerrequisitos.mjs';
import type {Role} from '@vexa/platform/capabilities';
export type EstadoAsistente = EstadoPaso | 'otro';
export interface ContextoAsistente { senales?: Senales | null; consultadas?: readonly string[]; push?: {configurado: boolean | null; dispositivos: number | null} | null }
export interface ItemAsistente { id: string; textos: {titulo: string; cuerpo: string}; href: string | null; accion: string; min: number; mixto: boolean; quien: Role[]; estado: EstadoAsistente; cuenta: boolean; esperaA: string | null; nota: string | null; puede: boolean }
export interface EntradaAsistente { id: string; min: number; mixto?: boolean; pre?: 'push'; fijo?: 'no_disponible' }
export const ASISTENTE: Readonly<Record<'propietario' | 'analista' | 'operador' | 'lector', readonly EntradaAsistente[]>>;
export function rolesQueLoHacen(accion: string): Role[];
export function estadoAsistente(pista: Pista, entrada: EntradaAsistente, ctx?: ContextoAsistente): {estado: EstadoAsistente; cuenta: boolean; esperaA: string | null; nota: string | null; puede: boolean};
export function calcularAsistente(pista: Pista, ctx?: ContextoAsistente): {items: ItemAsistente[]; progreso: {hechos: number; total: number}; siguiente: string | null};
export const HOJA_PROVEEDOR: string;
export const HOJA_PERMISOS_MINIMOS: readonly string[];
export const HOJA_PERMISOS_OPCIONALES: readonly string[];
export function nombreCredencial(tenantId: string): string;
export interface DatosHoja { proveedor: string; organizacion: string; tenantId: string; cuenta: string | null; credencial: string; permisos: string[]; opcionales: string[] }
export function datosHojaSoporte(entrada?: {tenantId?: string; organizacion?: string; cuenta?: string | null}): DatosHoja;
export interface Conciliacion { tipo: 'base' | 'hay_ligas' | 'sin_pedidos' | 'sin_resumen' | 'pendiente'; ligados: number | null; total: number | null; fecha: string | null }
export function indicadorConciliacion(datos: {pedidos?: number | null; resumen?: string; refreshedAt?: string | null; ligadas?: boolean | null} | null | undefined): Conciliacion;
