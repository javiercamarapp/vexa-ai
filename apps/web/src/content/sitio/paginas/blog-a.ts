// Artículos a2 a a5 del blog. Los redacta un agente en este archivo (y solo en este); a6 a a8 viven en blog-b.ts y a1 en blog.ts.
// Para publicar uno: añadir aquí la llamada articulo({...}) con id 'a2' ... 'a5' (el id fija la ruta en el registro K2). Mientras no exista,
// la ruta devuelve el 404 propio del sitio y el artículo no aparece en el índice, en el RSS, en el sitemap ni en los espejos.
// Guía de forma: ver ARTICULO_A1 en blog.ts. Constructores: p, h2, h3, ul, pasos, cita, noAfirmamos y articulo, de ../ayudas.ts.
import type { Articulo } from '../tipos.ts';

export const ARTICULOS_A: readonly Articulo[] = [];
