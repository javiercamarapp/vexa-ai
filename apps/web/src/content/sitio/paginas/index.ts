// Páginas internas del mapa del sitio con insumos (T11). El registro (K2) las identifica por `id`.
// Faltan por redactar: los artículos a2 a a8 (blog-a.ts y blog-b.ts, hoy vacíos; sin contenido siguen en 404) y, por esperar al abogado, Aviso de privacidad y Términos (404 a propósito).
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
];

export const PAGINA_POR_ID: Readonly<Record<string, Pagina>> = Object.fromEntries(PAGINAS_INTERNAS.map((p) => [p.id, p]));
