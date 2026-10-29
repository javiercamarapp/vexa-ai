// Identidad pública de Rovaq AI (SEO, Open Graph, JSON-LD, robots, sitemap). Fuente única: nada de esto toca la interfaz.
// Dominio canónico: NEXT_PUBLIC_SITE_URL; sin ella (o inválida) se usa el host vigente de la aplicación.
export const SITE_URL_RESPALDO = 'https://app.rovaq.ai'; // host vigente de la aplicación (el host rovaq-ai.vercel.app es el antiguo y solo redirige)
export function siteUrl(env = process.env.NEXT_PUBLIC_SITE_URL) {
  try { const u = new URL(String(env ?? '').trim()); if (u.protocol === 'https:' || u.hostname === 'localhost') return u.origin; } catch { /* sin valor válido: respaldo */ }
  return SITE_URL_RESPALDO;
}
/** Origen público de la landing. NEXT_PUBLIC_LANDING_URL lo sobreescribe; sin valor válido, https://rovaq.ai. Es independiente de NEXT_PUBLIC_SITE_URL, que sigue siendo el origen de la aplicación. */
export const LANDING_URL_RESPALDO = 'https://rovaq.ai';
export function landingUrl(env = process.env.NEXT_PUBLIC_LANDING_URL) {
  try { const u = new URL(String(env ?? '').trim()); if (u.protocol === 'https:' || u.hostname === 'localhost') return u.origin; } catch { /* sin valor válido: respaldo */ }
  return LANDING_URL_RESPALDO;
}
/** Origen de la aplicación a la que enlaza la landing (inicio de sesión). */
export const APP_URL = 'https://app.rovaq.ai';
export const SITE = Object.freeze({
  nombre: 'Rovaq AI',
  corto: 'Rovaq',
  anteriorNombre: 'Vexa AI',
  titulo: 'Rovaq AI · Inteligencia de ingresos para negocios en marketplaces',
  descripcion: 'Rovaq AI es inteligencia de ingresos para negocios que venden por marketplaces: detecta fugas de ingreso, entiende a tus clientes y decide con evidencia.',
  idioma: 'es-MX',
  locale: 'es_MX',
  categoria: 'business',
  palabrasClave: ['inteligencia de ingresos', 'marketplaces', 'ecommerce', 'análisis de ventas', 'reembolsos', 'experiencia del cliente', 'decisiones con evidencia'],
  contacto: 'javiercamaraportepetit@gmail.com',
  og: Object.freeze({ ancho: 1200, alto: 630, alt: 'Rovaq AI: inteligencia de ingresos para negocios que venden por marketplaces' }),
});
/** Rutas públicas indexables (todo lo demás es privado). `/` redirige: a /login sin sesión y a /overview con sesión. */
export const RUTAS_PUBLICAS = Object.freeze(['/login']);
/** Prefijos privados: noindex + Disallow. Debe cubrir cada carpeta de src/app/(workspace) (lo verifica tests/seo-produccion.test.mjs). */
export const PREFIJOS_PRIVADOS = Object.freeze([
  '/api', '/auth', '/platform', '/seguridad', '/sin-acceso',
  '/analysis', '/briefs', '/cco', '/cfo', '/confianza', '/connections', '/customers', '/economics', '/evaluation', '/explorer', '/gaps', '/history', '/imports',
  '/interventions', '/jobs', '/map', '/migrations', '/notifications', '/overview', '/pain-points', '/preguntale', '/problems', '/recommendations', '/refunds',
  '/settings', '/setup', '/sources', '/workload',
]);
/** Metadatos de una página pública: canonical + Open Graph + Twitter coherentes (un `openGraph` hijo reemplaza al del layout, por eso se arma completo). */
export function metadatosPublicos({ titulo, descripcion = SITE.descripcion, ruta }) {
  const imagenes = [{ url: '/opengraph-image', width: SITE.og.ancho, height: SITE.og.alto, alt: SITE.og.alt, type: 'image/png' }];
  return {
    ...(titulo ? { title: titulo } : {}),
    description: descripcion,
    alternates: { canonical: ruta },
    openGraph: { type: 'website', locale: SITE.locale, siteName: SITE.nombre, title: titulo ? `${titulo} · ${SITE.nombre}` : SITE.titulo, description: descripcion, url: ruta, images: imagenes },
    twitter: { card: 'summary_large_image', title: titulo ? `${titulo} · ${SITE.nombre}` : SITE.titulo, description: descripcion, images: [{ url: '/twitter-image', width: SITE.og.ancho, height: SITE.og.alto, alt: SITE.og.alt }] },
    robots: { index: true, follow: true },
  };
}
/** JSON-LD de la página pública: Organization + SoftwareApplication. Sin ratings, precios ni clientes. */
export function jsonLd(base = siteUrl()) {
  const logo = `${base}/brand/rovaq-logo-horizontal-positivo-600px.png`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${base}/#organizacion`, name: SITE.nombre, alternateName: [SITE.corto, SITE.anteriorNombre], url: base, logo: { '@type': 'ImageObject', url: logo, width: 600, height: 168 }, description: SITE.descripcion },
      { '@type': 'SoftwareApplication', '@id': `${base}/#aplicacion`, name: SITE.nombre, url: `${base}/login`, applicationCategory: 'BusinessApplication', operatingSystem: 'Web', inLanguage: 'es-MX', description: SITE.descripcion, image: `${base}/opengraph-image`, publisher: { '@id': `${base}/#organizacion` } },
    ],
  };
}
/** Robots de las páginas privadas (espacio de trabajo, plataforma, acceso, seguridad). */
export const ROBOTS_PRIVADO = Object.freeze({ index: false, follow: false, nocache: true });
