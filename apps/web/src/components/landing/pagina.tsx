import type {Metadata} from 'next';
import {Landing, jsonLdLanding} from './landing';
import {traductor, type Idioma} from '../../lib/i18n';
import {SITE, landingUrl} from '../../lib/site.mjs';

/** URL pública de cada idioma: español sin prefijo e inglés bajo /en. */
export const RUTA_PUBLICA: Record<Idioma, string> = {es: '/', en: '/en'};

/** Metadatos de la landing por idioma, sin leer cookies ni cabeceras: canonical propio, hreflang recíproco, Open Graph y Twitter. */
export function metadatosLanding(idioma: Idioma): Metadata {
  const t = traductor(idioma), base = landingUrl();
  const titulo = t('landing.meta.titulo'), descripcion = t('landing.meta.descripcion'), url = base + RUTA_PUBLICA[idioma];
  return {
    title: {absolute: titulo}, description: descripcion,
    alternates: {canonical: url, languages: {'es-MX': base + RUTA_PUBLICA.es, en: base + RUTA_PUBLICA.en, 'x-default': base + RUTA_PUBLICA.es}},
    openGraph: {type: 'website', locale: idioma === 'es' ? 'es_MX' : 'en_US', alternateLocale: idioma === 'es' ? ['en_US'] : ['es_MX'], siteName: SITE.nombre, title: titulo, description: descripcion, url, images: [{url: `${base}/opengraph-image`, width: SITE.og.ancho, height: SITE.og.alto, alt: SITE.og.alt, type: 'image/png'}]},
    twitter: {card: 'summary_large_image', title: titulo, description: descripcion, images: [{url: `${base}/twitter-image`, width: SITE.og.ancho, height: SITE.og.alto, alt: SITE.og.alt}]},
    robots: {index: true, follow: true},
  };
}

export function PaginaLandingIdioma({idioma}: {idioma: Idioma}) {
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLdLanding(landingUrl(), idioma)).replace(/</g, '\\u003c')}} />
    <Landing idioma={idioma} />
  </>;
}
