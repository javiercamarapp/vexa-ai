// K2. Registro único de las páginas públicas de rovaq.ai (34 URL por idioma: 25 páginas, índice del blog y 8 artículos).
// Esqueleto de T1: solo identidad y rutas, que es lo que necesitan el enrutamiento por host y el despachador. T2 añade aquí metadatos
// (título, descripción, h1, hreflang, estado de aprobación) sin cambiar estas claves. Fuente única: host-routing.mjs, el sitemap y los
// espejos derivan de este archivo, así que las rutas no pueden divergir. Español sin prefijo; inglés bajo /en.
// Sin paréntesis ni signos de exclamación en el texto (regla editorial).
export const IDIOMAS = Object.freeze(['es', 'en']);
export const PAGINAS = Object.freeze([
 {id:"inicio", tipo:"inicio", es:{ruta:"/"}, en:{ruta:"/en"}},
 {id:"producto", tipo:"indice", es:{ruta:"/producto"}, en:{ruta:"/en/product"}},
 {id:"hoy", tipo:"producto", es:{ruta:"/producto/hoy"}, en:{ruta:"/en/product/today"}},
 {id:"fuga-de-reembolsos", tipo:"producto", es:{ruta:"/producto/fuga-de-reembolsos"}, en:{ruta:"/en/product/refund-leakage"}},
 {id:"problemas", tipo:"producto", es:{ruta:"/producto/problemas"}, en:{ruta:"/en/product/problems"}},
 {id:"puntos-de-dolor", tipo:"producto", es:{ruta:"/producto/puntos-de-dolor"}, en:{ruta:"/en/product/pain-points"}},
 {id:"pregunta-a-tus-datos", tipo:"producto", es:{ruta:"/producto/pregunta-a-tus-datos"}, en:{ruta:"/en/product/ask-your-data"}},
 {id:"por-decidir", tipo:"producto", es:{ruta:"/producto/por-decidir"}, en:{ruta:"/en/product/to-decide"}},
 {id:"carga-y-sla", tipo:"producto", es:{ruta:"/producto/carga-y-sla"}, en:{ruta:"/en/product/workload"}},
 {id:"confianza-de-los-datos", tipo:"producto", es:{ruta:"/producto/confianza-de-los-datos"}, en:{ruta:"/en/product/data-trust"}},
 {id:"fuentes-e-importaciones", tipo:"producto", es:{ruta:"/producto/fuentes-e-importaciones"}, en:{ruta:"/en/product/sources-and-imports"}},
 {id:"finanzas", tipo:"producto", es:{ruta:"/producto/finanzas"}, en:{ruta:"/en/product/finance"}},
 {id:"casos-de-uso", tipo:"indice", es:{ruta:"/casos-de-uso"}, en:{ruta:"/en/use-cases"}},
 {id:"propietario", tipo:"rol", es:{ruta:"/casos-de-uso/propietario"}, en:{ruta:"/en/use-cases/owner"}},
 {id:"analista", tipo:"rol", es:{ruta:"/casos-de-uso/analista"}, en:{ruta:"/en/use-cases/analyst"}},
 {id:"operador", tipo:"rol", es:{ruta:"/casos-de-uso/operador"}, en:{ruta:"/en/use-cases/operator"}},
 {id:"lector", tipo:"rol", es:{ruta:"/casos-de-uso/lector"}, en:{ruta:"/en/use-cases/viewer"}},
 {id:"seguridad-y-privacidad", tipo:"institucional", es:{ruta:"/seguridad-y-privacidad"}, en:{ruta:"/en/security-and-privacy"}},
 {id:"integraciones", tipo:"institucional", es:{ruta:"/integraciones"}, en:{ruta:"/en/integrations"}},
 {id:"hoja-de-ruta", tipo:"institucional", es:{ruta:"/hoja-de-ruta"}, en:{ruta:"/en/roadmap"}},
 {id:"acerca", tipo:"institucional", es:{ruta:"/acerca"}, en:{ruta:"/en/about"}},
 {id:"solicitar-acceso", tipo:"contacto", es:{ruta:"/solicitar-acceso"}, en:{ruta:"/en/request-access"}},
 {id:"estado", tipo:"institucional", es:{ruta:"/estado"}, en:{ruta:"/en/status"}},
 {id:"aviso-de-privacidad", tipo:"legal", es:{ruta:"/aviso-de-privacidad"}, en:{ruta:"/en/privacy-notice"}},
 {id:"terminos", tipo:"legal", es:{ruta:"/terminos"}, en:{ruta:"/en/terms"}},
 {id:"blog", tipo:"blog-indice", es:{ruta:"/blog"}, en:{ruta:"/en/blog"}},
 {id:"a1", tipo:"articulo", es:{ruta:"/blog/reembolsos-fuga-que-se-puede-localizar"}, en:{ruta:"/en/blog/refund-leak-you-can-locate"}},
 {id:"a2", tipo:"articulo", es:{ruta:"/blog/procedencia-de-cada-numero"}, en:{ruta:"/en/blog/where-every-number-comes-from"}},
 {id:"a3", tipo:"articulo", es:{ruta:"/blog/la-ia-clasifica-las-personas-deciden"}, en:{ruta:"/en/blog/ai-classifies-people-decide"}},
 {id:"a4", tipo:"articulo", es:{ruta:"/blog/un-puesto-una-vista"}, en:{ruta:"/en/blog/one-role-one-view"}},
 {id:"a5", tipo:"articulo", es:{ruta:"/blog/exportes-de-marketplace-ya-son-datos"}, en:{ruta:"/en/blog/marketplace-exports-are-data"}},
 {id:"a6", tipo:"articulo", es:{ruta:"/blog/puntos-de-dolor-del-texto-a-la-prioridad"}, en:{ruta:"/en/blog/pain-points-from-text-to-priority"}},
 {id:"a7", tipo:"articulo", es:{ruta:"/blog/que-afirmamos-sobre-seguridad"}, en:{ruta:"/en/blog/what-we-claim-about-security"}},
 {id:"a8", tipo:"articulo", es:{ruta:"/blog/una-recomendacion-debe-poder-discutirse"}, en:{ruta:"/en/blog/a-recommendation-must-be-debatable"}},
]);
export const porId = (id) => PAGINAS.find((p) => p.id === id);
/** Ruta pública de una página en un idioma, o null si el id no existe. */
export const rutaDe = (id, lang) => porId(id)?.[lang]?.ruta ?? null;
const INDICE = new Map(PAGINAS.flatMap((p) => IDIOMAS.map((lang) => [p[lang].ruta, {id: p.id, lang}])));
/** Inversa de rutaDe: {id, lang} de una ruta pública exacta (sin barra final), o null. */
export const idDeRuta = (ruta) => INDICE.get(ruta) ?? null;
/** Todas las rutas públicas, en los dos idiomas. */
export const RUTAS = Object.freeze([...INDICE.keys()]);
