import type {Metadata} from 'next';
import {Landing, jsonLdLanding} from '../../../components/landing/landing';
import {idiomaActual} from '../../../lib/i18n/servidor';
import {traductor} from '../../../lib/i18n';
import {SITE, landingUrl} from '../../../lib/site.mjs';

/** Landing pública: indexable, con su propio canonical (rovaq.ai), Open Graph y Twitter. La app sigue noindex. En rovaq.ai la raíz se reescribe aquí (middleware); en el host de la app esta ruta existe pero su canonical apunta a rovaq.ai. */
export async function generateMetadata(): Promise<Metadata> {
  const idioma = await idiomaActual(), t = traductor(idioma), base = landingUrl();
  const titulo = t('landing.meta.titulo'), descripcion = t('landing.meta.descripcion');
  const imagen = `${base}/opengraph-image`;
  return {
    title: {absolute: titulo},
    description: descripcion,
    alternates: {canonical: `${base}/`},
    openGraph: {type: 'website', locale: idioma === 'es' ? 'es_MX' : 'en_US', siteName: SITE.nombre, title: titulo, description: descripcion, url: `${base}/`, images: [{url: imagen, width: SITE.og.ancho, height: SITE.og.alto, alt: SITE.og.alt, type: 'image/png'}]},
    twitter: {card: 'summary_large_image', title: titulo, description: descripcion, images: [{url: `${base}/twitter-image`, width: SITE.og.ancho, height: SITE.og.alto, alt: SITE.og.alt}]},
    robots: {index: true, follow: true},
  };
}

export default async function PaginaLanding() {
  const idioma = await idiomaActual();
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLdLanding()).replace(/</g, '\\u003c')}} />
    <Landing idioma={idioma} />
  </>;
}
