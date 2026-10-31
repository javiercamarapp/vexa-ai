// Datos estructurados (JSON-LD) del sitio público (T2). Un grafo por página con ids estables, construido con las mismas fichas del SEO.
// Reglas de verdad: sin precios ni ofertas, sin valoraciones, sin reseñas, sin clientes, sin cifras, sin nombre anterior y sin ningún correo.
// Hoy el único buzón que recibe correo es el de SITE.contacto: no se repite aquí. Cuando exista un buzón de dominio se añade un ContactPoint en organizacion().
// El texto de cada pregunta del FAQPage es idéntico al visible en la página: una pregunta cuya respuesta lleva una dirección de correo no entra al grafo.
import { landingUrl } from '../site.mjs';
import { HREFLANG, NOMBRE, urlAbsoluta, urlSocial } from './metadatos.mjs';
import { etiquetaDe } from './articulos.mjs';

/** Serialización segura para un script ld+json: escapa < para que ningún texto cierre la etiqueta. */
export const serializar = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

/** Medidas reales de public/brand/rovaq-logo-horizontal-positivo-600px.png (600 por 167). Una prueba las compara con el archivo. */
export const LOGO_HORIZONTAL = Object.freeze({ ruta: '/brand/rovaq-logo-horizontal-positivo-600px.png', ancho: 600, alto: 167 });
/** Ícono cuadrado de 512, el que Google prefiere como logotipo de la organización. */
export const LOGO_CUADRADO = Object.freeze({ ruta: '/icon-512.png', ancho: 512, alto: 512 });

export const ids = (base = landingUrl()) => ({
  org: `${base}/#organizacion`,
  sitio: `${base}/#sitio`,
  app: `${base}/#aplicacion`,
});

export function organizacion(base = landingUrl()) {
  return {
    '@type': 'Organization',
    '@id': ids(base).org,
    name: NOMBRE,
    alternateName: 'Rovaq',
    url: base,
    logo: { '@type': 'ImageObject', url: `${base}${LOGO_CUADRADO.ruta}`, width: LOGO_CUADRADO.ancho, height: LOGO_CUADRADO.alto },
    image: { '@type': 'ImageObject', url: `${base}${LOGO_HORIZONTAL.ruta}`, width: LOGO_HORIZONTAL.ancho, height: LOGO_HORIZONTAL.alto },
    // Sin email ni contactPoint (ver arriba). sameAs: solo perfiles que existan y que Javier confirme; hoy ninguno.
  };
}

export function sitioWeb(base = landingUrl()) {
  // Sin SearchAction: el sitio no tiene buscador.
  return { '@type': 'WebSite', '@id': ids(base).sitio, name: NOMBRE, url: base, inLanguage: [HREFLANG.es, HREFLANG.en], publisher: { '@id': ids(base).org } };
}

/** Descripción verdadera del producto: la misma del título de la portada. Sin offers, sin aggregateRating, sin featureList. */
export function aplicacion(lang, descripcion, base = landingUrl()) {
  return {
    '@type': 'SoftwareApplication',
    '@id': ids(base).app,
    name: NOMBRE,
    url: base,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: HREFLANG[lang],
    description: descripcion,
    image: urlSocial(lang, base),
    publisher: { '@id': ids(base).org },
  };
}

const TIPO_PAGINA = Object.freeze({ acerca: 'AboutPage', 'solicitar-acceso': 'ContactPage' });

/** WebPage de cualquier página; AboutPage y ContactPage donde corresponde. */
export function paginaWeb(ficha, lang, base = landingUrl()) {
  const url = urlAbsoluta(ficha.ruta[lang], base);
  return {
    '@type': TIPO_PAGINA[ficha.id] ?? 'WebPage',
    '@id': `${url}#pagina`,
    url,
    // La portada se nombra con su título de pestaña: su h1 es el titular blindado del hero, que lleva su subtítulo y su límite al lado y no debe viajar solo.
    name: ficha.id === 'inicio' ? ficha.titulo[lang] : ficha.h1[lang] || ficha.titulo[lang],
    description: ficha.descripcion[lang],
    inLanguage: HREFLANG[lang],
    isPartOf: { '@id': ids(base).sitio },
    primaryImageOfPage: { '@type': 'ImageObject', url: urlSocial(lang, base), width: 1200, height: 630 },
    ...(ficha.mod ? { dateModified: ficha.mod } : {}),
    ...(ficha.id !== 'inicio' ? { breadcrumb: { '@id': `${url}#migas` } } : {}),
  };
}

