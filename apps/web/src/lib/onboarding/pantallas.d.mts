export const slugDe: (href: string) => string;
export interface PantallaDef {readonly ilu: string; readonly clave: readonly string[]; readonly accion?: {readonly capacidad: string; readonly objetivos: readonly string[]}}
export const PANTALLAS: Readonly<Record<string, PantallaDef>>;
export const QUE: readonly string[];
export const ACCIONES: readonly string[];
export const clavesDePantalla: (href: string) => string[];
export const CLAVES_PANTALLAS: readonly string[];
export const TEXTO_PISTA: Readonly<Record<string, Readonly<Record<string, string>>>>;
export const textoDe: (pista: string | null, href: string, campo: 'desc' | 'claveT' | 'claveC' | 'accionT' | 'accionC', general: string) => string;
export const CLAVES_TEXTO_PISTA: readonly string[];
