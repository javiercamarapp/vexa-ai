export const SENALES_POR_ROL: Readonly<Record<string, readonly string[]>>;
export function consultaDeSenales(rol: string): {claves: readonly string[]; texto: string} | null;
