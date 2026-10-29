// SEO del sitio público (T2): fichas por página, metadatos de Next (título, descripción, canonical, hreflang, Open Graph, Twitter, robots),
// viewport con theme-color y direcciones de las imágenes sociales y de los espejos Markdown. Funciones puras: sin Next, sin lectura de archivos.
// Las fichas salen del registro K2 (rutas) y del contenido de T11 pasado por publicar(): una sola fuente para metadatos, JSON-LD, sitemap, llms y espejos.
// El contenido (landing y páginas) se entrega por parámetro porque lo cargan quienes pueden: Next (TypeScript) o las herramientas de Node (importación directa de .ts).
import { landingUrl } from '../site.mjs';
import { PAGINAS, porId } from '../../content/sitio/registro.mjs';
import { contextoPorDefecto, estadoPagina, publicar } from './marcadores.mjs';

export const NOMBRE = 'Rovaq AI';
export const IDIOMAS = Object.freeze(['es', 'en']);
/** hreflang e inLanguage: español de México e inglés. */
export const HREFLANG = Object.freeze({ es: 'es-MX', en: 'en' });
export const LOCALE_OG = Object.freeze({ es: 'es_MX', en: 'en_US' });
const OTRO = Object.freeze({ es: 'en', en: 'es' });

/** Texto alternativo de la imagen social, por idioma. Sin cifras ni afirmaciones. */
export const ALT_SOCIAL = Object.freeze({
  es: 'Rovaq AI: inteligencia de ingresos de posventa para negocios que venden por marketplaces',
  en: 'Rovaq AI: post-purchase revenue intelligence for businesses that sell on marketplaces',
});
/** Color de la barra del navegador: claro (hueso del sitio, --s-c-hueso) y oscuro (tinta). Mismos valores de tokens.css. */
export const THEME_COLOR = Object.freeze({ claro: '#F7F7F8', oscuro: '#0E0E10' });

// ---------------------------------------------------------------- direcciones

/** URL absoluta. Un solo criterio, el mismo que Next escribe en el HTML: ninguna barra final, tampoco en el origen pelado (https://rovaq.ai). */
export function urlAbsoluta(ruta, base = landingUrl()) {
  if (ruta === '/' || ruta === '') return base;
  return `${base}${ruta.length > 1 && ruta.endsWith('/') ? ruta.slice(0, -1) : ruta}`;
}
/** Imagen social 1200 por 630, una por idioma (generada en el build por la ruta /og/[archivo]). */
export const urlSocial = (lang, base = landingUrl()) => `${base}/og/${lang}.png`;
/**
 * Espejo Markdown. La portada vive en /index.md y /en/index.md (nombres estables que host-routing ya sirve como activos). Las demás páginas viven en
 * /s/md/<idioma>/<id>.<hash8>.md: con el hash en el nombre, como todo activo de /s/ (contrato K3), y declaradas en la sección md de public/s/manifest.json.
 * La URL estable de cualquier página es la propia página con Accept: text/markdown. `manifestMd` es manifest.md ({ 'es/hoy': { url } }).
 */
export function rutaEspejo(id, lang, manifestMd = {}) {
  if (id === 'inicio') return lang === 'es' ? '/index.md' : '/en/index.md';
  return manifestMd[`${lang}/${id}`]?.url ?? null;
}
export const urlEspejo = (id, lang, base = landingUrl(), manifestMd = {}) => {
  const ruta = rutaEspejo(id, lang, manifestMd);
  return ruta ? `${base}${ruta}` : null;
};
/** Fuentes RSS del blog, una por idioma. */
export const rutaRss = (lang) => (lang === 'es' ? '/blog/rss.xml' : '/en/blog/rss.xml');

// ---------------------------------------------------------------- fichas

