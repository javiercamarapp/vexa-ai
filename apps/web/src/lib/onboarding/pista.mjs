// Resolver de pista de onboarding: puro, sin red ni almacenamiento.
// Prioridad: 1) sesión de soporte («Ver como») siempre gana; 2) dentro de /platform, la pista de plataforma;
// 3) dentro de una organización, la pista del rol que la persona tiene ahí; 4) superadmin sin membresías: aviso sin tour (null).
const PISTA_DE_ROL = Object.freeze({ owner: 'propietario', analyst: 'analista', operator: 'operador', viewer: 'lector' });
/**
 * @param {{rol?: string|null, support?: unknown, platformAdmin?: boolean, enPlataforma?: boolean}} entrada
 *   rol = rol en la organización activa (el efectivo: en soporte es viewer); support = sesión de soporte o null.
 * @returns {'propietario'|'analista'|'operador'|'lector'|'plataforma'|'soporte'|null} null = sin tour (aviso).
 */
export function pistaDe({ rol = null, support = null, platformAdmin = false, enPlataforma = false } = {}) {
  if (support != null) return 'soporte';
  if (platformAdmin && enPlataforma) return 'plataforma';
  if (typeof rol === 'string' && Object.hasOwn(PISTA_DE_ROL, rol)) return PISTA_DE_ROL[rol];
  return null;
}
