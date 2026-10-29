// Páginas internas del mapa del sitio con insumos (T11). El registro (K2) las identifica por `id`.
// Faltan por redactar, sin insumos suficientes: Blog y artículos, Estado, Aviso de privacidad y Términos (los dos últimos esperan al abogado).
import type { Pagina } from '../tipos.ts';
import { PAGINAS_PRODUCTO } from './producto.ts';
import { PAGINAS_CASOS } from './casos.ts';
import { SEGURIDAD } from './seguridad.ts';
import { INTEGRACIONES, HOJA_DE_RUTA } from './integraciones.ts';
import { ACERCA, SOLICITAR_ACCESO } from './acerca.ts';

export const PAGINAS_INTERNAS: readonly Pagina[] = [
  ...PAGINAS_PRODUCTO,
  ...PAGINAS_CASOS,
  SEGURIDAD,
  INTEGRACIONES,
  HOJA_DE_RUTA,
  ACERCA,
  SOLICITAR_ACCESO,
];

export const PAGINA_POR_ID: Readonly<Record<string, Pagina>> = Object.fromEntries(PAGINAS_INTERNAS.map((p) => [p.id, p]));