/** El contenido de T11 identifica las páginas como producto/hoy o casos-de-uso/propietario; el registro K2, como hoy y propietario. */
export function idRegistroDe(idContenido) {
  if (idContenido === 'producto' || idContenido === 'casos-de-uso') return idContenido;
  const ultimo = String(idContenido).split('/').pop();
  if (!porId(ultimo)) throw new Error(`CONTENIDO_SIN_REGISTRO: ${idContenido}`);
  return ultimo;
}

/** Padre jerárquico de una página para las migas y el enlazado: producto y casos de uso cuelgan de su índice, los artículos del blog. */
export function padreDe(pagina) {
  if (pagina.tipo === 'producto') return 'producto';
  if (pagina.tipo === 'rol') return 'casos-de-uso';
  if (pagina.tipo === 'articulo') return 'blog';
  return null;
}

const bi = (h) => ({ es: h?.es ?? '', en: h?.en ?? '' });

/**
 * Ficha de cada página del registro. Una página es publicable si su contenido existe y estadoPagina() lo permite; la portada siempre.
 * Parámetros: landing (LANDING), paginas (PAGINAS_INTERNAS), aprobaciones (aprobaciones.json), fechas ({ id: 'AAAA-MM-DD' }, de config/sitio/fechas.json).
 * Devuelve [{ id, tipo, padre, publicable, motivos, indexable, ruta, titulo, descripcion, h1, mod, pub?, etiqueta?, arbol }].
 * `arbol` es el contenido ya publicado (marcadores resueltos, alternos aplicados, lo no publicable omitido), aún bilingüe; sirve a los espejos Markdown.
 */
export function construirFichas({ landing, paginas, aprobaciones, fechas = {}, ctx = contextoPorDefecto() }) {
  const porRegistro = new Map(paginas.map((p) => [idRegistroDe(p.id), p]));
  const portada = publicar(landing, { aprobaciones, ctx }).arbol;
  return PAGINAS.map((reg) => {
    const base = { id: reg.id, tipo: reg.tipo, padre: padreDe(reg), ruta: { es: reg.es.ruta, en: reg.en.ruta }, mod: fechas[reg.id] ?? fechas.inicio ?? null };
    if (reg.id === 'inicio') {
      const seo = portada.seo.pagina;
      return { ...base, publicable: true, motivos: [], indexable: true, titulo: bi(seo.titulo), descripcion: bi(seo.descripcion), h1: bi(portada.hero.titulo), arbol: portada };
    }
    const contenido = porRegistro.get(reg.id);
    if (!contenido) {
      return { ...base, publicable: false, motivos: ['sin contenido escrito'], indexable: false, titulo: { es: '', en: '' }, descripcion: { es: '', en: '' }, h1: { es: '', en: '' }, arbol: null };
    }
    const e = estadoPagina(contenido, { aprobaciones, ctx });
    const arbol = e.publicable ? publicar(contenido, { aprobaciones, ctx, prefijo: `paginas.${contenido.id}` }).arbol : null;
    return {
      ...base,
      publicable: e.publicable,
      motivos: e.motivos,
      indexable: e.publicable,
      titulo: bi(contenido.seo.titulo),
      descripcion: bi(contenido.seo.descripcion),
      h1: bi(contenido.h1),
      pub: contenido.pub ?? null,
      mod: contenido.mod ?? base.mod,
      etiqueta: contenido.etiqueta ?? null,
      arbol,
    };
  });
}

/** Fichas indexables (publicables). Son las únicas que entran al sitemap, a llms y a los espejos. */
export const fichasPublicas = (fichas) => fichas.filter((f) => f.indexable);

// ---------------------------------------------------------------- metadatos

/** alternates.languages: es-MX, en y x-default (hacia el español). Recíprocos por construcción: las dos páginas comparten ficha. */
export function alternos(ficha, base = landingUrl()) {
  return {
    [HREFLANG.es]: urlAbsoluta(ficha.ruta.es, base),
    [HREFLANG.en]: urlAbsoluta(ficha.ruta.en, base),
    'x-default': urlAbsoluta(ficha.ruta.es, base),
  };
}

