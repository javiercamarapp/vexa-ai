export const ESTADOS_US: Readonly<Record<string, string>>;
export const ESTADOS_MX: Readonly<Record<string, string>>;
export function estadoDeDireccion(texto: unknown): {pais: 'US' | 'MX'; codigo: string; via: 'nombre' | 'abreviatura' | 'codigo_postal'} | null;
export function estadoDeZip(zip5: unknown): string | null;
export function estadoDeCpMx(cp5: unknown): string | null;
export function claveEstado(e: {pais: string; codigo: string} | null): string | null;
export function nombreEstado(clave: string): string | null;
