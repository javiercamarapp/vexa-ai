export const NOMBRES: Readonly<Record<string, string>>;
export const UNIDADES: Readonly<Record<string, string>>;
export function rangoDeSerie(serie: unknown, tieneDatos: (p: any) => boolean): string | null;
export type Identidad = {total: number; vinculadas: number; sinIdentificar: number; porRevisar: number; retenidas: number; vinculosActivos: number | null; bps: number; estimado: boolean};
export function identidad(fuente: unknown): Identidad | null;
export type TarjetaFuente = {clave: string; nombre: string; unidad: string; estado: 'cargada' | 'sin_cargar' | 'no_disponible'; clase: string; importaciones: number; abiertas: number; leidas: number; incorporadas: number; rechazadas: number; pendientes: number; detalle: string[]; nota: string | null; ultimaCarga: string | null; datosHasta: string | null; rango: string | null; rangoNota: string | null; bps: number | null};
export function tarjetasFuentes(cobertura: unknown, trends: unknown): TarjetaFuente[];
