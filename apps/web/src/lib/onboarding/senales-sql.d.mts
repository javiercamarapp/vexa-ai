export const SENALES_POR_ROL: Readonly<Record<string, readonly string[]>>;
export const SENALES_SETUP_POR_ROL: Readonly<Record<string, readonly string[]>>;
export function consultaDeSenales(rol: string, tabla?: Readonly<Record<string, readonly string[]>>): {claves: readonly string[]; texto: string} | null;