const ROBOTS_INDEXABLE = Object.freeze({
  index: true,
  follow: true,
  googleBot: Object.freeze({ index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 }),
});
const ROBOTS_PENDIENTE = Object.freeze({ index: false, follow: false, nocache: true });

/**
 * Metadata de Next para una página del sitio. Acepta la ficha completa o solo { id, lang, titulo, descripcion, indexable }, que es lo que
 * conocen los componentes de página. Título absoluto, canonical absoluto, hreflang recíproco, Open Graph y Twitter por idioma con imagen de 1200 por 630.
 * `espejo` es la ruta de su espejo Markdown (rutaEspejo); sin ella no se anuncia. Una página no indexable lleva solo canonical y robots noindex: no declara hreflang hacia una página que no se indexa.
 */
export function metadatosSitio({ id, lang, titulo, descripcion, indexable = true, base = landingUrl(), espejo = null }) {
  const reg = porId(id);
  if (!reg) throw new Error(`Página desconocida en el registro: ${id}`);
  if (!IDIOMAS.includes(lang)) throw new Error(`Idioma desconocido: ${lang}`);
  const ficha = { ruta: { es: reg.es.ruta, en: reg.en.ruta } };
  const url = urlAbsoluta(ficha.ruta[lang], base);
  const imagen = { url: urlSocial(lang, base), width: 1200, height: 630, alt: ALT_SOCIAL[lang], type: 'image/png' };
  const esBlog = reg.tipo === 'blog-indice' || reg.tipo === 'articulo';
  const tipos = {};
  if (indexable && espejo) tipos['text/markdown'] = `${base}${espejo}`;
  if (esBlog) tipos['application/rss+xml'] = `${base}${rutaRss(lang)}`;
  return {
    metadataBase: new URL(base),
    title: { absolute: titulo },
    description: descripcion,
    applicationName: NOMBRE,
    alternates: {
      canonical: url,
      ...(indexable ? { languages: alternos(ficha, base) } : {}),
      ...(Object.keys(tipos).length ? { types: tipos } : {}),
    },
    openGraph: {
      type: reg.tipo === 'articulo' ? 'article' : 'website',
      siteName: NOMBRE,
      locale: LOCALE_OG[lang],
      alternateLocale: [LOCALE_OG[OTRO[lang]]],
      title: titulo,
      description: descripcion,
      url,
      images: [imagen],
    },
    twitter: { card: 'summary_large_image', title: titulo, description: descripcion, images: [{ url: imagen.url, width: 1200, height: 630, alt: imagen.alt }] },
    robots: indexable ? ROBOTS_INDEXABLE : ROBOTS_PENDIENTE,
    formatDetection: { telephone: false, email: false, address: false },
    manifest: '/sitio.webmanifest',
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: '48x48' },
        { url: '/favicon.svg', type: 'image/svg+xml' },
        { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
        { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
  };
}

/** Viewport del sitio: tema de la barra del navegador en claro y oscuro. */
export const viewportSitio = Object.freeze({
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark light',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLOR.claro },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLOR.oscuro },
  ],
});

/**
 * Entradas del sitemap de rovaq.ai: una por página indexable y por idioma, cada una con alternates es-MX, en y x-default.
 * lastModified es la fecha real del contenido (ficha.mod, de config/sitio/fechas.json), nunca la fecha de la petición ni la del build.
 * Sin changefreq ni priority: Google los ignora.
 */
export function entradasSitemap(fichas, base = landingUrl()) {
  return fichasPublicas(fichas).flatMap((f) =>
    IDIOMAS.map((lang) => ({
      url: urlAbsoluta(f.ruta[lang], base),
      ...(f.mod ? { lastModified: f.mod } : {}),
      alternates: { languages: alternos(f, base) },
    })),
  );
}