/** Migas Inicio, [padre], página. Solo cuenta páginas publicadas: un padre que no se publica no entra a la cadena. */
export function migas(ficha, lang, fichasPorId, base = landingUrl()) {
  const cadena = [];
  for (let f = ficha; f; f = f.padre ? fichasPorId.get(f.padre) : null) cadena.unshift(f);
  const inicio = fichasPorId.get('inicio');
  if (cadena[0].id !== 'inicio') cadena.unshift(inicio);
  const visibles = cadena.filter((f) => f.id === ficha.id || f.indexable);
  const nombre = (f) => (f.id === 'inicio' ? (lang === 'es' ? 'Inicio' : 'Home') : f.titulo[lang].split(' | ')[0]);
  return {
    '@type': 'BreadcrumbList',
    '@id': `${urlAbsoluta(ficha.ruta[lang], base)}#migas`,
    itemListElement: visibles.map((f, i) => ({ '@type': 'ListItem', position: i + 1, name: nombre(f), item: urlAbsoluta(f.ruta[lang], base) })),
  };
}

/** Preguntas publicables como FAQPage. `items` son las hojas ya proyectadas { q, a } del FAQ visible. Se excluye la que lleve un correo. */
export function preguntasFrecuentes(items) {
  const validas = items.filter(({ q, a }) => !/@/.test(`${q} ${a}`));
  return { '@type': 'FAQPage', mainEntity: validas.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
}

/** Artículo: solo con fecha real de publicación. Autor y editor son la organización, no una persona. */
export function articulo(ficha, lang, base = landingUrl()) {
  if (!ficha.pub) throw new Error(`El artículo ${ficha.id} no tiene fecha de publicación; no se emite BlogPosting`);
  const url = urlAbsoluta(ficha.ruta[lang], base);
  return {
    '@type': 'BlogPosting',
    '@id': `${url}#articulo`,
    headline: ficha.h1[lang],
    description: ficha.descripcion[lang],
    inLanguage: HREFLANG[lang],
    datePublished: ficha.pub,
    dateModified: ficha.mod ?? ficha.pub,
    mainEntityOfPage: url,
    image: urlSocial(lang, base),
    author: { '@id': ids(base).org },
    publisher: { '@id': ids(base).org },
    ...(etiquetaDe(ficha, lang) ? { articleSection: etiquetaDe(ficha, lang) } : {}),
    ...(ficha.palabras?.[lang] ? { wordCount: ficha.palabras[lang] } : {}),
    ...(ficha.lectura?.[lang] ? { timeRequired: `PT${ficha.lectura[lang]}M` } : {}),
  };
}

export function blog(ficha, lang, base = landingUrl()) {
  return { '@type': 'Blog', name: ficha.h1[lang] || ficha.titulo[lang], url: urlAbsoluta(ficha.ruta[lang], base), inLanguage: HREFLANG[lang], publisher: { '@id': ids(base).org } };
}

/**
 * Grafo completo de una página. `fichas` es el arreglo de construirFichas(); `faq` son las preguntas visibles ya proyectadas al idioma (solo portada).
 * Portada: Organization, WebSite, WebPage, SoftwareApplication y FAQPage. Resto: Organization, WebPage (o su subtipo), BreadcrumbList y, según el tipo, Blog o BlogPosting.
 */
export function grafoDePagina(id, lang, { fichas, faq = [] }, base = landingUrl()) {
  const porId = new Map(fichas.map((f) => [f.id, f]));
  const ficha = porId.get(id);
  if (!ficha) throw new Error(`Página desconocida: ${id}`);
  const g = [organizacion(base)];
  if (id === 'inicio') {
    g.push(sitioWeb(base), paginaWeb(ficha, lang, base), aplicacion(lang, ficha.descripcion[lang], base));
    const preguntas = preguntasFrecuentes(faq);
    if (preguntas.mainEntity.length > 0) g.push(preguntas);
  } else {
    g.push(paginaWeb(ficha, lang, base), migas(ficha, lang, porId, base));
    if (ficha.tipo === 'blog-indice') g.push(blog(ficha, lang, base));
    if (ficha.tipo === 'articulo') g.push(articulo(ficha, lang, base));
  }
  return { '@context': 'https://schema.org', '@graph': g };
}
