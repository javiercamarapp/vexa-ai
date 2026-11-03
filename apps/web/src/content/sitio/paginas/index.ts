// Páginas internas del mapa del sitio con insumos (T11). El registro (K2) las identifica por `id`.
// Aviso de privacidad y Términos (legal.ts) están escritos pero fallan cerrados: no se publican mientras falte VEXA_LEGAL_ENTIDAD, VEXA_LEGAL_DOMICILIO o VEXA_LEGAL_CORREO.
import type { Pagina } from '../tipos.ts';
import { PAGINAS_PRODUCTO } from './producto.ts';
import { PAGINAS_CASOS } from './casos.ts';
import { SEGURIDAD } from './seguridad.ts';
import { INTEGRACIONES, HOJA_DE_RUTA } from './integraciones.ts';
import { ACERCA, SOLICITAR_ACCESO } from './acerca.ts';
import { ESTADO } from './estado.ts';
import { BLOG_INDICE, ARTICULOS_BLOG } from './blog.ts';
import { ARTICULOS_A } from './blog-a.ts';
import { ARTICULOS_B } from './blog-b.ts';
import { PAGINAS_LEGALES } from './legal.ts';

export const PAGINAS_INTERNAS: readonly Pagina[] = [
  ...PAGINAS_PRODUCTO,
  ...PAGINAS_CASOS,
  SEGURIDAD,
  INTEGRACIONES,
  HOJA_DE_RUTA,
  ACERCA,
  SOLICITAR_ACCESO,
  ESTADO,
  BLOG_INDICE,
  ...ARTICULOS_BLOG,
  ...ARTICULOS_A,
  ...ARTICULOS_B,
  ...PAGINAS_LEGALES,
];

export const PAGINA_POR_ID: Readonly<Record<string, Pagina>> = Object.fromEntries(PAGINAS_INTERNAS.map((p) => [p.id, p]));
